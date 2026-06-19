const fs = require("fs");
const path = require("path");

const { renderPublicLandingPage } = require("../src/web/renderPublicLandingPage");

const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "src", "web", "public");
const distDir = path.join(rootDir, "dist");
const assetsDir = path.join(distDir, "assets");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(assetsDir, { recursive: true });
fs.cpSync(publicDir, assetsDir, { recursive: true });

const indexHtml = renderPublicLandingPage({
  inviteUrl: process.env.PUBLIC_INVITE_URL || "",
  oauthConfigured: Boolean(process.env.PUBLIC_BACKEND_URL),
  backendUrl: process.env.PUBLIC_BACKEND_URL || "",
  sessionUser: null
});

fs.writeFileSync(path.join(distDir, "index.html"), indexHtml);

const notFoundHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zllawi be honest | Not Found</title>
    <meta http-equiv="refresh" content="0; url=/" />
  </head>
  <body>
    <a href="/">Go home</a>
  </body>
</html>`;

fs.writeFileSync(path.join(distDir, "404.html"), notFoundHtml);

console.log("Built static site to dist/");
