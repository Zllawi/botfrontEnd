function safeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function renderUserPortalPage({ bootstrap }) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zllawi be honest | User Portal</title>
    <meta
      name="description"
      content="واجهة المستخدم لإرسال ومتابعة الاعترافات في بوت Zllawi be honest"
    />
    <link rel="icon" type="image/png" href="/assets/zllawi-logo.png" />
    <link rel="stylesheet" href="/assets/user-portal.css" />
  </head>
  <body>
    <div id="portal-root" class="portal-root">
      <div class="loading-shell">
        <div class="loading-line w-40"></div>
        <div class="loading-line w-70"></div>
        <div class="loading-card"></div>
      </div>
    </div>

    <div id="portal-toast-container" class="toast-container" aria-live="polite"></div>

    <script>
      window.__USER_PORTAL_BOOTSTRAP__ = ${safeJsonForHtml(bootstrap)};
    </script>
    <script src="/assets/user-portal.js" charset="utf-8" defer></script>
  </body>
</html>`;
}

module.exports = {
  renderUserPortalPage
};
