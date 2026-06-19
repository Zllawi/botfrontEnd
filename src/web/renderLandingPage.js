function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderLandingPage({ inviteUrl }) {
  const hasInvite = Boolean(inviteUrl);
  const safeInviteUrl = hasInvite ? escapeHtml(inviteUrl) : "";

  const inviteButton = hasInvite
    ? `<a class="invite-btn" href="${safeInviteUrl}" target="_blank" rel="noopener noreferrer">دعوة البوت إلى سيرفرك</a>`
    : `<span class="invite-btn invite-btn--disabled">رابط الدعوة غير متاح</span>`;

  const inviteHint = hasInvite
    ? "اضغط الزر، اختر السيرفر، ثم أكمل صلاحيات البوت."
    : "أضف CLIENT_ID داخل ملف .env لتفعيل زر الدعوة.";

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zllawi be honest | واجهة البوت</title>
    <style>
      :root {
        --bg: #eef6f8;
        --card: #ffffff;
        --ink: #13242d;
        --muted: #4f6571;
        --primary: #0c8f7b;
        --primary-dark: #086a5b;
        --line: #d8e4e8;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Tahoma", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 15% 15%, #d5f1ea 0%, transparent 40%),
          radial-gradient(circle at 85% 0%, #d8ecff 0%, transparent 35%),
          var(--bg);
      }

      .wrapper {
        max-width: 920px;
        margin: 0 auto;
        padding: 48px 16px;
      }

      .hero {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 28px 24px;
        box-shadow: 0 8px 30px rgba(9, 42, 56, 0.08);
      }

      h1 {
        margin: 0;
        font-size: clamp(1.6rem, 3vw, 2.2rem);
        line-height: 1.3;
      }

      .lead {
        margin-top: 12px;
        color: var(--muted);
        line-height: 1.8;
      }

      .invite-box {
        margin-top: 24px;
        padding: 18px;
        background: #f7fbfc;
        border: 1px dashed #c7dde2;
        border-radius: 14px;
      }

      .invite-btn {
        display: inline-block;
        text-decoration: none;
        font-weight: 700;
        background: var(--primary);
        color: #ffffff;
        padding: 12px 20px;
        border-radius: 10px;
        transition: background 0.2s ease;
      }

      .invite-btn:hover {
        background: var(--primary-dark);
      }

      .invite-btn--disabled {
        background: #9eb3ba;
        cursor: not-allowed;
      }

      .hint {
        margin: 10px 0 0;
        color: var(--muted);
        font-size: 0.95rem;
      }

      .terms {
        margin-top: 24px;
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 24px;
      }

      h2 {
        margin-top: 0;
        font-size: 1.2rem;
      }

      ul {
        margin: 0;
        padding-right: 18px;
        line-height: 1.9;
        color: var(--ink);
      }

      footer {
        margin-top: 16px;
        color: var(--muted);
        font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <main class="wrapper">
      <section class="hero">
        <h1>واجهة بوت Zllawi be honest</h1>
        <p class="lead">
          بوت رسائل مجهولة داخل ديسكورد. من خلال هذه الصفحة يمكنك قراءة الشروط
          الأساسية ثم دعوة البوت مباشرة إلى سيرفرك.
        </p>

        <div class="invite-box">
          ${inviteButton}
          <p class="hint">${inviteHint}</p>
        </div>
      </section>

      <section class="terms">
        <h2>شروط الاستخدام</h2>
        <ul>
          <li>يُمنع استخدام البوت للإساءة أو التهديد أو نشر الكراهية.</li>
          <li>لا ترسل بيانات حساسة مثل كلمات المرور أو المعلومات البنكية.</li>
          <li>إدارة السيرفر مسؤولة عن طريقة استخدام البوت داخل مجتمعها.</li>
          <li>يمكن إيقاف الميزة أو حذف الرسائل المخالفة بدون إشعار مسبق.</li>
          <li>استخدامك للبوت يعني موافقتك على هذه الشروط.</li>
        </ul>
        <footer>آخر تحديث: 23 أبريل 2026</footer>
      </section>
    </main>
  </body>
</html>`;
}

module.exports = {
  renderLandingPage
};
