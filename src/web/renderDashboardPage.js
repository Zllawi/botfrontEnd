function safeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function renderDashboardPage({ bootstrap, pages, componentBlueprint }) {
  return `<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zllawi be honest | Admin Dashboard</title>
    <meta
      name="description"
      content="Professional dashboard to manage the Zllawi be honest Discord bot"
    />
    <link rel="icon" type="image/png" href="/assets/zllawi-logo.png" />
    <link rel="stylesheet" href="/assets/dashboard.css" />
  </head>
  <body>
    <div id="dashboard-root" class="dashboard-root">
      <div class="boot-skeleton">
        <div class="boot-skeleton__sidebar"></div>
        <div class="boot-skeleton__content">
          <div class="skeleton-line w-40"></div>
          <div class="skeleton-line w-70"></div>
          <div class="skeleton-grid">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
          </div>
        </div>
      </div>
    </div>

    <div id="toast-container" class="toast-container" aria-live="polite"></div>

    <div id="confirm-modal" class="modal hidden" role="dialog" aria-modal="true">
      <div class="modal__backdrop" data-action="close-modal"></div>
      <div class="modal__panel">
        <h3 id="confirm-modal-title">Confirm Action</h3>
        <p id="confirm-modal-message">Are you sure you want to continue?</p>
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" data-action="close-modal">Cancel</button>
          <button type="button" class="btn btn--danger" id="confirm-modal-submit">Confirm</button>
        </div>
      </div>
    </div>

    <script>
      window.__DASHBOARD_BOOTSTRAP__ = ${safeJsonForHtml(bootstrap)};
      window.__DASHBOARD_PAGES__ = ${safeJsonForHtml(pages)};
      window.__DASHBOARD_COMPONENT_BLUEPRINT__ = ${safeJsonForHtml(componentBlueprint)};
    </script>
    <script src="/assets/dashboard.js" charset="utf-8" defer></script>
  </body>
</html>`;
}

module.exports = {
  renderDashboardPage
};
