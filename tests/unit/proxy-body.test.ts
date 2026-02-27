import { EventEmitter } from "node:events";
import { describe, expect, test, vi } from "vitest";

import { readBody, readJsonBody } from "../../lib/proxy-body";

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
    const req = createReq(["x".repeat(2 * 1024 * 1024 + 1)]);
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
});
