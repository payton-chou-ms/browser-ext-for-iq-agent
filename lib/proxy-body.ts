import type http from "node:http";

export const MAX_BODY_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_JSON_BODY_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export function readBody(req: http.IncomingMessage, maxSize = MAX_BODY_SIZE_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", (chunk: Buffer | string) => {
      size += Buffer.byteLength(chunk);
      if (size > maxSize) {
        req.destroy();
        reject(new Error(`Request body too large (max ${Math.round(maxSize / 1024 / 1024)}MB)`));
        return;
      }
      body += chunk;
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function formatZodError(error: { issues: Array<{ path: Array<string | number>; message: string; code: string }> }) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export async function readJsonBody(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  jsonRes: (res: http.ServerResponse, status: number, data: unknown) => void,
  options: {
    schema?: {
      safeParse: (
        value: unknown
      ) => {
        success: boolean;
        data?: unknown;
        error?: { issues: Array<{ path: Array<string | number>; message: string; code: string }> };
      };
    };
    allowEmpty?: boolean;
  } = {},
): Promise<Record<string, unknown> | null> {
  const { schema, allowEmpty = false } = options;

  let raw: string;
  try {
    raw = await readBody(req, MAX_JSON_BODY_SIZE_BYTES);
  } catch (err) {
    jsonRes(res, 413, { ok: false, error: (err as Error).message });
    return null;
  }

  if (!raw || !raw.trim()) {
    if (!allowEmpty) {
      jsonRes(res, 400, { ok: false, error: "Request body is required" });
      return null;
    }

    if (!schema) return {};
    const emptyParsed = schema.safeParse({});
    if (!emptyParsed.success) {
      jsonRes(res, 400, { ok: false, error: "Invalid request body", details: formatZodError(emptyParsed.error!) });
      return null;
    }
    return emptyParsed.data as Record<string, unknown>;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    jsonRes(res, 400, { ok: false, error: `Invalid JSON: ${(err as Error).message}` });
    return null;
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    jsonRes(res, 400, { ok: false, error: "Request body must be a JSON object" });
    return null;
  }

  if (!schema) return parsed;

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    jsonRes(res, 400, {
      ok: false,
      error: "Invalid request body",
      details: formatZodError(validated.error!),
    });
    return null;
  }

  return validated.data as Record<string, unknown>;
}
