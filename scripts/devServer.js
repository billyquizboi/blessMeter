/**
 * Static file server for local widget testing.
 *
 * Serves the repository root so v1/localTest.html can fetch widget.html,
 * widgetFields.json, and node_modules/jquery over an http origin. A file://
 * page gets an opaque origin, which blocks both fetch() and same-origin
 * scripting into the widget iframe.
 *
 * Usage: node scripts/devServer.js [--port 8080]
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HARNESS_PATH = "/v1/localTest.html";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function resolvePort() {
  const flagIndex = process.argv.indexOf("--port");
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return Number(process.argv[flagIndex + 1]);
  }
  return Number(process.env.PORT) || 8080;
}

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Cache-Control": "no-store" }, headers));
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname);
  } catch {
    send(res, 400, "Bad request", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  // Redirect rather than serve the harness at "/": the page resolves
  // widget.html and widget.js relative to its own URL, so it has to be loaded
  // from /v1/ or those requests land on the repository root and 404.
  if (pathname === "/" || pathname === "/v1" || pathname === "/v1/") {
    send(res, 302, "", { Location: HARNESS_PATH });
    return;
  }

  const filePath = path.join(ROOT, pathname);
  // Reject anything that escapes the repository root.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(res, 404, `Not found: ${pathname}`, { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    fs.readFile(filePath, (readError, content) => {
      if (readError) {
        send(res, 500, "Internal server error", { "Content-Type": "text/plain; charset=utf-8" });
        return;
      }
      const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      send(res, 200, content, { "Content-Type": contentType });
    });
  });
});

const port = resolvePort();
server.listen(port, () => {
  console.log(`Serving ${ROOT} at http://localhost:${port}`);
  console.log(`v1 test harness: http://localhost:${port}${HARNESS_PATH}`);
});

server.on("error", error => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Try: node scripts/devServer.js --port ${port + 1}`);
    process.exit(1);
  }
  throw error;
});
