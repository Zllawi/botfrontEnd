(() => {
  const bootstrap = window.__USER_PORTAL_BOOTSTRAP__ || {};

  const state = {
    data: structuredClone(bootstrap),
    ui: {
      selectedGuildId: bootstrap.selectedGuildId || bootstrap.guilds?.[0]?.id || null,
      selectedCategory: bootstrap.categories?.[0]?.id || "general",
      loadingSubmissions: false,
      submissions: [],
      isSubmitting: false
    }
  };

  const root = document.getElementById("portal-root");
  const toastContainer = document.getElementById("portal-toast-container");

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function showToast(type, message) {
    const el = document.createElement("div");
    el.className = `toast ${type || "info"}`;
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function formatDate(value) {
    const date = new Date(value || Date.now());
    return date.toLocaleString("ar-LY", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getSelectedGuild() {
    return (state.data.guilds || []).find((item) => item.id === state.ui.selectedGuildId) || null;
  }

  function renderUserArea() {
    const auth = state.data.auth || {};
    if (!auth.loggedIn) {
      if (!auth.oauthConfigured) {
        return `
          <div class="notice warn">تسجيل الدخول غير متاح حالياً: إعدادات OAuth غير مكتملة في السيرفر.</div>
        `;
      }
      return `
        <a class="btn" href="/auth/discord/login?returnTo=/app">تسجيل الدخول عبر Discord</a>
      `;
    }

    const user = auth.user || {};
    return `
      ${
        user.avatarUrl
          ? `<img class="avatar" src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.username)}" />`
          : ""
      }
      <div>
        <div>${escapeHtml(user.username || "Discord User")}</div>
        <div class="muted">${escapeHtml(user.tag || "")}</div>
      </div>
      <a class="btn btn--ghost" href="/auth/discord/logout">تسجيل خروج</a>
    `;
  }

  function renderLoginView() {
    const auth = state.data.auth || {};
    return `
      <div class="shell">
        <header class="topbar">
          <div class="brand">
            <img class="brand__logo" src="/assets/zllawi-logo.png" alt="Zllawi Logo" />
            <div>
              <h1>Zllawi be honest</h1>
              <p>User Portal</p>
            </div>
          </div>
          <div class="user-area">
            ${renderUserArea()}
          </div>
        </header>

        <section class="card">
          <h2>بوابة المستخدم</h2>
          <p class="muted">
            من هذه الصفحة تقدر ترسل اعترافاتك وتتابع حالة الرسائل (تم النشر / مرفوض / قيد المراجعة).
          </p>
          ${
            auth.oauthConfigured
              ? `<a class="btn" href="/auth/discord/login?returnTo=/app">بدء تسجيل الدخول</a>`
              : `<div class="notice warn">المطور لازم يضيف متغيرات OAuth في ملف البيئة أولاً.</div>`
          }
        </section>
      </div>
    `;
  }

  function renderSubmissionRows() {
    const submissions = state.ui.submissions || [];
    if (!submissions.length) {
      return `<div class="empty">لا توجد عمليات إرسال سابقة لهذا السيرفر.</div>`;
    }

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الوقت</th>
              <th>الحالة</th>
              <th>التصنيف</th>
              <th>الملخص</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${submissions
              .map(
                (item) => `
                <tr>
                  <td>${escapeHtml(formatDate(item.createdAt))}</td>
                  <td>
                    <span class="status ${String(item.status || "").toLowerCase()}">
                      ${escapeHtml(item.statusLabel || item.status || "غير معروف")}
                    </span>
                  </td>
                  <td>${escapeHtml(item.categoryLabel || item.category || "-")}</td>
                  <td>${escapeHtml(item.preview || "-")}</td>
                  <td>${escapeHtml(item.reason || "-")}</td>
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderAppView() {
    const guild = getSelectedGuild();
    const limits = state.data.limits || {};

    return `
      <div class="shell">
        <header class="topbar">
          <div class="brand">
            <img class="brand__logo" src="/assets/zllawi-logo.png" alt="Zllawi Logo" />
            <div>
              <h1>Zllawi be honest</h1>
              <p>User Portal</p>
            </div>
          </div>
          <div class="user-area">
            ${renderUserArea()}
          </div>
        </header>

        <section class="layout">
          <article class="card">
            <h2>إرسال اعتراف</h2>
            <p class="muted">الرسالة تُرسل تلقائيًا إلى قناة الاعترافات المحددة في السيرفر.</p>

            ${
              !state.data.storageReady
                ? '<div class="notice warn">قاعدة البيانات غير متصلة حالياً. الإرسال ما زال يعمل لكن السجل قد لا يُحفظ.</div>'
                : ""
            }

            <div class="form-grid" style="margin-top:12px;">
              <div class="field">
                <label>السيرفر</label>
                <select id="guild-select">
                  ${(state.data.guilds || [])
                    .map(
                      (item) => `
                      <option value="${escapeHtml(item.id)}" ${
                        item.id === state.ui.selectedGuildId ? "selected" : ""
                      }>
                        ${escapeHtml(item.name)} ${item.confessionEnabled ? "" : "(غير مفعّل)"}
                      </option>
                    `
                    )
                    .join("")}
                </select>
              </div>
              <div class="field">
                <label>التصنيف</label>
                <select id="category-select">
                  ${(state.data.categories || [])
                    .map(
                      (item) => `
                      <option value="${escapeHtml(item.id)}" ${
                        item.id === state.ui.selectedCategory ? "selected" : ""
                      }>
                        ${escapeHtml(item.label)}
                      </option>
                    `
                    )
                    .join("")}
                </select>
              </div>
            </div>

            <div class="field" style="margin-top:10px;">
              <label>نص الرسالة</label>
              <textarea id="message-input" maxlength="${escapeHtml(limits.maxMessageLength || 500)}" placeholder="اكتب اعترافك هنا..."></textarea>
              <div class="muted">
                الحد الأقصى: ${escapeHtml(limits.maxMessageLength || 500)} حرف
                ${limits.cooldownSeconds ? `- كولداون: ${escapeHtml(limits.cooldownSeconds)} ثانية` : ""}
              </div>
            </div>

            <div class="field" style="margin-top:10px;">
              <label style="display:flex;align-items:center;gap:8px;">
                <input id="rules-accept" type="checkbox" style="width:auto;" />
                أوافق على القوانين قبل الإرسال
              </label>
            </div>

            <div style="margin-top:12px;">
              <button class="btn" id="submit-btn" ${!guild?.confessionEnabled ? "disabled" : ""}>
                ${state.ui.isSubmitting ? "جاري الإرسال..." : "إرسال الآن"}
              </button>
            </div>
          </article>

          <article class="card">
            <h3>قوانين الاستخدام</h3>
            <ul class="rule-list" style="margin-top:10px;">
              ${(state.data.rules || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
            <div class="notice info" style="margin-top:12px;">
              ${guild?.confessionEnabled ? "السيرفر المحدد جاهز للاستلام." : "هذا السيرفر غير مفعّل فيه قناة الاعترافات."}
            </div>
          </article>
        </section>

        <section class="card">
          <h3>سجل إرسالك</h3>
          <p class="muted">آخر الرسائل التي أرسلتها في السيرفر الحالي.</p>
          ${state.ui.loadingSubmissions ? '<div class="empty">جاري تحميل السجل...</div>' : renderSubmissionRows()}
        </section>
      </div>
    `;
  }

  function render() {
    const loggedIn = Boolean(state.data.auth?.loggedIn);
    root.innerHTML = loggedIn ? renderAppView() : renderLoginView();
    bindControls();
  }

  async function fetchSubmissions() {
    if (!state.data.auth?.loggedIn || !state.ui.selectedGuildId) return;
    state.ui.loadingSubmissions = true;
    render();

    try {
      const response = await fetch(
        `/api/app/submissions?guildId=${encodeURIComponent(state.ui.selectedGuildId)}`
      );
      const json = await response.json().catch(() => ({}));
      state.ui.submissions = Array.isArray(json?.submissions) ? json.submissions : [];
    } catch {
      state.ui.submissions = [];
      showToast("error", "فشل تحميل السجل.");
    } finally {
      state.ui.loadingSubmissions = false;
      render();
    }
  }

  async function submitForm() {
    if (state.ui.isSubmitting) return;

    const guildId = state.ui.selectedGuildId;
    const category = state.ui.selectedCategory;
    const messageInput = document.getElementById("message-input");
    const rulesAccept = document.getElementById("rules-accept");

    if (!guildId) {
      showToast("error", "اختر سيرفر أولاً.");
      return;
    }

    if (!rulesAccept?.checked) {
      showToast("error", "يجب الموافقة على القوانين قبل الإرسال.");
      return;
    }

    const content = String(messageInput?.value || "").trim();
    if (!content) {
      showToast("error", "الرسالة فارغة.");
      return;
    }

    state.ui.isSubmitting = true;
    render();

    try {
      const response = await fetch("/api/app/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          category,
          content
        })
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) {
        showToast("error", json?.error || "تعذر إرسال الرسالة.");
        return;
      }

      showToast("success", json?.message || "تم الإرسال.");
      if (messageInput) messageInput.value = "";
      if (rulesAccept) rulesAccept.checked = false;
      await fetchSubmissions();
    } catch {
      showToast("error", "تعذر الاتصال بالخادم.");
    } finally {
      state.ui.isSubmitting = false;
      render();
    }
  }

  function bindControls() {
    const guildSelect = document.getElementById("guild-select");
    if (guildSelect) {
      guildSelect.addEventListener("change", async (event) => {
        state.ui.selectedGuildId = event.target.value || null;
        await fetchSubmissions();
      });
    }

    const categorySelect = document.getElementById("category-select");
    if (categorySelect) {
      categorySelect.addEventListener("change", (event) => {
        state.ui.selectedCategory = event.target.value || "general";
      });
    }

    const submitBtn = document.getElementById("submit-btn");
    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        await submitForm();
      });
    }
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    const authDisabled = params.get("auth");

    render();

    if (authDisabled === "disabled") {
      showToast("error", "OAuth غير مفعّل على الخادم.");
    } else if (authError) {
      showToast("error", "تعذر تسجيل الدخول عبر Discord. حاول مرة أخرى.");
    }

    if (state.data.auth?.loggedIn && state.ui.selectedGuildId) {
      await fetchSubmissions();
    }
  }

  void init();
})();
