const fs = require("fs");
const http = require("http");
const path = require("path");

const rootDir = path.join(__dirname, "..", "dist");
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://localhost:${port}`);
  const cleanPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const filePath = path.join(rootDir, cleanPath || "index.html");
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(path.resolve(rootDir))) {
    return path.join(rootDir, "404.html");
  }

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    return resolvedPath;
  }

  return path.join(rootDir, "index.html");
}

const server = http.createServer((req, res) => {
  const filePath = resolveRequestPath(req.url || "/");
  const extension = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Server error");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream"
    });
    res.end(content);
  });
});

server.listen(port, () => {
  console.log(`Frontend running at http://localhost:${port}`);
});
