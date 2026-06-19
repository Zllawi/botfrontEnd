function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/u, "");
}

function renderPublicLandingPage({ inviteUrl, oauthConfigured, sessionUser, backendUrl }) {
  const hasInvite = Boolean(inviteUrl);
  const loggedIn = Boolean(sessionUser?.id);
  const safeBackendUrl = normalizeBaseUrl(backendUrl);
  const loginUrl = safeBackendUrl
    ? `${safeBackendUrl}/auth/discord/login?returnTo=/dashboard`
    : "/auth/discord/login?returnTo=/dashboard";
  const dashboardUrl = safeBackendUrl ? `${safeBackendUrl}/dashboard` : "/dashboard";

  const inviteButton = hasInvite
    ? `<a class="btn" href="${escapeHtml(inviteUrl)}" target="_blank" rel="noopener noreferrer">دعوة البوت</a>`
    : `<span class="btn btn--disabled">رابط الدعوة غير متاح</span>`;

  const loginButton = oauthConfigured
    ? `<a class="btn btn--ghost" href="${escapeHtml(loginUrl)}">تسجيل الدخول</a>`
    : `<span class="btn btn--disabled">OAuth غير مفعّل</span>`;

  const dashboardButton = loggedIn
    ? `<a class="btn btn--primary" href="${escapeHtml(dashboardUrl)}">الذهاب إلى الداشبورد</a>`
    : loginButton;

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zllawi be honest | Home</title>
    <meta name="description" content="واجهة تعريف، دعوة، وتسجيل دخول لبوت Zllawi be honest." />
    <link rel="icon" type="image/png" href="/assets/zllawi-logo.png" />
    <style>
      :root {
        --bg0: #0b0a14;
        --bg1: #121027;
        --card: #1a1835;
        --line: rgba(167, 144, 255, 0.22);
        --ink0: #f6f3ff;
        --ink1: #d0c8ee;
        --ink2: #a096ca;
        --violet: #9a7cff;
        --shadow: 0 16px 38px rgba(0, 0, 0, 0.34);
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        min-height: 100%;
        color: var(--ink0);
        font-family: "Segoe UI", "Tajawal", "Noto Kufi Arabic", sans-serif;
        background:
          radial-gradient(980px 590px at 11% -12%, #3b3178 0%, transparent 50%),
          radial-gradient(770px 460px at 90% 0%, #322c66 0%, transparent 44%),
          linear-gradient(160deg, var(--bg0), #0f0d20 48%, var(--bg1));
      }
      .wrap {
        max-width: 1100px;
        margin: 0 auto;
        padding: 20px 14px 26px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .hero {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: linear-gradient(155deg, rgba(149, 122, 255, 0.12), rgba(26, 24, 54, 0.96));
        box-shadow: var(--shadow);
        padding: 18px;
      }
      .top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .brand img {
        width: 60px;
        height: 60px;
        border-radius: 15px;
        border: 1px solid rgba(190, 172, 255, 0.68);
        box-shadow: 0 10px 24px rgba(109, 83, 233, 0.34);
      }
      .brand h1 {
        margin: 0;
        font-size: 1.08rem;
      }
      .brand p {
        margin: 5px 0 0;
        color: var(--ink2);
        font-size: 0.84rem;
      }
      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .btn {
        display: inline-block;
        text-decoration: none;
        border: 1px solid transparent;
        border-radius: 11px;
        padding: 10px 14px;
        font-weight: 700;
        background: var(--violet);
        color: #190f3b;
      }
      .btn--ghost {
        background: rgba(155, 124, 255, 0.14);
        color: var(--ink0);
        border-color: var(--line);
      }
      .btn--primary {
        background: linear-gradient(120deg, #a88dff, #8f6eff);
      }
      .btn--disabled {
        background: rgba(255, 255, 255, 0.15);
        color: #d5cfee;
        cursor: not-allowed;
      }
      .lead {
        margin: 14px 0 0;
        color: var(--ink1);
        line-height: 1.9;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .card {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: linear-gradient(165deg, rgba(31, 28, 60, 0.96), rgba(27, 24, 54, 0.93));
        box-shadow: var(--shadow);
        padding: 14px;
      }
      .card h2 {
        margin: 0 0 10px;
        font-size: 1rem;
      }
      .card ul {
        margin: 0;
        padding-right: 18px;
        line-height: 1.9;
        color: var(--ink1);
        font-size: 0.87rem;
      }
      .hint {
        margin-top: 10px;
        color: var(--ink2);
        font-size: 0.82rem;
      }
      @media (max-width: 900px) {
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="hero">
        <div class="top">
          <div class="brand">
            <img src="/assets/zllawi-logo.png" alt="Zllawi Logo" />
            <div>
              <h1>Zllawi be honest</h1>
              <p>Discord Confession & Moderation Bot</p>
            </div>
          </div>
          <div class="actions">
            ${inviteButton}
            ${dashboardButton}
          </div>
        </div>
        <p class="lead">
          واجهة رسمية لتعريف البوت، دعوته إلى السيرفر، وتسجيل الدخول عبر Discord. بعد تسجيل الدخول
          تنتقل مباشرة إلى لوحة التحكم الخاصة بحسابك لإدارة إعدادات السيرفرات التي يتواجد فيها البوت.
        </p>
        ${
          loggedIn
            ? `<p class="hint">مسجل حالياً باسم: <strong>${escapeHtml(
                sessionUser.username || sessionUser.tag || "Discord User"
              )}</strong> - <a href="/auth/discord/logout" style="color:#cfc3ff;">تسجيل خروج</a></p>`
            : `<p class="hint">ابدأ بـ "تسجيل الدخول" ثم افتح الداشبورد لإدارة القنوات والإعدادات.</p>`
        }
      </section>

      <section class="grid">
        <article class="card">
          <h2>التحكم بالقنوات</h2>
          <ul>
            <li>تحديد قناة الاعترافات من القنوات النصية المتاحة.</li>
            <li>تحديد قناة السجلات الخاصة بالبوت.</li>
            <li>تحديد قناة تنبيهات الإشراف الذكي (AI Mod Logs).</li>
          </ul>
        </article>
        <article class="card">
          <h2>قائمة المساعدة</h2>
          <ul>
            <li><code>/setup</code> لتعيين قناة الاعترافات.</li>
            <li><code>/panel</code> لإرسال لوحة الإرسال داخل السيرفر.</li>
            <li><code>/ai-mod settings</code> لمراجعة إعدادات AI Moderation.</li>
            <li><code>/help</code> لعرض كل الأوامر المتاحة.</li>
          </ul>
        </article>
      </section>
    </main>
  </body>
</html>`;
}

module.exports = {
  renderPublicLandingPage
};
