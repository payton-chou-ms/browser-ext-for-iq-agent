import { EventEmitter } from "node:events";
import { describe, expect, test, vi } from "vitest";

import { readBody, readJsonBody } from "../../src/lib/proxy-body";

function createReq(chunks: string[] = []) {
  const req = new EventEmitter() as any;
  req.destroy = vi.fn();

  queueMicrotask(() => {
    for (const chunk of chunks) {
      req.emit("data", Buffer.from(chunk));
    }
    req.emit("end");
  });

  return req;
}

describe("proxy body helpers", () => {
  test("readBody concatenates chunks", async () => {
    const req = createReq(["{\"a\"",":1}"]);
    const body = await readBody(req);
    expect(body).toBe("{\"a\":1}");
  });

  test("readBody rejects when body exceeds max size", async () => {
    const req = new EventEmitter() as any;
    req.destroy = vi.fn();

    const promise = readBody(req, 4);
    req.emit("data", Buffer.from("12345"));

    await expect(promise).rejects.toThrow("Request body too large");
    expect(req.destroy).toHaveBeenCalledTimes(1);
  });

  test("readJsonBody returns 400 for invalid json", async () => {
    const req = createReq(["{invalid"]);
    const res = {} as any;
    const jsonRes = vi.fn();

    const parsed = await readJsonBody(req, res, jsonRes);

    expect(parsed).toBeNull();
    expect(jsonRes).toHaveBeenCalledWith(
      res,
      400,
      expect.objectContaining({ ok: false, error: expect.stringContaining("Invalid JSON") })
    );
  });

  test("readJsonBody returns 413 when JSON body exceeds size guard", async () => {
    const req = createReq(["x".repeat(10 * 1024 * 1024 + 1)]);
    const res = {} as any;
    const jsonRes = vi.fn();

    const parsed = await readJsonBody(req, res, jsonRes);

    expect(parsed).toBeNull();
    expect(jsonRes).toHaveBeenCalledWith(
      res,
      413,
      expect.objectContaining({ ok: false, error: expect.stringContaining("Request body too large") })
    );
  });

  test("readJsonBody rejects empty body when allowEmpty is false", async () => {
    const req = createReq(["   "]);
    const res = {} as any;
    const jsonRes = vi.fn();

    const parsed = await readJsonBody(req, res, jsonRes, { allowEmpty: false });

    expect(parsed).toBeNull();
    expect(jsonRes).toHaveBeenCalledWith(
      res,
      400,
      expect.objectContaining({ ok: false, error: "Request body is required" })
    );
  });

  test("readJsonBody returns empty object for allowEmpty without schema", async () => {
    const req = createReq([""]);
    const res = {} as any;
    const jsonRes = vi.fn();

    const parsed = await readJsonBody(req, res, jsonRes, { allowEmpty: true });

    expect(parsed).toEqual({});
    expect(jsonRes).not.toHaveBeenCalled();
  });

  test("readJsonBody rejects non-object JSON payloads", async () => {
    const req = createReq(["[]"]);
    const res = {} as any;
    const jsonRes = vi.fn();

    const parsed = await readJsonBody(req, res, jsonRes);

    expect(parsed).toBeNull();
    expect(jsonRes).toHaveBeenCalledWith(
      res,
      400,
      expect.objectContaining({ ok: false, error: "Request body must be a JSON object" })
    );
  });

  test("readJsonBody returns schema validation details", async () => {
    const req = createReq(["{}"]);
    const res = {} as any;
    const jsonRes = vi.fn();
    const schema = {
      safeParse: vi.fn(() => ({
        success: false,
        error: {
          issues: [
            { path: ["sessionId"], message: "Required", code: "invalid_type" },
          ],
        },
      })),
    };

    const parsed = await readJsonBody(req, res, jsonRes, { schema: schema as any });

    expect(parsed).toBeNull();
    expect(jsonRes).toHaveBeenCalledWith(
      res,
      400,
      expect.objectContaining({
        ok: false,
        error: "Invalid request body",
        details: [
          expect.objectContaining({ path: "sessionId", message: "Required", code: "invalid_type" }),
        ],
      })
    );
  });
});
