(() => {
  const bootstrap = window.__DASHBOARD_BOOTSTRAP__ || {};
  const pages = window.__DASHBOARD_PAGES__ || [];
  const componentBlueprint = window.__DASHBOARD_COMPONENT_BLUEPRINT__ || {};

  const state = {
    data: structuredClone(bootstrap),
    ui: {
      activePage: pages[0]?.id || "home",
      activityRange: "weekly",
      selectedGuildId: bootstrap?.forms?.serverSettings?.[0]?.guildId || null,
      logsPage: 1,
      logsPerPage: 7,
      logsSearch: "",
      logsStatus: "ALL",
      logsCategory: "ALL",
      isLoading: true,
      mobileNavOpen: false,
      isSavingServerSettings: false,
      isSavingSettings: false,
      isRefreshingDeveloper: false,
      isUpdatingDeveloperPoints: false,
      developerUsageExpanded: false,
      developerGuildActionById: {},
      isRefreshingBotControl: false,
      isBotControlBusy: false,
      developerPointsForm: {
        guildId: bootstrap?.forms?.serverSettings?.[0]?.guildId || "",
        targetUserId: "",
        action: "reward",
        amount: "",
        reason: ""
      },
      categoriesDraftByGuild: {},
      homeRecentConfessionsExpanded: false
    }
  };

  const root = document.getElementById("dashboard-root");
  const toastContainer = document.getElementById("toast-container");
  const modal = document.getElementById("confirm-modal");
  const modalTitle = document.getElementById("confirm-modal-title");
  const modalMessage = document.getElementById("confirm-modal-message");
  const modalSubmit = document.getElementById("confirm-modal-submit");
  const pendingConfirm = { action: null };
  const HEALTH_POLL_INTERVAL_MS = 15000;
  const MOBILE_NAV_BREAKPOINT_PX = 700;
  const SETTINGS_PAGES = new Set([
    "server-settings",
    "categories",
    "moderation",
    "ai-settings",
    "branding",
    "language",
    "welcome",
    "levels",
    "economy",
    "panel-editor",
    "announcements"
  ]);
  const GUILD_SCOPED_FORM_KEYS = {
    categories: "categoriesByGuild",
    moderation: "moderationByGuild",
    "ai-settings": "aiByGuild",
    branding: "brandingByGuild",
    language: "languageByGuild",
    welcome: "welcomeByGuild",
    levels: "levelsByGuild",
    economy: "economyByGuild",
    "panel-editor": "panelEditorByGuild",
    announcements: "announcementsByGuild"
  };
  let healthPollTimer = null;
  let isEconomyCardStatusRefreshing = false;
  const AR_TRANSLATIONS = {
    Dashboard: "لوحة التحكم",
    Home: "الرئيسية",
    "Server Settings": "إعدادات السيرفر",
    Categories: "التصنيفات",
    Moderation: "الإشراف",
    "AI Settings": "إعدادات الذكاء الاصطناعي",
    "Logs & Confessions": "السجلات والاعترافات",
    Analytics: "التحليلات",
    "Branding & Appearance": "الهوية والمظهر",
    Language: "اللغة",
    Welcome: "الترحيب",
    Help: "المساعدة",
    Menu: "القائمة",
    Logout: "تسجيل الخروج",
    "Reload Data": "تحديث البيانات",
    "Current Server": "السيرفر الحالي",
    "No linked servers": "لا توجد سيرفرات مرتبطة",
    "No servers available": "لا توجد سيرفرات متاحة",
    "Switch to Arabic": "التبديل إلى العربية",
    "Switch to English": "التبديل إلى الإنجليزية",
    "Save Changes": "حفظ التغييرات",
    "Reset Settings": "إعادة الضبط",
    "No changes to save.": "لا توجد تغييرات للحفظ.",
    "No server selected.": "لم يتم اختيار سيرفر.",
    "Failed to connect to server API.": "فشل الاتصال بواجهة الخادم.",
    "Database is good": "قاعدة البيانات بحالة جيدة",
    "Branding & Appearance Settings": "إعدادات الهوية والمظهر",
    "Language Settings": "إعدادات اللغة",
    "Welcome Settings": "إعدادات الترحيب",
    "Enable Welcome": "تفعيل الترحيب",
    "Welcome Channel": "روم الترحيب",
    "Welcome Message": "رسالة الترحيب",
    "Welcome Background Image": "صورة خلفية الترحيب",
    "Mention New Member": "منشن العضو الجديد",
    "Language switched to EN.": "تم تغيير اللغة إلى الإنجليزية.",
    "Language switched to AR.": "تم تغيير اللغة إلى العربية.",
    "Welcome join events need Server Members Intent.": "تنبيهات دخول الأعضاء تحتاج Server Members Intent.",
    "Enable intent in Discord Developer Portal, set ENABLE_GUILD_MEMBERS_INTENT=true, then restart backend.": "فعّل intent من Discord Developer Portal، ثم اضبط ENABLE_GUILD_MEMBERS_INTENT=true وأعد تشغيل الباك اند.",
    "Welcome join events require Server Members Intent. Enable it in Discord Developer Portal, set ENABLE_GUILD_MEMBERS_INTENT=true, then restart backend.": "تنبيهات الترحيب عند الدخول تتطلب Server Members Intent. فعّله في Discord Developer Portal، ثم اضبط ENABLE_GUILD_MEMBERS_INTENT=true وأعد تشغيل الباك اند.",
    "Welcome join events are disabled because Guild Members intent is off. Enable it and restart backend.": "تنبيهات الترحيب متوقفة لأن Guild Members intent غير مفعّل. فعّله ثم أعد تشغيل الباك اند."
  };
  const AR_TRANSLATION_KEYS = Object.keys(AR_TRANSLATIONS).sort((a, b) => b.length - a.length);

  const DEFAULT_CATEGORIES = [
    { id: "general", name: "General", color: "#7c5cff", icon: "hashtag", active: true, order: 1 }
  ];
  const DEFAULT_MODERATION_FORM = {
    badWordsFilterEnabled: true,
    aiModerationEnabled: false,
    toxicityThreshold: 70,
    spamDetectionEnabled: true,
    linkRestrictionEnabled: false,
    imageRestrictionEnabled: false,
    autoRejectEnabled: false,
    badWordsText: ""
  };
  const DEFAULT_AI_FORM = {
    integrationStatus: "LIMITED",
    provider: "OpenAI",
    aiAutoReply: false,
    smartSuggestions: true,
    creativity: 45,
    strictness: 72,
    moderationPrompt: "Classify confession risk and provide safe moderation action.",
    conversationPrompt: "Generate concise, respectful, and neutral suggestions."
  };
  const DEFAULT_BRANDING_FORM = {
    embedColor: "#7c5cff",
    botFooter: "Zllawi be honest",
    successMessage: "Message sent successfully",
    errorMessage: "Failed to send message",
    uiTheme: "dark-violet"
  };
  const DEFAULT_LANGUAGE_FORM = {
    language: "en"
  };
  const DEFAULT_WELCOME_FORM = {
    enabled: false,
    channelId: "",
    message: "Welcome {user} to {server}!",
    backgroundImage: "asset://welcome-default.png",
    mentionUser: true,
    overlayText: "",
    overlayTextSize: 100,
    overlayTextX: 73,
    overlayTextY: 50,
    avatarScale: 100,
    avatarX: 30.2,
    avatarY: 48.8,
    imageFilter: "none",
    roleFilters: []
  };
  const DEFAULT_LEVELS_FORM = {
    enabled: true,
    minXp: 10,
    maxXp: 20,
    cooldownSeconds: 60,
    imageFilter: "none",
    roleFilters: [],
    cardTemplate: "blue",
    roleCardTemplates: [],
    avatarScale: 100,
    usernameScale: 100,
    statsScale: 100,
    rewards: []
  };
  const DEFAULT_ECONOMY_FORM = {
    enabled: true,
    shopChannelId: "",
    purchaseLogChannelId: "",
    messagePoints: 2,
    messageCooldownSeconds: 45,
    messageDailyLimit: 250,
    voicePointsPerMinute: 1,
    voiceDailyLimit: 200,
    reactionReceivedPoints: 1,
    reactionDailyLimit: 100,
    dailyRewardAmount: 75,
    dailyEarningLimit: 500,
    purchaseTaxPercent: 0,
    purchaseCooldownSeconds: 30,
    roleDurationDays: 0,
    allowedRoleIds: [],
    exclusiveRoleIds: [],
    blockedBuyerRoleIds: [],
    shopItems: []
  };
  const DEFAULT_PANEL_EDITOR_FORM = {
    title: "",
    description: "",
    buttonLabel: "",
    imageUrl: "",
    thumbnailUrl: "",
    footerText: "",
    accentColor: "",
    hasStoredUploadedImage: false
  };
  const DEFAULT_ANNOUNCEMENTS_FORM = {
    channelId: "",
    title: "",
    message: "",
    imageUrl: "",
    mentionEveryone: false,
    poll: {
      responseChannelId: "",
      durationMinutes: 60,
      allowTextResponses: true,
      choicesText: ""
    },
    giveaway: {
      responseChannelId: "",
      durationMinutes: 60,
      prize: "",
      winnersCount: 1
    }
  };
  const WELCOME_IMAGE_FILTER_OPTIONS = [
    "none",
    "pink",
    "rose",
    "blue",
    "purple",
    "teal",
    "gold",
    "green",
    "red",
    "mono",
    "sunset",
    "royal"
  ];
  const WELCOME_IMAGE_FILTER_LABELS = {
    none: "Original",
    pink: "Pink",
    rose: "Rose",
    blue: "Blue",
    purple: "Purple",
    teal: "Teal",
    gold: "Gold",
    green: "Green",
    red: "Red",
    mono: "Monochrome",
    sunset: "Sunset",
    royal: "Royal"
  };
  const LEVEL_FILTER_ACCENT_COLORS = Object.freeze({
    pink: "#ff76c8",
    rose: "#ff6aa8",
    blue: "#7ab4ff",
    purple: "#9f87ff",
    teal: "#59d5ca",
    gold: "#ffd07b",
    green: "#7bd68e",
    red: "#ff7b7b",
    mono: "#d8e1ee",
    sunset: "#ff9f72",
    royal: "#8ea3ff"
  });
  const LEVEL_CARD_TEMPLATE_OPTIONS = ["blue", "pink"];
  const LEVEL_CARD_TEMPLATE_LABELS = {
    blue: "Blue Overlay",
    pink: "Pink Overlay"
  };
  const LEVEL_CARD_TEMPLATE_ASSET_MAP = {
    blue: "/assets/levels-blue.png",
    pink: "/assets/levels-pink.png"
  };

  function cloneData(value) {
    return structuredClone(value);
  }

  function parseBooleanSetting(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(normalized)) return true;
      if (["0", "false", "no", "off"].includes(normalized)) return false;
    }
    if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
    if (value === null || value === undefined) return fallback;
    return Boolean(value);
  }

  function parsePositiveIntSetting(value, fallback = 50) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
    return fallback;
  }

  function normalizeEngagementDurationMinutes(value, fallback = 60) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(60 * 24 * 14, Math.trunc(parsed)));
  }

  function normalizeAnnouncementForm(value = {}) {
    const poll = value?.poll && typeof value.poll === "object" ? value.poll : {};
    const giveaway = value?.giveaway && typeof value.giveaway === "object" ? value.giveaway : {};
    return {
      channelId: String(value.channelId || ""),
      title: String(value.title || "").trim().slice(0, 180),
      message: String(value.message || "").trim().slice(0, 1900),
      imageUrl: String(value.imageUrl || "").trim().slice(0, 500),
      mentionEveryone: Boolean(value.mentionEveryone),
      poll: {
        responseChannelId: String(poll.responseChannelId || ""),
        durationMinutes: normalizeEngagementDurationMinutes(poll.durationMinutes, 60),
        allowTextResponses: poll.allowTextResponses !== false,
        choicesText: String(poll.choicesText || "").trim().slice(0, 900)
      },
      giveaway: {
        responseChannelId: String(giveaway.responseChannelId || ""),
        durationMinutes: normalizeEngagementDurationMinutes(giveaway.durationMinutes, 60),
        prize: String(giveaway.prize || "").trim().slice(0, 180),
        winnersCount: Math.max(1, Math.min(10, parsePositiveIntSetting(giveaway.winnersCount, 1)))
      }
    };
  }

  const SERVER_LOG_ALERT_KEYS = [
    "confessionSender",
    "guildUpdates",
    "channelUpdates",
    "roleUpdates",
    "stickerUpdates",
    "emojiUpdates"
  ];

  function normalizeServerSettingsList(list) {
    if (!Array.isArray(list)) return [];
    const normalized = [];

    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const guildId = String(item.guildId || "").trim();
      if (!guildId) continue;

      item.guildId = guildId;
      item.confessionChannelId = item.confessionChannelId ? String(item.confessionChannelId) : null;
      item.panelChannelId = item.panelChannelId ? String(item.panelChannelId) : null;
      item.logsChannelId = item.logsChannelId ? String(item.logsChannelId) : null;
      item.moderationChannelId = item.moderationChannelId ? String(item.moderationChannelId) : null;
      item.botEnabled = parseBooleanSetting(item.botEnabled, true);
      item.developerBlocked = parseBooleanSetting(item.developerBlocked, false);
      item.anonymousPosting = parseBooleanSetting(item.anonymousPosting, true);
      item.repliesEnabled = parseBooleanSetting(item.repliesEnabled, true);
      item.aiModerationEnabled = parseBooleanSetting(item.aiModerationEnabled, false);
      item.dailyMessageQuota = parsePositiveIntSetting(item.dailyMessageQuota, 50);
      item.dailyMessageUsed = parsePositiveIntSetting(item.dailyMessageUsed, 0);
      item.dailyMessageRemaining = Math.max(item.dailyMessageQuota - item.dailyMessageUsed, 0);
      item.logAlertSettings = normalizeServerLogAlertSettings(item.logAlertSettings || {});

      normalized.push(item);
    }

    return normalized;
  }

  function updateServerSettingsState(guildId, patch = {}) {
    ensureGuildScopedFormMaps();
    const list = Array.isArray(state.data.forms?.serverSettings) ? state.data.forms.serverSettings : [];
    const index = list.findIndex((item) => String(item?.guildId || "") === String(guildId || ""));
    if (index < 0) return null;

    const current = list[index] || {};
    const next = {
      ...current,
      ...patch,
      guildId: String(current.guildId || guildId || "").trim()
    };

    if (Object.prototype.hasOwnProperty.call(next, "logAlertSettings")) {
      next.logAlertSettings = normalizeServerLogAlertSettings(next.logAlertSettings || {});
    }

    list[index] = next;
    state.data.forms.serverSettings = list;
    return next;
  }

  function ensureGuildScopedFormMaps() {
    if (!state.data || typeof state.data !== "object") state.data = {};
    if (!state.data.forms || typeof state.data.forms !== "object") state.data.forms = {};

    const forms = state.data.forms;
    forms.serverSettings = normalizeServerSettingsList(forms.serverSettings);
    const guildIds = forms.serverSettings.map((item) => item.guildId);

    if (!state.ui.selectedGuildId || !guildIds.includes(state.ui.selectedGuildId)) {
      state.ui.selectedGuildId = guildIds[0] || null;
    }

    const fallbackCategories =
      Array.isArray(forms.categories) && forms.categories.length ? forms.categories : DEFAULT_CATEGORIES;
    const fallbackModeration =
      forms.moderation && typeof forms.moderation === "object" ? forms.moderation : DEFAULT_MODERATION_FORM;
    const fallbackAi = forms.ai && typeof forms.ai === "object" ? forms.ai : DEFAULT_AI_FORM;
    const fallbackBranding =
      forms.branding && typeof forms.branding === "object" ? forms.branding : DEFAULT_BRANDING_FORM;
    const fallbackLanguage =
      forms.language && typeof forms.language === "object" ? forms.language : DEFAULT_LANGUAGE_FORM;
    const fallbackWelcome =
      forms.welcome && typeof forms.welcome === "object" ? forms.welcome : DEFAULT_WELCOME_FORM;
    const fallbackLevels =
      forms.levels && typeof forms.levels === "object" ? forms.levels : DEFAULT_LEVELS_FORM;
    const fallbackEconomy =
      forms.economy && typeof forms.economy === "object" ? forms.economy : DEFAULT_ECONOMY_FORM;
    const fallbackPanelEditor =
      forms.panelEditor && typeof forms.panelEditor === "object"
        ? forms.panelEditor
        : DEFAULT_PANEL_EDITOR_FORM;
    const fallbackAnnouncements = normalizeAnnouncementForm(
      forms.announcements && typeof forms.announcements === "object"
        ? forms.announcements
        : DEFAULT_ANNOUNCEMENTS_FORM
    );

    if (!forms.categoriesByGuild || typeof forms.categoriesByGuild !== "object") {
      forms.categoriesByGuild = {};
    }
    if (!forms.moderationByGuild || typeof forms.moderationByGuild !== "object") {
      forms.moderationByGuild = {};
    }
    if (!forms.aiByGuild || typeof forms.aiByGuild !== "object") {
      forms.aiByGuild = {};
    }
    if (!forms.brandingByGuild || typeof forms.brandingByGuild !== "object") {
      forms.brandingByGuild = {};
    }
    if (!forms.languageByGuild || typeof forms.languageByGuild !== "object") {
      forms.languageByGuild = {};
    }
    if (!forms.welcomeByGuild || typeof forms.welcomeByGuild !== "object") {
      forms.welcomeByGuild = {};
    }
    if (!forms.levelsByGuild || typeof forms.levelsByGuild !== "object") {
      forms.levelsByGuild = {};
    }
    if (!forms.economyByGuild || typeof forms.economyByGuild !== "object") {
      forms.economyByGuild = {};
    }
    if (!forms.panelEditorByGuild || typeof forms.panelEditorByGuild !== "object") {
      forms.panelEditorByGuild = {};
    }
    if (!forms.announcementsByGuild || typeof forms.announcementsByGuild !== "object") {
      forms.announcementsByGuild = {};
    }

    for (const guildId of guildIds) {
      if (!Array.isArray(forms.categoriesByGuild[guildId])) {
        forms.categoriesByGuild[guildId] = cloneData(fallbackCategories);
      }
      if (!forms.moderationByGuild[guildId] || typeof forms.moderationByGuild[guildId] !== "object") {
        forms.moderationByGuild[guildId] = cloneData(fallbackModeration);
      }
      if (!forms.aiByGuild[guildId] || typeof forms.aiByGuild[guildId] !== "object") {
        forms.aiByGuild[guildId] = cloneData(fallbackAi);
      }
      if (!forms.brandingByGuild[guildId] || typeof forms.brandingByGuild[guildId] !== "object") {
        forms.brandingByGuild[guildId] = cloneData(fallbackBranding);
      }
      if (!forms.languageByGuild[guildId] || typeof forms.languageByGuild[guildId] !== "object") {
        forms.languageByGuild[guildId] = cloneData(fallbackLanguage);
      }
      if (!forms.welcomeByGuild[guildId] || typeof forms.welcomeByGuild[guildId] !== "object") {
        forms.welcomeByGuild[guildId] = cloneData(fallbackWelcome);
      }
      if (!forms.levelsByGuild[guildId] || typeof forms.levelsByGuild[guildId] !== "object") {
        forms.levelsByGuild[guildId] = cloneData(fallbackLevels);
      }
      if (!forms.economyByGuild[guildId] || typeof forms.economyByGuild[guildId] !== "object") {
        forms.economyByGuild[guildId] = cloneData(fallbackEconomy);
      }
      if (
        !forms.panelEditorByGuild[guildId] ||
        typeof forms.panelEditorByGuild[guildId] !== "object"
      ) {
        forms.panelEditorByGuild[guildId] = cloneData(fallbackPanelEditor);
      }
      if (
        !forms.announcementsByGuild[guildId] ||
        typeof forms.announcementsByGuild[guildId] !== "object"
      ) {
        forms.announcementsByGuild[guildId] = cloneData(fallbackAnnouncements);
      } else {
        forms.announcementsByGuild[guildId] = normalizeAnnouncementForm(
          forms.announcementsByGuild[guildId]
        );
      }

      if (!Array.isArray(state.ui.categoriesDraftByGuild[guildId])) {
        state.ui.categoriesDraftByGuild[guildId] = cloneData(forms.categoriesByGuild[guildId]);
      }
    }

    const selectedGuildId = state.ui.selectedGuildId;
    if (selectedGuildId) {
      forms.categories = cloneData(forms.categoriesByGuild[selectedGuildId] || fallbackCategories);
      forms.moderation = cloneData(forms.moderationByGuild[selectedGuildId] || fallbackModeration);
      forms.ai = cloneData(forms.aiByGuild[selectedGuildId] || fallbackAi);
      forms.branding = cloneData(forms.brandingByGuild[selectedGuildId] || fallbackBranding);
      forms.language = cloneData(forms.languageByGuild[selectedGuildId] || fallbackLanguage);
      forms.welcome = cloneData(forms.welcomeByGuild[selectedGuildId] || fallbackWelcome);
      forms.levels = cloneData(forms.levelsByGuild[selectedGuildId] || fallbackLevels);
      forms.economy = cloneData(forms.economyByGuild[selectedGuildId] || fallbackEconomy);
      forms.panelEditor = cloneData(
        forms.panelEditorByGuild[selectedGuildId] || fallbackPanelEditor
      );
      forms.announcements = normalizeAnnouncementForm(
        forms.announcementsByGuild[selectedGuildId] || fallbackAnnouncements
      );
    }
  }

  function getSelectedGuildId() {
    ensureGuildScopedFormMaps();
    return state.ui.selectedGuildId;
  }

  function getActiveSettingsPageId() {
    if (!SETTINGS_PAGES.has(state.ui.activePage)) return null;
    return state.ui.activePage;
  }

  function getSavedGuildForm(pageId, guildId) {
    ensureGuildScopedFormMaps();
    const key = GUILD_SCOPED_FORM_KEYS[pageId];
    if (!key) return null;
    return state.data.forms?.[key]?.[guildId] || null;
  }

  function setSavedGuildForm(pageId, guildId, value) {
    ensureGuildScopedFormMaps();
    const key = GUILD_SCOPED_FORM_KEYS[pageId];
    if (!key || !guildId) return;
    if (!state.data.forms[key] || typeof state.data.forms[key] !== "object") {
      state.data.forms[key] = {};
    }
    state.data.forms[key][guildId] = cloneData(value);
  }

  ensureGuildScopedFormMaps();

  function isMobileViewport() {
    return window.innerWidth <= MOBILE_NAV_BREAKPOINT_PX;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderUserIdentity(authUser, extraClass = "") {
    const username = String(authUser?.username || authUser?.tag || "Discord User");
    const avatarUrl = String(authUser?.avatarUrl || "").trim();
    const fallbackInitial = escapeHtml(username.charAt(0).toUpperCase() || "U");
    const avatar = avatarUrl
      ? `<img class="user-identity__avatar" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(username)} avatar" loading="lazy" decoding="async" />`
      : `<span class="user-identity__avatar user-identity__avatar--fallback" aria-hidden="true">${fallbackInitial}</span>`;

    return `
      <div class="user-identity ${escapeHtml(extraClass)}">
        ${avatar}
        <div class="user-identity__text">
          <strong>${escapeHtml(username)}</strong>
          <span>Discord Account</span>
        </div>
      </div>
    `;
  }

  function renderIcon(name) {
    const iconMap = {
      globe:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15 15 0 0 1 0 20"></path><path d="M12 2a15 15 0 0 0 0 20"></path></svg>',
      logout:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
      refresh:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.5 9a9 9 0 0 1 14.1-3.4L23 10"></path><path d="M20.5 15a9 9 0 0 1-14.1 3.4L1 14"></path></svg>'
    };

    return `<span class="ui-icon" aria-hidden="true">${iconMap[name] || ""}</span>`;
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function clampNumber(value, min, max, fallback = min, decimals = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const clamped = Math.min(max, Math.max(min, parsed));
    if (!Number.isFinite(decimals) || decimals <= 0) return Math.round(clamped);
    const factor = 10 ** decimals;
    return Math.round(clamped * factor) / factor;
  }

  function normalizeWelcomeImageFilter(value, fallback = "none") {
    const aliases = {
      cool: "blue",
      warm: "gold",
      neon: "purple",
      forest: "green"
    };
    const normalizedRaw = String(value || "").trim().toLowerCase();
    const normalized = aliases[normalizedRaw] || normalizedRaw;
    if (WELCOME_IMAGE_FILTER_OPTIONS.includes(normalized)) return normalized;
    const normalizedFallbackRaw = String(fallback || "none").trim().toLowerCase();
    const normalizedFallback = aliases[normalizedFallbackRaw] || normalizedFallbackRaw;
    if (WELCOME_IMAGE_FILTER_OPTIONS.includes(normalizedFallback)) return normalizedFallback;
    return "none";
  }

  function normalizeWelcomeRoleFilters(value) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const seenRoleIds = new Set();
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      if (output.length >= 30) break;

      const roleId = String(item.roleId || "").trim();
      if (!/^\d{5,30}$/.test(roleId) || seenRoleIds.has(roleId)) continue;
      const filter = normalizeWelcomeImageFilter(item.filter, "none");
      output.push({ roleId, filter });
      seenRoleIds.add(roleId);
    }
    return output;
  }

  function normalizeLevelCardTemplateKey(value, fallback = "blue") {
    const normalized = String(value || "").trim().toLowerCase();
    if (LEVEL_CARD_TEMPLATE_OPTIONS.includes(normalized)) return normalized;
    const fallbackNormalized = String(fallback || "blue").trim().toLowerCase();
    if (LEVEL_CARD_TEMPLATE_OPTIONS.includes(fallbackNormalized)) return fallbackNormalized;
    return "blue";
  }

  function normalizeLevelCardRoleTemplates(value, fallbackTemplate = "blue") {
    if (!Array.isArray(value)) return [];
    const output = [];
    const seenRoleIds = new Set();
    const fallback = normalizeLevelCardTemplateKey(fallbackTemplate, "blue");
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      if (output.length >= 30) break;

      const roleId = String(item.roleId || "").trim();
      if (!/^\d{5,30}$/.test(roleId) || seenRoleIds.has(roleId)) continue;
      const template = normalizeLevelCardTemplateKey(item.template, fallback);
      output.push({ roleId, template });
      seenRoleIds.add(roleId);
    }
    return output;
  }

  function resolveLevelCardTemplateAsset(template) {
    const key = normalizeLevelCardTemplateKey(template, "blue");
    return LEVEL_CARD_TEMPLATE_ASSET_MAP[key] || LEVEL_CARD_TEMPLATE_ASSET_MAP.blue;
  }

  function getWelcomePreviewCssFilter(filterKey) {
    const key = normalizeWelcomeImageFilter(filterKey, "none");
    switch (key) {
      case "pink":
        return "sepia(0.38) hue-rotate(-58deg) saturate(2.35) brightness(1.08) contrast(1.1)";
      case "rose":
        return "sepia(0.34) hue-rotate(-44deg) saturate(2.05) brightness(1.07) contrast(1.1)";
      case "blue":
        return "hue-rotate(18deg) saturate(1.55) brightness(1.08) contrast(1.08)";
      case "purple":
        return "hue-rotate(34deg) saturate(1.75) brightness(1.08) contrast(1.11)";
      case "teal":
        return "hue-rotate(58deg) saturate(1.6) brightness(1.04) contrast(1.08)";
      case "gold":
        return "sepia(0.42) hue-rotate(-12deg) saturate(1.65) brightness(1.08)";
      case "green":
        return "hue-rotate(72deg) saturate(1.6) brightness(1.02) contrast(1.06)";
      case "red":
        return "hue-rotate(-44deg) saturate(1.75) brightness(1.05) contrast(1.09)";
      case "mono":
        return "grayscale(1) contrast(1.18)";
      case "sunset":
        return "sepia(0.48) hue-rotate(-32deg) saturate(1.65) brightness(1.07)";
      case "royal":
        return "hue-rotate(28deg) saturate(1.7) contrast(1.14) brightness(1.06)";
      case "none":
      default:
        return "none";
    }
  }

  function sanitizeHexColorInput(value, fallback = "") {
    const normalized = String(value || "").trim();
    if (!normalized) return "";
    if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized.toLowerCase();
    return String(fallback || "");
  }

  function toHexColorFromInt(value, fallback = "") {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0xffffff) {
      return String(fallback || "");
    }
    return `#${numeric.toString(16).padStart(6, "0")}`;
  }

  function getActiveDashboardLanguage() {
    const guildId = getSelectedGuildId();
    const language = guildId
      ? String(getSavedGuildForm("language", guildId)?.language || "en").toLowerCase()
      : "en";
    return language === "ar" ? "ar" : "en";
  }

  function tr(value) {
    if (value === null || value === undefined) return value;
    if (getActiveDashboardLanguage() !== "ar") return String(value);

    let output = String(value);
    for (const key of AR_TRANSLATION_KEYS) {
      if (output.includes(key)) {
        output = output.split(key).join(AR_TRANSLATIONS[key]);
      }
    }

    output = output.replace(/Page\s+(\d+)\s+of\s+(\d+)/g, "الصفحة $1 من $2");
    return output;
  }

  function localizeContainerText(container) {
    if (!container || getActiveDashboardLanguage() !== "ar") return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const raw = node?.nodeValue;
      if (!raw || !raw.trim()) continue;
      const next = tr(raw);
      if (next !== raw) node.nodeValue = next;
    }

    const attrs = ["placeholder", "title", "aria-label"];
    for (const attr of attrs) {
      const nodes = container.querySelectorAll(`[${attr}]`);
      for (const node of nodes) {
        const raw = node.getAttribute(attr);
        if (!raw) continue;
        const next = tr(raw);
        if (next !== raw) node.setAttribute(attr, next);
      }
    }
  }

  function applyDocumentLanguage() {
    const language = getActiveDashboardLanguage();
    const direction = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.body.setAttribute("dir", direction);
    if (root) {
      root.setAttribute("dir", direction);
      root.setAttribute("lang", language);
    }
    const sidebar = document.getElementById("dashboard-sidebar");
    if (sidebar) {
      sidebar.setAttribute("dir", direction);
    }
  }

  function getActiveLocale() {
    const language = getActiveDashboardLanguage();
    return language === "ar" ? "ar-LY" : "en-US";
  }

  function getLanguageToggleMeta() {
    const guildId = getSelectedGuildId();
    const current = getActiveDashboardLanguage();
    const next = current === "ar" ? "en" : "ar";
    const title = next === "ar" ? "Switch to Arabic" : "Switch to English";
    return {
      guildId,
      current,
      next,
      title,
      badge: current.toUpperCase()
    };
  }

  function formatNumber(value) {
    const locale = getActiveLocale();
    return new Intl.NumberFormat(locale).format(number(value));
  }

  function formatDate(value) {
    const date = new Date(value || Date.now());
    return date.toLocaleString(getActiveLocale(), {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short"
    });
  }

  function uptimeLabel(seconds) {
    const total = number(seconds);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  function badgeClass(level) {
    if (level === "healthy" || level === "ONLINE") return "success";
    if (level === "warning") return "warning";
    return "danger";
  }

  function formatSubmissionStatus(status) {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "APPROVED") return "Approved";
    if (normalized === "PENDING") return "Pending";
    if (normalized === "REJECTED") return "Rejected";
    if (normalized === "ACTIVE") return "Active";
    return normalized || "Unknown";
  }

  function getDatabaseStatusView() {
    const database = state.data?.runtime?.database || null;
    if (!database) {
      return {
        global: { className: "warning", text: tr("Database: Checking..."), hint: "" },
        moderation: { className: "warning", text: tr("Moderation DB: Checking..."), hint: "" },
        confession: { className: "warning", text: tr("Dashboard Store: Checking..."), hint: "" }
      };
    }

    const moderationConnected = Boolean(database?.moderation?.connected);
    const moderationReason = String(database?.moderation?.reason || "");

    const confessionBackend = String(database?.confession?.backend || "unknown");
    const confessionMongoReady = Boolean(database?.confession?.mongo?.ready);
    const confessionFileFallback = confessionBackend === "file";

    const moderationView = {
      className: moderationConnected ? "success" : "danger",
      text: tr(`Moderation DB: ${moderationConnected ? "Connected" : "Disconnected"}`),
      hint: tr(
        moderationConnected ? "MongoDB connection is active." : moderationReason || "MongoDB unavailable."
      )
    };

    let confessionView;
    if (confessionBackend === "mongo" && confessionMongoReady) {
      confessionView = {
        className: "success",
        text: tr("Dashboard Store: Mongo Connected"),
        hint: tr("Confession/dashboard settings are stored in MongoDB.")
      };
    } else if (confessionFileFallback) {
      confessionView = {
        className: "warning",
        text: tr("Dashboard Store: File Fallback"),
        hint: tr("MongoDB unavailable, local file persistence is active.")
      };
    } else {
      confessionView = {
        className: "danger",
        text: tr("Dashboard Store: Disconnected"),
        hint: tr("No active persistence backend.")
      };
    }

    const fullyConnected = moderationConnected && confessionBackend === "mongo" && confessionMongoReady;
    const partiallyConnected = moderationConnected || confessionFileFallback;

    const globalView = fullyConnected
      ? {
          className: "success",
          text: tr("Database: Connected"),
          hint: tr("All persistence layers use MongoDB.")
        }
      : partiallyConnected
      ? {
          className: "warning",
          text: tr("Database: Partial"),
          hint: tr("Some components are connected while others use fallback.")
        }
      : {
          className: "danger",
          text: tr("Database: Disconnected"),
          hint: tr(moderationReason || "MongoDB unavailable.")
        };

    return {
      global: globalView,
      moderation: moderationView,
      confession: confessionView
    };
  }

  function isGuildMembersIntentEnabled() {
    return Boolean(state.data?.runtime?.features?.guildMembersIntentEnabled);
  }

  function setBadgeState(node, view) {
    if (!node || !view) return;
    node.classList.remove("success", "warning", "danger");
    node.classList.add(view.className || "warning");
    node.textContent = view.text || "Unknown";
    node.title = view.hint || "";
  }

  function paintDatabaseStatusBadges() {
    const view = getDatabaseStatusView();
    setBadgeState(document.getElementById("db-global-badge"), view.global);
    setBadgeState(document.getElementById("db-moderation-badge"), view.moderation);
    setBadgeState(document.getElementById("db-confession-badge"), view.confession);
  }

  function applyHealthSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;

    const previousRuntime =
      state.data?.runtime && typeof state.data.runtime === "object" ? state.data.runtime : {};
    const snapshotFeatures =
      snapshot?.features && typeof snapshot.features === "object" ? snapshot.features : {};

    state.data.runtime = {
      updatedAt: Date.now(),
      ready: Boolean(snapshot.ready),
      wsStatus: snapshot.ws_status,
      uptimeSeconds: number(snapshot.uptime_seconds),
      memoryRssMb: number(snapshot.memory_rss_mb),
      database: snapshot.database || null,
      features: {
        ...(previousRuntime.features || {}),
        ...snapshotFeatures
      }
    };
  }

  async function refreshRuntimeHealth({ showErrorToast = false } = {}) {
    try {
      const response = await fetch("/api/health", {
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        throw new Error(`Health API returned ${response.status}`);
      }

      const payload = await response.json();
      applyHealthSnapshot(payload);
      paintDatabaseStatusBadges();
    } catch (error) {
      if (showErrorToast) {
        showToast("error", `Failed to fetch database status. ${error?.message || ""}`.trim());
      }
    }
  }

  function showToast(type, message) {
    const node = document.createElement("div");
    node.className = `toast ${type || "info"}`;
    node.textContent = tr(message);
    toastContainer.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function openConfirm({ title, message, onConfirm }) {
    modalTitle.textContent = tr(title);
    modalMessage.textContent = tr(message);
    pendingConfirm.action = onConfirm;
    modal.classList.remove("hidden");
  }

  function closeConfirm() {
    pendingConfirm.action = null;
    modal.classList.add("hidden");
  }

  function getCurrentPage() {
    return pages.find((item) => item.id === state.ui.activePage) || pages[0] || {
      title: "Dashboard",
      subtitle: ""
    };
  }

  function renderServerOptions(servers, selected) {
    if (!servers.length) return '<option value="">No servers available</option>';
    return servers
      .map(
        (server) =>
          `<option value="${escapeHtml(server.guildId)}" ${
            selected === server.guildId ? "selected" : ""
          }>${escapeHtml(server.guildName)}</option>`
      )
      .join("");
  }

  function getDeveloperPointsGuildOptions() {
    const optionsById = new Map();

    const overviewRows = Array.isArray(state.data?.developer?.overview?.guilds)
      ? state.data.developer.overview.guilds
      : [];
    for (const row of overviewRows) {
      const guildId = String(row?.guildId || "").trim();
      if (!guildId || optionsById.has(guildId)) continue;
      const guildName = String(row?.guildName || guildId).trim() || guildId;
      optionsById.set(guildId, { guildId, guildName });
    }

    const settingsRows = Array.isArray(state.data?.forms?.serverSettings)
      ? state.data.forms.serverSettings
      : [];
    for (const row of settingsRows) {
      const guildId = String(row?.guildId || "").trim();
      if (!guildId || optionsById.has(guildId)) continue;
      const guildName = String(row?.guildName || row?.name || guildId).trim() || guildId;
      optionsById.set(guildId, { guildId, guildName });
    }

    return Array.from(optionsById.values());
  }

  function normalizeDeveloperPointsFormDraft(draft = {}) {
    const allowedActions = new Set(["reward", "deduct", "set"]);
    const guildOptions = getDeveloperPointsGuildOptions();
    const validGuildIds = new Set(guildOptions.map((item) => String(item.guildId || "").trim()));

    const currentGuildId = String(draft?.guildId || "").trim();
    const selectedGuildId = String(getSelectedGuildId() || "").trim();
    const fallbackGuildId = guildOptions[0]?.guildId || "";

    const guildId = validGuildIds.has(currentGuildId)
      ? currentGuildId
      : validGuildIds.has(selectedGuildId)
        ? selectedGuildId
        : fallbackGuildId;

    const actionRaw = String(draft?.action || "").trim().toLowerCase();
    const action = allowedActions.has(actionRaw) ? actionRaw : "reward";

    return {
      guildId,
      targetUserId: String(draft?.targetUserId || "")
        .replace(/[^\d]/gu, "")
        .slice(0, 30),
      action,
      amount: String(draft?.amount || "").trim().slice(0, 12),
      reason: String(draft?.reason || "").slice(0, 300)
    };
  }

  function updateDeveloperPointsFormDraft(patch = {}) {
    const currentDraft =
      state.ui?.developerPointsForm && typeof state.ui.developerPointsForm === "object"
        ? state.ui.developerPointsForm
        : {};
    state.ui.developerPointsForm = normalizeDeveloperPointsFormDraft({
      ...currentDraft,
      ...patch
    });
    return state.ui.developerPointsForm;
  }

  function renderChannelOptions(channels, selected, includeEmpty = true) {
    const items = Array.isArray(channels) ? channels : [];
    const selectedId = String(selected || "").trim();
    const options = [];

    if (includeEmpty) {
      options.push(`<option value="" ${selectedId ? "" : "selected"}>-- Not Set --</option>`);
    }

    for (const channel of items) {
      const id = String(channel.id || "").trim();
      const idEscaped = escapeHtml(id);
      const name = escapeHtml(channel.name || channel.id);
      options.push(
        `<option value="${idEscaped}" ${selectedId === id ? "selected" : ""}>#${name}</option>`
      );
    }

    if (selectedId && !items.some((item) => String(item?.id || "").trim() === selectedId)) {
      options.push(
        `<option value="${escapeHtml(selectedId)}" selected>${escapeHtml(`#unknown-${selectedId.slice(-4)}`)}</option>`
      );
    }

    return options.join("");
  }

  function renderPlainChannelOptions(channels, selected, includeEmpty = true) {
    const items = Array.isArray(channels) ? channels : [];
    const selectedId = String(selected || "").trim();
    const options = [];

    if (includeEmpty) {
      options.push(`<option value="" ${selectedId ? "" : "selected"}>-- Not Set --</option>`);
    }

    for (const channel of items) {
      const id = String(channel.id || "").trim();
      const name = escapeHtml(channel.name || channel.id);
      options.push(
        `<option value="${escapeHtml(id)}" ${selectedId === id ? "selected" : ""}>${name}</option>`
      );
    }

    return options.join("");
  }

  function renderRoleOptions(roles, selected, includeEmpty = true, emptyLabel = "-- Select Role --") {
    const items = Array.isArray(roles) ? roles : [];
    const selectedId = String(selected || "").trim();
    const options = [];

    if (includeEmpty) {
      options.push(`<option value="" ${selectedId ? "" : "selected"}>${escapeHtml(emptyLabel)}</option>`);
    }

    for (const role of items) {
      const id = String(role?.id || "").trim();
      if (!id) continue;
      const roleName = String(role?.name || role?.id || "").trim() || id;
      options.push(
        `<option value="${escapeHtml(id)}" ${selectedId === id ? "selected" : ""}>@${escapeHtml(roleName)}</option>`
      );
    }

    if (selectedId && !items.some((item) => String(item?.id || "").trim() === selectedId)) {
      options.push(
        `<option value="${escapeHtml(selectedId)}" selected>${escapeHtml(`@unknown-${selectedId.slice(-4)}`)}</option>`
      );
    }

    return options.join("");
  }

  function renderMultiRoleOptions(roles, selectedIds = []) {
    const items = Array.isArray(roles) ? roles : [];
    const selected = new Set(Array.isArray(selectedIds) ? selectedIds.map((id) => String(id)) : []);

    return items
      .map((role) => {
        const id = String(role?.id || "").trim();
        if (!id) return "";
        const roleName = String(role?.name || role?.id || "").trim() || id;
        return `<option value="${escapeHtml(id)}" ${selected.has(id) ? "selected" : ""}>@${escapeHtml(
          roleName
        )}</option>`;
      })
      .join("");
  }

  function renderWelcomeImageFilterOptions(selected) {
    const selectedFilter = normalizeWelcomeImageFilter(selected, "none");
    return WELCOME_IMAGE_FILTER_OPTIONS.map((value) => {
      const label = WELCOME_IMAGE_FILTER_LABELS[value] || value;
      return `<option value="${escapeHtml(value)}" ${selectedFilter === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderLevelCardTemplateOptions(selected) {
    const selectedTemplate = normalizeLevelCardTemplateKey(selected, "blue");
    return LEVEL_CARD_TEMPLATE_OPTIONS.map((value) => {
      const label = LEVEL_CARD_TEMPLATE_LABELS[value] || value;
      return `<option value="${escapeHtml(value)}" ${selectedTemplate === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderWelcomeRoleFilterRow(item, roles, rowId) {
    const roleId = String(item?.roleId || "").trim();
    const filter = normalizeWelcomeImageFilter(item?.filter, "none");
    const stableRowId = String(rowId || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

    return `
      <div class="welcome-role-filter-row" data-welcome-role-filter-row data-row-id="${escapeHtml(stableRowId)}">
        <select data-welcome-role-filter-role>
          ${renderRoleOptions(roles, roleId, true, "-- Select Role --")}
        </select>
        <select data-welcome-role-filter-filter>
          ${renderWelcomeImageFilterOptions(filter)}
        </select>
        <button class="btn btn--ghost btn--small" type="button" data-action="remove-welcome-role-filter">
          Remove
        </button>
      </div>
    `;
  }

  function getCurrentServerSettingsItem() {
    ensureGuildScopedFormMaps();
    const allSettings = state.data.forms?.serverSettings || [];
    return allSettings.find((item) => item.guildId === state.ui.selectedGuildId) || allSettings[0] || null;
  }

  function hasDeveloperAccess() {
    if (state.data?.developer?.access === true) return true;
    if (state.data?.runtime?.features?.developerAccess === true) return true;
    return false;
  }

  function isGuildDeveloperBlockedForDashboard(guildId = getSelectedGuildId()) {
    const normalizedGuildId = String(guildId || "").trim();
    if (!normalizedGuildId) return false;
    ensureGuildScopedFormMaps();
    const list = Array.isArray(state.data?.forms?.serverSettings) ? state.data.forms.serverSettings : [];
    const item =
      list.find((row) => String(row?.guildId || "") === normalizedGuildId) ||
      getCurrentServerSettingsItem();
    if (!item) return false;
    return Boolean(item.developerBlocked);
  }

  function getPageScope(pageId) {
    if (!pageId) return document;
    return document.querySelector(`.page[data-page="${pageId}"]`) || document;
  }

  function readToggleDomState(key, fallback = true, scope = document) {
    const queryRoot = scope && typeof scope.querySelector === "function" ? scope : document;
    const node = queryRoot.querySelector(`[data-key="${key}"]`) || document.querySelector(`[data-key="${key}"]`);
    if (!node) return Boolean(fallback);
    return node.classList.contains("active");
  }

  function normalizeServerLogAlertSettings(settings = {}) {
    const normalized = {};
    for (const key of SERVER_LOG_ALERT_KEYS) {
      normalized[key] = Object.prototype.hasOwnProperty.call(settings, key)
        ? Boolean(settings[key])
        : true;
    }
    return normalized;
  }

  function getSavedServerSettingsSnapshot(current) {
    const source = current || {};
    return {
      confessionChannelId: String(source.confessionChannelId || ""),
      panelChannelId: String(source.panelChannelId || ""),
      logsChannelId: String(source.logsChannelId || ""),
      moderationChannelId: String(source.moderationChannelId || ""),
      botEnabled: Boolean(source.botEnabled),
      anonymousPosting: Boolean(source.anonymousPosting),
      repliesEnabled: Boolean(source.repliesEnabled),
      aiModerationEnabled: Boolean(source.aiModerationEnabled),
      dailyMessageQuota: parsePositiveIntSetting(source.dailyMessageQuota, 50),
      logAlertSettings: normalizeServerLogAlertSettings(source.logAlertSettings || {})
    };
  }

  function getDraftServerSettingsSnapshot(current) {
    if (!current) return null;

    const saved = getSavedServerSettingsSnapshot(current);
    const section = getPageScope("server-settings");
    const readSelect = (id, fallback) => {
      const node = section.querySelector(`#${id}`) || document.getElementById(id);
      if (!node) return String(fallback || "");
      return String(node.value || "");
    };

    return {
      confessionChannelId: readSelect("ss-confession-channel", saved.confessionChannelId),
      panelChannelId: readSelect("ss-panel-channel", saved.panelChannelId),
      logsChannelId: readSelect("ss-logs-channel", saved.logsChannelId),
      moderationChannelId: readSelect("ss-moderation-channel", saved.moderationChannelId),
      dailyMessageQuota: parsePositiveIntSetting(
        section.querySelector("#ss-daily-message-quota")?.value,
        saved.dailyMessageQuota
      ),
      botEnabled: readToggleDomState("bot-enabled", saved.botEnabled, section),
      anonymousPosting: readToggleDomState("anonymous-posting", saved.anonymousPosting, section),
      repliesEnabled: readToggleDomState("reply-enabled", saved.repliesEnabled, section),
      aiModerationEnabled: readToggleDomState("ai-enabled", saved.aiModerationEnabled, section),
      logAlertSettings: {
        confessionSender: readToggleDomState(
          "log-alert-confessionSender",
          saved.logAlertSettings.confessionSender,
          section
        ),
        guildUpdates: readToggleDomState(
          "log-alert-guildUpdates",
          saved.logAlertSettings.guildUpdates,
          section
        ),
        channelUpdates: readToggleDomState(
          "log-alert-channelUpdates",
          saved.logAlertSettings.channelUpdates,
          section
        ),
        roleUpdates: readToggleDomState(
          "log-alert-roleUpdates",
          saved.logAlertSettings.roleUpdates,
          section
        ),
        stickerUpdates: readToggleDomState(
          "log-alert-stickerUpdates",
          saved.logAlertSettings.stickerUpdates,
          section
        ),
        emojiUpdates: readToggleDomState(
          "log-alert-emojiUpdates",
          saved.logAlertSettings.emojiUpdates,
          section
        )
      }
    };
  }

  function isServerSettingsSnapshotEqual(left, right) {
    if (!left || !right) return false;

    if (left.confessionChannelId !== right.confessionChannelId) return false;
    if (left.panelChannelId !== right.panelChannelId) return false;
    if (left.logsChannelId !== right.logsChannelId) return false;
    if (left.moderationChannelId !== right.moderationChannelId) return false;
    if (Number(left.dailyMessageQuota || 0) !== Number(right.dailyMessageQuota || 0)) return false;
    if (left.botEnabled !== right.botEnabled) return false;
    if (left.anonymousPosting !== right.anonymousPosting) return false;
    if (left.repliesEnabled !== right.repliesEnabled) return false;
    if (left.aiModerationEnabled !== right.aiModerationEnabled) return false;

    for (const key of SERVER_LOG_ALERT_KEYS) {
      if (Boolean(left.logAlertSettings?.[key]) !== Boolean(right.logAlertSettings?.[key])) {
        return false;
      }
    }

    return true;
  }

  function hasServerSettingsUnsavedChanges() {
    const current = getCurrentServerSettingsItem();
    if (!current) return false;

    const saved = getSavedServerSettingsSnapshot(current);
    const draft = getDraftServerSettingsSnapshot(current);
    return !isServerSettingsSnapshotEqual(saved, draft);
  }

  function normalizeCategoriesSnapshot(categories) {
    if (!Array.isArray(categories)) return [];
    return categories.map((item, index) => ({
      id: String(item?.id || "").trim(),
      name: String(item?.name || "").trim(),
      color: String(item?.color || "").trim(),
      icon: String(item?.icon || "").trim(),
      active: item?.active !== false,
      order: Number(item?.order || index + 1)
    }));
  }

  function getSavedCategoriesSnapshot(guildId) {
    const saved = getSavedGuildForm("categories", guildId);
    return normalizeCategoriesSnapshot(saved || []);
  }

  function getDraftCategoriesSnapshot(guildId) {
    if (!guildId) return [];
    if (!Array.isArray(state.ui.categoriesDraftByGuild[guildId])) {
      state.ui.categoriesDraftByGuild[guildId] = cloneData(getSavedCategoriesSnapshot(guildId));
    }
    return normalizeCategoriesSnapshot(state.ui.categoriesDraftByGuild[guildId]);
  }

  function setDraftCategoriesSnapshot(guildId, categories) {
    if (!guildId) return;
    state.ui.categoriesDraftByGuild[guildId] = normalizeCategoriesSnapshot(categories);
  }

  function readModerationDraftSnapshot(saved = {}) {
    const section = getPageScope("moderation");
    const thresholdNode =
      section.querySelector("#toxicity-threshold") || document.getElementById("toxicity-threshold");
    const badWordsNode = section.querySelector("#mod-bad-words") || document.getElementById("mod-bad-words");
    return {
      badWordsFilterEnabled: readToggleDomState(
        "mod-badwords-enabled",
        saved.badWordsFilterEnabled !== false,
        section
      ),
      aiModerationEnabled: readToggleDomState("mod-ai", Boolean(saved.aiModerationEnabled), section),
      toxicityThreshold: Number(thresholdNode?.value || saved.toxicityThreshold || 70),
      spamDetectionEnabled: readToggleDomState(
        "mod-spam",
        saved.spamDetectionEnabled !== false,
        section
      ),
      linkRestrictionEnabled: readToggleDomState(
        "mod-links",
        Boolean(saved.linkRestrictionEnabled),
        section
      ),
      imageRestrictionEnabled: readToggleDomState(
        "mod-images",
        Boolean(saved.imageRestrictionEnabled),
        section
      ),
      autoRejectEnabled: readToggleDomState("mod-reject", Boolean(saved.autoRejectEnabled), section),
      badWordsText: String(badWordsNode?.value || saved.badWordsText || "")
        .trim()
        .replace(/\s*,\s*/gu, ", ")
    };
  }

  function readAiDraftSnapshot(saved = {}) {
    const section = getPageScope("ai-settings");
    const conversationPromptNode =
      section.querySelector("#ai-conversation-prompt") || document.getElementById("ai-conversation-prompt");
    const moderationPromptNode =
      section.querySelector("#ai-moderation-prompt") || document.getElementById("ai-moderation-prompt");
    const creativityNode = section.querySelector("#ai-creativity") || document.getElementById("ai-creativity");
    const strictnessNode = section.querySelector("#ai-strictness") || document.getElementById("ai-strictness");

    return {
      aiAutoReply: readToggleDomState("ai-auto-reply", Boolean(saved.aiAutoReply), section),
      smartSuggestions: readToggleDomState(
        "ai-smart-suggestions",
        saved.smartSuggestions !== false,
        section
      ),
      creativity: Number(creativityNode?.value || saved.creativity || 45),
      strictness: Number(strictnessNode?.value || saved.strictness || 72),
      moderationPrompt: String(moderationPromptNode?.value || saved.moderationPrompt || "").trim(),
      conversationPrompt: String(
        conversationPromptNode?.value || saved.conversationPrompt || ""
      ).trim()
    };
  }

  function readBrandingDraftSnapshot(saved = {}) {
    const section = getPageScope("branding");
    const readValue = (id, fallback = "") => {
      const node = section.querySelector(`#${id}`) || document.getElementById(id);
      return String(node?.value || fallback || "");
    };

    return {
      embedColor: readValue("brand-embed-color", saved.embedColor || "#7c5cff"),
      botFooter: readValue("brand-bot-footer", saved.botFooter || ""),
      successMessage: readValue("brand-success-message", saved.successMessage || ""),
      errorMessage: readValue("brand-error-message", saved.errorMessage || ""),
      uiTheme: readValue("brand-ui-theme", saved.uiTheme || "dark-violet")
    };
  }

  function readLanguageDraftSnapshot(saved = {}) {
    const section = getPageScope("language");
    const node = section.querySelector("#lang-language") || document.getElementById("lang-language");
    const value = String(node?.value || saved.language || "en").toLowerCase();
    return {
      language: value === "ar" ? "ar" : "en"
    };
  }

  function readWelcomeDraftSnapshot(saved = {}, channels = [], roles = []) {
    const section = getPageScope("welcome");
    const readValue = (id, fallback = "") => {
      const node = section.querySelector(`#${id}`) || document.getElementById(id);
      return String(node?.value || fallback || "");
    };

    const selectedChannel = readValue("welcome-channel", saved.channelId || "");
    void channels;
    void roles;
    const imageFilter = normalizeWelcomeImageFilter(
      readValue("welcome-image-filter", saved.imageFilter || "none"),
      saved.imageFilter || "none"
    );
    const roleFilterListNode = section.querySelector("#welcome-role-filters-list");
    const roleRows = Array.from(section.querySelectorAll("[data-welcome-role-filter-row]"));
    const roleFilters =
      roleFilterListNode
        ? normalizeWelcomeRoleFilters(
            roleRows.map((row) => {
              const roleSelect = row.querySelector("[data-welcome-role-filter-role]");
              const filterSelect = row.querySelector("[data-welcome-role-filter-filter]");
              return {
                roleId: String(roleSelect?.value || "").trim(),
                filter: String(filterSelect?.value || "none")
              };
            })
          )
        : normalizeWelcomeRoleFilters(saved.roleFilters || []);

    return {
      enabled: readToggleDomState("welcome-enabled", Boolean(saved.enabled), section),
      channelId: selectedChannel,
      message: readValue("welcome-message", saved.message || "Welcome {user} to {server}!")
        .trim()
        .slice(0, 500),
      backgroundImage: readValue(
        "welcome-background-image",
        saved.backgroundImage || "asset://welcome-default.png"
      )
        .trim()
        .slice(0, 500),
      mentionUser: readToggleDomState("welcome-mention-user", saved.mentionUser !== false, section),
      overlayText: readValue("welcome-overlay-text", saved.overlayText || "")
        .trim()
        .slice(0, 180),
      overlayTextSize: clampNumber(
        readValue("welcome-overlay-text-size", saved.overlayTextSize || 100),
        60,
        220,
        100
      ),
      overlayTextX: clampNumber(
        readValue("welcome-overlay-text-x", saved.overlayTextX || 73),
        5,
        95,
        73,
        1
      ),
      overlayTextY: clampNumber(
        readValue("welcome-overlay-text-y", saved.overlayTextY || 50),
        8,
        92,
        50,
        1
      ),
      avatarScale: clampNumber(
        readValue("welcome-avatar-scale", saved.avatarScale || 100),
        55,
        180,
        100
      ),
      avatarX: clampNumber(
        readValue("welcome-avatar-x", saved.avatarX || 30.2),
        8,
        92,
        30.2,
        1
      ),
      avatarY: clampNumber(
        readValue("welcome-avatar-y", saved.avatarY || 48.8),
        8,
        92,
        48.8,
        1
      ),
      imageFilter,
      roleFilters
    };
  }

  function normalizeLevelsRewardsSnapshot(value) {
    if (!Array.isArray(value)) return [];

    const dedupe = new Set();
    const output = [];

    for (const item of value) {
      if (output.length >= 200) break;
      const level = clampNumber(item?.level, 1, 10000, 1);
      const roleId = String(item?.roleId || "").trim();
      if (!roleId) continue;
      if (!/^\d{5,30}$/.test(roleId)) continue;

      const key = `${level}:${roleId}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);

      output.push({
        level,
        roleId
      });
    }

    output.sort((left, right) => {
      if (left.level !== right.level) return left.level - right.level;
      return left.roleId.localeCompare(right.roleId);
    });

    return output;
  }

  function normalizeLevelsFormSnapshot(value = {}) {
    const minXp = clampNumber(value?.minXp, 1, 500, 10);
    const maxXp = clampNumber(value?.maxXp, minXp, 5000, Math.max(20, minXp));
    const cardTemplate = normalizeLevelCardTemplateKey(value?.cardTemplate, "blue");
    return {
      enabled: value?.enabled !== false,
      minXp,
      maxXp,
      cooldownSeconds: clampNumber(value?.cooldownSeconds, 0, 900, 60),
      imageFilter: normalizeWelcomeImageFilter(value?.imageFilter, "none"),
      roleFilters: normalizeWelcomeRoleFilters(value?.roleFilters || []),
      cardTemplate,
      roleCardTemplates: normalizeLevelCardRoleTemplates(
        value?.roleCardTemplates || [],
        cardTemplate
      ),
      avatarScale: clampNumber(value?.avatarScale, 55, 180, 100),
      usernameScale: clampNumber(value?.usernameScale, 70, 170, 100),
      statsScale: clampNumber(value?.statsScale, 70, 170, 100),
      rewards: normalizeLevelsRewardsSnapshot(value?.rewards || [])
    };
  }

  function renderLevelsRoleFilterRow(item, roles, rowId) {
    const roleId = String(item?.roleId || "").trim();
    const filter = normalizeWelcomeImageFilter(item?.filter, "none");
    const stableRowId = String(rowId || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

    return `
      <div class="levels-role-filter-row" data-levels-role-filter-row data-row-id="${escapeHtml(stableRowId)}">
        <select data-levels-role-filter-role>
          ${renderRoleOptions(roles, roleId, true, "-- Select Role --")}
        </select>
        <select data-levels-role-filter-filter>
          ${renderWelcomeImageFilterOptions(filter)}
        </select>
        <button class="btn btn--ghost btn--small" type="button" data-action="remove-levels-role-filter">
          Remove
        </button>
      </div>
    `;
  }

  function renderLevelsRoleTemplateRow(item, roles, rowId) {
    const roleId = String(item?.roleId || "").trim();
    const template = normalizeLevelCardTemplateKey(item?.template, "blue");
    const stableRowId = String(rowId || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

    return `
      <div class="levels-role-template-row" data-levels-role-template-row data-row-id="${escapeHtml(stableRowId)}">
        <select data-levels-role-template-role>
          ${renderRoleOptions(roles, roleId, true, "-- Select Role --")}
        </select>
        <select data-levels-role-template-template>
          ${renderLevelCardTemplateOptions(template)}
        </select>
        <button class="btn btn--ghost btn--small" type="button" data-action="remove-levels-role-template">
          Remove
        </button>
      </div>
    `;
  }

  function renderLevelRewardRow(item, roles, rowId) {
    const level = clampNumber(item?.level, 1, 10000, 1);
    const roleId = String(item?.roleId || "").trim();
    const stableRowId = String(rowId || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

    return `
      <div class="levels-reward-row" data-level-reward-row data-row-id="${escapeHtml(stableRowId)}">
        <input
          type="number"
          min="1"
          max="10000"
          step="1"
          data-level-reward-level
          value="${escapeHtml(level)}"
          placeholder="Level"
        />
        <select data-level-reward-role>
          ${renderRoleOptions(roles, roleId, true, "-- Select Role --")}
        </select>
        <button class="btn btn--ghost btn--small" type="button" data-action="remove-level-reward">
          Remove
        </button>
      </div>
    `;
  }

  function readLevelsDraftSnapshot(saved = {}, roles = []) {
    const section = getPageScope("levels");
    const readValue = (id, fallback = "") => {
      const node = section.querySelector(`#${id}`) || document.getElementById(id);
      return String(node?.value || fallback || "");
    };

    const enabled = readToggleDomState("levels-enabled", saved.enabled !== false, section);
    const minXp = clampNumber(readValue("levels-min-xp", saved.minXp || 10), 1, 500, 10);
    const maxXp = clampNumber(
      readValue("levels-max-xp", saved.maxXp || Math.max(20, minXp)),
      minXp,
      5000,
      Math.max(20, minXp)
    );
    const cooldownSeconds = clampNumber(
      readValue("levels-cooldown-seconds", saved.cooldownSeconds || 60),
      0,
      900,
      60
    );
    const imageFilter = normalizeWelcomeImageFilter(
      readValue("levels-image-filter", saved.imageFilter || "none"),
      saved.imageFilter || "none"
    );
    const cardTemplate = normalizeLevelCardTemplateKey(
      readValue("levels-card-template", saved.cardTemplate || "blue"),
      saved.cardTemplate || "blue"
    );
    const avatarScale = clampNumber(
      readValue("levels-avatar-scale", saved.avatarScale || 100),
      55,
      180,
      100
    );
    const usernameScale = clampNumber(
      readValue("levels-username-scale", saved.usernameScale || 100),
      70,
      170,
      100
    );
    const statsScale = clampNumber(
      readValue("levels-stats-scale", saved.statsScale || 100),
      70,
      170,
      100
    );

    const roleFilterListNode = section.querySelector("#levels-role-filters-list");
    const roleFilterRows = Array.from(section.querySelectorAll("[data-levels-role-filter-row]"));
    const roleFilters =
      roleFilterListNode
        ? normalizeWelcomeRoleFilters(
            roleFilterRows.map((row) => {
              const roleSelect = row.querySelector("[data-levels-role-filter-role]");
              const filterSelect = row.querySelector("[data-levels-role-filter-filter]");
              return {
                roleId: String(roleSelect?.value || "").trim(),
                filter: String(filterSelect?.value || "none")
              };
            })
          )
        : normalizeWelcomeRoleFilters(saved.roleFilters || []);
    const roleTemplateListNode = section.querySelector("#levels-role-templates-list");
    const roleTemplateRows = Array.from(section.querySelectorAll("[data-levels-role-template-row]"));
    const roleCardTemplates =
      roleTemplateListNode
        ? normalizeLevelCardRoleTemplates(
            roleTemplateRows.map((row) => {
              const roleSelect = row.querySelector("[data-levels-role-template-role]");
              const templateSelect = row.querySelector("[data-levels-role-template-template]");
              return {
                roleId: String(roleSelect?.value || "").trim(),
                template: String(templateSelect?.value || "blue")
              };
            }),
            cardTemplate
          )
        : normalizeLevelCardRoleTemplates(saved.roleCardTemplates || [], cardTemplate);

    const rewardRows = Array.from(section.querySelectorAll("[data-level-reward-row]"));
    void roles;

    return {
      enabled,
      minXp,
      maxXp,
      cooldownSeconds,
      imageFilter,
      roleFilters,
      cardTemplate,
      roleCardTemplates,
      avatarScale,
      usernameScale,
      statsScale,
      rewards: normalizeLevelsRewardsSnapshot(
        rewardRows.map((row) => {
          const levelNode = row.querySelector("[data-level-reward-level]");
          const roleNode = row.querySelector("[data-level-reward-role]");
          return {
            level: Number(levelNode?.value || 1),
            roleId: String(roleNode?.value || "").trim()
          };
        })
      )
    };
  }

  function readPanelEditorDraftSnapshot(saved = {}) {
    const section = getPageScope("panel-editor");
    const readValue = (id, fallback = "") => {
      const node = section.querySelector(`#${id}`) || document.getElementById(id);
      return String(node?.value || fallback || "");
    };

    return {
      title: readValue("panel-editor-title", saved.title || "").trim().slice(0, 256),
      description: readValue("panel-editor-description", saved.description || "")
        .trim()
        .slice(0, 4000),
      buttonLabel: readValue("panel-editor-button-label", saved.buttonLabel || "")
        .trim()
        .slice(0, 80),
      imageUrl: readValue("panel-editor-image-url", saved.imageUrl || "").trim().slice(0, 500),
      thumbnailUrl: readValue("panel-editor-thumbnail-url", saved.thumbnailUrl || "")
        .trim()
        .slice(0, 500),
      footerText: readValue("panel-editor-footer-text", saved.footerText || "").trim().slice(0, 240),
      accentColor: sanitizeHexColorInput(
        readValue("panel-editor-accent-color", saved.accentColor || ""),
        sanitizeHexColorInput(saved.accentColor, "")
      ),
      hasStoredUploadedImage: Boolean(saved.hasStoredUploadedImage)
    };
  }

  function readAnnouncementsDraftSnapshot(saved = {}) {
    const section = getPageScope("announcements");
    const normalizedSaved = normalizeAnnouncementForm(saved);
    const readValue = (id, fallback = "") => {
      const node = section.querySelector(`#${id}`) || document.getElementById(id);
      return String(node?.value || fallback || "");
    };

    return normalizeAnnouncementForm({
      channelId: readValue("announcement-channel", normalizedSaved.channelId).trim(),
      title: readValue("announcement-title", normalizedSaved.title).trim().slice(0, 180),
      message: readValue("announcement-message", normalizedSaved.message).trim().slice(0, 1900),
      imageUrl: readValue("announcement-image-url", normalizedSaved.imageUrl).trim().slice(0, 500),
      mentionEveryone: readToggleDomState(
        "announcement-mention-everyone",
        Boolean(normalizedSaved.mentionEveryone),
        section
      ),
      poll: {
        responseChannelId: readValue(
          "poll-response-channel",
          normalizedSaved.poll.responseChannelId
        ).trim(),
        durationMinutes: readValue(
          "poll-duration-minutes",
          normalizedSaved.poll.durationMinutes
        ),
        allowTextResponses: readToggleDomState(
          "poll-allow-text-responses",
          Boolean(normalizedSaved.poll.allowTextResponses),
          section
        ),
        choicesText: readValue("poll-choices", normalizedSaved.poll.choicesText)
          .trim()
          .slice(0, 900)
      },
      giveaway: {
        responseChannelId: readValue(
          "giveaway-response-channel",
          normalizedSaved.giveaway.responseChannelId
        ).trim(),
        durationMinutes: readValue(
          "giveaway-duration-minutes",
          normalizedSaved.giveaway.durationMinutes
        ),
        prize: readValue("giveaway-prize", normalizedSaved.giveaway.prize).trim().slice(0, 180),
        winnersCount: readValue("giveaway-winners-count", normalizedSaved.giveaway.winnersCount)
      }
    });
  }

  function normalizeShopItemId(value, fallback = "") {
    const normalized = String(value || fallback || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return normalized || `item-${Date.now().toString(36)}`;
  }

  function normalizeRoleIdListForEconomy(value = []) {
    const output = [];
    const seen = new Set();
    for (const item of Array.isArray(value) ? value : []) {
      const roleId = String(item || "").trim();
      if (!roleId || seen.has(roleId)) continue;
      output.push(roleId);
      seen.add(roleId);
    }
    return output;
  }

  function normalizeShopCardCodeInput(value = "") {
    return String(value || "").trim().slice(0, 180);
  }

  function normalizeShopCardInventorySnapshot(value = []) {
    const source = Array.isArray(value) ? value : [];
    const output = [];
    const seenCodes = new Set();
    let autoIndex = 1;

    for (const rawEntry of source) {
      if (output.length >= 5000) break;

      const entry = rawEntry && typeof rawEntry === "object" ? rawEntry : { code: rawEntry };
      const code = normalizeShopCardCodeInput(entry.code);
      if (!code || seenCodes.has(code)) continue;
      seenCodes.add(code);

      const sold = entry?.sold === true;
      output.push({
        id: String(entry?.id || `card-${autoIndex}`).trim().slice(0, 40) || `card-${autoIndex}`,
        code,
        sold,
        soldAt: sold ? clampNumber(entry?.soldAt, 0, 9999999999999, 0) : 0,
        soldToUserId: sold ? String(entry?.soldToUserId || "").trim() : "",
        purchaseId: sold ? String(entry?.purchaseId || "").trim().slice(0, 80) : ""
      });
      autoIndex += 1;
    }

    return output;
  }

  function normalizeShopItemSnapshot(item = {}, index = 0) {
    const type = ["role", "nickname", "announcement", "feature", "card"].includes(
      String(item.type || "").toLowerCase()
    )
      ? String(item.type).toLowerCase()
      : "role";
    const category = ["basic", "premium", "rare"].includes(String(item.category || "").toLowerCase())
      ? String(item.category).toLowerCase()
      : "basic";
    const name = String(item.name || `Shop Item ${index + 1}`).trim().slice(0, 80);

    return {
      id: normalizeShopItemId(item.id, name),
      name,
      description: String(item.description || "").trim().slice(0, 300),
      price: clampNumber(item.price, 0, 100000000, 0),
      category,
      type,
      enabled: item.enabled !== false,
      roleId: type === "role" ? String(item.roleId || "").trim() : "",
      nickname: type === "nickname" ? String(item.nickname || "").trim().slice(0, 32) : "",
      message: type === "announcement" ? String(item.message || "").trim().slice(0, 1800) : "",
      featureKey: type === "feature" ? String(item.featureKey || item.id || name).trim().slice(0, 80) : "",
      cardInventory: type === "card" ? normalizeShopCardInventorySnapshot(item.cardInventory) : [],
      durationDays: clampNumber(item.durationDays, 0, 3650, 0),
      cooldownSeconds: clampNumber(item.cooldownSeconds, 0, 86400, 0),
      cardCooldownDays: type === "card" ? clampNumber(item.cardCooldownDays, 0, 3650, 1) : 0,
      limitedUntil: String(item.limitedUntil || "").trim(),
      purchaseLimit: clampNumber(item.purchaseLimit, 0, 1000000, 0),
      userPurchaseLimit: clampNumber(item.userPurchaseLimit, 0, 1000000, 0)
    };
  }

  function normalizeEconomyFormSnapshot(value = {}) {
    const source = value && typeof value === "object" ? value : DEFAULT_ECONOMY_FORM;
    const shopItems = Array.isArray(source.shopItems) ? source.shopItems : [];
    return {
      enabled: source.enabled !== false,
      shopChannelId: String(source.shopChannelId || ""),
      purchaseLogChannelId: String(source.purchaseLogChannelId || ""),
      messagePoints: clampNumber(source.messagePoints, 0, 10000, 2),
      messageCooldownSeconds: clampNumber(source.messageCooldownSeconds, 1, 3600, 45),
      messageDailyLimit: clampNumber(source.messageDailyLimit, 0, 1000000, 250),
      voicePointsPerMinute: clampNumber(source.voicePointsPerMinute, 0, 10000, 1),
      voiceDailyLimit: clampNumber(source.voiceDailyLimit, 0, 1000000, 200),
      reactionReceivedPoints: clampNumber(source.reactionReceivedPoints, 0, 10000, 1),
      reactionDailyLimit: clampNumber(source.reactionDailyLimit, 0, 1000000, 100),
      dailyRewardAmount: clampNumber(source.dailyRewardAmount, 0, 1000000, 75),
      dailyEarningLimit: clampNumber(source.dailyEarningLimit, 1, 10000000, 500),
      purchaseTaxPercent: clampNumber(source.purchaseTaxPercent, 0, 100, 0),
      purchaseCooldownSeconds: clampNumber(source.purchaseCooldownSeconds, 0, 86400, 30),
      roleDurationDays: clampNumber(source.roleDurationDays, 0, 3650, 0),
      allowedRoleIds: normalizeRoleIdListForEconomy(source.allowedRoleIds),
      exclusiveRoleIds: normalizeRoleIdListForEconomy(source.exclusiveRoleIds),
      blockedBuyerRoleIds: normalizeRoleIdListForEconomy(source.blockedBuyerRoleIds),
      shopItems: shopItems.map((item, index) => normalizeShopItemSnapshot(item, index))
    };
  }

  function readSelectedValues(selectNode) {
    return Array.from(selectNode?.selectedOptions || [])
      .map((option) => String(option.value || "").trim())
      .filter(Boolean);
  }

  function parseShopCardInventoryJson(value) {
    const raw = String(value || "").trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return normalizeShopCardInventorySnapshot(parsed);
    } catch {
      return [];
    }
  }

  function buildShopCardInventoryFromRow(row) {
    const existing = parseShopCardInventoryJson(
      row.querySelector("[data-shop-item-card-inventory]")?.value || "[]"
    );
    const inputCodes = String(row.querySelector("[data-shop-item-card-codes]")?.value || "")
      .split(/\r?\n/u)
      .map((line) => normalizeShopCardCodeInput(line))
      .filter(Boolean);

    const uniqueCodes = [];
    const seenCodes = new Set();
    for (const code of inputCodes) {
      if (seenCodes.has(code)) continue;
      seenCodes.add(code);
      uniqueCodes.push(code);
    }

    const soldCards = existing.filter((entry) => entry.sold === true);
    const unsoldMap = new Map(
      existing
        .filter((entry) => entry.sold !== true)
        .map((entry) => [entry.code, entry])
    );

    let newCardIndex = 1;
    const nextUnsoldCards = uniqueCodes.map((code) => {
      const existingUnsold = unsoldMap.get(code);
      if (existingUnsold) return existingUnsold;
      const id = `card-${Date.now().toString(36)}-${newCardIndex}`;
      newCardIndex += 1;
      return {
        id,
        code,
        sold: false,
        soldAt: 0,
        soldToUserId: "",
        purchaseId: ""
      };
    });

    return normalizeShopCardInventorySnapshot([...soldCards, ...nextUnsoldCards]);
  }

  function readEconomyDraftSnapshot(saved = {}) {
    const section = getPageScope("economy");
    const readValue = (id, fallback = "") => {
      const node = section.querySelector(`#${id}`) || document.getElementById(id);
      return String(node?.value || fallback || "");
    };
    const itemRows = Array.from(section.querySelectorAll("[data-shop-item-row]"));

    return normalizeEconomyFormSnapshot({
      enabled: readToggleDomState("economy-enabled", saved.enabled !== false, section),
      shopChannelId: readValue("economy-shop-channel", saved.shopChannelId || ""),
      purchaseLogChannelId: readValue("economy-log-channel", saved.purchaseLogChannelId || ""),
      messagePoints: readValue("economy-message-points", saved.messagePoints || 2),
      messageCooldownSeconds: readValue(
        "economy-message-cooldown",
        saved.messageCooldownSeconds || 45
      ),
      messageDailyLimit: readValue("economy-message-daily-limit", saved.messageDailyLimit || 250),
      voicePointsPerMinute: readValue("economy-voice-points", saved.voicePointsPerMinute || 1),
      voiceDailyLimit: readValue("economy-voice-daily-limit", saved.voiceDailyLimit || 200),
      reactionReceivedPoints: readValue(
        "economy-reaction-points",
        saved.reactionReceivedPoints || 1
      ),
      reactionDailyLimit: readValue("economy-reaction-daily-limit", saved.reactionDailyLimit || 100),
      dailyRewardAmount: readValue("economy-daily-reward", saved.dailyRewardAmount || 75),
      dailyEarningLimit: readValue("economy-daily-limit", saved.dailyEarningLimit || 500),
      purchaseTaxPercent: readValue("economy-tax-percent", saved.purchaseTaxPercent || 0),
      purchaseCooldownSeconds: readValue(
        "economy-purchase-cooldown",
        saved.purchaseCooldownSeconds || 30
      ),
      roleDurationDays: readValue("economy-role-duration", saved.roleDurationDays || 0),
      allowedRoleIds: readSelectedValues(section.querySelector("#economy-allowed-roles")),
      exclusiveRoleIds: readSelectedValues(section.querySelector("#economy-exclusive-roles")),
      blockedBuyerRoleIds: readSelectedValues(
        section.querySelector("#economy-blocked-buyer-roles")
      ),
      shopItems: itemRows.map((row, index) =>
        normalizeShopItemSnapshot(
          {
            id: row.querySelector("[data-shop-item-id]")?.value || "",
            name: row.querySelector("[data-shop-item-name]")?.value || "",
            description: row.querySelector("[data-shop-item-description]")?.value || "",
            price: row.querySelector("[data-shop-item-price]")?.value || 0,
            category: row.querySelector("[data-shop-item-category]")?.value || "basic",
            type: row.querySelector("[data-shop-item-type]")?.value || "role",
            enabled: row.querySelector("[data-shop-item-enabled]")?.checked !== false,
            roleId: row.querySelector("[data-shop-item-role]")?.value || "",
            nickname: row.querySelector("[data-shop-item-nickname]")?.value || "",
            message: row.querySelector("[data-shop-item-message]")?.value || "",
            featureKey: row.querySelector("[data-shop-item-feature]")?.value || "",
            cardInventory: buildShopCardInventoryFromRow(row),
            durationDays: row.querySelector("[data-shop-item-duration]")?.value || 0,
            cooldownSeconds: row.querySelector("[data-shop-item-cooldown]")?.value || 0,
            cardCooldownDays:
              row.querySelector("[data-shop-item-card-cooldown-days]")?.value || 0,
            limitedUntil: row.querySelector("[data-shop-item-limited-until]")?.value || "",
            purchaseLimit: row.querySelector("[data-shop-item-purchase-limit]")?.value || 0,
            userPurchaseLimit: row.querySelector("[data-shop-item-user-limit]")?.value || 0
          },
          index
        )
      )
    });
  }

  function normalizeUrlLikeInput(value) {
    let normalized = String(value || "").trim();
    if (!normalized) return "";

    const markdownUrlMatch = normalized.match(
      /^!?\[[^\]]*\]\((https?:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)$/iu
    );
    if (markdownUrlMatch && markdownUrlMatch[1]) {
      normalized = markdownUrlMatch[1].trim();
    }

    let changed = true;
    while (changed && normalized.length > 1) {
      changed = false;
      const startsWith = normalized[0];
      const endsWith = normalized[normalized.length - 1];
      const wrappers = [
        ["<", ">"],
        ['"', '"'],
        ["'", "'"],
        ["(", ")"],
        ["[", "]"]
      ];

      for (const [start, end] of wrappers) {
        if (startsWith === start && endsWith === end) {
          normalized = normalized.slice(1, -1).trim();
          changed = true;
          break;
        }
      }
    }

    return normalized;
  }

  function normalizeHttpPreviewUrl(value) {
    const normalized = normalizeUrlLikeInput(value);
    if (!normalized) return "";

    try {
      const parsed = new URL(normalized);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      return "";
    }

    return "";
  }

  function toWelcomePreviewBackground(rawValue) {
    const rawBackground = normalizeUrlLikeInput(rawValue || "asset://welcome-default.png");
    if (!rawBackground) return "/assets/welcome-default.png";
    if (rawBackground.startsWith("asset://")) {
      const safeName =
        rawBackground.slice("asset://".length).replace(/[^a-z0-9._-]/gi, "") ||
        "welcome-default.png";
      return `/assets/${safeName}`;
    }

    const normalizedHttpUrl = normalizeHttpPreviewUrl(rawBackground);
    if (normalizedHttpUrl) {
      return `/api/dashboard/media-proxy?url=${encodeURIComponent(normalizedHttpUrl)}`;
    }
    return rawBackground;
  }

  function updateWelcomeLivePreview() {
    const section = getPageScope("welcome");
    if (!section) return;

    const backgroundInput = section.querySelector("#welcome-background-image");
    const overlayInput = section.querySelector("#welcome-overlay-text");
    const imageNode = section.querySelector("#welcome-preview-image");
    const textNode = section.querySelector("#welcome-preview-overlay-text");
    const avatarNode = section.querySelector("#welcome-preview-avatar");
    const textSizeInput = section.querySelector("#welcome-overlay-text-size");
    const textXInput = section.querySelector("#welcome-overlay-text-x");
    const textYInput = section.querySelector("#welcome-overlay-text-y");
    const avatarScaleInput = section.querySelector("#welcome-avatar-scale");
    const avatarXInput = section.querySelector("#welcome-avatar-x");
    const avatarYInput = section.querySelector("#welcome-avatar-y");
    const filterInput = section.querySelector("#welcome-image-filter");
    const textSizeValueNode = section.querySelector("#welcome-overlay-text-size-value");
    const avatarScaleValueNode = section.querySelector("#welcome-avatar-scale-value");

    if (imageNode) {
      const nextSrc = toWelcomePreviewBackground(backgroundInput?.value || "");
      if (imageNode.getAttribute("src") !== nextSrc) {
        imageNode.setAttribute("src", nextSrc);
      }
      imageNode.style.filter = getWelcomePreviewCssFilter(filterInput?.value || "none");
    }

    if (textNode) {
      const nextText = String(overlayInput?.value || "").trim().slice(0, 180);
      textNode.textContent = nextText;
      textNode.classList.toggle("is-hidden", !nextText);

      const textSize = clampNumber(textSizeInput?.value, 60, 220, 100);
      const textX = clampNumber(textXInput?.value, 5, 95, 73, 1);
      const textY = clampNumber(textYInput?.value, 8, 92, 50, 1);
      textNode.style.left = `${textX}%`;
      textNode.style.top = `${textY}%`;
      textNode.style.fontSize = `calc(clamp(16px, 1.95vw, 33px) * ${textSize / 100})`;
    }

    if (avatarNode) {
      const avatarScale = clampNumber(avatarScaleInput?.value, 55, 180, 100);
      const avatarX = clampNumber(avatarXInput?.value, 8, 92, 30.2, 1);
      const avatarY = clampNumber(avatarYInput?.value, 8, 92, 48.8, 1);
      avatarNode.style.left = `${avatarX}%`;
      avatarNode.style.top = `${avatarY}%`;
      avatarNode.style.width = `calc(28.4% * ${avatarScale / 100})`;
    }

    if (textSizeValueNode) {
      textSizeValueNode.textContent = `${clampNumber(textSizeInput?.value, 60, 220, 100)}%`;
    }
    if (avatarScaleValueNode) {
      avatarScaleValueNode.textContent = `${clampNumber(avatarScaleInput?.value, 55, 180, 100)}%`;
    }

  }

  function initWelcomePreviewInteractions() {
    const section = getPageScope("welcome");
    if (!section) return;

    const card = section.querySelector("#welcome-preview-card");
    const avatarNode = section.querySelector("#welcome-preview-avatar");
    const textNode = section.querySelector("#welcome-preview-overlay-text");
    const avatarXInput = section.querySelector("#welcome-avatar-x");
    const avatarYInput = section.querySelector("#welcome-avatar-y");
    const textXInput = section.querySelector("#welcome-overlay-text-x");
    const textYInput = section.querySelector("#welcome-overlay-text-y");
    if (!card || !avatarNode || !textNode) return;

    const applyPosition = (mode, clientX, clientY) => {
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const relativeX = ((clientX - rect.left) / rect.width) * 100;
      const relativeY = ((clientY - rect.top) / rect.height) * 100;

      if (mode === "avatar") {
        const nextX = clampNumber(relativeX, 8, 92, 30.2, 1);
        const nextY = clampNumber(relativeY, 8, 92, 48.8, 1);
        if (avatarXInput) avatarXInput.value = String(nextX);
        if (avatarYInput) avatarYInput.value = String(nextY);
      } else {
        const nextX = clampNumber(relativeX, 5, 95, 73, 1);
        const nextY = clampNumber(relativeY, 8, 92, 50, 1);
        if (textXInput) textXInput.value = String(nextX);
        if (textYInput) textYInput.value = String(nextY);
      }

      updateWelcomeLivePreview();
      syncFloatingSaveButton();
    };

    const beginDrag = (event, mode) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();

      const pointerId = event.pointerId;
      card.classList.toggle("welcome-preview-card--drag-avatar", mode === "avatar");
      card.classList.toggle("welcome-preview-card--drag-text", mode === "text");
      applyPosition(mode, event.clientX, event.clientY);

      const onPointerMove = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        applyPosition(mode, moveEvent.clientX, moveEvent.clientY);
      };

      const onPointerEnd = (endEvent) => {
        if (endEvent.pointerId !== pointerId) return;
        card.classList.remove("welcome-preview-card--drag-avatar");
        card.classList.remove("welcome-preview-card--drag-text");
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerEnd);
        window.removeEventListener("pointercancel", onPointerEnd);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerEnd);
      window.addEventListener("pointercancel", onPointerEnd);
    };

    avatarNode.addEventListener("pointerdown", (event) => beginDrag(event, "avatar"));
    textNode.addEventListener("pointerdown", (event) => {
      if (textNode.classList.contains("is-hidden")) return;
      beginDrag(event, "text");
    });
  }

  function resolveLevelsPreviewAccent(section, roles = []) {
    const roleRows = Array.from(section.querySelectorAll("[data-levels-role-filter-row]"));

    for (const row of roleRows) {
      const roleId = String(row.querySelector("[data-levels-role-filter-role]")?.value || "").trim();
      if (!roleId) continue;

      const role = roles.find((item) => String(item?.id || "").trim() === roleId);
      const roleColor = sanitizeHexColorInput(toHexColorFromInt(role?.color, ""), "");
      if (roleColor && roleColor !== "#000000") {
        return { color: roleColor, source: "Role Color" };
      }

      const rowFilter = normalizeWelcomeImageFilter(
        row.querySelector("[data-levels-role-filter-filter]")?.value || "none",
        "none"
      );
      const fallbackRowColor = LEVEL_FILTER_ACCENT_COLORS[rowFilter];
      if (fallbackRowColor) {
        return { color: fallbackRowColor, source: "Role LUT" };
      }
    }

    const defaultFilter = normalizeWelcomeImageFilter(
      section.querySelector("#levels-image-filter")?.value || "none",
      "none"
    );
    const fallbackFilterColor = LEVEL_FILTER_ACCENT_COLORS[defaultFilter];
    if (fallbackFilterColor) {
      return { color: fallbackFilterColor, source: "Default LUT" };
    }

    const guildId = getSelectedGuildId();
    const brandingForm = guildId ? getSavedGuildForm("branding", guildId) || {} : {};
    const brandingColor = sanitizeHexColorInput(brandingForm?.embedColor, "");
    if (brandingColor) {
      return { color: brandingColor, source: "Bot Theme" };
    }

    return { color: "#8aa9ff", source: "Fallback" };
  }

  function resolveLevelsPreviewTemplate(section) {
    const roleTemplateRows = Array.from(section.querySelectorAll("[data-levels-role-template-row]"));
    for (const row of roleTemplateRows) {
      const roleId = String(row.querySelector("[data-levels-role-template-role]")?.value || "").trim();
      if (!roleId) continue;
      const template = normalizeLevelCardTemplateKey(
        row.querySelector("[data-levels-role-template-template]")?.value || "blue",
        "blue"
      );
      return { template, source: "Role Template" };
    }

    const defaultTemplate = normalizeLevelCardTemplateKey(
      section.querySelector("#levels-card-template")?.value || "blue",
      "blue"
    );
    return { template: defaultTemplate, source: "Default Template" };
  }

  function updateLevelsLivePreview() {
    const section = getPageScope("levels");
    if (!section) return;

    const previewCard = section.querySelector("#levels-card-preview");
    if (!previewCard) return;

    const previewOverlay = section.querySelector("#levels-preview-template");
    const previewFill = section.querySelector("#levels-preview-progress-fill");
    const previewUser = section.querySelector("#levels-preview-username");
    const previewLevel = section.querySelector("#levels-preview-level");
    const previewRank = section.querySelector("#levels-preview-rank");
    const previewXp = section.querySelector("#levels-preview-xp");
    const previewAccent = section.querySelector("#levels-preview-accent");
    const avatarScaleValueNode = section.querySelector("#levels-avatar-scale-value");
    const usernameScaleValueNode = section.querySelector("#levels-username-scale-value");
    const statsScaleValueNode = section.querySelector("#levels-stats-scale-value");

    const guildId = getSelectedGuildId();
    const currentServer = getCurrentServerSettingsItem();
    const roles = Array.isArray(currentServer?.availableRoles) ? currentServer.availableRoles : [];
    const levelsFilter = normalizeWelcomeImageFilter(
      section.querySelector("#levels-image-filter")?.value || "none",
      "none"
    );
    const templateInfo = resolveLevelsPreviewTemplate(section);
    const accent = resolveLevelsPreviewAccent(section, roles);
    const avatarScale = clampNumber(section.querySelector("#levels-avatar-scale")?.value, 55, 180, 100);
    const usernameScale = clampNumber(
      section.querySelector("#levels-username-scale")?.value,
      70,
      170,
      100
    );
    const statsScale = clampNumber(section.querySelector("#levels-stats-scale")?.value, 70, 170, 100);

    previewCard.style.setProperty("--level-accent", accent.color);
    previewCard.style.setProperty("--level-accent-soft", `${accent.color}66`);
    previewCard.style.setProperty("--level-avatar-scale", (avatarScale / 100).toFixed(2));
    previewCard.style.setProperty("--level-username-scale", (usernameScale / 100).toFixed(2));
    previewCard.style.setProperty("--level-stats-scale", (statsScale / 100).toFixed(2));

    if (previewOverlay) {
      const templateSrc = resolveLevelCardTemplateAsset(templateInfo.template);
      if (previewOverlay.getAttribute("src") !== templateSrc) {
        previewOverlay.setAttribute("src", templateSrc);
      }
      previewOverlay.style.filter = getWelcomePreviewCssFilter(levelsFilter);
    }

    const minXp = clampNumber(section.querySelector("#levels-min-xp")?.value, 1, 500, 10);
    const maxXp = clampNumber(section.querySelector("#levels-max-xp")?.value, minXp, 5000, Math.max(20, minXp));
    const simulatedRequiredXp = Math.max(20, Math.round((minXp + maxXp) * 20));
    const simulatedCurrentXp = Math.round(simulatedRequiredXp * 0.67);
    const progressRatio = clampNumber(simulatedCurrentXp / simulatedRequiredXp, 0, 1, 0.67, 3);

    if (previewFill) {
      previewFill.style.width = `${Math.round(progressRatio * 100)}%`;
    }

    const authUserName = String(
      state.data?.auth?.user?.username || state.data?.auth?.user?.tag || "Member"
    )
      .trim()
      .slice(0, 22);
    if (previewUser) previewUser.textContent = authUserName || "Member";
    if (previewLevel) previewLevel.textContent = `LVL ${Math.max(1, Math.round((minXp + maxXp) / 2))}`;
    if (previewRank) previewRank.textContent = `#${Math.max(1, (guildId ? guildId.length : 5) * 3)}`;
    if (previewXp) previewXp.textContent = `${simulatedCurrentXp} / ${simulatedRequiredXp} XP`;
    if (avatarScaleValueNode) avatarScaleValueNode.textContent = `${avatarScale}%`;
    if (usernameScaleValueNode) usernameScaleValueNode.textContent = `${usernameScale}%`;
    if (statsScaleValueNode) statsScaleValueNode.textContent = `${statsScale}%`;
    if (previewAccent) {
      const templateLabel =
        LEVEL_CARD_TEMPLATE_LABELS[templateInfo.template] || templateInfo.template.toUpperCase();
      previewAccent.textContent = `${templateInfo.source}: ${templateLabel} | ${accent.source}: ${accent.color.toUpperCase()}`;
    }
  }

  function updatePanelEditorLivePreview() {
    const section = getPageScope("panel-editor");
    if (!section) return;

    const titleInput = section.querySelector("#panel-editor-title");
    const descriptionInput = section.querySelector("#panel-editor-description");
    const buttonLabelInput = section.querySelector("#panel-editor-button-label");
    const imageInput = section.querySelector("#panel-editor-image-url");
    const thumbnailInput = section.querySelector("#panel-editor-thumbnail-url");
    const footerInput = section.querySelector("#panel-editor-footer-text");
    const accentColorInput = section.querySelector("#panel-editor-accent-color");

    const titleNode = section.querySelector("#panel-preview-title");
    const descriptionNode = section.querySelector("#panel-preview-description");
    const buttonNode = section.querySelector("#panel-preview-button");
    const footerNode = section.querySelector("#panel-preview-footer");
    const imageNode = section.querySelector("#panel-preview-image");
    const thumbnailNode = section.querySelector("#panel-preview-thumbnail");
    const colorNode = section.querySelector("#panel-preview-color");

    const title = String(titleInput?.value || "").trim();
    const description = String(descriptionInput?.value || "").trim();
    const buttonLabel = String(buttonLabelInput?.value || "").trim();
    const imageUrl = String(imageInput?.value || "").trim();
    const thumbnailUrl = String(thumbnailInput?.value || "").trim();
    const footerText = String(footerInput?.value || "").trim();
    const accentColor = sanitizeHexColorInput(accentColorInput?.value, "#7c5cff") || "#7c5cff";

    if (titleNode) titleNode.textContent = title || "Anonymous Confessions";
    if (descriptionNode) {
      descriptionNode.textContent =
        description || "Send your confession anonymously using the button below.";
    }
    if (buttonNode) buttonNode.textContent = buttonLabel || "Send Anonymous Confession";
    if (footerNode) {
      footerNode.textContent = footerText;
      footerNode.classList.toggle("is-hidden", !footerText);
    }

    if (imageNode) {
      if (imageUrl) {
        imageNode.src = imageUrl;
      } else {
        imageNode.removeAttribute("src");
      }
      imageNode.classList.toggle("is-hidden", !imageUrl);
    }
    if (thumbnailNode) {
      if (thumbnailUrl) {
        thumbnailNode.src = thumbnailUrl;
      } else {
        thumbnailNode.removeAttribute("src");
      }
      thumbnailNode.classList.toggle("is-hidden", !thumbnailUrl);
    }
    if (colorNode) {
      colorNode.style.background = accentColor;
    }
  }

  function isJsonEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function hasCategoriesUnsavedChanges() {
    const guildId = getSelectedGuildId();
    if (!guildId) return false;
    const saved = getSavedCategoriesSnapshot(guildId);
    const draft = getDraftCategoriesSnapshot(guildId);
    return !isJsonEqual(saved, draft);
  }

  function hasModerationUnsavedChanges() {
    const guildId = getSelectedGuildId();
    if (!guildId) return false;
    const saved = getSavedGuildForm("moderation", guildId) || DEFAULT_MODERATION_FORM;
    const draft = readModerationDraftSnapshot(saved);
    return !isJsonEqual(
      {
        badWordsFilterEnabled: saved.badWordsFilterEnabled !== false,
        aiModerationEnabled: Boolean(saved.aiModerationEnabled),
        toxicityThreshold: Number(saved.toxicityThreshold || 70),
        spamDetectionEnabled: saved.spamDetectionEnabled !== false,
        linkRestrictionEnabled: Boolean(saved.linkRestrictionEnabled),
        imageRestrictionEnabled: Boolean(saved.imageRestrictionEnabled),
        autoRejectEnabled: Boolean(saved.autoRejectEnabled),
        badWordsText: String(saved.badWordsText || "")
          .trim()
          .replace(/\s*,\s*/gu, ", ")
      },
      draft
    );
  }

  function hasAiSettingsUnsavedChanges() {
    const guildId = getSelectedGuildId();
    if (!guildId) return false;
    const saved = getSavedGuildForm("ai-settings", guildId) || DEFAULT_AI_FORM;
    const draft = readAiDraftSnapshot(saved);
    return !isJsonEqual(
      {
        aiAutoReply: Boolean(saved.aiAutoReply),
        smartSuggestions: saved.smartSuggestions !== false,
        creativity: Number(saved.creativity || 45),
        strictness: Number(saved.strictness || 72),
        moderationPrompt: String(saved.moderationPrompt || "").trim(),
        conversationPrompt: String(saved.conversationPrompt || "").trim()
      },
      draft
    );
  }

  function hasBrandingUnsavedChanges() {
    const guildId = getSelectedGuildId();
    if (!guildId) return false;
    const saved = getSavedGuildForm("branding", guildId) || DEFAULT_BRANDING_FORM;
    const draft = readBrandingDraftSnapshot(saved);
    return !isJsonEqual(
      {
        embedColor: String(saved.embedColor || "#7c5cff"),
        botFooter: String(saved.botFooter || ""),
        successMessage: String(saved.successMessage || ""),
        errorMessage: String(saved.errorMessage || ""),
        uiTheme: String(saved.uiTheme || "dark-violet")
      },
      draft
    );
  }

  function hasLanguageUnsavedChanges() {
    const guildId = getSelectedGuildId();
    if (!guildId) return false;
    const saved = getSavedGuildForm("language", guildId) || DEFAULT_LANGUAGE_FORM;
    const draft = readLanguageDraftSnapshot(saved);
    return String(saved.language || "en") !== String(draft.language || "en");
  }

  function hasWelcomeUnsavedChanges() {
    const guildId = getSelectedGuildId();
    if (!guildId) return false;

    const current = getCurrentServerSettingsItem();
    const channels = current?.availableChannels || [];
    const roles = current?.availableRoles || [];
    const saved = getSavedGuildForm("welcome", guildId) || DEFAULT_WELCOME_FORM;
    const draft = readWelcomeDraftSnapshot(saved, channels, roles);

    return !isJsonEqual(
      {
        enabled: Boolean(saved.enabled),
        channelId: String(saved.channelId || ""),
        message: String(saved.message || "Welcome {user} to {server}!"),
        backgroundImage: String(saved.backgroundImage || "asset://welcome-default.png"),
        mentionUser: saved.mentionUser !== false,
        overlayText: String(saved.overlayText || ""),
        overlayTextSize: clampNumber(saved.overlayTextSize, 60, 220, 100),
        overlayTextX: clampNumber(saved.overlayTextX, 5, 95, 73, 1),
        overlayTextY: clampNumber(saved.overlayTextY, 8, 92, 50, 1),
        avatarScale: clampNumber(saved.avatarScale, 55, 180, 100),
        avatarX: clampNumber(saved.avatarX, 8, 92, 30.2, 1),
        avatarY: clampNumber(saved.avatarY, 8, 92, 48.8, 1),
        imageFilter: normalizeWelcomeImageFilter(saved.imageFilter || "none", "none"),
        roleFilters: normalizeWelcomeRoleFilters(saved.roleFilters || [])
      },
      draft
    );
  }

  function hasLevelsUnsavedChanges() {
    const guildId = getSelectedGuildId();
    if (!guildId) return false;

    const current = getCurrentServerSettingsItem();
    const roles = current?.availableRoles || [];
    const saved = normalizeLevelsFormSnapshot(
      getSavedGuildForm("levels", guildId) || DEFAULT_LEVELS_FORM
    );
    const draft = readLevelsDraftSnapshot(saved, roles);

    return !isJsonEqual(saved, draft);
  }

  function hasEconomyUnsavedChanges() {
    const guildId = getSelectedGuildId();
    if (!guildId) return false;

    const saved = normalizeEconomyFormSnapshot(
      getSavedGuildForm("economy", guildId) || DEFAULT_ECONOMY_FORM
    );
    const draft = readEconomyDraftSnapshot(saved);
    return !isJsonEqual(saved, draft);
  }

  function hasPanelEditorUnsavedChanges() {
    const guildId = getSelectedGuildId();
    if (!guildId) return false;

    const saved = getSavedGuildForm("panel-editor", guildId) || DEFAULT_PANEL_EDITOR_FORM;
    const draft = readPanelEditorDraftSnapshot(saved);

    const comparableSaved = {
      title: String(saved.title || "").trim().slice(0, 256),
      description: String(saved.description || "").trim().slice(0, 4000),
      buttonLabel: String(saved.buttonLabel || "").trim().slice(0, 80),
      imageUrl: String(saved.imageUrl || "").trim().slice(0, 500),
      thumbnailUrl: String(saved.thumbnailUrl || "").trim().slice(0, 500),
      footerText: String(saved.footerText || "").trim().slice(0, 240),
      accentColor: sanitizeHexColorInput(saved.accentColor, ""),
      hasStoredUploadedImage: Boolean(saved.hasStoredUploadedImage)
    };

    return !isJsonEqual(comparableSaved, draft);
  }

  function hasAnnouncementsUnsavedChanges() {
    const guildId = getSelectedGuildId();
    if (!guildId) return false;

    const saved = getSavedGuildForm("announcements", guildId) || DEFAULT_ANNOUNCEMENTS_FORM;
    const draft = readAnnouncementsDraftSnapshot(saved);
    const comparableSaved = normalizeAnnouncementForm(saved);

    return !isJsonEqual(comparableSaved, draft);
  }

  function hasActiveSettingsUnsavedChanges() {
    const activePage = getActiveSettingsPageId();
    if (!activePage) return false;
    if (activePage === "server-settings") return hasServerSettingsUnsavedChanges();
    if (activePage === "categories") return hasCategoriesUnsavedChanges();
    if (activePage === "moderation") return hasModerationUnsavedChanges();
    if (activePage === "ai-settings") return hasAiSettingsUnsavedChanges();
    if (activePage === "branding") return hasBrandingUnsavedChanges();
    if (activePage === "language") return hasLanguageUnsavedChanges();
    if (activePage === "welcome") return hasWelcomeUnsavedChanges();
    if (activePage === "levels") return hasLevelsUnsavedChanges();
    if (activePage === "economy") return hasEconomyUnsavedChanges();
    if (activePage === "panel-editor") return hasPanelEditorUnsavedChanges();
    if (activePage === "announcements") return hasAnnouncementsUnsavedChanges();
    return false;
  }

  function syncFloatingSaveButton() {
    const bar = document.querySelector(".floating-save-bar");
    const saveButton = bar?.querySelector('[data-action="save-active-settings"]');
    const resetButton = bar?.querySelector('[data-action="reset-active-settings"]');
    if (!bar || !saveButton) return;

    const isVisible = hasActiveSettingsUnsavedChanges();
    const isSaving = Boolean(state.ui.isSavingServerSettings || state.ui.isSavingSettings);
    bar.classList.toggle("is-visible", isVisible);
    saveButton.disabled = isSaving;
    if (resetButton) {
      resetButton.disabled = isSaving;
    }
    saveButton.textContent = isSaving ? "Saving..." : "Save Changes";
  }

  function renderSidebar() {
    const authUser = state.data.auth?.user || null;
    const languageMeta = getLanguageToggleMeta();
    const currentGuild = state.data.forms?.serverSettings?.find(
      (item) => item.guildId === state.ui.selectedGuildId
    );

    return `
      <aside id="dashboard-sidebar" class="sidebar">
        <div class="brand">
          ${
            authUser
              ? renderUserIdentity(authUser, "user-identity--sidebar")
              : `
                <img
                  class="brand__logo"
                  src="/assets/zllawi-logo.png"
                  alt="Zllawi be honest logo"
                  loading="eager"
                  decoding="async"
                />
                <div class="brand__text">
                  <h1>Zllawi be honest</h1>
                  <p>Admin Control Center</p>
                </div>
              `
          }
        </div>

        <div class="server-selector">
          <label for="sidebar-server-select">Current Server</label>
          <select id="sidebar-server-select" data-action="select-guild">
            ${renderServerOptions(state.data.forms?.serverSettings || [], state.ui.selectedGuildId)}
          </select>
          <p class="section-subtitle" style="margin-top:8px;">
            ${currentGuild ? escapeHtml(currentGuild.guildName) : "No linked servers"}
          </p>
        </div>

        <div class="sidebar-quick-tools">
          <button
            class="btn btn--ghost icon-btn language-toggle-btn"
            data-action="toggle-dashboard-language"
            title="${escapeHtml(languageMeta.title)}"
            aria-label="${escapeHtml(languageMeta.title)}"
            ${languageMeta.guildId ? "" : "disabled"}
          >
            ${renderIcon("globe")}
            <span class="icon-btn__label">${escapeHtml(languageMeta.badge)}</span>
          </button>
        </div>

        <nav class="nav-list">
          ${pages
            .map(
              (page) => `
              <button class="nav-btn ${state.ui.activePage === page.id ? "active" : ""}" data-nav="${page.id}">
                <span class="nav-btn__title">${escapeHtml(page.title)}</span>
                <span class="nav-btn__subtitle">${escapeHtml(page.subtitle)}</span>
              </button>
            `
            )
            .join("")}
        </nav>
      </aside>
    `;
  }

  function renderTopbar() {
    const authUser = state.data.auth?.user || null;

    return `
      <header class="topbar">
        <div class="topbar__title">
          ${authUser ? renderUserIdentity(authUser, "user-identity--topbar") : "<h2>Dashboard</h2>"}
        </div>
        <div class="topbar__actions">
          <button
            class="btn btn--ghost mobile-nav-toggle"
            data-action="toggle-mobile-nav"
            aria-controls="dashboard-sidebar"
            aria-expanded="${state.ui.mobileNavOpen ? "true" : "false"}"
          >
            <span class="mobile-nav-toggle__icon" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span>Menu</span>
          </button>
          <a
            class="btn btn--ghost icon-btn icon-btn--square"
            href="/auth/discord/logout"
            title="Logout"
            aria-label="Logout"
          >
            ${renderIcon("logout")}
          </a>
          <button
            class="btn btn--ghost icon-btn icon-btn--square"
            data-action="simulate-loading"
            title="Reload Data"
            aria-label="Reload Data"
          >
            ${renderIcon("refresh")}
          </button>
        </div>
      </header>
    `;
  }

  function renderMetricCard(label, value, hint = "") {
    return `
      <article class="card metric">
        <div class="metric__label">${escapeHtml(label)}</div>
        <div class="metric__value">${escapeHtml(value)}</div>
        <div class="metric__hint">${escapeHtml(hint)}</div>
      </article>
    `;
  }

  function renderSwitchRow(label, active, key, disabled = false) {
    return `
      <div class="switch-row">
        <span>${escapeHtml(label)}</span>
        <button class="switch ${active ? "active" : ""} ${disabled ? "is-disabled" : ""}" data-action="toggle" data-key="${escapeHtml(
          key
        )}" ${disabled ? "disabled" : ""}></button>
      </div>
    `;
  }

  function renderHomePage() {
    const cards = state.data.cards || {};
    const health = state.data.widgets?.botHealth || {};
    const topServers = state.data.widgets?.topServers || [];
    const feed = state.data.activity?.feed || [];
    const recentConfessions = Array.isArray(state.data.widgets?.recentConfessions)
      ? state.data.widgets.recentConfessions
      : [];
    const recentConfessionLimit = 5;
    const recentConfessionsVisible = state.ui.homeRecentConfessionsExpanded
      ? recentConfessions
      : recentConfessions.slice(0, recentConfessionLimit);
    const hasMoreRecentConfessions = recentConfessions.length > recentConfessionLimit;

    return `
      <section class="page ${state.ui.activePage === "home" ? "active" : ""}" data-page="home">
        <div class="grid cards-6">
          ${renderMetricCard("Total Servers", formatNumber(cards.totalServers), "Linked servers right now")}
          ${renderMetricCard("Total Users", formatNumber(cards.totalUsers), "Based on Discord memberCount")}
          ${renderMetricCard("Total Confessions", formatNumber(cards.totalConfessions), "Cumulative confession history")}
          ${renderMetricCard("Bot Status", cards.botStatus || "UNKNOWN", "Updated automatically")}
          ${renderMetricCard("AI Usage Today", formatNumber(cards.aiUsageToday), "Today's classification operations")}
          ${renderMetricCard("Pending Review", formatNumber(cards.pendingModerationQueue), "Low-confidence cases")}
        </div>

        <div class="grid cols-2">
          <article class="card">
            <h3 class="section-title">Confession Activity (Weekly / Monthly)</h3>
            <p class="section-subtitle">Switch between weekly and monthly views.</p>
            <div class="toolbar" style="margin-bottom:10px;">
              <button class="btn btn--small ${state.ui.activityRange === "weekly" ? "" : "btn--ghost"}" data-action="set-activity-range" data-range="weekly">Weekly</button>
              <button class="btn btn--small ${state.ui.activityRange === "monthly" ? "" : "btn--ghost"}" data-action="set-activity-range" data-range="monthly">Monthly</button>
            </div>
            <div class="chart-wrap"><canvas id="home-activity-chart" class="line-chart"></canvas></div>
          </article>

          <article class="card">
            <h3 class="section-title">Latest Bot Activity</h3>
            <p class="section-subtitle">Latest administration and moderation events.</p>
            ${
              feed.length
                ? `<ul class="feed-list">${feed
                    .map(
                      (item) => `
                      <li class="feed-item">
                        <div class="feed-item__title">${escapeHtml(item.title)}</div>
                        <div class="feed-item__meta">${escapeHtml(item.subtitle)} - ${formatDate(item.timestamp)}</div>
                      </li>
                    `
                    )
                    .join("")}</ul>`
                : '<div class="empty-state">No recent activity yet.</div>'
            }
          </article>
        </div>

        <div class="grid cols-3">
          <article class="card">
            <h3 class="section-title">Bot Health</h3>
            <p class="section-subtitle">Connection and stability metrics.</p>
            <div class="health-badges">
              <span class="badge ${badgeClass(health.level)}">Status: ${escapeHtml(health.status || "Unknown")}</span>
              <span class="badge ${badgeClass(health.wsPing > 250 ? "warning" : "healthy")}">Ping: ${escapeHtml(health.wsPing || 0)}ms</span>
              <span class="badge ${badgeClass("healthy")}">Uptime: ${escapeHtml(uptimeLabel(health.uptimeSeconds || 0))}</span>
              <span id="db-moderation-badge" class="badge warning">Moderation DB: Checking...</span>
              <span id="db-confession-badge" class="badge warning">Dashboard Store: Checking...</span>
            </div>
            <p class="section-subtitle" style="margin-top:12px;">RAM: ${formatNumber(health.memoryRssMb || 0)} MB</p>
          </article>

          <article class="card">
            <h3 class="section-title">Top Active Servers</h3>
            <p class="section-subtitle">Most active linked servers.</p>
            ${
              topServers.length
                ? `<ul class="feed-list">${topServers
                    .slice(0, 5)
                    .map(
                      (server) => `
                      <li class="feed-item">
                        <div class="feed-item__title">${escapeHtml(server.name)}</div>
                        <div class="feed-item__meta">${formatNumber(server.confessions)} confessions - ${formatNumber(server.members)} members</div>
                      </li>
                    `
                    )
                    .join("")}</ul>`
                : '<div class="empty-state">No server data available.</div>'
            }
          </article>

          <article class="card">
            <h3 class="section-title">Moderation Queue</h3>
            <p class="section-subtitle">Cases that require manual review.</p>
            ${renderMetricCard("Pending", formatNumber(cards.pendingModerationQueue || 0), "Confidence below 70%")}
          </article>

          <article class="card">
            <h3 class="section-title">Recent Confession Messages</h3>
            <p class="section-subtitle">Latest confession messages. Click to view full message.</p>
            ${
              recentConfessionsVisible.length
                ? `<ul class="feed-list">${recentConfessionsVisible
                    .map(
                      (item) => `
                      <li class="feed-item">
                        <div class="feed-item__title">${escapeHtml(item.userTag || item.userId || "Unknown User")}</div>
                        <div class="feed-item__meta">${escapeHtml(item.guildName || "Unknown Server")} - ${formatDate(
                          item.createdAt
                        )}</div>
                        <div class="feed-item__meta">${escapeHtml(item.preview || "")}</div>
                        <div style="margin-top:8px;">
                          <button class="btn btn--small btn--ghost" data-action="view-recent-confession" data-id="${escapeHtml(
                            item.id || ""
                          )}">
                            Show Message
                          </button>
                        </div>
                      </li>
                    `
                    )
                    .join("")}</ul>
                    ${
                      hasMoreRecentConfessions
                        ? `<div style="margin-top:10px;">
                            <button class="btn btn--small btn--ghost" data-action="toggle-recent-confessions">
                              ${state.ui.homeRecentConfessionsExpanded ? "Show Less" : "Show More"}
                            </button>
                          </div>`
                        : ""
                    }`
                : '<div class="empty-state">No recent confession messages yet.</div>'
            }
          </article>
        </div>
      </section>
    `;
  }

  function renderServerSettingsPage() {
    const allSettings = state.data.forms?.serverSettings || [];
    const current =
      allSettings.find((item) => item.guildId === state.ui.selectedGuildId) || allSettings[0] || null;
    const developerAccess = hasDeveloperAccess();
    const developerBlocked = Boolean(current?.developerBlocked);
    const controlsLockedByDeveloper = developerBlocked && !developerAccess;
    const controlsDisabledAttr = controlsLockedByDeveloper ? "disabled" : "";
    const channels = current?.availableChannels || [];
    const logAlertSettings = current?.logAlertSettings || {};
    const logAlertEnabled = (key, fallback = true) =>
      Object.prototype.hasOwnProperty.call(logAlertSettings, key)
        ? Boolean(logAlertSettings[key])
        : fallback;

    return `
      <section class="page ${state.ui.activePage === "server-settings" ? "active" : ""}" data-page="server-settings">
        <article class="card">
          <h3 class="section-title">Server Settings</h3>
          <p class="section-subtitle">Control bot channels for the selected server.</p>
          ${
            developerBlocked
              ? `<div class="inline-alert inline-alert--warning">
                  <strong>Developer Block Active</strong>
                  <span>${
                    developerAccess
                      ? "This server is currently blocked by developers. You can unblock it from Developer Center."
                      : "This server was blocked by bot developers and cannot use the bot until unblocked."
                  }</span>
                </div>`
              : ""
          }

          ${
            current
              ? `
              <div class="form-grid">
                <div class="field">
                  <label>Confession Channel</label>
                  <select id="ss-confession-channel" ${controlsDisabledAttr}>
                    ${renderChannelOptions(channels, current.confessionChannelId || "", true)}
                  </select>
                  <span class="help">Primary channel for confessions.</span>
                </div>
                <div class="field">
                  <label>Panel Channel</label>
                  <select id="ss-panel-channel" ${controlsDisabledAttr}>
                    ${renderChannelOptions(channels, current.panelChannelId || "", true)}
                  </select>
                  <span class="help">Where the confession panel message is posted.</span>
                  <button class="btn btn--ghost btn--small" data-action="resend-panel" type="button" style="margin-top:8px;" ${controlsDisabledAttr}>
                    Re-Send Panel
                  </button>
                </div>
                <div class="field">
                  <label>Logs Channel</label>
                  <select id="ss-logs-channel" ${controlsDisabledAttr}>
                    ${renderChannelOptions(channels, current.logsChannelId || "", true)}
                  </select>
                  <span class="help">Administrative logs channel.</span>
                </div>
                <div class="field">
                  <label>AI Mod Log Channel</label>
                  <select id="ss-moderation-channel" ${controlsDisabledAttr}>
                    ${renderChannelOptions(channels, current.moderationChannelId || "", true)}
                  </select>
                  <span class="help">AI moderation alerts channel.</span>
                </div>
                <div class="field">
                  <label>Daily Messages Quota</label>
                  <input id="ss-daily-message-quota" type="number" min="1" step="1" value="${escapeHtml(
                    parsePositiveIntSetting(current.dailyMessageQuota, 50)
                  )}" ${controlsDisabledAttr} />
                  <span class="help">Default 50/day. Used today: ${escapeHtml(
                    Number(current.dailyMessageUsed || 0)
                  )} | Remaining: ${escapeHtml(Number(current.dailyMessageRemaining || 0))}</span>
                </div>
                <div class="field">
                  <label>Cooldown (seconds)</label>
                  <input type="number" value="${escapeHtml(current.cooldownSeconds)}" disabled />
                  <span class="help">Current global value (per-server support can be extended).</span>
                </div>
                <div class="field">
                  <label>Max Message Length</label>
                  <input type="number" value="${escapeHtml(current.maxMessageLength)}" disabled />
                  <span class="help">Maximum message length.</span>
                </div>
                <div class="field">
                  <label>Discord OAuth Status</label>
                  <input value="${state.data.oauth?.connected ? "Connected" : "Not Connected"}" disabled />
                  <span class="help">Dashboard access is linked to your Discord account.</span>
                </div>
              </div>

              <div class="grid cols-2" style="margin-top:12px;">
                ${renderSwitchRow("Enable Bot", current.botEnabled, "bot-enabled", controlsLockedByDeveloper)}
                ${renderSwitchRow("Allow Anonymous Posting", current.anonymousPosting, "anonymous-posting", controlsLockedByDeveloper)}
                ${renderSwitchRow("Enable Replies", current.repliesEnabled, "reply-enabled", controlsLockedByDeveloper)}
                ${renderSwitchRow("Enable AI Moderation", current.aiModerationEnabled, "ai-enabled", controlsLockedByDeveloper)}
              </div>

              <h3 class="section-title" style="margin-top:16px;">Owner Log Alerts</h3>
              <p class="section-subtitle">
                Enable or disable log notifications by category.
              </p>
              <div class="grid cols-2" style="margin-top:10px;">
                ${renderSwitchRow(
                  "Confession Sender Alerts",
                  logAlertEnabled("confessionSender", true),
                  "log-alert-confessionSender",
                  controlsLockedByDeveloper
                )}
                ${renderSwitchRow(
                  "Server Profile Updates",
                  logAlertEnabled("guildUpdates", true),
                  "log-alert-guildUpdates",
                  controlsLockedByDeveloper
                )}
                ${renderSwitchRow(
                  "Channel Updates",
                  logAlertEnabled("channelUpdates", true),
                  "log-alert-channelUpdates",
                  controlsLockedByDeveloper
                )}
                ${renderSwitchRow(
                  "Role Updates",
                  logAlertEnabled("roleUpdates", true),
                  "log-alert-roleUpdates",
                  controlsLockedByDeveloper
                )}
                ${renderSwitchRow(
                  "Sticker Updates",
                  logAlertEnabled("stickerUpdates", true),
                  "log-alert-stickerUpdates",
                  controlsLockedByDeveloper
                )}
                ${renderSwitchRow(
                  "Emoji Updates",
                  logAlertEnabled("emojiUpdates", true),
                  "log-alert-emojiUpdates",
                  controlsLockedByDeveloper
                )}
              </div>

              <div class="floating-save-spacer" aria-hidden="true"></div>
            `
              : '<div class="empty-state">No server settings are available for this account.</div>'
          }
        </article>
      </section>
    `;
  }

  function renderFloatingServerSettingsBar() {
    const activePage = getActiveSettingsPageId();
    if (!activePage) return "";

    if (activePage === "server-settings" && !getCurrentServerSettingsItem()) return "";
    if (activePage !== "server-settings" && !getSelectedGuildId()) return "";
    const selectedGuildId = getSelectedGuildId();
    const controlsLockedByDeveloper =
      Boolean(selectedGuildId) &&
      isGuildDeveloperBlockedForDashboard(selectedGuildId) &&
      !hasDeveloperAccess();

    return `
      <div class="floating-save-bar" aria-live="polite">
        <button class="btn btn--ghost floating-reset-btn" data-action="reset-active-settings" type="button" ${
          controlsLockedByDeveloper ? "disabled" : ""
        }>
          Reset
        </button>
        <button class="btn floating-save-btn" data-action="save-active-settings" type="button" ${
          controlsLockedByDeveloper ? "disabled" : ""
        }>
          Save Changes
        </button>
      </div>
    `;
  }

  function renderCategoriesPage() {
    const guildId = getSelectedGuildId();
    const categories = guildId ? getDraftCategoriesSnapshot(guildId) : [];

    return `
      <section class="page ${state.ui.activePage === "categories" ? "active" : ""}" data-page="categories">
        <article class="card">
          <h3 class="section-title">Categories Management</h3>
          <p class="section-subtitle">Add, edit, delete, and reorder categories with color, icon, and status.</p>
          <div class="toolbar" style="margin-bottom:10px;">
            <button class="btn" data-action="category-add">Add Category</button>
            <button class="btn btn--ghost" data-action="category-reorder">Auto Reorder</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Name</th>
                  <th>Color</th>
                  <th>Icon</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${
                  categories.length
                    ? categories
                        .map(
                          (cat) => `
                        <tr>
                          <td>${escapeHtml(cat.order)}</td>
                          <td>${escapeHtml(cat.name)}</td>
                          <td><span class="badge" style="background:${escapeHtml(cat.color)}22;border-color:${escapeHtml(cat.color)}66;color:${escapeHtml(cat.color)};">${escapeHtml(cat.color)}</span></td>
                          <td>${escapeHtml(cat.icon)}</td>
                          <td><span class="badge ${cat.active ? "success" : "danger"}">${cat.active ? "Active" : "Disabled"}</span></td>
                          <td>
                            <div class="toolbar">
                              <button class="btn btn--small btn--ghost" data-action="category-edit" data-id="${escapeHtml(cat.id)}">Edit</button>
                              <button class="btn btn--small btn--danger" data-action="category-delete" data-id="${escapeHtml(cat.id)}">Delete</button>
                            </div>
                          </td>
                        </tr>
                      `
                        )
                        .join("")
                    : '<tr><td colspan="6"><div class="empty-state">No categories yet.</div></td></tr>'
                }
              </tbody>
            </table>
          </div>
          <div class="floating-save-spacer" aria-hidden="true"></div>
        </article>
      </section>
    `;
  }

  function renderModerationPage() {
    const guildId = getSelectedGuildId();
    const moderation = guildId
      ? getSavedGuildForm("moderation", guildId) || DEFAULT_MODERATION_FORM
      : DEFAULT_MODERATION_FORM;
    return `
      <section class="page ${state.ui.activePage === "moderation" ? "active" : ""}" data-page="moderation">
        <div class="grid cols-2">
          <article class="card">
            <h3 class="section-title">Blocked Words Filter</h3>
            <p class="section-subtitle">Manage blocked words with Arabic/English support.</p>
            <div class="grid" style="margin-bottom:10px;">
              ${renderSwitchRow(
                "Enable Blocked Words Filter",
                moderation.badWordsFilterEnabled !== false,
                "mod-badwords-enabled"
              )}
            </div>
            <textarea id="mod-bad-words" rows="8" placeholder="Write comma-separated words">${escapeHtml(
              moderation.badWordsText || ""
            )}</textarea>
          </article>
          <article class="card">
            <h3 class="section-title">Auto Moderation Controls</h3>
            <p class="section-subtitle">Smart filtering options and automatic actions.</p>
            <div class="grid">
              ${renderSwitchRow("Enable AI Moderation", moderation.aiModerationEnabled, "mod-ai")}
              ${renderSwitchRow("Enable Spam Detection", moderation.spamDetectionEnabled, "mod-spam")}
              ${renderSwitchRow("Block Links", moderation.linkRestrictionEnabled, "mod-links")}
              ${renderSwitchRow("Block Images", moderation.imageRestrictionEnabled, "mod-images")}
              ${renderSwitchRow("Auto Reject", moderation.autoRejectEnabled, "mod-reject")}
            </div>
          </article>
        </div>
        <article class="card">
          <h3 class="section-title">Toxicity Threshold</h3>
          <p class="section-subtitle">Set the minimum confidence before automatic enforcement.</p>
          <div class="range-row">
            <input id="toxicity-threshold" type="range" min="40" max="95" value="${escapeHtml(moderation.toxicityThreshold || 70)}" />
            <span class="slider-value" id="toxicity-value">${escapeHtml(moderation.toxicityThreshold || 70)}%</span>
          </div>
        </article>
        <div class="floating-save-spacer" aria-hidden="true"></div>
      </section>
    `;
  }

  function renderAiSettingsPage() {
    const guildId = getSelectedGuildId();
    const ai = guildId ? getSavedGuildForm("ai-settings", guildId) || DEFAULT_AI_FORM : DEFAULT_AI_FORM;
    return `
      <section class="page ${state.ui.activePage === "ai-settings" ? "active" : ""}" data-page="ai-settings">
        <div class="grid cols-3">
          ${renderMetricCard("Integration", ai.integrationStatus || "UNKNOWN", ai.provider || "-")}
          ${renderMetricCard("Creativity", `${ai.creativity || 0}%`, "Creativity level")}
          ${renderMetricCard("Strictness", `${ai.strictness || 0}%`, "Strictness level")}
        </div>
        <div class="grid cols-2">
          <article class="card">
            <h3 class="section-title">AI Prompt Editor</h3>
            <textarea id="ai-conversation-prompt" rows="8">${escapeHtml(ai.conversationPrompt || "")}</textarea>
            <span class="help">Prompt for smart suggestions inside the system.</span>
          </article>
          <article class="card">
            <h3 class="section-title">AI Moderation Prompt</h3>
            <textarea id="ai-moderation-prompt" rows="8">${escapeHtml(ai.moderationPrompt || "")}</textarea>
            <span class="help">Prompt for message classification and moderation.</span>
          </article>
        </div>
        <article class="card">
          <h3 class="section-title">AI Behavior Controls</h3>
          <div class="grid cols-2">
            ${renderSwitchRow("AI Auto-Reply", ai.aiAutoReply, "ai-auto-reply")}
            ${renderSwitchRow("Smart Suggestions", ai.smartSuggestions, "ai-smart-suggestions")}
          </div>
          <div class="form-grid" style="margin-top:10px;">
            <div class="field">
              <label>Creativity</label>
              <input id="ai-creativity" type="range" min="0" max="100" value="${escapeHtml(ai.creativity || 0)}" />
            </div>
            <div class="field">
              <label>Strictness</label>
              <input id="ai-strictness" type="range" min="0" max="100" value="${escapeHtml(ai.strictness || 0)}" />
            </div>
          </div>
        </article>
        <div class="floating-save-spacer" aria-hidden="true"></div>
      </section>
    `;
  }

  function renderOptions(values, selected) {
    return values
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`
      )
      .join("");
  }

  function getFilteredLogs() {
    const allLogs = state.data.tables?.logs || [];
    return allLogs.filter((item) => {
      const query = state.ui.logsSearch.trim().toLowerCase();
      const statusOk = state.ui.logsStatus === "ALL" || item.status === state.ui.logsStatus;
      const categoryOk = state.ui.logsCategory === "ALL" || item.category === state.ui.logsCategory;
      const queryOk =
        !query ||
        [item.id, item.server, item.author, item.contentPreview]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return statusOk && categoryOk && queryOk;
    });
  }

  function renderLogsPage() {
    const logs = getFilteredLogs();
    const categories = [...new Set((state.data.tables?.logs || []).map((item) => item.category))];
    const totalPages = Math.max(1, Math.ceil(logs.length / state.ui.logsPerPage));
    if (state.ui.logsPage > totalPages) state.ui.logsPage = totalPages;
    const start = (state.ui.logsPage - 1) * state.ui.logsPerPage;
    const pageLogs = logs.slice(start, start + state.ui.logsPerPage);

    return `
      <section class="page ${state.ui.activePage === "logs" ? "active" : ""}" data-page="logs">
        <article class="card">
          <h3 class="section-title">Confession History & Logs</h3>
          <p class="section-subtitle">Search, filter, full view, and CSV export for logs.</p>
          <div class="toolbar" style="margin-bottom:10px;">
            <input style="max-width:260px;" placeholder="Search..." value="${escapeHtml(state.ui.logsSearch)}" data-action="logs-search" />
            <select style="max-width:170px;" data-action="logs-status">${renderOptions(["ALL", "APPROVED", "REJECTED", "PENDING"], state.ui.logsStatus)}</select>
            <select style="max-width:170px;" data-action="logs-category">${renderOptions(["ALL", ...categories], state.ui.logsCategory)}</select>
            <button class="btn btn--ghost" data-action="export-logs">Export Logs</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Log ID</th><th>Server</th><th>Category</th><th>Status</th><th>Preview</th><th>Date</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${
                  pageLogs.length
                    ? pageLogs
                        .map(
                          (item) => `
                        <tr>
                          <td>${escapeHtml(item.id)}</td>
                          <td>${escapeHtml(item.server)}</td>
                          <td>${escapeHtml(item.category)}</td>
                          <td><span class="badge ${item.status === "APPROVED" ? "success" : item.status === "PENDING" ? "warning" : "danger"}">${escapeHtml(item.status)}</span></td>
                          <td>${escapeHtml(item.contentPreview)}</td>
                          <td>${formatDate(item.createdAt)}</td>
                          <td><button class="btn btn--small btn--ghost" data-action="view-log" data-id="${escapeHtml(item.id)}">View Details</button></td>
                        </tr>
                      `
                        )
                        .join("")
                    : '<tr><td colspan="7"><div class="empty-state">No results match the current filters.</div></td></tr>'
                }
              </tbody>
            </table>
          </div>
          <div class="pagination">
            <span class="section-subtitle">Page ${state.ui.logsPage} of ${totalPages}</span>
            <div class="toolbar">
              <button class="btn btn--small btn--ghost" data-action="logs-prev">Previous</button>
              <button class="btn btn--small btn--ghost" data-action="logs-next">Next</button>
            </div>
          </div>
        </article>
      </section>
    `;
  }

  function renderAnalyticsPage() {
    const cards = state.data.cards || {};
    const ai = state.data.widgets?.aiUsageBreakdown || {};
    const heatmap = state.data.widgets?.heatmap || [];

    return `
      <section class="page ${state.ui.activePage === "analytics" ? "active" : ""}" data-page="analytics">
        <div class="grid cards-4">
          ${renderMetricCard("Daily Confessions", formatNumber(state.data.activity?.weekly?.[6]?.value || 0), "Latest day")}
          ${renderMetricCard("Moderation Cases", formatNumber(ai.automatedActions || 0), "Automated actions")}
          ${renderMetricCard("Low Confidence", formatNumber(ai.lowConfidenceOnly || 0), "Requires manual review")}
          ${renderMetricCard("AI Quality", `${formatNumber(ai.moderationAccuracyHint || 0)}%`, "Internal estimate")}
        </div>
        <div class="grid cols-2">
          <article class="card">
            <h3 class="section-title">Daily / Weekly / Monthly Chart</h3>
            <div class="chart-wrap"><canvas id="analytics-line-chart" class="line-chart"></canvas></div>
          </article>
          <article class="card">
            <h3 class="section-title">Moderation Breakdown</h3>
            <div class="feed-list">
              <div class="feed-item"><div class="feed-item__title">AI Automated: ${formatNumber(ai.automatedActions || 0)}</div></div>
              <div class="feed-item"><div class="feed-item__title">Low Confidence: ${formatNumber(ai.lowConfidenceOnly || 0)}</div></div>
              <div class="feed-item"><div class="feed-item__title">Severe Cases: ${formatNumber(ai.severeCases || 0)}</div></div>
              <div class="feed-item"><div class="feed-item__title">Pending Queue: ${formatNumber(cards.pendingModerationQueue || 0)}</div></div>
            </div>
          </article>
        </div>
        <article class="card">
          <h3 class="section-title">User Activity Heatmap</h3>
          <p class="section-subtitle">Activity distribution across recent weeks.</p>
          ${
            heatmap.length
              ? `<div class="heatmap">
                  ${heatmap
                    .map(
                      (week) => `<div class="heatmap-week">${week
                        .map((value) => `<span class="heat-cell heat-${Math.max(0, Math.min(5, Number(value)))}"></span>`)
                        .join("")}</div>`
                    )
                    .join("")}
                </div>`
              : '<div class="empty-state">Not enough activity data.</div>'
          }
        </article>
      </section>
    `;
  }

  function renderBrandingPage() {
    const guildId = getSelectedGuildId();
    const branding = guildId
      ? getSavedGuildForm("branding", guildId) || DEFAULT_BRANDING_FORM
      : DEFAULT_BRANDING_FORM;

    return `
      <section class="page ${state.ui.activePage === "branding" ? "active" : ""}" data-page="branding">
        <article class="card">
          <h3 class="section-title">Branding & Appearance Settings</h3>
          <p class="section-subtitle">Customize dashboard and message appearance.</p>
          <div class="form-grid">
            <div class="field"><label>Embed Color</label><input id="brand-embed-color" type="color" value="${escapeHtml(branding.embedColor || "#7c5cff")}" /></div>
            <div class="field"><label>Bot Footer Text</label><input id="brand-bot-footer" value="${escapeHtml(branding.botFooter || "")}" /></div>
            <div class="field"><label>Success Message</label><input id="brand-success-message" value="${escapeHtml(branding.successMessage || "")}" /></div>
            <div class="field"><label>Error Message</label><input id="brand-error-message" value="${escapeHtml(branding.errorMessage || "")}" /></div>
            <div class="field"><label>UI Theme</label><select id="brand-ui-theme">${renderOptions(["dark-violet", "dark-indigo", "dark-rose"], branding.uiTheme || "dark-violet")}</select></div>
          </div>
          <div class="floating-save-spacer" aria-hidden="true"></div>
        </article>
      </section>
    `;
  }

  function renderLanguagePage() {
    const guildId = getSelectedGuildId();
    const language = guildId
      ? getSavedGuildForm("language", guildId) || DEFAULT_LANGUAGE_FORM
      : DEFAULT_LANGUAGE_FORM;

    return `
      <section class="page ${state.ui.activePage === "language" ? "active" : ""}" data-page="language">
        <article class="card">
          <h3 class="section-title">Language Settings</h3>
          <p class="section-subtitle">Choose default language for bot replies and dashboard labels.</p>
          <div class="form-grid">
            <div class="field">
              <label>Bot Language</label>
              <select id="lang-language">${renderOptions(["en", "ar"], language.language || "en")}</select>
              <span class="help">English is default. You can switch to Arabic anytime.</span>
            </div>
          </div>
          <div class="floating-save-spacer" aria-hidden="true"></div>
        </article>
      </section>
    `;
  }

  function renderWelcomePage() {
    const guildId = getSelectedGuildId();
    const welcome = guildId
      ? getSavedGuildForm("welcome", guildId) || DEFAULT_WELCOME_FORM
      : DEFAULT_WELCOME_FORM;
    const current = getCurrentServerSettingsItem();
    const channels = current?.availableChannels || [];
    const roles = current?.availableRoles || [];
    const roleFilters = normalizeWelcomeRoleFilters(welcome.roleFilters || []);
    const roleFilterRowsMarkup = roleFilters.length
      ? roleFilters
          .map((item, index) => renderWelcomeRoleFilterRow(item, roles, `${index + 1}`))
          .join("")
      : '<div class="empty-state">No role-based color presets yet.</div>';
    const imageFilter = normalizeWelcomeImageFilter(welcome.imageFilter || "none", "none");

    const rawBackground = String(welcome.backgroundImage || "asset://welcome-default.png");
    const previewBackground = toWelcomePreviewBackground(rawBackground);
    const previewOverlayText = String(welcome.overlayText || "").trim().slice(0, 180);
    const previewAvatarUrl = String(state.data?.auth?.user?.avatarUrl || "/assets/zllawi-logo.png");
    const previewOverlayTextSize = clampNumber(welcome.overlayTextSize, 60, 220, 100);
    const previewOverlayTextX = clampNumber(welcome.overlayTextX, 5, 95, 73, 1);
    const previewOverlayTextY = clampNumber(welcome.overlayTextY, 8, 92, 50, 1);
    const previewAvatarScale = clampNumber(welcome.avatarScale, 55, 180, 100);
    const previewAvatarX = clampNumber(welcome.avatarX, 8, 92, 30.2, 1);
    const previewAvatarY = clampNumber(welcome.avatarY, 8, 92, 48.8, 1);
    const guildMembersIntentEnabled = isGuildMembersIntentEnabled();
    const intentWarning = guildMembersIntentEnabled
      ? ""
      : `
          <div class="inline-alert inline-alert--warning">
            <strong>${escapeHtml(tr("Welcome join events need Server Members Intent."))}</strong>
            <span>${escapeHtml(
              tr(
                "Enable intent in Discord Developer Portal, set ENABLE_GUILD_MEMBERS_INTENT=true, then restart backend."
              )
            )}</span>
          </div>
        `;

    return `
      <section class="page ${state.ui.activePage === "welcome" ? "active" : ""}" data-page="welcome">
        <article class="card">
          <h3 class="section-title">Welcome Settings</h3>
          <p class="section-subtitle">Configure animated welcome card with member avatar in the center.</p>
          ${intentWarning}

          <div class="grid" style="margin-bottom:10px;">
            ${renderSwitchRow("Enable Welcome", Boolean(welcome.enabled), "welcome-enabled")}
            ${renderSwitchRow("Mention New Member", welcome.mentionUser !== false, "welcome-mention-user")}
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Welcome Channel</label>
              <select id="welcome-channel">
                ${renderChannelOptions(channels, String(welcome.channelId || ""), true)}
              </select>
              <span class="help">Text channel where welcome message and animated card are sent.</span>
              <button class="btn btn--ghost btn--small" data-action="send-test-welcome" type="button" style="margin-top:8px;">
                Send Test Welcome
              </button>
            </div>
            <div class="field">
              <label>Welcome Background Image</label>
              <input id="welcome-background-image" value="${escapeHtml(rawBackground)}" placeholder="asset://welcome-default.png or https://..." />
              <span class="help">Use image URL (http/https) or asset://welcome-default.png.</span>
            </div>
          </div>

          <div class="field" style="margin-top:10px;">
            <label>Welcome Message</label>
            <textarea id="welcome-message" rows="4" placeholder="Welcome {user} to {server}!">${escapeHtml(
              welcome.message || "Welcome {user} to {server}!"
            )}</textarea>
            <span class="help">Placeholders: {user}, {server}</span>
          </div>

          <div class="form-grid" style="margin-top:10px;">
            <div class="field">
              <label>Default Color LUT</label>
              <select id="welcome-image-filter">
                ${renderWelcomeImageFilterOptions(imageFilter)}
              </select>
              <span class="help">Used when no role-based color preset matches the joining member.</span>
            </div>
            <div class="field">
              <label>Role-Based Color LUT</label>
              <div id="welcome-role-filters-list" class="welcome-role-filters-list">
                ${roleFilterRowsMarkup}
              </div>
              <div class="toolbar" style="margin-top:8px;">
                <button
                  class="btn btn--ghost btn--small"
                  data-action="add-welcome-role-filter"
                  type="button"
                  ${roles.length ? "" : "disabled"}
                >
                  Add Role Color
                </button>
              </div>
              <span class="help">Priority is top-to-bottom in this list (first matching role wins).</span>
            </div>
          </div>

          <div class="field" style="margin-top:10px;">
            <label>Welcome Card Right Text (Optional)</label>
            <input id="welcome-overlay-text" value="${escapeHtml(previewOverlayText)}" placeholder="Write optional text on the right side..." />
            <span class="help">Leave empty to disable extra text on the card.</span>
          </div>

          <div class="form-grid" style="margin-top:10px;">
            <div class="field">
              <label>Text Size</label>
              <input id="welcome-overlay-text-size" type="range" min="60" max="220" step="1" value="${escapeHtml(
                previewOverlayTextSize
              )}" />
              <span id="welcome-overlay-text-size-value" class="help">${escapeHtml(
                `${previewOverlayTextSize}%`
              )}</span>
            </div>
            <div class="field">
              <label>Avatar Size</label>
              <input id="welcome-avatar-scale" type="range" min="55" max="180" step="1" value="${escapeHtml(
                previewAvatarScale
              )}" />
              <span id="welcome-avatar-scale-value" class="help">${escapeHtml(
                `${previewAvatarScale}%`
              )}</span>
            </div>
          </div>

          <div class="form-grid" style="margin-top:10px;">
            <div class="field">
              <label>Text Position X (%)</label>
              <input id="welcome-overlay-text-x" type="number" min="5" max="95" step="0.1" value="${escapeHtml(
                previewOverlayTextX
              )}" />
            </div>
            <div class="field">
              <label>Text Position Y (%)</label>
              <input id="welcome-overlay-text-y" type="number" min="8" max="92" step="0.1" value="${escapeHtml(
                previewOverlayTextY
              )}" />
            </div>
            <div class="field">
              <label>Avatar Position X (%)</label>
              <input id="welcome-avatar-x" type="number" min="8" max="92" step="0.1" value="${escapeHtml(
                previewAvatarX
              )}" />
            </div>
            <div class="field">
              <label>Avatar Position Y (%)</label>
              <input id="welcome-avatar-y" type="number" min="8" max="92" step="0.1" value="${escapeHtml(
                previewAvatarY
              )}" />
            </div>
          </div>

          <div class="field" style="margin-top:10px;">
            <label>Live Welcome Preview</label>
            <div id="welcome-preview-card" class="welcome-preview-card">
              <img id="welcome-preview-image" src="${escapeHtml(previewBackground)}" alt="Welcome background preview" />
              <div
                id="welcome-preview-avatar"
                class="welcome-preview-avatar"
                style="left:${escapeHtml(`${previewAvatarX}%`)};top:${escapeHtml(
                  `${previewAvatarY}%`
                )};width:${escapeHtml(`calc(28.4% * ${previewAvatarScale / 100})`)};"
              >
                <img src="${escapeHtml(previewAvatarUrl)}" alt="Avatar preview" />
              </div>
              <div
                id="welcome-preview-overlay-text"
                class="welcome-preview-text ${previewOverlayText ? "" : "is-hidden"}"
                style="left:${escapeHtml(`${previewOverlayTextX}%`)};top:${escapeHtml(
                  `${previewOverlayTextY}%`
                )};font-size:${escapeHtml(
                  `calc(clamp(16px, 1.95vw, 33px) * ${previewOverlayTextSize / 100})`
                )};"
              >${escapeHtml(previewOverlayText)}</div>
            </div>
            <span class="help">Drag avatar or text directly with the mouse to change position.</span>
          </div>

          <div class="floating-save-spacer" aria-hidden="true"></div>
        </article>
      </section>
    `;
  }

  function renderLevelsPage() {
    const guildId = getSelectedGuildId();
    const levels = normalizeLevelsFormSnapshot(
      guildId ? getSavedGuildForm("levels", guildId) || DEFAULT_LEVELS_FORM : DEFAULT_LEVELS_FORM
    );
    const current = getCurrentServerSettingsItem();
    const roles = current?.availableRoles || [];
    const rewardRowsMarkup = levels.rewards.length
      ? levels.rewards
          .map((item, index) => renderLevelRewardRow(item, roles, `${index + 1}`))
          .join("")
      : '<div class="empty-state">No level role rewards configured yet.</div>';
    const roleFilterRowsMarkup = levels.roleFilters.length
      ? levels.roleFilters
          .map((item, index) => renderLevelsRoleFilterRow(item, roles, `lf-${index + 1}`))
          .join("")
      : '<div class="empty-state">No role-based level colors yet.</div>';
    const roleTemplateRowsMarkup = levels.roleCardTemplates.length
      ? levels.roleCardTemplates
          .map((item, index) => renderLevelsRoleTemplateRow(item, roles, `lt-${index + 1}`))
          .join("")
      : '<div class="empty-state">No role-based templates yet.</div>';
    const brandingForm = guildId ? getSavedGuildForm("branding", guildId) || {} : {};
    const previewFilter = normalizeWelcomeImageFilter(levels.imageFilter || "none", "none");
    const previewTemplate = normalizeLevelCardTemplateKey(levels.cardTemplate || "blue", "blue");
    const previewTemplateSrc = resolveLevelCardTemplateAsset(previewTemplate);
    const previewAccent =
      LEVEL_FILTER_ACCENT_COLORS[previewFilter] ||
      sanitizeHexColorInput(brandingForm?.embedColor, "#8aa9ff") ||
      "#8aa9ff";
    const previewAvatar =
      String(state.data?.auth?.user?.avatarUrl || "").trim() || "/assets/zllawi-logo.png";
    const previewUsername = String(
      state.data?.auth?.user?.username || state.data?.auth?.user?.tag || "Member"
    )
      .trim()
      .slice(0, 22) || "Member";
    const previewAvatarScale = clampNumber(levels.avatarScale, 55, 180, 100);
    const previewUsernameScale = clampNumber(levels.usernameScale, 70, 170, 100);
    const previewStatsScale = clampNumber(levels.statsScale, 70, 170, 100);

    return `
      <section class="page ${state.ui.activePage === "levels" ? "active" : ""}" data-page="levels">
        <article class="card">
          <h3 class="section-title">Levels Settings</h3>
          <p class="section-subtitle">Modern transparent level-card system with dynamic overlay colors and level role rewards.</p>

          <div class="grid" style="margin-bottom:10px;">
            ${renderSwitchRow("Enable Levels", Boolean(levels.enabled), "levels-enabled")}
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Min XP Per Message</label>
              <input id="levels-min-xp" type="number" min="1" max="500" step="1" value="${escapeHtml(
                levels.minXp
              )}" />
            </div>
            <div class="field">
              <label>Max XP Per Message</label>
              <input id="levels-max-xp" type="number" min="1" max="5000" step="1" value="${escapeHtml(
                levels.maxXp
              )}" />
            </div>
            <div class="field">
              <label>XP Cooldown (Seconds)</label>
              <input
                id="levels-cooldown-seconds"
                type="number"
                min="0"
                max="900"
                step="1"
                value="${escapeHtml(levels.cooldownSeconds)}"
              />
              <span class="help">Each user earns XP once per cooldown window.</span>
            </div>
            <div class="field">
              <label>Default Color LUT</label>
              <select id="levels-image-filter">
                ${renderWelcomeImageFilterOptions(levels.imageFilter || "none")}
              </select>
              <span class="help">Default level-card color when no role rule matches.</span>
            </div>
            <div class="field">
              <label>Default Card Template</label>
              <select id="levels-card-template">
                ${renderLevelCardTemplateOptions(levels.cardTemplate || "blue")}
              </select>
              <span class="help">Fallback template if no role template rule matches.</span>
            </div>
            <div class="field">
              <label>
                Avatar Size
                <span class="slider-value" id="levels-avatar-scale-value">${escapeHtml(
                  `${previewAvatarScale}%`
                )}</span>
              </label>
              <input
                id="levels-avatar-scale"
                type="range"
                min="55"
                max="180"
                step="1"
                value="${escapeHtml(previewAvatarScale)}"
              />
            </div>
            <div class="field">
              <label>
                Username Size
                <span class="slider-value" id="levels-username-scale-value">${escapeHtml(
                  `${previewUsernameScale}%`
                )}</span>
              </label>
              <input
                id="levels-username-scale"
                type="range"
                min="70"
                max="170"
                step="1"
                value="${escapeHtml(previewUsernameScale)}"
              />
            </div>
            <div class="field">
              <label>
                Stats Size
                <span class="slider-value" id="levels-stats-scale-value">${escapeHtml(
                  `${previewStatsScale}%`
                )}</span>
              </label>
              <input
                id="levels-stats-scale"
                type="range"
                min="70"
                max="170"
                step="1"
                value="${escapeHtml(previewStatsScale)}"
              />
            </div>
          </div>

          <div class="field levels-card-preview-field" style="margin-top:12px;">
            <label>Live Level Card UI Preview</label>
            <div
              id="levels-card-preview"
              class="levels-card-preview"
              style="--level-accent:${escapeHtml(previewAccent)};--level-accent-soft:${escapeHtml(
                `${previewAccent}66`
              )};--level-avatar-scale:${escapeHtml(
                (previewAvatarScale / 100).toFixed(2)
              )};--level-username-scale:${escapeHtml(
                (previewUsernameScale / 100).toFixed(2)
              )};--level-stats-scale:${escapeHtml((previewStatsScale / 100).toFixed(2))};"
            >
              <img
                id="levels-preview-template"
                class="levels-card-preview__overlay"
                src="${escapeHtml(previewTemplateSrc)}"
                alt="Levels overlay template preview"
                loading="lazy"
                decoding="async"
              />
              <div class="levels-card-preview__tint" aria-hidden="true"></div>
              <div class="levels-card-preview__particle levels-card-preview__particle--a" aria-hidden="true"></div>
              <div class="levels-card-preview__particle levels-card-preview__particle--b" aria-hidden="true"></div>
              <div class="levels-card-preview__particle levels-card-preview__particle--c" aria-hidden="true"></div>
              <div class="levels-card-preview__avatar">
                <img src="${escapeHtml(previewAvatar)}" alt="Preview avatar" loading="lazy" decoding="async" />
              </div>
              <div class="levels-card-preview__content">
                <h4 id="levels-preview-username">${escapeHtml(previewUsername)}</h4>
                <div class="levels-card-preview__meta-row">
                  <strong id="levels-preview-level">LVL 15</strong>
                  <span id="levels-preview-rank">#12</span>
                </div>
                <div class="levels-card-preview__progress-track">
                  <div id="levels-preview-progress-fill" class="levels-card-preview__progress-fill"></div>
                </div>
                <div class="levels-card-preview__stats-row">
                  <span id="levels-preview-xp">420 / 700 XP</span>
                  <span id="levels-preview-accent">Default Template: ${escapeHtml(
                    (LEVEL_CARD_TEMPLATE_LABELS[previewTemplate] || previewTemplate).toString()
                  )} | Default LUT: ${escapeHtml(previewAccent.toUpperCase())}</span>
                </div>
              </div>
            </div>
            <span class="help">Final output from slash command is PNG 1024x450 with transparent background and dynamic glow.</span>
          </div>

          <div class="field" style="margin-top:10px;">
            <label>Role-Based Card Templates</label>
            <div id="levels-role-templates-list" class="levels-role-templates-list">
              ${roleTemplateRowsMarkup}
            </div>
            <div class="toolbar" style="margin-top:8px;">
              <button
                class="btn btn--ghost btn--small"
                data-action="add-levels-role-template"
                type="button"
                ${roles.length ? "" : "disabled"}
              >
                Add Role Template
              </button>
            </div>
            <span class="help">Top-to-bottom priority. Example: pink for female role, blue for male role.</span>
          </div>

          <div class="field" style="margin-top:10px;">
            <label>Role-Based Level Card Colors</label>
            <div id="levels-role-filters-list" class="levels-role-filters-list">
              ${roleFilterRowsMarkup}
            </div>
            <div class="toolbar" style="margin-top:8px;">
              <button
                class="btn btn--ghost btn--small"
                data-action="add-levels-role-filter"
                type="button"
                ${roles.length ? "" : "disabled"}
              >
                Add Role Color
              </button>
            </div>
            <span class="help">Top-to-bottom priority. First matching role decides level-card color.</span>
          </div>

          <div class="field" style="margin-top:10px;">
            <label>Role Rewards by Level</label>
            <div id="levels-reward-list" class="levels-reward-list">
              ${rewardRowsMarkup}
            </div>
            <div class="toolbar" style="margin-top:8px;">
              <button
                class="btn btn--ghost btn--small"
                data-action="add-level-reward"
                type="button"
                ${roles.length ? "" : "disabled"}
              >
                Add Reward
              </button>
            </div>
            <span class="help">When a member reaches the configured level, the role is granted automatically.</span>
          </div>

          <div class="floating-save-spacer" aria-hidden="true"></div>
        </article>
      </section>
    `;
  }

  function buildShopCardStatusText(cardInventory = []) {
    const normalizedInventory = normalizeShopCardInventorySnapshot(cardInventory);
    if (!normalizedInventory.length) return "No cards yet.";

    return normalizedInventory
      .map((entry, index) => {
        if (entry.sold === true) {
          const soldAtText = entry.soldAt
            ? new Date(Number(entry.soldAt)).toISOString()
            : "unknown-time";
          return `${index + 1}. CONSUMED (مستهلك) | user:${entry.soldToUserId || "unknown"} | ${soldAtText}`;
        }
        return `${index + 1}. AVAILABLE | ${entry.code}`;
      })
      .join("\n");
  }

  function renderShopItemRow(item, roles, rowId) {
    const normalized = normalizeShopItemSnapshot(item, Number(rowId) || 0);
    const typeOptions = ["role", "nickname", "announcement", "feature", "card"]
      .map(
        (value) =>
          `<option value="${value}" ${normalized.type === value ? "selected" : ""}>${value}</option>`
      )
      .join("");
    const categoryOptions = ["basic", "premium", "rare"]
      .map(
        (value) =>
          `<option value="${value}" ${normalized.category === value ? "selected" : ""}>${value}</option>`
      )
      .join("");
    const unsoldCards = normalized.cardInventory.filter((entry) => entry.sold !== true);
    const cardCodesText = unsoldCards.map((entry) => entry.code).join("\n");
    const cardStatusText = buildShopCardStatusText(normalized.cardInventory);

    return `
      <div class="economy-shop-item-row" data-shop-item-row data-row-id="${escapeHtml(rowId)}">
        <div class="economy-shop-item-row__head">
          <label class="economy-check">
            <input type="checkbox" data-shop-item-enabled ${normalized.enabled ? "checked" : ""} />
            <span>Enabled</span>
          </label>
          <button class="btn btn--ghost btn--small" type="button" data-action="remove-shop-item">Remove</button>
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Item ID</label>
            <input data-shop-item-id value="${escapeHtml(normalized.id)}" placeholder="vip-role" />
          </div>
          <div class="field">
            <label>Name</label>
            <input data-shop-item-name value="${escapeHtml(normalized.name)}" placeholder="VIP Role" />
          </div>
          <div class="field">
            <label>Price</label>
            <input data-shop-item-price type="number" min="0" max="100000000" step="1" value="${escapeHtml(
              normalized.price
            )}" />
          </div>
          <div class="field">
            <label>Category</label>
            <select data-shop-item-category>${categoryOptions}</select>
          </div>
          <div class="field">
            <label>Type</label>
            <select data-shop-item-type>${typeOptions}</select>
          </div>
          <div class="field">
            <label>Role Reward</label>
            <select data-shop-item-role>
              ${renderRoleOptions(roles, normalized.roleId, true, "-- No Role --")}
            </select>
          </div>
          <div class="field">
            <label>Nickname Template</label>
            <input data-shop-item-nickname value="${escapeHtml(normalized.nickname)}" placeholder="{user} VIP" />
          </div>
          <div class="field">
            <label>Feature Key</label>
            <input data-shop-item-feature value="${escapeHtml(normalized.featureKey)}" placeholder="feature:key" />
          </div>
          <div class="field">
            <label>Role Duration Days</label>
            <input data-shop-item-duration type="number" min="0" max="3650" step="1" value="${escapeHtml(
              normalized.durationDays
            )}" />
          </div>
          <div class="field">
            <label>Item Cooldown Seconds</label>
            <input data-shop-item-cooldown type="number" min="0" max="86400" step="1" value="${escapeHtml(
              normalized.cooldownSeconds
            )}" />
          </div>
          <div class="field">
            <label>Card Cooldown Days</label>
            <input data-shop-item-card-cooldown-days type="number" min="0" max="3650" step="1" value="${escapeHtml(
              normalized.cardCooldownDays
            )}" />
            <span class="help">Card items: one purchase per user every N days (default: 1).</span>
          </div>
          <div class="field">
            <label>Total Purchase Limit</label>
            <input data-shop-item-purchase-limit type="number" min="0" max="1000000" step="1" value="${escapeHtml(
              normalized.purchaseLimit
            )}" />
          </div>
          <div class="field">
            <label>User Purchase Limit</label>
            <input data-shop-item-user-limit type="number" min="0" max="1000000" step="1" value="${escapeHtml(
              normalized.userPurchaseLimit
            )}" />
          </div>
        </div>
        <div class="field" style="margin-top:8px;">
          <label>Description</label>
          <input data-shop-item-description value="${escapeHtml(normalized.description)}" placeholder="Short shop description..." />
        </div>
        <div class="field" style="margin-top:8px;">
          <label>Announcement Message</label>
          <textarea data-shop-item-message rows="2" placeholder="Used only by announcement items.">${escapeHtml(
            normalized.message
          )}</textarea>
        </div>
        <div class="field" style="margin-top:8px;">
          <label>One-Time Card Codes</label>
          <textarea data-shop-item-card-codes rows="4" placeholder="One code per line.">${escapeHtml(
            cardCodesText
          )}</textarea>
          <span class="help">Each code can be purchased once only.</span>
        </div>
        <div class="field" style="margin-top:8px;">
          <label>Cards Status</label>
          <textarea data-shop-item-card-status rows="4" readonly>${escapeHtml(cardStatusText)}</textarea>
        </div>
        <textarea data-shop-item-card-inventory style="display:none;">${escapeHtml(
          JSON.stringify(normalized.cardInventory)
        )}</textarea>
        <div class="field" style="margin-top:8px;">
          <label>Limited Until</label>
          <input data-shop-item-limited-until value="${escapeHtml(
            normalized.limitedUntil
          )}" placeholder="2026-12-31T23:59:00.000Z" />
        </div>
      </div>
    `;
  }

  function renderEconomyPage() {
    const guildId = getSelectedGuildId();
    const economy = normalizeEconomyFormSnapshot(
      guildId ? getSavedGuildForm("economy", guildId) || DEFAULT_ECONOMY_FORM : DEFAULT_ECONOMY_FORM
    );
    const current = getCurrentServerSettingsItem();
    const channels = current?.availableChannels || [];
    const roles = current?.availableRoles || [];
    const shopRows = economy.shopItems.length
      ? economy.shopItems
          .map((item, index) => renderShopItemRow(item, roles, `${index + 1}`))
          .join("")
      : '<div class="empty-state">No shop items configured yet.</div>';

    return `
      <section class="page ${state.ui.activePage === "economy" ? "active" : ""}" data-page="economy">
        <article class="card">
          <h3 class="section-title">Economy & Shop</h3>
          <p class="section-subtitle">Control points earning, daily caps, shop channels, taxes, and role purchase safety.</p>

          <div class="grid" style="margin-bottom:10px;">
            ${renderSwitchRow("Enable Economy", Boolean(economy.enabled), "economy-enabled")}
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Shop Channel</label>
              <select id="economy-shop-channel">
                ${renderChannelOptions(channels, economy.shopChannelId, true)}
              </select>
            </div>
            <div class="field">
              <label>Purchase Logs Channel</label>
              <select id="economy-log-channel">
                ${renderChannelOptions(channels, economy.purchaseLogChannelId, true)}
              </select>
            </div>
            <div class="field">
              <label>Message Points</label>
              <input id="economy-message-points" type="number" min="0" max="10000" step="1" value="${escapeHtml(
                economy.messagePoints
              )}" />
            </div>
            <div class="field">
              <label>Message Cooldown Seconds</label>
              <input id="economy-message-cooldown" type="number" min="1" max="3600" step="1" value="${escapeHtml(
                economy.messageCooldownSeconds
              )}" />
            </div>
            <div class="field">
              <label>Message Daily Limit</label>
              <input id="economy-message-daily-limit" type="number" min="0" max="1000000" step="1" value="${escapeHtml(
                economy.messageDailyLimit
              )}" />
            </div>
            <div class="field">
              <label>Voice Points Per Minute</label>
              <input id="economy-voice-points" type="number" min="0" max="10000" step="1" value="${escapeHtml(
                economy.voicePointsPerMinute
              )}" />
            </div>
            <div class="field">
              <label>Voice Daily Limit</label>
              <input id="economy-voice-daily-limit" type="number" min="0" max="1000000" step="1" value="${escapeHtml(
                economy.voiceDailyLimit
              )}" />
            </div>
            <div class="field">
              <label>Reaction Received Points</label>
              <input id="economy-reaction-points" type="number" min="0" max="10000" step="1" value="${escapeHtml(
                economy.reactionReceivedPoints
              )}" />
            </div>
            <div class="field">
              <label>Reaction Daily Limit</label>
              <input id="economy-reaction-daily-limit" type="number" min="0" max="1000000" step="1" value="${escapeHtml(
                economy.reactionDailyLimit
              )}" />
            </div>
            <div class="field">
              <label>Daily Reward</label>
              <input id="economy-daily-reward" type="number" min="0" max="1000000" step="1" value="${escapeHtml(
                economy.dailyRewardAmount
              )}" />
            </div>
            <div class="field">
              <label>Max Daily Earning Limit</label>
              <input id="economy-daily-limit" type="number" min="1" max="10000000" step="1" value="${escapeHtml(
                economy.dailyEarningLimit
              )}" />
            </div>
            <div class="field">
              <label>Purchase Tax Percent</label>
              <input id="economy-tax-percent" type="number" min="0" max="100" step="1" value="${escapeHtml(
                economy.purchaseTaxPercent
              )}" />
            </div>
            <div class="field">
              <label>Purchase Cooldown Seconds</label>
              <input id="economy-purchase-cooldown" type="number" min="0" max="86400" step="1" value="${escapeHtml(
                economy.purchaseCooldownSeconds
              )}" />
            </div>
            <div class="field">
              <label>Default Role Duration Days</label>
              <input id="economy-role-duration" type="number" min="0" max="3650" step="1" value="${escapeHtml(
                economy.roleDurationDays
              )}" />
            </div>
            <div class="field">
              <label>Purchasable Roles</label>
              <select id="economy-allowed-roles" multiple size="7">
                ${renderMultiRoleOptions(roles, economy.allowedRoleIds)}
              </select>
              <span class="help">Role shop items only work when their role is selected here.</span>
            </div>
            <div class="field">
              <label>Exclusive Roles</label>
              <select id="economy-exclusive-roles" multiple size="7">
                ${renderMultiRoleOptions(roles, economy.exclusiveRoleIds)}
              </select>
              <span class="help">Buying one exclusive role removes the other selected exclusive roles.</span>
            </div>
            <div class="field">
              <label>Blocked Buyer Roles</label>
              <select id="economy-blocked-buyer-roles" multiple size="7">
                ${renderMultiRoleOptions(roles, economy.blockedBuyerRoleIds)}
              </select>
              <span class="help">Members with any selected role cannot buy from the shop.</span>
            </div>
          </div>

          <div class="toolbar" style="margin-top:12px;">
            <button class="btn btn--ghost btn--small" data-action="resend-shop-message" type="button">
              Re-Send Shop Message
            </button>
          </div>
        </article>

        <article class="card">
          <h3 class="section-title">Shop Items</h3>
          <p class="section-subtitle">Dynamic items shown in /shop and the posted shop panel.</p>
          <div id="economy-shop-items-list" class="economy-shop-items-list">
            ${shopRows}
          </div>
          <div class="toolbar" style="margin-top:10px;">
            <button class="btn btn--ghost btn--small" data-action="refresh-shop-card-status" type="button">
              Refresh Cards Status
            </button>
            <button class="btn btn--ghost btn--small" data-action="add-shop-item" type="button">
              Add Shop Item
            </button>
          </div>
          <div class="floating-save-spacer" aria-hidden="true"></div>
        </article>
      </section>
    `;
  }

  function renderPanelEditorPage() {
    const guildId = getSelectedGuildId();
    const panel = guildId
      ? getSavedGuildForm("panel-editor", guildId) || DEFAULT_PANEL_EDITOR_FORM
      : DEFAULT_PANEL_EDITOR_FORM;
    const previewAccentColor = sanitizeHexColorInput(panel.accentColor, "#7c5cff") || "#7c5cff";

    return `
      <section class="page ${state.ui.activePage === "panel-editor" ? "active" : ""}" data-page="panel-editor">
        <article class="card">
          <h3 class="section-title">Panel Editor</h3>
          <p class="section-subtitle">Edit panel text, style, media links, and resend panel instantly.</p>

          <div class="form-grid">
            <div class="field">
              <label>Panel Title</label>
              <input id="panel-editor-title" value="${escapeHtml(panel.title || "")}" placeholder="Anonymous Confessions" />
            </div>
            <div class="field">
              <label>Button Label</label>
              <input id="panel-editor-button-label" value="${escapeHtml(panel.buttonLabel || "")}" placeholder="Send Anonymous Confession" />
            </div>
          </div>

          <div class="field" style="margin-top:10px;">
            <label>Panel Description</label>
            <textarea id="panel-editor-description" rows="4" placeholder="Write panel description...">${escapeHtml(
              panel.description || ""
            )}</textarea>
          </div>

          <div class="form-grid" style="margin-top:10px;">
            <div class="field">
              <label>Main Image URL</label>
              <input id="panel-editor-image-url" value="${escapeHtml(panel.imageUrl || "")}" placeholder="https://..." />
              <span class="help">Shown as embed image.</span>
            </div>
            <div class="field">
              <label>Thumbnail URL</label>
              <input id="panel-editor-thumbnail-url" value="${escapeHtml(panel.thumbnailUrl || "")}" placeholder="https://..." />
              <span class="help">Shown in top-right of embed.</span>
            </div>
            <div class="field">
              <label>Footer Text</label>
              <input id="panel-editor-footer-text" value="${escapeHtml(panel.footerText || "")}" placeholder="Optional footer..." />
            </div>
            <div class="field">
              <label>Accent Color (Hex)</label>
              <input id="panel-editor-accent-color" value="${escapeHtml(panel.accentColor || "")}" placeholder="#7c5cff" />
            </div>
          </div>

          <div class="toolbar" style="margin-top:12px;">
            <button class="btn btn--ghost btn--small" data-action="resend-panel" type="button">
              Re-Send Panel
            </button>
          </div>

          <div class="field" style="margin-top:14px;">
            <label>Panel Live Preview</label>
            <div class="panel-preview">
              <div id="panel-preview-color" class="panel-preview__color" style="background:${escapeHtml(
                previewAccentColor
              )};"></div>
              <div class="panel-preview__body">
                <img
                  id="panel-preview-thumbnail"
                  class="panel-preview__thumbnail ${panel.thumbnailUrl ? "" : "is-hidden"}"
                  src="${escapeHtml(panel.thumbnailUrl || "about:blank")}"
                  alt="Panel thumbnail preview"
                />
                <h4 id="panel-preview-title" class="panel-preview__title">${escapeHtml(
                  panel.title || "Anonymous Confessions"
                )}</h4>
                <p id="panel-preview-description" class="panel-preview__description">${escapeHtml(
                  panel.description || "Send your confession anonymously using the button below."
                )}</p>
                <img
                  id="panel-preview-image"
                  class="panel-preview__image ${panel.imageUrl ? "" : "is-hidden"}"
                  src="${escapeHtml(panel.imageUrl || "about:blank")}"
                  alt="Panel image preview"
                />
                <div id="panel-preview-footer" class="panel-preview__footer ${panel.footerText ? "" : "is-hidden"}">${escapeHtml(
                  panel.footerText || ""
                )}</div>
              </div>
              <div id="panel-preview-button" class="panel-preview__button">${escapeHtml(
                panel.buttonLabel || "Send Anonymous Confession"
              )}</div>
            </div>
          </div>

          <div class="floating-save-spacer" aria-hidden="true"></div>
        </article>
      </section>
    `;
  }

  function renderAnnouncementsPage() {
    const guildId = getSelectedGuildId();
    const announcement = normalizeAnnouncementForm(
      guildId
        ? getSavedGuildForm("announcements", guildId) || DEFAULT_ANNOUNCEMENTS_FORM
        : DEFAULT_ANNOUNCEMENTS_FORM
    );
    const poll = announcement.poll || DEFAULT_ANNOUNCEMENTS_FORM.poll;
    const giveaway = announcement.giveaway || DEFAULT_ANNOUNCEMENTS_FORM.giveaway;
    const current = getCurrentServerSettingsItem();
    const channels = current?.availableChannels || [];

    return `
      <section class="page ${state.ui.activePage === "announcements" ? "active" : ""}" data-page="announcements">
        <article class="card">
          <h3 class="section-title">Server Announcements</h3>
          <p class="section-subtitle">Save defaults and send announcement with optional image.</p>

          <div class="form-grid">
            <div class="field">
              <label>Announcement Channel</label>
              <select id="announcement-channel">
                ${renderChannelOptions(channels, String(announcement.channelId || ""), true)}
              </select>
            </div>
            <div class="field">
              <label>Announcement Title</label>
              <input id="announcement-title" value="${escapeHtml(announcement.title || "")}" placeholder="Title..." />
            </div>
          </div>

          <div class="field" style="margin-top:10px;">
            <label>Announcement Message</label>
            <textarea id="announcement-message" rows="5" placeholder="Write announcement message...">${escapeHtml(
              announcement.message || ""
            )}</textarea>
          </div>

          <div class="form-grid" style="margin-top:10px;">
            <div class="field">
              <label>Image URL (Optional)</label>
              <input id="announcement-image-url" value="${escapeHtml(announcement.imageUrl || "")}" placeholder="https://..." />
            </div>
            <div class="field">
              <label>Mention Options</label>
              <div class="grid">
                ${renderSwitchRow(
                  "Mention @everyone",
                  Boolean(announcement.mentionEveryone),
                  "announcement-mention-everyone"
                )}
              </div>
            </div>
          </div>

          <div class="toolbar" style="margin-top:12px;">
            <button class="btn btn--ghost btn--small" data-action="send-announcement-now" type="button">
              Send Announcement Now
            </button>
          </div>

          <div class="divider"></div>

          <h3 class="section-title">Poll</h3>
          <p class="section-subtitle">Publish a timed poll. Members can choose an option or write an opinion, and reports go to the response channel.</p>

          <div class="form-grid">
            <div class="field">
              <label>Poll Response Channel</label>
              <select id="poll-response-channel">
                ${renderChannelOptions(channels, String(poll.responseChannelId || ""), true)}
              </select>
            </div>
            <div class="field">
              <label>Poll Duration (Minutes)</label>
              <input id="poll-duration-minutes" type="number" min="1" max="20160" value="${escapeHtml(
                String(poll.durationMinutes || 60)
              )}" />
            </div>
          </div>

          <div class="form-grid" style="margin-top:10px;">
            <div class="field">
              <label>Poll Choices (Optional)</label>
              <textarea id="poll-choices" rows="4" placeholder="One choice per line">${escapeHtml(
                poll.choicesText || ""
              )}</textarea>
              <span class="help">Leave empty for opinion-only poll. Maximum 10 choices.</span>
            </div>
            <div class="field">
              <label>Poll Options</label>
              <div class="grid">
                ${renderSwitchRow(
                  "Allow written opinions",
                  poll.allowTextResponses !== false,
                  "poll-allow-text-responses"
                )}
              </div>
            </div>
          </div>

          <div class="toolbar" style="margin-top:12px;">
            <button class="btn btn--ghost btn--small" data-action="send-poll-now" type="button">
              Send Poll Now
            </button>
          </div>

          <div class="divider"></div>

          <h3 class="section-title">Giveaway</h3>
          <p class="section-subtitle">Publish a timed giveaway. Members enter with a button and the bot chooses random winner(s) when time ends.</p>

          <div class="form-grid">
            <div class="field">
              <label>Giveaway Report Channel</label>
              <select id="giveaway-response-channel">
                ${renderChannelOptions(channels, String(giveaway.responseChannelId || ""), true)}
              </select>
            </div>
            <div class="field">
              <label>Giveaway Duration (Minutes)</label>
              <input id="giveaway-duration-minutes" type="number" min="1" max="20160" value="${escapeHtml(
                String(giveaway.durationMinutes || 60)
              )}" />
            </div>
          </div>

          <div class="form-grid" style="margin-top:10px;">
            <div class="field">
              <label>Prize</label>
              <input id="giveaway-prize" value="${escapeHtml(giveaway.prize || "")}" placeholder="Prize..." />
            </div>
            <div class="field">
              <label>Winners Count</label>
              <input id="giveaway-winners-count" type="number" min="1" max="10" value="${escapeHtml(
                String(giveaway.winnersCount || 1)
              )}" />
            </div>
          </div>

          <div class="toolbar" style="margin-top:12px;">
            <button class="btn btn--ghost btn--small" data-action="send-giveaway-now" type="button">
              Send Giveaway Now
            </button>
          </div>

          <div class="floating-save-spacer" aria-hidden="true"></div>
        </article>
      </section>
    `;
  }

  function renderBotControlPage() {
    const current = getCurrentServerSettingsItem();
    const guildId = getSelectedGuildId();
    const textChannels = current?.availableChannels || [];
    const voiceChannels = current?.availableVoiceChannels || [];
    const botControl = state.data.botControl && typeof state.data.botControl === "object"
      ? state.data.botControl
      : { bots: [] };
    const bots = Array.isArray(botControl.bots) ? botControl.bots : [];
    const canManageHelpers = botControl.canManageHelpers === true;
    const botOptions = bots.length
      ? bots
          .map((bot) => {
            const label = `${bot.kind === "main" ? "Main" : "Helper"} - ${bot.name || bot.configuredName || bot.id}${
              bot.ready ? "" : " (offline)"
            }`;
            return `<option value="${escapeHtml(bot.id)}">${escapeHtml(label)}</option>`;
          })
          .join("")
      : '<option value="main">Main Bot</option>';
    const helperRows = bots
      .filter((bot) => bot.kind === "helper")
      .map(
        (bot) => `
          <tr>
            <td>${escapeHtml(bot.name || bot.configuredName || bot.id)}</td>
            <td><span class="badge ${bot.ready ? "success" : "warning"}">${bot.ready ? "Connected" : "Offline"}</span></td>
            <td>${escapeHtml(bot.userId || "Not logged in")}</td>
            <td>${escapeHtml(bot.tokenPreview || "")}</td>
            <td>
              <button class="btn btn--small btn--ghost" data-action="bot-control-login-helper" data-bot-id="${escapeHtml(bot.id)}" type="button" ${canManageHelpers ? "" : "disabled"}>Login</button>
              <button class="btn btn--small btn--danger" data-action="bot-control-remove-helper" data-bot-id="${escapeHtml(bot.id)}" type="button" ${canManageHelpers ? "" : "disabled"}>Remove</button>
            </td>
          </tr>
        `
      )
      .join("");

    return `
      <section class="page ${state.ui.activePage === "bot-control" ? "active" : ""}" data-page="bot-control">
        <article class="card">
          <h3 class="section-title">Bot Control</h3>
          <p class="section-subtitle">Send messages and move the main bot or helper bots into voice channels.</p>
          <div class="toolbar" style="margin-bottom:10px;">
            <button class="btn btn--ghost btn--small" data-action="bot-control-refresh" type="button" ${
              state.ui.isRefreshingBotControl ? "disabled" : ""
            }>Refresh Bots</button>
            <span class="section-subtitle" style="margin:0;">Server: ${escapeHtml(current?.guildName || guildId || "No server selected")}</span>
          </div>
        </article>

        <article class="card">
          <h3 class="section-title">Helper Bots</h3>
          <p class="section-subtitle">Add secondary bot tokens. Tokens are stored locally and hidden after saving.</p>
          ${canManageHelpers ? "" : '<p class="section-subtitle">Only bot developers can add, reconnect, or remove helper bots.</p>'}
          <div class="form-grid">
            <div class="field">
              <label for="bot-helper-name">Display Name</label>
              <input id="bot-helper-name" placeholder="Helper Bot 1" ${canManageHelpers ? "" : "disabled"} />
            </div>
            <div class="field">
              <label for="bot-helper-token">Bot Token</label>
              <input id="bot-helper-token" type="password" placeholder="Paste helper bot token" autocomplete="off" ${canManageHelpers ? "" : "disabled"} />
            </div>
          </div>
          <div class="toolbar" style="margin-top:12px;">
            <button class="btn btn--ghost btn--small" data-action="bot-control-add-helper" type="button" ${
              state.ui.isBotControlBusy || !canManageHelpers ? "disabled" : ""
            }>Add & Login Helper</button>
          </div>
          <div class="table-wrap" style="margin-top:12px;">
            <table>
              <thead>
                <tr><th>Name</th><th>Status</th><th>User ID</th><th>Token</th><th>Actions</th></tr>
              </thead>
              <tbody>
                ${helperRows || '<tr><td colspan="5" class="muted">No helper bots configured.</td></tr>'}
              </tbody>
            </table>
          </div>
        </article>

        <article class="card">
          <h3 class="section-title">Send Message</h3>
          <div class="form-grid">
            <div class="field">
              <label for="bot-control-message-bot">Bot</label>
              <select id="bot-control-message-bot">${botOptions}</select>
            </div>
            <div class="field">
              <label for="bot-control-message-channel">Text Channel</label>
              <select id="bot-control-message-channel">${renderChannelOptions(textChannels, "", true)}</select>
            </div>
          </div>
          <div class="field" style="margin-top:10px;">
            <label for="bot-control-message-body">Message</label>
            <textarea id="bot-control-message-body" rows="4" placeholder="Write message..."></textarea>
          </div>
          <div class="toolbar" style="margin-top:12px;">
            <button class="btn btn--ghost btn--small" data-action="bot-control-send-message" type="button" ${
              state.ui.isBotControlBusy ? "disabled" : ""
            }>Send Message</button>
          </div>
        </article>

        <article class="card">
          <h3 class="section-title">Voice Control</h3>
          <div class="form-grid">
            <div class="field">
              <label for="bot-control-voice-bot">Bot</label>
              <select id="bot-control-voice-bot">${botOptions}</select>
            </div>
            <div class="field">
              <label for="bot-control-voice-channel">Voice Channel</label>
              <select id="bot-control-voice-channel">${renderPlainChannelOptions(voiceChannels, "", true)}</select>
            </div>
          </div>
          <div class="toolbar" style="margin-top:12px;">
            <button class="btn btn--ghost btn--small" data-action="bot-control-join-voice" type="button" ${
              state.ui.isBotControlBusy ? "disabled" : ""
            }>Join Voice</button>
            <button class="btn btn--ghost btn--small" data-action="bot-control-leave-voice" type="button" ${
              state.ui.isBotControlBusy ? "disabled" : ""
            }>Leave Voice</button>
          </div>
        </article>
      </section>
    `;
  }

  function renderDeveloperChannelBadge(label, stateValue) {
    const stateObject = stateValue && typeof stateValue === "object" ? stateValue : {};
    const status = String(stateObject.status || "UNKNOWN").toUpperCase();
    let badge = "warning";
    let text = "Unknown";
    if (status === "OK") {
      badge = "success";
      text = "OK";
    } else if (status === "NOT_SET") {
      badge = "warning";
      text = "Not Set";
    } else if (status === "INVALID_CHANNEL") {
      badge = "danger";
      text = "Invalid";
    } else if (status === "MISSING_PERMISSIONS") {
      badge = "danger";
      text = "Missing Perms";
    }

    return `<span class="badge ${badge}">${escapeHtml(label)}: ${escapeHtml(text)}</span>`;
  }

  function renderDeveloperCenterPage() {
    const developer = state.data?.developer || {};
    const overview = developer?.overview || {};
    const summary = overview?.summary || {};
    const guildRows = Array.isArray(overview?.guilds) ? overview.guilds : [];
    const recentUsageRows = Array.isArray(overview?.recentUsage) ? overview.recentUsage : [];
    const pointsDraft = updateDeveloperPointsFormDraft(state.ui?.developerPointsForm || {});
    const pointsGuildOptions = getDeveloperPointsGuildOptions();
    const pointsGuildOptionsHtml = pointsGuildOptions.length
      ? pointsGuildOptions
          .map(
            (item) =>
              `<option value="${escapeHtml(item.guildId)}" ${
                String(pointsDraft.guildId || "") === String(item.guildId || "") ? "selected" : ""
              }>${escapeHtml(item.guildName || item.guildId)}</option>`
          )
          .join("")
      : '<option value="">No servers available</option>';
    const pointsActionOptions = [
      { value: "reward", label: "Reward (+)" },
      { value: "deduct", label: "Deduct (-)" },
      { value: "set", label: "Set Balance" }
    ]
      .map(
        (item) =>
          `<option value="${escapeHtml(item.value)}" ${
            pointsDraft.action === item.value ? "selected" : ""
          }>${escapeHtml(item.label)}</option>`
      )
      .join("");
    const usageRowsVisible = state.ui.developerUsageExpanded
      ? recentUsageRows
      : recentUsageRows.slice(0, 5);
    const generatedAt = overview?.generatedAt ? formatDate(overview.generatedAt) : "N/A";
    const refreshLabel = state.ui.isRefreshingDeveloper ? "Refreshing..." : "Refresh Snapshot";
    const pointsSubmitLabel = state.ui.isUpdatingDeveloperPoints
      ? "Updating..."
      : "Apply Points Update";

    return `
      <section class="page ${state.ui.activePage === "developer-center" ? "active" : ""}" data-page="developer-center">
        <article class="card">
          <h3 class="section-title">Developer Center</h3>
          <p class="section-subtitle">Global monitoring for all servers where the bot is present.</p>
          <div class="toolbar" style="margin-bottom:10px;">
            <button class="btn btn--ghost btn--small" data-action="refresh-developer-overview" type="button" ${
              state.ui.isRefreshingDeveloper ? "disabled" : ""
            }>${escapeHtml(refreshLabel)}</button>
            <span class="section-subtitle" style="margin:0;">Last snapshot: ${escapeHtml(generatedAt)}</span>
          </div>
          <div class="grid cards-6">
            ${renderMetricCard("Total Guilds", formatNumber(summary.totalGuilds || 0), "All connected servers")}
            ${renderMetricCard("Total Members", formatNumber(summary.totalMembers || 0), "Across all servers")}
            ${renderMetricCard("Enabled Guilds", formatNumber(summary.enabledGuilds || 0), "Bot enabled state")}
            ${renderMetricCard("Blocked Guilds", formatNumber(summary.blockedGuilds || 0), "Developer blocks")}
            ${renderMetricCard("Welcome Enabled", formatNumber(summary.welcomeEnabledGuilds || 0), "Join automation")}
            ${renderMetricCard("Users 24h", formatNumber(summary.totalUsers24h || 0), "Unique active users")}
            ${renderMetricCard("Confessions 24h", formatNumber(summary.totalConfessions24h || 0), "Recent traffic")}
          </div>
        </article>

        <article class="card">
          <h3 class="section-title">Owner Points Control</h3>
          <p class="section-subtitle">Adjust any member balance and record actor + reason in logs.</p>
          <div class="form-grid">
            <div class="field">
              <label for="developer-points-guild">Server</label>
              <select id="developer-points-guild" data-developer-points-field="guildId">
                ${pointsGuildOptionsHtml}
              </select>
            </div>
            <div class="field">
              <label for="developer-points-user-id">Target User ID</label>
              <input
                id="developer-points-user-id"
                data-developer-points-field="targetUserId"
                value="${escapeHtml(pointsDraft.targetUserId || "")}"
                placeholder="Discord user ID"
                inputmode="numeric"
              />
            </div>
          </div>
          <div class="form-grid" style="margin-top:10px;">
            <div class="field">
              <label for="developer-points-action">Action</label>
              <select id="developer-points-action" data-developer-points-field="action">
                ${pointsActionOptions}
              </select>
            </div>
            <div class="field">
              <label for="developer-points-amount">Amount</label>
              <input
                id="developer-points-amount"
                data-developer-points-field="amount"
                type="number"
                min="0"
                step="1"
                value="${escapeHtml(pointsDraft.amount || "")}"
                placeholder="Points amount"
              />
            </div>
          </div>
          <div class="field" style="margin-top:10px;">
            <label for="developer-points-reason">Reason (required)</label>
            <textarea id="developer-points-reason" data-developer-points-field="reason" rows="3" maxlength="300" placeholder="Reason shown in logs...">${escapeHtml(
              pointsDraft.reason || ""
            )}</textarea>
          </div>
          <div class="toolbar" style="margin-top:12px;">
            <button
              class="btn btn--small"
              data-action="developer-adjust-points"
              type="button"
              ${state.ui.isUpdatingDeveloperPoints || !pointsGuildOptions.length ? "disabled" : ""}
            >${escapeHtml(pointsSubmitLabel)}</button>
          </div>
        </article>

        <article class="card">
          <h3 class="section-title">Per-Server Monitoring</h3>
          <p class="section-subtitle">Configuration health, activity, and moderation indicators.</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Server</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th>Users 24h</th>
                  <th>Confessions 24h</th>
                  <th>Pending Cases</th>
                  <th>Channels Health</th>
                  <th>Last Activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${
                  guildRows.length
                    ? guildRows
                        .map((row) => {
                          const statusBadge = row.developerBlocked
                            ? '<span class="badge danger">Blocked by Dev</span>'
                            : row.botEnabled
                              ? '<span class="badge success">Enabled</span>'
                              : '<span class="badge warning">Disabled</span>';
                          const guildId = String(row.guildId || "");
                          const actionBusy =
                            Boolean(state.ui.developerGuildActionById?.[guildId]) ||
                            state.ui.isRefreshingDeveloper;
                          const actionLabel = row.developerBlocked
                            ? "Unblock"
                            : row.botEnabled
                              ? "Block Server"
                              : "Enable Bot";
                          const nextEnabled = row.developerBlocked
                            ? "true"
                            : row.botEnabled
                              ? "false"
                              : "true";
                          const channelsCell = [
                            renderDeveloperChannelBadge("Conf", row?.channels?.confession),
                            renderDeveloperChannelBadge("Panel", row?.channels?.panel),
                            renderDeveloperChannelBadge("Logs", row?.channels?.logs)
                          ].join(" ");

                          return `
                            <tr>
                              <td>
                                <div class="feed-item__title">${escapeHtml(row.guildName || row.guildId || "Unknown")}</div>
                                <div class="feed-item__meta">${escapeHtml(row.guildId || "")}</div>
                              </td>
                              <td>${formatNumber(row.memberCount || 0)}</td>
                              <td>${statusBadge}</td>
                              <td>${formatNumber(row.users24h || 0)}</td>
                              <td>${formatNumber(row.confessions24h || 0)}</td>
                              <td>${formatNumber(row?.moderation?.pendingCases || 0)}</td>
                              <td><div class="status-badge-list">${channelsCell}</div></td>
                              <td>${row.lastActivityAt ? formatDate(row.lastActivityAt) : "No Data"}</td>
                              <td>
                                <button
                                  class="btn btn--small ${row.developerBlocked || row.botEnabled ? "btn--danger" : "btn--ghost"}"
                                  data-action="developer-toggle-guild-bot"
                                  data-guild-id="${escapeHtml(guildId)}"
                                  data-enabled="${escapeHtml(nextEnabled)}"
                                  type="button"
                                  ${actionBusy ? "disabled" : ""}
                                >${escapeHtml(actionBusy ? "Updating..." : actionLabel)}</button>
                              </td>
                            </tr>
                          `;
                        })
                        .join("")
                    : '<tr><td colspan="9"><div class="empty-state">No developer data available.</div></td></tr>'
                }
              </tbody>
            </table>
          </div>
        </article>

        <article class="card">
          <h3 class="section-title">Latest Usage Logs</h3>
          <p class="section-subtitle">Latest bot interactions and confessions across all servers.</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Server</th>
                  <th>User</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                ${
                  usageRowsVisible.length
                    ? usageRowsVisible
                        .map((item) => {
                          const isConfession = String(item?.type || "") === "confession";
                          return `
                            <tr>
                              <td>${item?.lastSeenAt ? formatDate(item.lastSeenAt) : "N/A"}</td>
                              <td>${escapeHtml(item?.guildName || item?.guildId || "Unknown")}</td>
                              <td>${escapeHtml(item?.userTag || item?.userId || "Unknown")}</td>
                              <td>${isConfession ? '<span class="badge info">Confession</span>' : '<span class="badge success">Interaction</span>'}</td>
                              <td>${escapeHtml(item?.source || "-")}</td>
                              <td>${escapeHtml(item?.message || "-")}</td>
                            </tr>
                          `;
                        })
                        .join("")
                    : '<tr><td colspan="6"><div class="empty-state">No usage logs available yet.</div></td></tr>'
                }
              </tbody>
            </table>
          </div>
          ${
            recentUsageRows.length > 5
              ? `<div class="toolbar" style="margin-top:10px;">
                  <button class="btn btn--ghost btn--small" data-action="toggle-developer-usage" type="button">
                    ${state.ui.developerUsageExpanded ? "Show Less" : "Show More"}
                  </button>
                </div>`
              : ""
          }
        </article>
      </section>
    `;
  }

  function renderHelpPage() {
    const help = state.data.help || {};
    const quickStart = Array.isArray(help.quickStart) ? help.quickStart : [];
    const commands = Array.isArray(help.commands) ? help.commands : [];
    const faq = Array.isArray(help.faq) ? help.faq : [];

    const renderList = (items) =>
      items.length
        ? `<ul class="feed-list">${items
            .map((item) => `<li class="feed-item"><div class="feed-item__title">${escapeHtml(item)}</div></li>`)
            .join("")}</ul>`
        : '<div class="empty-state">No help items available.</div>';

    return `
      <section class="page ${state.ui.activePage === "help" ? "active" : ""}" data-page="help">
        <div class="grid cols-3">
          <article class="card">
            <h3 class="section-title">Quick Start</h3>
            <p class="section-subtitle">Quick setup steps.</p>
            ${renderList(quickStart)}
          </article>
          <article class="card">
            <h3 class="section-title">Commands</h3>
            <p class="section-subtitle">Important bot commands.</p>
            ${renderList(commands)}
          </article>
          <article class="card">
            <h3 class="section-title">FAQ</h3>
            <p class="section-subtitle">Common issues and fixes.</p>
            ${renderList(faq)}
          </article>
        </div>
      </section>
    `;
  }

  function renderContentPages() {
    return [
      renderHomePage(),
      renderServerSettingsPage(),
      renderCategoriesPage(),
      renderModerationPage(),
      renderAiSettingsPage(),
      renderLogsPage(),
      renderAnalyticsPage(),
      renderBrandingPage(),
      renderLanguagePage(),
      renderWelcomePage(),
      renderLevelsPage(),
      renderEconomyPage(),
      renderPanelEditorPage(),
      renderAnnouncementsPage(),
      renderBotControlPage(),
      renderDeveloperCenterPage(),
      renderHelpPage()
    ].join("");
  }

  function renderApp() {
    if (state.ui.isLoading) return;
    ensureGuildScopedFormMaps();
    applyDocumentLanguage();
    const appShellClass = state.ui.mobileNavOpen ? "app-shell mobile-nav-open" : "app-shell";
    root.innerHTML = `
      <div class="${appShellClass}">
        <button class="mobile-nav-backdrop" data-action="close-mobile-nav" aria-label="Close menu"></button>
        ${renderSidebar()}
        <main class="main">
          ${renderTopbar()}
          <section class="content">${renderContentPages()}</section>
        </main>
        ${renderFloatingServerSettingsBar()}
      </div>
    `;
    applyDocumentLanguage();
    document.body.classList.toggle("mobile-nav-open", state.ui.mobileNavOpen && isMobileViewport());
    drawHomeChart();
    drawAnalyticsChart();
    bindRangeLabels();
    paintDatabaseStatusBadges();
    syncFloatingSaveButton();
    localizeContainerText(root);
    localizeContainerText(modal);
    updateWelcomeLivePreview();
    initWelcomePreviewInteractions();
    updateLevelsLivePreview();
    updatePanelEditorLivePreview();
  }

  function drawLineChart(canvasId, labels, values, color = "#8c6dff") {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(240, rect.width || 420);
    const height = Math.max(180, rect.height || 220);

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);

    const padding = 28;
    const graphW = width - padding * 2;
    const graphH = height - padding * 2;

    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    ctx.strokeStyle = "rgba(151,131,255,0.2)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padding + (graphH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    const points = values.map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * graphW;
      const normalized = (value - min) / range;
      const y = padding + graphH - normalized * graphH;
      return { x, y, label: labels[index] || "" };
    });

    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    gradient.addColorStop(0, `${color}CC`);
    gradient.addColorStop(1, `${color}10`);

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.3;
    ctx.stroke();

    ctx.lineTo(points[points.length - 1].x, height - padding);
    ctx.lineTo(points[0].x, height - padding);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.fillStyle = "#d7cfff";
    ctx.font = "11px Segoe UI";
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.1, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = "#b8addf";
      ctx.fillText(tr(point.label), point.x - 10, height - 9);
    });
  }

  function drawHomeChart() {
    const range = state.ui.activityRange;
    const set = range === "monthly" ? state.data.activity?.monthly || [] : state.data.activity?.weekly || [];
    if (!set.length) return;
    drawLineChart(
      "home-activity-chart",
      set.map((item) => item.label),
      set.map((item) => number(item.value)),
      "#8c6dff"
    );
  }

  function drawAnalyticsChart() {
    const monthly = state.data.activity?.monthly || [];
    if (!monthly.length) return;
    drawLineChart(
      "analytics-line-chart",
      monthly.map((item) => item.label),
      monthly.map((item) => number(item.value)),
      "#a78fff"
    );
  }

  function bindRangeLabels() {
    const toxicity = document.getElementById("toxicity-threshold");
    const toxicityValue = document.getElementById("toxicity-value");
    if (toxicity && toxicityValue) {
      toxicity.addEventListener("input", () => {
        toxicityValue.textContent = `${toxicity.value}%`;
      });
    }
  }

  function exportLogsCsv() {
    const logs = getFilteredLogs();
    if (!logs.length) {
      showToast("info", "No data available for export.");
      return;
    }

    const headers = ["id", "server", "category", "status", "author", "contentPreview", "createdAt", "action"];
    const rows = logs.map((item) =>
      headers
        .map((key) => {
          const cell = String(item[key] || "").replaceAll('"', '""');
          return '"' + cell + '"';
        })
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zllawi-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Logs exported successfully.");
  }

  async function resendPanelMessage() {
    if (state.ui.isSavingSettings) return;

    const current = getCurrentServerSettingsItem();
    if (!current?.guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const section = getPageScope("server-settings");
    const panelChannelNode =
      section.querySelector("#ss-panel-channel") || document.getElementById("ss-panel-channel");
    const panelChannelId = String(panelChannelNode?.value || current.panelChannelId || "");

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/panel/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId: current.guildId,
          panelChannelId
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to re-send panel.");
        return;
      }

      if (payload?.settings && Object.prototype.hasOwnProperty.call(payload.settings, "panelChannelId")) {
        updateServerSettingsState(current.guildId, {
          panelChannelId: String(payload.settings.panelChannelId || "")
        });
      }

      syncFloatingSaveButton();
      showToast("success", payload?.message || "Panel sent successfully.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function sendTestWelcomeMessage() {
    if (state.ui.isSavingSettings) return;

    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const current = getCurrentServerSettingsItem();
    const channels = current?.availableChannels || [];
    const roles = current?.availableRoles || [];
    const saved = getSavedGuildForm("welcome", guildId) || DEFAULT_WELCOME_FORM;
    const draft = readWelcomeDraftSnapshot(saved, channels, roles);

    if (!draft.channelId) {
      showToast("error", "Welcome channel is not set. Choose a channel first.");
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/welcome/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to send test welcome.");
        return;
      }

      const resolvedLut = String(payload?.preview?.resolvedLut || "").trim();
      if (resolvedLut) {
        showToast("info", `Resolved LUT: ${resolvedLut}`);
      }
      showToast("success", payload?.message || "Test welcome sent.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function reloadDashboardDataFromApi() {
    const previousGuildId = state.ui.selectedGuildId;
    state.ui.isLoading = true;
    root.innerHTML = `
      <div class="boot-skeleton">
        <div class="boot-skeleton__sidebar"></div>
        <div class="boot-skeleton__content"></div>
      </div>
    `;

    try {
      const response = await fetch("/api/dashboard/bootstrap", {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok || !payload?.bootstrap) {
        showToast("error", payload?.error || "Failed to refresh dashboard data.");
        return;
      }

      state.data = structuredClone(payload.bootstrap);
      const availableGuildIds = Array.isArray(state.data?.forms?.serverSettings)
        ? state.data.forms.serverSettings.map((item) => String(item?.guildId || "")).filter(Boolean)
        : [];
      state.ui.selectedGuildId = availableGuildIds.includes(String(previousGuildId || ""))
        ? String(previousGuildId)
        : availableGuildIds[0] || null;
      ensureGuildScopedFormMaps();
      renderApp();
      showToast("success", "Dashboard data refreshed.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isLoading = false;
    }
  }

  async function refreshDeveloperOverview() {
    if (state.ui.isRefreshingDeveloper) return;
    state.ui.isRefreshingDeveloper = true;
    renderApp();

    try {
      const response = await fetch("/api/dashboard/developer/overview", {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to refresh developer overview.");
        return;
      }

      if (!state.data.developer || typeof state.data.developer !== "object") {
        state.data.developer = {
          access: true,
          overview: null
        };
      }
      state.data.developer.overview =
        payload?.overview && typeof payload.overview === "object" ? payload.overview : null;
      state.ui.developerUsageExpanded = false;

      renderApp();
      showToast("success", "Developer snapshot refreshed.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isRefreshingDeveloper = false;
      if (state.ui.activePage === "developer-center") {
        renderApp();
      }
    }
  }

  function updateBotControlState(payload) {
    state.data.botControl = {
      ...(state.data.botControl || {}),
      canManageHelpers: payload?.canManageHelpers === true,
      bots: Array.isArray(payload?.bots) ? payload.bots : state.data.botControl?.bots || []
    };
  }

  async function refreshBotControl({ silent = false } = {}) {
    if (state.ui.isRefreshingBotControl) return;
    state.ui.isRefreshingBotControl = true;
    if (!silent) renderApp();

    try {
      const response = await fetch("/api/dashboard/bot-control", {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        if (!silent) showToast("error", payload?.error || "Failed to refresh bot control.");
        return;
      }
      updateBotControlState(payload);
      if (!silent) showToast("success", "Bot list refreshed.");
    } catch {
      if (!silent) showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isRefreshingBotControl = false;
      if (state.ui.activePage === "bot-control") renderApp();
    }
  }

  async function runBotControlRequest(url, body, successFallback) {
    if (state.ui.isBotControlBusy) return null;
    state.ui.isBotControlBusy = true;
    renderApp();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body || {})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Bot control action failed.");
        return null;
      }
      if (Array.isArray(payload?.bots)) updateBotControlState(payload);
      showToast("success", payload?.message || successFallback || "Bot control action completed.");
      return payload;
    } catch {
      showToast("error", "Failed to connect to server API.");
      return null;
    } finally {
      state.ui.isBotControlBusy = false;
      if (state.ui.activePage === "bot-control") renderApp();
    }
  }

  async function addHelperBotFromForm() {
    const name = String(document.getElementById("bot-helper-name")?.value || "").trim();
    const token = String(document.getElementById("bot-helper-token")?.value || "").trim();
    if (!token) {
      showToast("error", "Helper bot token is required.");
      return;
    }
    await runBotControlRequest(
      "/api/dashboard/bot-control/helpers",
      { name, token },
      "Helper bot added."
    );
  }

  async function loginHelperBot(botId) {
    const id = String(botId || "").trim();
    if (!id) return;
    await runBotControlRequest(
      "/api/dashboard/bot-control/helpers/login",
      { botId: id },
      "Helper bot logged in."
    );
  }

  async function removeHelperBot(botId) {
    const id = String(botId || "").trim();
    if (!id) return;
    if (state.ui.isBotControlBusy) return;
    state.ui.isBotControlBusy = true;
    renderApp();

    try {
      const response = await fetch(`/api/dashboard/bot-control/helpers/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to remove helper bot.");
        return;
      }
      updateBotControlState(payload);
      showToast("success", "Helper bot removed.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isBotControlBusy = false;
      if (state.ui.activePage === "bot-control") renderApp();
    }
  }

  async function sendBotControlMessage() {
    const guildId = getSelectedGuildId();
    const botId = String(document.getElementById("bot-control-message-bot")?.value || "main").trim();
    const channelId = String(document.getElementById("bot-control-message-channel")?.value || "").trim();
    const message = String(document.getElementById("bot-control-message-body")?.value || "").trim();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }
    if (!channelId) {
      showToast("error", "Choose a text channel.");
      return;
    }
    if (!message) {
      showToast("error", "Message cannot be empty.");
      return;
    }
    await runBotControlRequest(
      "/api/dashboard/bot-control/message",
      { guildId, botId, channelId, message },
      "Message sent."
    );
  }

  async function joinBotControlVoice() {
    const guildId = getSelectedGuildId();
    const botId = String(document.getElementById("bot-control-voice-bot")?.value || "main").trim();
    const channelId = String(document.getElementById("bot-control-voice-channel")?.value || "").trim();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }
    if (!channelId) {
      showToast("error", "Choose a voice channel.");
      return;
    }
    await runBotControlRequest(
      "/api/dashboard/bot-control/voice/join",
      { guildId, botId, channelId },
      "Bot joined voice."
    );
  }

  async function leaveBotControlVoice() {
    const guildId = getSelectedGuildId();
    const botId = String(document.getElementById("bot-control-voice-bot")?.value || "main").trim();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }
    await runBotControlRequest(
      "/api/dashboard/bot-control/voice/leave",
      { guildId, botId },
      "Bot left voice."
    );
  }

  async function toggleDeveloperGuildBotState(guildId, enabled) {
    const normalizedGuildId = String(guildId || "").trim();
    if (!normalizedGuildId) return;
    if (state.ui.developerGuildActionById?.[normalizedGuildId]) return;

    state.ui.developerGuildActionById = {
      ...(state.ui.developerGuildActionById || {}),
      [normalizedGuildId]: true
    };
    renderApp();

    try {
      const response = await fetch("/api/dashboard/developer/guild-bot-state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId: normalizedGuildId,
          enabled: Boolean(enabled)
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to update guild bot state.");
        return;
      }

      if (!state.data.developer || typeof state.data.developer !== "object") {
        state.data.developer = {
          access: true,
          overview: null
        };
      }
      state.data.developer.overview =
        payload?.overview && typeof payload.overview === "object"
          ? payload.overview
          : state.data.developer.overview || null;
      updateServerSettingsState(normalizedGuildId, {
        botEnabled: parseBooleanSetting(payload?.botEnabled, Boolean(enabled)),
        developerBlocked: parseBooleanSetting(payload?.developerBlocked, !Boolean(enabled))
      });
      showToast(
        "success",
        payload?.botEnabled
          ? "Server unblocked and bot enabled."
          : "Server blocked by developers."
      );
      renderApp();
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      const nextMap = { ...(state.ui.developerGuildActionById || {}) };
      delete nextMap[normalizedGuildId];
      state.ui.developerGuildActionById = nextMap;
      renderApp();
    }
  }

  function readDeveloperPointsFormFromDom() {
    const section = getPageScope("developer-center");
    const readValue = (id, fallback = "") => {
      const node = section.querySelector(`#${id}`) || document.getElementById(id);
      return String(node?.value || fallback || "");
    };

    return updateDeveloperPointsFormDraft({
      guildId: readValue("developer-points-guild", state.ui?.developerPointsForm?.guildId || "").trim(),
      targetUserId: readValue(
        "developer-points-user-id",
        state.ui?.developerPointsForm?.targetUserId || ""
      ),
      action: readValue("developer-points-action", state.ui?.developerPointsForm?.action || "reward"),
      amount: readValue("developer-points-amount", state.ui?.developerPointsForm?.amount || ""),
      reason: readValue("developer-points-reason", state.ui?.developerPointsForm?.reason || "")
    });
  }

  function startDeveloperPointsAdjustment() {
    if (state.ui.isUpdatingDeveloperPoints) return;
    const draft = readDeveloperPointsFormFromDom();

    const guildId = String(draft.guildId || "").trim();
    if (!guildId) {
      showToast("error", "Select a server first.");
      return;
    }

    const targetUserId = String(draft.targetUserId || "").trim();
    if (!/^\d{5,30}$/u.test(targetUserId)) {
      showToast("error", "Enter a valid target user ID.");
      return;
    }

    const action = String(draft.action || "").trim().toLowerCase();
    if (!["reward", "deduct", "set"].includes(action)) {
      showToast("error", "Choose a valid action.");
      return;
    }

    const rawAmount = Number(draft.amount);
    const amount = Number.isFinite(rawAmount) ? Math.trunc(rawAmount) : NaN;
    if (!Number.isInteger(amount)) {
      showToast("error", "Amount must be an integer.");
      return;
    }
    if (action === "set" && (amount < 0 || amount > 100000000)) {
      showToast("error", "Set amount must be between 0 and 100000000.");
      return;
    }
    if ((action === "reward" || action === "deduct") && (amount < 1 || amount > 1000000)) {
      showToast("error", "Amount must be between 1 and 1000000.");
      return;
    }

    const reason = String(draft.reason || "").trim().slice(0, 300);
    if (!reason) {
      showToast("error", "Reason is required.");
      return;
    }

    const actionLabel =
      action === "reward" ? "reward" : action === "deduct" ? "deduct" : "set balance";
    openConfirm({
      title: "Confirm Points Update",
      message: `Apply ${actionLabel} for user ${targetUserId} in guild ${guildId} with amount ${amount.toLocaleString(
        "en-US"
      )}?`,
      onConfirm: () => {
        void submitDeveloperPointsAdjustment({
          guildId,
          targetUserId,
          action,
          amount,
          reason
        });
      }
    });
  }

  async function submitDeveloperPointsAdjustment(payloadBody) {
    if (state.ui.isUpdatingDeveloperPoints) return;
    state.ui.isUpdatingDeveloperPoints = true;
    renderApp();

    try {
      const response = await fetch("/api/dashboard/developer/economy/points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payloadBody || {})
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to update member points.");
        return;
      }

      if (!state.data.developer || typeof state.data.developer !== "object") {
        state.data.developer = {
          access: true,
          overview: null
        };
      }

      state.data.developer.overview =
        payload?.overview && typeof payload.overview === "object"
          ? payload.overview
          : state.data.developer.overview || null;

      const adjustment = payload?.adjustment || {};
      showToast(
        "success",
        `Points updated for ${adjustment?.targetTag || adjustment?.targetUserId || "member"} (Balance ${Number(
          adjustment?.afterBalance || 0
        ).toLocaleString("en-US")}).`
      );

      updateDeveloperPointsFormDraft({
        targetUserId: "",
        amount: "",
        reason: ""
      });
      renderApp();
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isUpdatingDeveloperPoints = false;
      if (state.ui.activePage === "developer-center") {
        renderApp();
      }
    }
  }

  async function persistServerSettings() {
    if (state.ui.isSavingServerSettings) return;

    const current = getCurrentServerSettingsItem();
    if (!current?.guildId) {
      showToast("error", "No server selected.");
      return;
    }

    if (Boolean(current.developerBlocked) && !hasDeveloperAccess()) {
      showToast(
        "error",
        "This server is blocked by bot developers and cannot use the bot until unblocked."
      );
      return;
    }

    if (!hasServerSettingsUnsavedChanges()) {
      showToast("info", "No changes to save.");
      return;
    }

    const draft = getDraftServerSettingsSnapshot(current);
    if (!draft) {
      showToast("error", "Failed to read current settings.");
      return;
    }

    state.ui.isSavingServerSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/server-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId: current.guildId,
          confessionChannelId: draft.confessionChannelId,
          panelChannelId: draft.panelChannelId,
          logsChannelId: draft.logsChannelId,
          moderationChannelId: draft.moderationChannelId,
          botEnabled: draft.botEnabled,
          anonymousPosting: draft.anonymousPosting,
          repliesEnabled: draft.repliesEnabled,
          aiModerationEnabled: draft.aiModerationEnabled,
          dailyMessageQuota: draft.dailyMessageQuota,
          logAlertSettings: draft.logAlertSettings
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        if (String(payload?.code || "") === "DEVELOPER_BLOCKED") {
          updateServerSettingsState(current.guildId, {
            developerBlocked: true,
            botEnabled: false
          });
          renderApp();
        }
        showToast("error", payload?.error || "Failed to save server settings.");
        return;
      }

      const hasOwnSettingsKey = (key) =>
        Object.prototype.hasOwnProperty.call(payload.settings || {}, key);
      if (!payload?.settings || typeof payload.settings !== "object") {
        showToast(
          "error",
          "Server returned an invalid save response. Please restart backend and refresh dashboard."
        );
        return;
      }

      const serverPatch = {};
      if (hasOwnSettingsKey("confessionChannelId")) {
        serverPatch.confessionChannelId = String(payload.settings.confessionChannelId || "");
      }
      if (hasOwnSettingsKey("panelChannelId")) {
        serverPatch.panelChannelId = String(payload.settings.panelChannelId || "");
      }
      if (hasOwnSettingsKey("logsChannelId")) {
        serverPatch.logsChannelId = String(payload.settings.logsChannelId || "");
      }
      if (hasOwnSettingsKey("moderationChannelId")) {
        serverPatch.moderationChannelId = String(payload.settings.moderationChannelId || "");
      }
      if (hasOwnSettingsKey("aiModerationEnabled")) {
        serverPatch.aiModerationEnabled = parseBooleanSetting(
          payload.settings.aiModerationEnabled,
          false
        );
      }
      if (hasOwnSettingsKey("botEnabled")) {
        serverPatch.botEnabled = parseBooleanSetting(payload.settings.botEnabled, true);
      }
      if (hasOwnSettingsKey("developerBlocked")) {
        serverPatch.developerBlocked = parseBooleanSetting(payload.settings.developerBlocked, false);
      }
      if (hasOwnSettingsKey("anonymousPosting")) {
        serverPatch.anonymousPosting = parseBooleanSetting(payload.settings.anonymousPosting, true);
      }
      if (hasOwnSettingsKey("repliesEnabled")) {
        serverPatch.repliesEnabled = parseBooleanSetting(payload.settings.repliesEnabled, true);
      }
      if (hasOwnSettingsKey("dailyMessageQuota")) {
        serverPatch.dailyMessageQuota = parsePositiveIntSetting(payload.settings.dailyMessageQuota, 50);
      }
      if (hasOwnSettingsKey("dailyMessageUsed")) {
        serverPatch.dailyMessageUsed = Math.max(Number(payload.settings.dailyMessageUsed || 0), 0);
      }
      if (hasOwnSettingsKey("dailyMessageRemaining")) {
        serverPatch.dailyMessageRemaining = Math.max(
          Number(payload.settings.dailyMessageRemaining || 0),
          0
        );
      }
      if (hasOwnSettingsKey("logAlertSettings") && payload.settings.logAlertSettings) {
        serverPatch.logAlertSettings = payload.settings.logAlertSettings;
      }
      if (Object.keys(serverPatch).length) {
        updateServerSettingsState(current.guildId, serverPatch);
      }

      const missingSettingsKeys = [
        "confessionChannelId",
        "panelChannelId",
        "logsChannelId",
        "moderationChannelId",
        "aiModerationEnabled",
        "botEnabled",
        "developerBlocked",
        "anonymousPosting",
        "repliesEnabled",
        "dailyMessageQuota",
        "logAlertSettings"
      ].filter((key) => !hasOwnSettingsKey(key));

      renderApp();
      if (missingSettingsKeys.length) {
        showToast(
          "info",
          `Server response is missing some fields (${missingSettingsKeys.join(
            ", "
          )}). Backend may be outdated.`
        );
      }
      if (Array.isArray(payload.warnings) && payload.warnings.length) {
        for (const warning of payload.warnings) {
          showToast("info", String(warning || "Some settings were not saved."));
        }
      }
      showToast("success", payload.message || "Server settings saved.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingServerSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function persistCategoriesSettings() {
    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    if (!hasCategoriesUnsavedChanges()) {
      showToast("info", "No changes to save.");
      return;
    }

    const categories = getDraftCategoriesSnapshot(guildId);
    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          categories
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to save categories.");
        return;
      }

      const nextCategories = Array.isArray(payload?.form?.categories)
        ? normalizeCategoriesSnapshot(payload.form.categories)
        : categories;
      setSavedGuildForm("categories", guildId, nextCategories);
      setDraftCategoriesSnapshot(guildId, nextCategories);
      renderApp();
      showToast("success", payload?.message || "Categories saved.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function persistModerationSettings() {
    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = getSavedGuildForm("moderation", guildId) || DEFAULT_MODERATION_FORM;
    const draft = readModerationDraftSnapshot(saved);
    if (isJsonEqual(saved, draft)) {
      showToast("info", "No changes to save.");
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/moderation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to save moderation settings.");
        return;
      }

      const nextForm = payload?.form && typeof payload.form === "object" ? payload.form : draft;
      setSavedGuildForm("moderation", guildId, {
        badWordsFilterEnabled: nextForm.badWordsFilterEnabled !== false,
        aiModerationEnabled: Boolean(nextForm.aiModerationEnabled),
        toxicityThreshold: Number(nextForm.toxicityThreshold || 70),
        spamDetectionEnabled: nextForm.spamDetectionEnabled !== false,
        linkRestrictionEnabled: Boolean(nextForm.linkRestrictionEnabled),
        imageRestrictionEnabled: Boolean(nextForm.imageRestrictionEnabled),
        autoRejectEnabled: Boolean(nextForm.autoRejectEnabled),
        badWordsText: String(nextForm.badWordsText || "")
          .trim()
          .replace(/\s*,\s*/gu, ", ")
      });

      const currentServer = getCurrentServerSettingsItem();
      if (currentServer && currentServer.guildId === guildId) {
        currentServer.aiModerationEnabled = Boolean(nextForm.aiModerationEnabled);
      }

      renderApp();
      if (Array.isArray(payload.warnings) && payload.warnings.length) {
        for (const warning of payload.warnings) {
          showToast("info", String(warning || "Some settings were not saved."));
        }
      }
      showToast("success", payload?.message || "Moderation settings saved.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function persistAiSettings() {
    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = getSavedGuildForm("ai-settings", guildId) || DEFAULT_AI_FORM;
    const draft = readAiDraftSnapshot(saved);
    const comparableSaved = {
      aiAutoReply: Boolean(saved.aiAutoReply),
      smartSuggestions: saved.smartSuggestions !== false,
      creativity: Number(saved.creativity || 45),
      strictness: Number(saved.strictness || 72),
      moderationPrompt: String(saved.moderationPrompt || "").trim(),
      conversationPrompt: String(saved.conversationPrompt || "").trim()
    };
    if (isJsonEqual(comparableSaved, draft)) {
      showToast("info", "No changes to save.");
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/ai-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to save AI settings.");
        return;
      }

      const nextForm = payload?.form && typeof payload.form === "object" ? payload.form : draft;
      setSavedGuildForm("ai-settings", guildId, nextForm);
      renderApp();
      showToast("success", payload?.message || "AI settings saved.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function persistBrandingSettings() {
    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = getSavedGuildForm("branding", guildId) || DEFAULT_BRANDING_FORM;
    const draft = readBrandingDraftSnapshot(saved);
    const comparableSaved = {
      embedColor: String(saved.embedColor || "#7c5cff"),
      botFooter: String(saved.botFooter || ""),
      successMessage: String(saved.successMessage || ""),
      errorMessage: String(saved.errorMessage || ""),
      uiTheme: String(saved.uiTheme || "dark-violet")
    };
    if (isJsonEqual(comparableSaved, draft)) {
      showToast("info", "No changes to save.");
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/branding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to save branding settings.");
        return;
      }

      const nextForm = payload?.form && typeof payload.form === "object" ? payload.form : draft;
      setSavedGuildForm("branding", guildId, nextForm);
      renderApp();
      showToast("success", payload?.message || "Branding settings saved.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function persistLanguageSettings() {
    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = getSavedGuildForm("language", guildId) || DEFAULT_LANGUAGE_FORM;
    const draft = readLanguageDraftSnapshot(saved);
    if (String(saved.language || "en") === String(draft.language || "en")) {
      showToast("info", "No changes to save.");
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/language", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          language: draft.language
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to save language settings.");
        return;
      }

      const nextForm = payload?.form && typeof payload.form === "object" ? payload.form : draft;
      setSavedGuildForm("language", guildId, {
        language: String(nextForm.language || "en").toLowerCase() === "ar" ? "ar" : "en"
      });
      renderApp();
      showToast("success", payload?.message || "Language settings saved.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function persistWelcomeSettings() {
    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const current = getCurrentServerSettingsItem();
    const channels = current?.availableChannels || [];
    const roles = current?.availableRoles || [];
    const saved = getSavedGuildForm("welcome", guildId) || DEFAULT_WELCOME_FORM;
    const draft = readWelcomeDraftSnapshot(saved, channels, roles);

    const comparableSaved = {
      enabled: Boolean(saved.enabled),
      channelId: String(saved.channelId || ""),
      message: String(saved.message || "Welcome {user} to {server}!"),
      backgroundImage: String(saved.backgroundImage || "asset://welcome-default.png"),
      mentionUser: saved.mentionUser !== false,
      overlayText: String(saved.overlayText || ""),
      overlayTextSize: clampNumber(saved.overlayTextSize, 60, 220, 100),
      overlayTextX: clampNumber(saved.overlayTextX, 5, 95, 73, 1),
      overlayTextY: clampNumber(saved.overlayTextY, 8, 92, 50, 1),
      avatarScale: clampNumber(saved.avatarScale, 55, 180, 100),
      avatarX: clampNumber(saved.avatarX, 8, 92, 30.2, 1),
      avatarY: clampNumber(saved.avatarY, 8, 92, 48.8, 1),
      imageFilter: normalizeWelcomeImageFilter(saved.imageFilter || "none", "none"),
      roleFilters: normalizeWelcomeRoleFilters(saved.roleFilters || [])
    };

    if (isJsonEqual(comparableSaved, draft)) {
      showToast("info", "No changes to save.");
      return;
    }

    if (draft.enabled && !isGuildMembersIntentEnabled()) {
      showToast("error", "Welcome join events need Server Members Intent.");
      showToast(
        "info",
        "Enable intent in Discord Developer Portal, set ENABLE_GUILD_MEMBERS_INTENT=true, then restart backend."
      );
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/welcome", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to save welcome settings.");
        return;
      }

      const nextForm = payload?.form && typeof payload.form === "object" ? payload.form : draft;
      setSavedGuildForm("welcome", guildId, {
        enabled: Boolean(nextForm.enabled),
        channelId: String(nextForm.channelId || ""),
        message: String(nextForm.message || "Welcome {user} to {server}!"),
        backgroundImage: String(nextForm.backgroundImage || "asset://welcome-default.png"),
        mentionUser: nextForm.mentionUser !== false,
        overlayText: String(nextForm.overlayText || ""),
        overlayTextSize: clampNumber(nextForm.overlayTextSize, 60, 220, 100),
        overlayTextX: clampNumber(nextForm.overlayTextX, 5, 95, 73, 1),
        overlayTextY: clampNumber(nextForm.overlayTextY, 8, 92, 50, 1),
        avatarScale: clampNumber(nextForm.avatarScale, 55, 180, 100),
        avatarX: clampNumber(nextForm.avatarX, 8, 92, 30.2, 1),
        avatarY: clampNumber(nextForm.avatarY, 8, 92, 48.8, 1),
        imageFilter: normalizeWelcomeImageFilter(nextForm.imageFilter || "none", "none"),
        roleFilters: normalizeWelcomeRoleFilters(nextForm.roleFilters || [])
      });
      if (Array.isArray(payload?.warnings)) {
        for (const warning of payload.warnings) {
          if (!warning) continue;
          showToast("warning", String(warning));
        }
      }
      renderApp();
      showToast("success", payload?.message || "Welcome settings saved.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function persistLevelsSettings() {
    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const current = getCurrentServerSettingsItem();
    const roles = current?.availableRoles || [];
    const saved = normalizeLevelsFormSnapshot(
      getSavedGuildForm("levels", guildId) || DEFAULT_LEVELS_FORM
    );
    const draft = readLevelsDraftSnapshot(saved, roles);
    if (isJsonEqual(saved, draft)) {
      showToast("info", "No changes to save.");
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to save levels settings.");
        return;
      }

      const nextForm = normalizeLevelsFormSnapshot(payload?.form || draft);
      setSavedGuildForm("levels", guildId, nextForm);
      renderApp();
      showToast("success", payload?.message || "Levels settings saved.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function fetchLatestEconomyFormForGuild(guildId) {
    const response = await fetch(`/api/dashboard/economy?guildId=${encodeURIComponent(guildId)}`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error || "Failed to fetch economy form.");
      error.payload = payload;
      throw error;
    }

    return normalizeEconomyFormSnapshot(payload?.form || DEFAULT_ECONOMY_FORM);
  }

  function syncLiveShopCardStatus(latestEconomyForm = {}) {
    const section = getPageScope("economy");
    const rows = Array.from(section.querySelectorAll("[data-shop-item-row]"));
    if (!rows.length) return 0;

    const latestItems = Array.isArray(latestEconomyForm?.shopItems) ? latestEconomyForm.shopItems : [];
    const latestCardItemsById = new Map();
    for (const rawItem of latestItems) {
      const item = normalizeShopItemSnapshot(rawItem);
      const itemId = String(item?.id || "").trim().toLowerCase();
      if (!itemId || item.type !== "card") continue;
      latestCardItemsById.set(itemId, item);
    }

    let updatedRows = 0;
    for (const row of rows) {
      const itemId = String(row.querySelector("[data-shop-item-id]")?.value || "")
        .trim()
        .toLowerCase();
      if (!itemId) continue;

      const latestItem = latestCardItemsById.get(itemId);
      if (!latestItem) continue;

      const nextStatusText = buildShopCardStatusText(latestItem.cardInventory);
      const statusNode = row.querySelector("[data-shop-item-card-status]");
      if (statusNode && String(statusNode.value || "") !== nextStatusText) {
        statusNode.value = nextStatusText;
        updatedRows += 1;
      }

      const inventoryNode = row.querySelector("[data-shop-item-card-inventory]");
      if (inventoryNode) {
        inventoryNode.value = JSON.stringify(latestItem.cardInventory || []);
      }
    }

    return updatedRows;
  }

  async function refreshShopCardStatus({ silent = false, skipWhenBusy = false } = {}) {
    if (isEconomyCardStatusRefreshing) return;
    if (state.ui.activePage !== "economy") return;
    if (skipWhenBusy && (state.ui.isSavingSettings || state.ui.isSavingServerSettings)) return;
    if (skipWhenBusy && hasEconomyUnsavedChanges()) return;

    const section = getPageScope("economy");
    if (!section.querySelector("[data-shop-item-row]")) {
      if (!silent) showToast("info", "No shop items configured yet.");
      return;
    }

    const guildId = getSelectedGuildId();
    if (!guildId) {
      if (!silent) showToast("error", "No server selected.");
      return;
    }

    const refreshButton = section.querySelector('[data-action="refresh-shop-card-status"]');
    const refreshLabel = refreshButton ? refreshButton.textContent : "";

    isEconomyCardStatusRefreshing = true;
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = "Refreshing...";
    }

    try {
      const latestForm = await fetchLatestEconomyFormForGuild(guildId);
      setSavedGuildForm("economy", guildId, latestForm);
      const updatedRows = syncLiveShopCardStatus(latestForm);
      if (!silent) {
        showToast(
          "success",
          updatedRows > 0 ? `Card status updated (${updatedRows}).` : "Card status already up to date."
        );
      }
    } catch (error) {
      if (!silent) {
        showToast("error", error?.message || "Failed to refresh cards status.");
      }
    } finally {
      isEconomyCardStatusRefreshing = false;
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = refreshLabel || "Refresh Cards Status";
      }
    }
  }

  async function persistEconomySettings() {
    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = normalizeEconomyFormSnapshot(
      getSavedGuildForm("economy", guildId) || DEFAULT_ECONOMY_FORM
    );
    const draft = readEconomyDraftSnapshot(saved);
    if (isJsonEqual(saved, draft)) {
      showToast("info", "No changes to save.");
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/economy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to save economy settings.");
        return;
      }

      const nextForm = normalizeEconomyFormSnapshot(payload?.form || draft);
      setSavedGuildForm("economy", guildId, nextForm);
      renderApp();
      showToast("success", payload?.message || "Economy settings saved.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function resendShopMessage() {
    if (state.ui.isSavingSettings) return;

    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = normalizeEconomyFormSnapshot(
      getSavedGuildForm("economy", guildId) || DEFAULT_ECONOMY_FORM
    );
    const draft = readEconomyDraftSnapshot(saved);

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/economy/shop/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          shopChannelId: draft.shopChannelId
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to send shop message.");
        return;
      }

      showToast("success", payload?.message || "Shop message sent.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function persistPanelEditorSettings() {
    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = getSavedGuildForm("panel-editor", guildId) || DEFAULT_PANEL_EDITOR_FORM;
    const draft = readPanelEditorDraftSnapshot(saved);
    const comparableSaved = {
      title: String(saved.title || "").trim().slice(0, 256),
      description: String(saved.description || "").trim().slice(0, 4000),
      buttonLabel: String(saved.buttonLabel || "").trim().slice(0, 80),
      imageUrl: String(saved.imageUrl || "").trim().slice(0, 500),
      thumbnailUrl: String(saved.thumbnailUrl || "").trim().slice(0, 500),
      footerText: String(saved.footerText || "").trim().slice(0, 240),
      accentColor: sanitizeHexColorInput(saved.accentColor, ""),
      hasStoredUploadedImage: Boolean(saved.hasStoredUploadedImage)
    };

    if (isJsonEqual(comparableSaved, draft)) {
      showToast("info", "No changes to save.");
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/panel-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to save panel settings.");
        return;
      }

      const nextForm = payload?.form && typeof payload.form === "object" ? payload.form : draft;
      setSavedGuildForm("panel-editor", guildId, {
        title: String(nextForm.title || "").trim().slice(0, 256),
        description: String(nextForm.description || "").trim().slice(0, 4000),
        buttonLabel: String(nextForm.buttonLabel || "").trim().slice(0, 80),
        imageUrl: String(nextForm.imageUrl || "").trim().slice(0, 500),
        thumbnailUrl: String(nextForm.thumbnailUrl || "").trim().slice(0, 500),
        footerText: String(nextForm.footerText || "").trim().slice(0, 240),
        accentColor: sanitizeHexColorInput(nextForm.accentColor, ""),
        hasStoredUploadedImage: Boolean(nextForm.hasStoredUploadedImage)
      });
      renderApp();
      showToast("success", payload?.message || "Panel settings saved.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function persistAnnouncementsSettings() {
    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = getSavedGuildForm("announcements", guildId) || DEFAULT_ANNOUNCEMENTS_FORM;
    const draft = readAnnouncementsDraftSnapshot(saved);
    const comparableSaved = normalizeAnnouncementForm(saved);

    if (isJsonEqual(comparableSaved, draft)) {
      showToast("info", "No changes to save.");
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/announcements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to save announcement settings.");
        return;
      }

      const nextForm = payload?.form && typeof payload.form === "object" ? payload.form : draft;
      setSavedGuildForm("announcements", guildId, normalizeAnnouncementForm(nextForm));
      renderApp();
      showToast("success", payload?.message || "Announcement settings saved.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function sendAnnouncementNow() {
    if (state.ui.isSavingSettings) return;

    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = getSavedGuildForm("announcements", guildId) || DEFAULT_ANNOUNCEMENTS_FORM;
    const draft = readAnnouncementsDraftSnapshot(saved);

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/announcements/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to send announcement.");
        return;
      }

      if (Array.isArray(payload?.warnings) && payload.warnings.length) {
        for (const warning of payload.warnings) {
          if (!warning) continue;
          showToast("warning", String(warning));
        }
      }
      showToast("success", payload?.message || "Announcement sent.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function sendPollNow() {
    if (state.ui.isSavingSettings) return;

    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = getSavedGuildForm("announcements", guildId) || DEFAULT_ANNOUNCEMENTS_FORM;
    const draft = readAnnouncementsDraftSnapshot(saved);
    if (!draft.channelId) {
      showToast("error", "Choose a publish channel first.");
      return;
    }
    if (!draft.poll.responseChannelId) {
      showToast("error", "Choose a poll response channel first.");
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/announcements/poll/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to send poll.");
        return;
      }

      if (Array.isArray(payload?.warnings) && payload.warnings.length) {
        for (const warning of payload.warnings) {
          if (!warning) continue;
          showToast("warning", String(warning));
        }
      }
      showToast("success", payload?.message || "Poll sent.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function sendGiveawayNow() {
    if (state.ui.isSavingSettings) return;

    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = getSavedGuildForm("announcements", guildId) || DEFAULT_ANNOUNCEMENTS_FORM;
    const draft = readAnnouncementsDraftSnapshot(saved);
    if (!draft.channelId) {
      showToast("error", "Choose a publish channel first.");
      return;
    }
    if (!draft.giveaway.responseChannelId) {
      showToast("error", "Choose a giveaway report channel first.");
      return;
    }
    if (!draft.giveaway.prize) {
      showToast("error", "Giveaway prize is required.");
      return;
    }

    state.ui.isSavingSettings = true;
    syncFloatingSaveButton();

    try {
      const response = await fetch("/api/dashboard/announcements/giveaway/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          ...draft
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to send giveaway.");
        return;
      }

      if (Array.isArray(payload?.warnings) && payload.warnings.length) {
        for (const warning of payload.warnings) {
          if (!warning) continue;
          showToast("warning", String(warning));
        }
      }
      showToast("success", payload?.message || "Giveaway sent.");
    } catch {
      showToast("error", "Failed to connect to server API.");
    } finally {
      state.ui.isSavingSettings = false;
      syncFloatingSaveButton();
    }
  }

  async function toggleDashboardLanguage() {
    const guildId = getSelectedGuildId();
    if (!guildId) {
      showToast("error", "No server selected.");
      return;
    }

    const saved = getSavedGuildForm("language", guildId) || DEFAULT_LANGUAGE_FORM;
    const currentLanguage = String(saved.language || "en").toLowerCase() === "ar" ? "ar" : "en";
    const nextLanguage = currentLanguage === "ar" ? "en" : "ar";

    try {
      const response = await fetch("/api/dashboard/language", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          guildId,
          language: nextLanguage
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        showToast("error", payload?.error || "Failed to switch dashboard language.");
        return;
      }

      const nextForm = payload?.form && typeof payload.form === "object" ? payload.form : {
        language: nextLanguage
      };
      setSavedGuildForm("language", guildId, {
        language: String(nextForm.language || nextLanguage).toLowerCase() === "ar" ? "ar" : "en"
      });
      renderApp();
      showToast("success", `Language switched to ${nextLanguage.toUpperCase()}.`);
    } catch {
      showToast("error", "Failed to connect to server API.");
    }
  }

  async function persistActiveSettings() {
    const activePage = getActiveSettingsPageId();
    if (!activePage) return;
    const selectedGuildId = getSelectedGuildId();
    if (
      selectedGuildId &&
      isGuildDeveloperBlockedForDashboard(selectedGuildId) &&
      !hasDeveloperAccess()
    ) {
      showToast(
        "error",
        "This server is blocked by bot developers and cannot use the bot until unblocked."
      );
      return;
    }

    if (activePage === "server-settings") {
      await persistServerSettings();
      return;
    }
    if (activePage === "categories") {
      await persistCategoriesSettings();
      return;
    }
    if (activePage === "moderation") {
      await persistModerationSettings();
      return;
    }
    if (activePage === "ai-settings") {
      await persistAiSettings();
      return;
    }
    if (activePage === "branding") {
      await persistBrandingSettings();
      return;
    }
    if (activePage === "language") {
      await persistLanguageSettings();
      return;
    }
    if (activePage === "welcome") {
      await persistWelcomeSettings();
      return;
    }
    if (activePage === "levels") {
      await persistLevelsSettings();
      return;
    }
    if (activePage === "economy") {
      await persistEconomySettings();
      return;
    }
    if (activePage === "panel-editor") {
      await persistPanelEditorSettings();
      return;
    }
    if (activePage === "announcements") {
      await persistAnnouncementsSettings();
    }
  }

  function resetActiveSettingsDraft() {
    const activePage = getActiveSettingsPageId();
    const guildId = getSelectedGuildId();

    if (!activePage || !guildId) return;

    if (activePage === "categories") {
      setDraftCategoriesSnapshot(guildId, getSavedCategoriesSnapshot(guildId));
    }

    renderApp();
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const target = event.target.closest("[data-nav], [data-action]");
      if (!target) return;
      const nav = target.getAttribute("data-nav");
      const action = target.getAttribute("data-action");

      if (nav) {
        state.ui.activePage = nav;
        if (isMobileViewport()) {
          state.ui.mobileNavOpen = false;
        }
        renderApp();
        if (nav === "economy") {
          void refreshShopCardStatus({ silent: true, skipWhenBusy: true });
        }
        if (nav === "bot-control") {
          void refreshBotControl({ silent: true });
        }
        return;
      }

      if (action === "toggle-mobile-nav") {
        state.ui.mobileNavOpen = !state.ui.mobileNavOpen;
        renderApp();
        return;
      }

      if (action === "close-mobile-nav") {
        if (state.ui.mobileNavOpen) {
          state.ui.mobileNavOpen = false;
          renderApp();
        }
        return;
      }

      if (action === "set-activity-range") {
        state.ui.activityRange = target.getAttribute("data-range") || "weekly";
        renderApp();
        return;
      }

      if (action === "toggle-recent-confessions") {
        state.ui.homeRecentConfessionsExpanded = !state.ui.homeRecentConfessionsExpanded;
        renderApp();
        return;
      }

      if (action === "view-recent-confession") {
        const confessionId = String(target.dataset.id || "").trim();
        if (!confessionId) return;
        const rows = Array.isArray(state.data.widgets?.recentConfessions)
          ? state.data.widgets.recentConfessions
          : [];
        const row = rows.find((item) => String(item?.id || "") === confessionId);
        if (!row) return;

        openConfirm({
          title: `Confession by ${row.userTag || row.userId || "Unknown User"}`,
          message: `${row.message || ""}\n\nServer: ${row.guildName || "Unknown Server"}\nTime: ${formatDate(
            row.createdAt
          )}\nSource: ${row.source || "confession"}`,
          onConfirm: null
        });
        return;
      }

      if (action === "toggle-dashboard-language") {
        void toggleDashboardLanguage();
        return;
      }

      if (action === "save-all") {
        if (SETTINGS_PAGES.has(state.ui.activePage)) {
          void persistActiveSettings();
        } else {
          showToast("info", "Use page-specific save buttons for this section.");
        }
        return;
      }

      if (action === "simulate-loading") {
        void reloadDashboardDataFromApi();
        return;
      }

      if (action === "refresh-developer-overview") {
        void refreshDeveloperOverview();
        return;
      }

      if (action === "toggle-developer-usage") {
        state.ui.developerUsageExpanded = !state.ui.developerUsageExpanded;
        renderApp();
        return;
      }

      if (action === "bot-control-refresh") {
        void refreshBotControl();
        return;
      }

      if (action === "bot-control-add-helper") {
        void addHelperBotFromForm();
        return;
      }

      if (action === "bot-control-login-helper") {
        void loginHelperBot(target.dataset.botId);
        return;
      }

      if (action === "bot-control-remove-helper") {
        const botId = target.dataset.botId;
        openConfirm({
          title: "Remove helper bot",
          message: "This removes the stored helper token from this backend.",
          onConfirm: () => {
            void removeHelperBot(botId);
          }
        });
        return;
      }

      if (action === "bot-control-send-message") {
        void sendBotControlMessage();
        return;
      }

      if (action === "bot-control-join-voice") {
        void joinBotControlVoice();
        return;
      }

      if (action === "bot-control-leave-voice") {
        void leaveBotControlVoice();
        return;
      }

      if (action === "developer-toggle-guild-bot") {
        const guildId = String(target.dataset.guildId || "").trim();
        const enabled = String(target.dataset.enabled || "").trim().toLowerCase() === "true";
        if (!guildId) return;
        void toggleDeveloperGuildBotState(guildId, enabled);
        return;
      }

      if (action === "developer-adjust-points") {
        startDeveloperPointsAdjustment();
        return;
      }

      if (action === "toggle") {
        if (target.hasAttribute("disabled") || target.classList.contains("is-disabled")) {
          return;
        }
        target.classList.toggle("active");
        syncFloatingSaveButton();
        return;
      }

      if (action === "category-add") {
        const guildId = getSelectedGuildId();
        if (!guildId) {
          showToast("error", "No server selected.");
          return;
        }
        const current = getDraftCategoriesSnapshot(guildId);
        const name = `Category ${current.length + 1}`;
        current.push({
          id: `cat-${Date.now()}`,
          name,
          color: "#8c6dff",
          icon: "tag",
          active: true,
          order: current.length + 1
        });
        setDraftCategoriesSnapshot(guildId, current);
        renderApp();
        showToast("success", "New category added.");
        return;
      }

      if (action === "category-edit") {
        showToast("info", `Category editor ${target.dataset.id} is ready for integration.`);
        return;
      }

      if (action === "category-delete") {
        const guildId = getSelectedGuildId();
        if (!guildId) {
          showToast("error", "No server selected.");
          return;
        }
        const id = target.dataset.id;
        openConfirm({
          title: "Delete Category",
          message: "Are you sure you want to delete this category? This action cannot be undone.",
          onConfirm: () => {
            const next = getDraftCategoriesSnapshot(guildId).filter((item) => item.id !== id);
            next.forEach((item, index) => {
              item.order = index + 1;
            });
            setDraftCategoriesSnapshot(guildId, next);
            renderApp();
            showToast("success", "Category deleted.");
          }
        });
        return;
      }

      if (action === "category-reorder") {
        const guildId = getSelectedGuildId();
        if (!guildId) {
          showToast("error", "No server selected.");
          return;
        }
        const next = [...getDraftCategoriesSnapshot(guildId)].sort((a, b) =>
          a.name.localeCompare(b.name, "en")
        );
        next.forEach((item, index) => {
          item.order = index + 1;
        });
        setDraftCategoriesSnapshot(guildId, next);
        renderApp();
        showToast("info", "Categories reordered.");
        return;
      }

      if (action === "resend-panel") {
        void resendPanelMessage();
        return;
      }

      if (action === "send-test-welcome") {
        void sendTestWelcomeMessage();
        return;
      }

      if (action === "add-welcome-role-filter") {
        const section = getPageScope("welcome");
        const container = section.querySelector("#welcome-role-filters-list");
        const currentServer = getCurrentServerSettingsItem();
        const roles = Array.isArray(currentServer?.availableRoles) ? currentServer.availableRoles : [];

        if (!container || !roles.length) {
          showToast("error", "No roles available for this server.");
          return;
        }

        const usedRoleIds = new Set(
          Array.from(container.querySelectorAll("[data-welcome-role-filter-role]"))
            .map((node) => String(node?.value || "").trim())
            .filter(Boolean)
        );
        const freeRole = roles.find((item) => !usedRoleIds.has(String(item?.id || "").trim()));
        if (!freeRole?.id) {
          showToast("info", "All roles are already used in role color presets.");
          return;
        }

        const emptyState = container.querySelector(".empty-state");
        if (emptyState) emptyState.remove();
        container.insertAdjacentHTML(
          "beforeend",
          renderWelcomeRoleFilterRow(
            { roleId: String(freeRole.id), filter: "none" },
            roles,
            `${Date.now()}`
          )
        );
        localizeContainerText(container);
        syncFloatingSaveButton();
        return;
      }

      if (action === "remove-welcome-role-filter") {
        const row = target.closest("[data-welcome-role-filter-row]");
        const section = getPageScope("welcome");
        const container = section.querySelector("#welcome-role-filters-list");
        if (row) {
          row.remove();
        }
        if (container && !container.querySelector("[data-welcome-role-filter-row]")) {
          container.innerHTML = '<div class="empty-state">No role-based color presets yet.</div>';
          localizeContainerText(container);
        }
        syncFloatingSaveButton();
        return;
      }

      if (action === "add-levels-role-template") {
        const section = getPageScope("levels");
        const container = section.querySelector("#levels-role-templates-list");
        const currentServer = getCurrentServerSettingsItem();
        const roles = Array.isArray(currentServer?.availableRoles) ? currentServer.availableRoles : [];

        if (!container || !roles.length) {
          showToast("error", "No roles available for this server.");
          return;
        }

        const usedRoleIds = new Set(
          Array.from(container.querySelectorAll("[data-levels-role-template-role]"))
            .map((node) => String(node?.value || "").trim())
            .filter(Boolean)
        );
        const freeRole = roles.find((item) => !usedRoleIds.has(String(item?.id || "").trim()));
        if (!freeRole?.id) {
          showToast("info", "All roles are already used in card template presets.");
          return;
        }

        const defaultTemplate = normalizeLevelCardTemplateKey(
          section.querySelector("#levels-card-template")?.value || "blue",
          "blue"
        );
        const emptyState = container.querySelector(".empty-state");
        if (emptyState) emptyState.remove();
        container.insertAdjacentHTML(
          "beforeend",
          renderLevelsRoleTemplateRow(
            { roleId: String(freeRole.id), template: defaultTemplate },
            roles,
            `${Date.now()}`
          )
        );
        localizeContainerText(container);
        updateLevelsLivePreview();
        syncFloatingSaveButton();
        return;
      }

      if (action === "remove-levels-role-template") {
        const row = target.closest("[data-levels-role-template-row]");
        const section = getPageScope("levels");
        const container = section.querySelector("#levels-role-templates-list");
        if (row) {
          row.remove();
        }
        if (container && !container.querySelector("[data-levels-role-template-row]")) {
          container.innerHTML = '<div class="empty-state">No role-based templates yet.</div>';
          localizeContainerText(container);
        }
        updateLevelsLivePreview();
        syncFloatingSaveButton();
        return;
      }

      if (action === "add-levels-role-filter") {
        const section = getPageScope("levels");
        const container = section.querySelector("#levels-role-filters-list");
        const currentServer = getCurrentServerSettingsItem();
        const roles = Array.isArray(currentServer?.availableRoles) ? currentServer.availableRoles : [];

        if (!container || !roles.length) {
          showToast("error", "No roles available for this server.");
          return;
        }

        const usedRoleIds = new Set(
          Array.from(container.querySelectorAll("[data-levels-role-filter-role]"))
            .map((node) => String(node?.value || "").trim())
            .filter(Boolean)
        );
        const freeRole = roles.find((item) => !usedRoleIds.has(String(item?.id || "").trim()));
        if (!freeRole?.id) {
          showToast("info", "All roles are already used in level-card color presets.");
          return;
        }

        const emptyState = container.querySelector(".empty-state");
        if (emptyState) emptyState.remove();
        container.insertAdjacentHTML(
          "beforeend",
          renderLevelsRoleFilterRow(
            { roleId: String(freeRole.id), filter: "none" },
            roles,
            `${Date.now()}`
          )
        );
        localizeContainerText(container);
        updateLevelsLivePreview();
        syncFloatingSaveButton();
        return;
      }

      if (action === "remove-levels-role-filter") {
        const row = target.closest("[data-levels-role-filter-row]");
        const section = getPageScope("levels");
        const container = section.querySelector("#levels-role-filters-list");
        if (row) {
          row.remove();
        }
        if (container && !container.querySelector("[data-levels-role-filter-row]")) {
          container.innerHTML = '<div class="empty-state">No role-based level colors yet.</div>';
          localizeContainerText(container);
        }
        updateLevelsLivePreview();
        syncFloatingSaveButton();
        return;
      }

      if (action === "add-level-reward") {
        const section = getPageScope("levels");
        const container = section.querySelector("#levels-reward-list");
        const currentServer = getCurrentServerSettingsItem();
        const roles = Array.isArray(currentServer?.availableRoles) ? currentServer.availableRoles : [];

        if (!container || !roles.length) {
          showToast("error", "No roles available for this server.");
          return;
        }

        const existingLevels = Array.from(container.querySelectorAll("[data-level-reward-level]"))
          .map((node) => Number(node?.value || 1))
          .filter((value) => Number.isFinite(value));
        const nextLevel = existingLevels.length ? Math.max(...existingLevels) + 1 : 1;
        const usedRoleIds = new Set(
          Array.from(container.querySelectorAll("[data-level-reward-role]"))
            .map((node) => String(node?.value || "").trim())
            .filter(Boolean)
        );
        const freeRole = roles.find((item) => !usedRoleIds.has(String(item?.id || "").trim())) || roles[0];
        if (!freeRole?.id) {
          showToast("error", "No roles available for this server.");
          return;
        }

        const emptyState = container.querySelector(".empty-state");
        if (emptyState) emptyState.remove();
        container.insertAdjacentHTML(
          "beforeend",
          renderLevelRewardRow(
            { level: nextLevel, roleId: String(freeRole.id) },
            roles,
            `${Date.now()}`
          )
        );
        localizeContainerText(container);
        syncFloatingSaveButton();
        return;
      }

      if (action === "remove-level-reward") {
        const row = target.closest("[data-level-reward-row]");
        const section = getPageScope("levels");
        const container = section.querySelector("#levels-reward-list");
        if (row) {
          row.remove();
        }
        if (container && !container.querySelector("[data-level-reward-row]")) {
          container.innerHTML = '<div class="empty-state">No level role rewards configured yet.</div>';
          localizeContainerText(container);
        }
        syncFloatingSaveButton();
        return;
      }

      if (action === "add-shop-item") {
        const section = getPageScope("economy");
        const container = section.querySelector("#economy-shop-items-list");
        const currentServer = getCurrentServerSettingsItem();
        const roles = Array.isArray(currentServer?.availableRoles) ? currentServer.availableRoles : [];
        if (!container) return;

        const currentRows = Array.from(container.querySelectorAll("[data-shop-item-row]"));
        const nextIndex = currentRows.length + 1;
        const emptyState = container.querySelector(".empty-state");
        if (emptyState) emptyState.remove();
        const firstRoleId = roles[0]?.id ? String(roles[0].id) : "";
        container.insertAdjacentHTML(
          "beforeend",
          renderShopItemRow(
            {
              id: `item-${nextIndex}`,
              name: `Shop Item ${nextIndex}`,
              description: "",
              price: 100,
              category: "basic",
              type: "role",
              enabled: true,
              roleId: firstRoleId
            },
            roles,
            `${Date.now()}`
          )
        );
        localizeContainerText(container);
        syncFloatingSaveButton();
        return;
      }

      if (action === "remove-shop-item") {
        const row = target.closest("[data-shop-item-row]");
        const section = getPageScope("economy");
        const container = section.querySelector("#economy-shop-items-list");
        if (row) row.remove();
        if (container && !container.querySelector("[data-shop-item-row]")) {
          container.innerHTML = '<div class="empty-state">No shop items configured yet.</div>';
          localizeContainerText(container);
        }
        syncFloatingSaveButton();
        return;
      }

      if (action === "resend-shop-message") {
        void resendShopMessage();
        return;
      }

      if (action === "refresh-shop-card-status") {
        void refreshShopCardStatus();
        return;
      }

      if (action === "send-announcement-now") {
        void sendAnnouncementNow();
        return;
      }

      if (action === "send-poll-now") {
        void sendPollNow();
        return;
      }

      if (action === "send-giveaway-now") {
        void sendGiveawayNow();
        return;
      }

      if (action === "save-active-settings" || action === "save-server-settings") {
        void persistActiveSettings();
        return;
      }

      if (action === "reset-active-settings" || action === "reset-server-settings") {
        openConfirm({
          title: "Reset Settings",
          message: "This will discard unsaved local changes and restore the last saved values. Continue?",
          onConfirm: () => {
            resetActiveSettingsDraft();
            showToast("info", "Unsaved changes were discarded.");
          }
        });
        return;
      }

      if (action === "logs-prev") {
        state.ui.logsPage = Math.max(1, state.ui.logsPage - 1);
        renderApp();
        return;
      }

      if (action === "logs-next") {
        const total = Math.max(1, Math.ceil(getFilteredLogs().length / state.ui.logsPerPage));
        state.ui.logsPage = Math.min(total, state.ui.logsPage + 1);
        renderApp();
        return;
      }

      if (action === "export-logs") {
        exportLogsCsv();
        return;
      }

      if (action === "view-log") {
        const item = (state.data.tables.logs || []).find((row) => row.id === target.dataset.id);
        if (!item) return;
        openConfirm({
          title: `Log details ${item.id}`,
          message: `${item.contentPreview}\n\nStatus: ${item.status}\nCategory: ${item.category}`,
          onConfirm: () => {
            showToast("info", "Log review confirmed.");
          }
        });
        return;
      }

      if (action === "close-modal") {
        closeConfirm();
      }
    });

    document.addEventListener("change", (event) => {
      const action = event.target.getAttribute("data-action");

      if (action === "select-guild") {
        state.ui.selectedGuildId = event.target.value || null;
        ensureGuildScopedFormMaps();
        if (isMobileViewport()) {
          state.ui.mobileNavOpen = false;
        }
        renderApp();
        if (state.ui.activePage === "economy") {
          void refreshShopCardStatus({ silent: true, skipWhenBusy: true });
        }
        return;
      }

      if (event.target.matches?.("[data-developer-points-field]")) {
        const fieldKey = String(event.target.getAttribute("data-developer-points-field") || "").trim();
        if (fieldKey) {
          updateDeveloperPointsFormDraft({
            [fieldKey]: event.target.value || ""
          });
        }
        return;
      }

      if (
        event.target.id === "ss-confession-channel" ||
        event.target.id === "ss-panel-channel" ||
        event.target.id === "ss-logs-channel" ||
        event.target.id === "ss-moderation-channel" ||
        event.target.id === "ss-daily-message-quota" ||
        event.target.id === "brand-ui-theme" ||
        event.target.id === "brand-embed-color" ||
        event.target.id === "lang-language" ||
        event.target.id === "welcome-channel" ||
        event.target.id === "welcome-image-filter" ||
        event.target.id === "welcome-background-image" ||
        event.target.id === "welcome-overlay-text" ||
        event.target.id === "welcome-overlay-text-size" ||
        event.target.id === "welcome-overlay-text-x" ||
        event.target.id === "welcome-overlay-text-y" ||
        event.target.id === "welcome-avatar-scale" ||
        event.target.id === "welcome-avatar-x" ||
        event.target.id === "welcome-avatar-y" ||
        event.target.id === "levels-image-filter" ||
        event.target.id === "levels-card-template" ||
        event.target.id === "levels-min-xp" ||
        event.target.id === "levels-max-xp" ||
        event.target.id === "levels-cooldown-seconds" ||
        event.target.id === "levels-avatar-scale" ||
        event.target.id === "levels-username-scale" ||
        event.target.id === "levels-stats-scale" ||
        event.target.id === "economy-shop-channel" ||
        event.target.id === "economy-log-channel" ||
        event.target.id === "economy-message-points" ||
        event.target.id === "economy-message-cooldown" ||
        event.target.id === "economy-message-daily-limit" ||
        event.target.id === "economy-voice-points" ||
        event.target.id === "economy-voice-daily-limit" ||
        event.target.id === "economy-reaction-points" ||
        event.target.id === "economy-reaction-daily-limit" ||
        event.target.id === "economy-daily-reward" ||
        event.target.id === "economy-daily-limit" ||
        event.target.id === "economy-tax-percent" ||
        event.target.id === "economy-purchase-cooldown" ||
        event.target.id === "economy-role-duration" ||
        event.target.id === "economy-allowed-roles" ||
        event.target.id === "economy-exclusive-roles" ||
        event.target.id === "economy-blocked-buyer-roles" ||
        event.target.id === "panel-editor-title" ||
        event.target.id === "panel-editor-description" ||
        event.target.id === "panel-editor-button-label" ||
        event.target.id === "panel-editor-image-url" ||
        event.target.id === "panel-editor-thumbnail-url" ||
        event.target.id === "panel-editor-footer-text" ||
        event.target.id === "panel-editor-accent-color" ||
        event.target.id === "announcement-channel" ||
        event.target.id === "announcement-title" ||
        event.target.id === "announcement-message" ||
        event.target.id === "announcement-image-url" ||
        event.target.id === "poll-response-channel" ||
        event.target.id === "poll-duration-minutes" ||
        event.target.id === "poll-choices" ||
        event.target.id === "giveaway-response-channel" ||
        event.target.id === "giveaway-duration-minutes" ||
        event.target.id === "giveaway-prize" ||
        event.target.id === "giveaway-winners-count" ||
        event.target.matches?.("[data-level-reward-level]") ||
        event.target.matches?.("[data-level-reward-role]") ||
        event.target.matches?.("[data-levels-role-template-role]") ||
        event.target.matches?.("[data-levels-role-template-template]") ||
        event.target.matches?.("[data-levels-role-filter-role]") ||
        event.target.matches?.("[data-levels-role-filter-filter]") ||
        event.target.matches?.("[data-shop-item-id]") ||
        event.target.matches?.("[data-shop-item-name]") ||
        event.target.matches?.("[data-shop-item-description]") ||
        event.target.matches?.("[data-shop-item-price]") ||
        event.target.matches?.("[data-shop-item-category]") ||
        event.target.matches?.("[data-shop-item-type]") ||
        event.target.matches?.("[data-shop-item-role]") ||
        event.target.matches?.("[data-shop-item-nickname]") ||
        event.target.matches?.("[data-shop-item-message]") ||
        event.target.matches?.("[data-shop-item-feature]") ||
        event.target.matches?.("[data-shop-item-card-codes]") ||
        event.target.matches?.("[data-shop-item-duration]") ||
        event.target.matches?.("[data-shop-item-cooldown]") ||
        event.target.matches?.("[data-shop-item-card-cooldown-days]") ||
        event.target.matches?.("[data-shop-item-limited-until]") ||
        event.target.matches?.("[data-shop-item-purchase-limit]") ||
        event.target.matches?.("[data-shop-item-user-limit]") ||
        event.target.matches?.("[data-shop-item-enabled]") ||
        event.target.matches?.("[data-welcome-role-filter-role]") ||
        event.target.matches?.("[data-welcome-role-filter-filter]")
      ) {
        if (event.target.id === "levels-min-xp" || event.target.id === "levels-max-xp") {
          const section = getPageScope("levels");
          const minNode = section.querySelector("#levels-min-xp");
          const maxNode = section.querySelector("#levels-max-xp");
          const minValue = clampNumber(minNode?.value, 1, 500, 10);
          const maxValue = clampNumber(maxNode?.value, minValue, 5000, Math.max(20, minValue));
          if (minNode) minNode.value = String(minValue);
          if (maxNode) maxNode.value = String(maxValue);
        }
        if (
          event.target.id === "levels-image-filter" ||
          event.target.id === "levels-card-template" ||
          event.target.id === "levels-min-xp" ||
          event.target.id === "levels-max-xp" ||
          event.target.id === "levels-cooldown-seconds" ||
          event.target.id === "levels-avatar-scale" ||
          event.target.id === "levels-username-scale" ||
          event.target.id === "levels-stats-scale" ||
          event.target.matches?.("[data-level-reward-level]") ||
          event.target.matches?.("[data-level-reward-role]") ||
          event.target.matches?.("[data-levels-role-template-role]") ||
          event.target.matches?.("[data-levels-role-template-template]") ||
          event.target.matches?.("[data-levels-role-filter-role]") ||
          event.target.matches?.("[data-levels-role-filter-filter]")
        ) {
          updateLevelsLivePreview();
        }
        if (
          event.target.id === "welcome-image-filter" ||
          event.target.id === "welcome-background-image" ||
          event.target.id === "welcome-overlay-text" ||
          event.target.id === "welcome-overlay-text-size" ||
          event.target.id === "welcome-overlay-text-x" ||
          event.target.id === "welcome-overlay-text-y" ||
          event.target.id === "welcome-avatar-scale" ||
          event.target.id === "welcome-avatar-x" ||
          event.target.id === "welcome-avatar-y"
        ) {
          updateWelcomeLivePreview();
        }
        if (
          event.target.id === "panel-editor-title" ||
          event.target.id === "panel-editor-description" ||
          event.target.id === "panel-editor-button-label" ||
          event.target.id === "panel-editor-image-url" ||
          event.target.id === "panel-editor-thumbnail-url" ||
          event.target.id === "panel-editor-footer-text" ||
          event.target.id === "panel-editor-accent-color"
        ) {
          updatePanelEditorLivePreview();
        }
        if (event.target.matches?.("[data-welcome-role-filter-filter]")) {
          const section = getPageScope("welcome");
          const imageNode = section.querySelector("#welcome-preview-image");
          if (imageNode) {
            imageNode.style.filter = getWelcomePreviewCssFilter(event.target.value || "none");
          }
        }
        syncFloatingSaveButton();
        return;
      }

      if (action === "logs-status") {
        state.ui.logsStatus = event.target.value;
        state.ui.logsPage = 1;
        renderApp();
        return;
      }

      if (action === "logs-category") {
        state.ui.logsCategory = event.target.value;
        state.ui.logsPage = 1;
        renderApp();
        return;
      }

      if (SETTINGS_PAGES.has(state.ui.activePage)) {
        syncFloatingSaveButton();
      }
    });

    document.addEventListener("input", (event) => {
      const action = event.target.getAttribute("data-action");
      if (action === "logs-search") {
        state.ui.logsSearch = event.target.value || "";
        state.ui.logsPage = 1;
        renderApp();
        return;
      }

      if (event.target.matches?.("[data-developer-points-field]")) {
        const fieldKey = String(event.target.getAttribute("data-developer-points-field") || "").trim();
        if (fieldKey) {
          updateDeveloperPointsFormDraft({
            [fieldKey]: event.target.value || ""
          });
        }
        return;
      }

      if (
        event.target.id === "welcome-background-image" ||
        event.target.id === "welcome-overlay-text" ||
        event.target.id === "welcome-overlay-text-size" ||
        event.target.id === "welcome-overlay-text-x" ||
        event.target.id === "welcome-overlay-text-y" ||
        event.target.id === "welcome-avatar-scale" ||
        event.target.id === "welcome-avatar-x" ||
        event.target.id === "welcome-avatar-y"
      ) {
        updateWelcomeLivePreview();
      }

      if (event.target.id === "levels-min-xp" || event.target.id === "levels-max-xp") {
        const section = getPageScope("levels");
        const minNode = section.querySelector("#levels-min-xp");
        const maxNode = section.querySelector("#levels-max-xp");
        const minValue = clampNumber(minNode?.value, 1, 500, 10);
        const maxValue = clampNumber(maxNode?.value, minValue, 5000, Math.max(20, minValue));
        if (minNode) minNode.value = String(minValue);
        if (maxNode) maxNode.value = String(maxValue);
        updateLevelsLivePreview();
      }
      if (
        event.target.id === "levels-avatar-scale" ||
        event.target.id === "levels-username-scale" ||
        event.target.id === "levels-stats-scale"
      ) {
        updateLevelsLivePreview();
      }

      if (
        event.target.id === "panel-editor-title" ||
        event.target.id === "panel-editor-description" ||
        event.target.id === "panel-editor-button-label" ||
        event.target.id === "panel-editor-image-url" ||
        event.target.id === "panel-editor-thumbnail-url" ||
        event.target.id === "panel-editor-footer-text" ||
        event.target.id === "panel-editor-accent-color"
      ) {
        updatePanelEditorLivePreview();
      }

      if (
        event.target.id?.startsWith?.("economy-") ||
        event.target.matches?.("[data-shop-item-id]") ||
        event.target.matches?.("[data-shop-item-name]") ||
        event.target.matches?.("[data-shop-item-description]") ||
        event.target.matches?.("[data-shop-item-price]") ||
        event.target.matches?.("[data-shop-item-nickname]") ||
        event.target.matches?.("[data-shop-item-message]") ||
        event.target.matches?.("[data-shop-item-feature]") ||
        event.target.matches?.("[data-shop-item-card-codes]") ||
        event.target.matches?.("[data-shop-item-duration]") ||
        event.target.matches?.("[data-shop-item-cooldown]") ||
        event.target.matches?.("[data-shop-item-card-cooldown-days]") ||
        event.target.matches?.("[data-shop-item-limited-until]") ||
        event.target.matches?.("[data-shop-item-purchase-limit]") ||
        event.target.matches?.("[data-shop-item-user-limit]")
      ) {
        syncFloatingSaveButton();
      }

      if (SETTINGS_PAGES.has(state.ui.activePage)) {
        syncFloatingSaveButton();
      }
    });

    modalSubmit.addEventListener("click", () => {
      const action = pendingConfirm.action;
      closeConfirm();
      if (typeof action === "function") action();
    });

    modal.addEventListener("click", (event) => {
      if (event.target.matches("[data-action='close-modal']")) {
        closeConfirm();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!state.ui.mobileNavOpen) return;
      state.ui.mobileNavOpen = false;
      renderApp();
    });

    window.addEventListener("resize", () => {
      if (!isMobileViewport() && state.ui.mobileNavOpen) {
        state.ui.mobileNavOpen = false;
        renderApp();
        return;
      }
      if (!state.ui.isLoading) {
        drawHomeChart();
        drawAnalyticsChart();
      }
    });

    window.addEventListener("beforeunload", () => {
      if (healthPollTimer) {
        clearInterval(healthPollTimer);
        healthPollTimer = null;
      }
    });
  }

  bindEvents();
  setTimeout(() => {
    state.ui.isLoading = false;
    renderApp();
    void refreshRuntimeHealth().finally(() => {
      showToast("success", "Database is good");
    });
    healthPollTimer = setInterval(() => {
      void refreshRuntimeHealth();
      void refreshShopCardStatus({ silent: true, skipWhenBusy: true });
    }, HEALTH_POLL_INTERVAL_MS);
  }, 600);
})();
