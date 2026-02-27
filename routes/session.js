import { approveAll } from "@github/copilot-sdk";
import { Schemas } from "./schemas.js";

export function registerSessionRoutes(routes, deps) {
  const {
    ensureClient,
    getSessionOrResume,
    sessions,
    jsonRes,
    readJsonBody,
    log,
    buildPromptWithAttachments,
    cors,
  } = deps;

  routes["POST /api/session/switch-model"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.switchModel });
    if (!body) return;

    const session = await getSessionOrResume(body.sessionId);
    if (!session) {
      jsonRes(res, 404, { ok: false, error: `Session ${body.sessionId} not found` });
      return;
    }

    try {
      const result = await session.rpc.model.switchTo({ modelId: body.modelId });
      log("MODEL", `[${body.sessionId.slice(0, 8)}] Switched to model: ${body.modelId}`, result);
      jsonRes(res, 200, { ok: true, modelId: result?.modelId || body.modelId });
    } catch (err) {
      log("WARN", `model.switchTo failed: ${err.message}`);
      jsonRes(res, 500, { ok: false, error: err.message });
    }
  };

  routes["POST /api/session/create"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionCreate, allowEmpty: true });
    if (!body) return;

    log("SESSION", "Creating session with config:", JSON.stringify(body));
    const c = await ensureClient();
    const config = {
      ...(body.model && { model: body.model }),
      ...(body.streaming !== undefined && { streaming: body.streaming }),
      ...(body.systemMessage && { systemMessage: { content: body.systemMessage } }),
      onPermissionRequest: approveAll,
    };

    const session = await c.createSession(config);
    const sid = session.sessionId;
    sessions.set(sid, session);

    log("SESSION", `Created session: ${sid}`);
    jsonRes(res, 200, { ok: true, sessionId: sid });
  };

  routes["POST /api/session/resume"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionIdOnly });
    if (!body) return;

    log("SESSION", `Resuming session: ${body.sessionId}`);
    const c = await ensureClient();
    const session = await c.resumeSession(body.sessionId, {
      onPermissionRequest: approveAll,
    });
    sessions.set(body.sessionId, session);
    jsonRes(res, 200, { ok: true, sessionId: body.sessionId });
  };

  routes["POST /api/session/list"] = async (_req, res) => {
    const c = await ensureClient();
    const list = await c.listSessions();
    jsonRes(res, 200, { ok: true, sessions: list });
  };

  routes["POST /api/session/delete"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionIdOnly });
    if (!body) return;

    const c = await ensureClient();
    await c.deleteSession(body.sessionId);
    sessions.delete(body.sessionId);

    log("SESSION", `Deleted session: ${body.sessionId}`);
    jsonRes(res, 200, { ok: true });
  };

  routes["POST /api/session/destroy"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionIdOnly });
    if (!body) return;

    const session = sessions.get(body.sessionId);
    if (session) {
      await session.destroy();
      sessions.delete(body.sessionId);
    }

    log("SESSION", `Destroyed session: ${body.sessionId}`);
    jsonRes(res, 200, { ok: true });
  };

  routes["POST /api/session/messages"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionIdOnly });
    if (!body) return;

    const session = await getSessionOrResume(body.sessionId);
    if (!session) {
      jsonRes(res, 404, { ok: false, error: `Session ${body.sessionId} not found` });
      return;
    }

    const messages = await session.getMessages();
    jsonRes(res, 200, { ok: true, messages });
  };

  routes["POST /api/session/sendAndWait"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionSend });
    if (!body) return;

    const session = await getSessionOrResume(body.sessionId);
    if (!session) {
      jsonRes(res, 404, { ok: false, error: `Session ${body.sessionId} not found` });
      return;
    }

    const fullPrompt = buildPromptWithAttachments(body.prompt, body.attachments);
    log("CHAT", `[${body.sessionId.slice(0, 8)}] sendAndWait: ${fullPrompt.slice(0, 100)}... (${body.attachments?.length || 0} files)`);
    const result = await session.sendAndWait({ prompt: fullPrompt });
    log("CHAT", `[${body.sessionId.slice(0, 8)}] Response received`);

    const content = result?.data?.content ?? "";
    const messageId = result?.data?.messageId ?? null;
    jsonRes(res, 200, {
      ok: true,
      content,
      messageId,
      type: result?.type ?? null,
      raw: result ? { type: result.type, data: result.data } : null,
    });
  };

  routes["POST /api/session/send"] = async (req, res) => {
    const body = await readJsonBody(req, res, { schema: Schemas.sessionSend });
    if (!body) return;

    const session = await getSessionOrResume(body.sessionId);
    if (!session) {
      jsonRes(res, 404, { ok: false, error: `Session ${body.sessionId} not found` });
      return;
    }

    const fullPrompt = buildPromptWithAttachments(body.prompt, body.attachments);
    log("CHAT", `[${body.sessionId.slice(0, 8)}] send (streaming): ${fullPrompt.slice(0, 100)}... (${body.attachments?.length || 0} files)`);

    cors(res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const sendSSE = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let finished = false;

    const unsubscribe = session.on((event) => {
      if (finished) return;
      log("SSE", `[${body.sessionId.slice(0, 8)}] event: ${event.type}`);
      sendSSE(event.type, event);

      if (event.type === "session.idle") {
        finished = true;
        sendSSE("done", { type: "done" });
        res.end();
        unsubscribe();
        log("SSE", `[${body.sessionId.slice(0, 8)}] stream finished (idle)`);
      }
    });

    req.on("close", () => {
      if (!finished) {
        log("SSE", `[${body.sessionId.slice(0, 8)}] client disconnected`);
        finished = true;
        unsubscribe();
      }
    });

    try {
      const msgId = await session.send({ prompt: fullPrompt });
      log("SSE", `[${body.sessionId.slice(0, 8)}] send() returned msgId: ${msgId}`);
    } catch (err) {
      log("ERROR", `[${body.sessionId.slice(0, 8)}] send() error:`, err.message);
      if (!finished) {
        finished = true;
        sendSSE("error", { type: "error", message: err.message });
        res.end();
        unsubscribe();
      }
    }
  };
}
