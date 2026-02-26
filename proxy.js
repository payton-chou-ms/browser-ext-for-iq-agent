#!/usr/bin/env node
// ===== IQ Copilot HTTP ↔ TCP Proxy =====
// Bridges HTTP requests from the browser extension to the Copilot CLI TCP server.
//
// Usage:
//   node proxy.js [--cli-port 4321] [--http-port 8321]
//
// The Copilot CLI uses raw TCP with LSP-style Content-Length framing.
// This proxy accepts HTTP POST /jsonrpc and forwards to the CLI server.

const http = require("http");
const net = require("net");

const args = process.argv.slice(2);
const cliPort = parseInt(getArg(args, "--cli-port") || "4321");
const httpPort = parseInt(getArg(args, "--http-port") || "8321");

function getArg(args, name) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

// Send a JSON-RPC message over TCP with Content-Length framing
function sendTcpRpc(host, port, jsonStr) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(30000);

    let buffer = Buffer.alloc(0);
    let headerParsed = false;
    let contentLength = -1;

    sock.connect(port, host, () => {
      const header = `Content-Length: ${Buffer.byteLength(jsonStr)}\r\n\r\n`;
      sock.write(header + jsonStr);
    });

    sock.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      if (!headerParsed) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          const header = buffer.slice(0, headerEnd).toString();
          const match = header.match(/Content-Length:\s*(\d+)/i);
          if (match) {
            contentLength = parseInt(match[1]);
            buffer = buffer.slice(headerEnd + 4);
            headerParsed = true;
          }
        }
      }

      if (headerParsed && buffer.length >= contentLength) {
        const body = buffer.slice(0, contentLength).toString();
        sock.destroy();
        resolve(body);
      }
    });

    sock.on("timeout", () => {
      sock.destroy();
      reject(new Error("TCP timeout"));
    });

    sock.on("error", (err) => {
      reject(err);
    });

    sock.on("close", () => {
      if (!headerParsed || buffer.length < contentLength) {
        // Might have partial data
        if (buffer.length > 0) {
          resolve(buffer.toString());
        }
      }
    });
  });
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", cliPort, httpPort }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      // Validate JSON
      JSON.parse(body);

      const result = await sendTcpRpc("localhost", cliPort, body);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(result);
    } catch (err) {
      const errorResponse = JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: err.message || "Proxy error",
        },
      });
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(errorResponse);
    }
  });
});

server.listen(httpPort, "127.0.0.1", () => {
  console.log(`\n✦ IQ Copilot Proxy`);
  console.log(`  HTTP  → http://127.0.0.1:${httpPort}/jsonrpc`);
  console.log(`  TCP   → localhost:${cliPort} (Copilot CLI)`);
  console.log(`  Health → http://127.0.0.1:${httpPort}/health\n`);
});
