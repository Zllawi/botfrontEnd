const { DEFAULT_MIN_CONFIDENCE } = require("../moderation/moderationSettings");

const DEFAULT_MAX_MESSAGE_LENGTH = 500;
const LEVEL_CARD_TEMPLATE_KEYS = new Set(["blue", "pink"]);

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeLevelCardTemplateKey(value, fallback = "blue") {
  const normalized = String(value || "").trim().toLowerCase();
  if (LEVEL_CARD_TEMPLATE_KEYS.has(normalized)) return normalized;
  const fallbackNormalized = String(fallback || "blue").trim().toLowerCase();
  if (LEVEL_CARD_TEMPLATE_KEYS.has(fallbackNormalized)) return fallbackNormalized;
  return "blue";
}

function normalizeLevelCardRoleTemplates(value, fallbackTemplate = "blue") {
  if (!Array.isArray(value)) return [];
  const output = [];
  const dedupe = new Set();
  const fallback = normalizeLevelCardTemplateKey(fallbackTemplate, "blue");

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    if (output.length >= 30) break;

    const roleId = String(item?.roleId || "").trim();
    if (!/^\d{5,30}$/u.test(roleId) || dedupe.has(roleId)) continue;

    output.push({
      roleId,
      template: normalizeLevelCardTemplateKey(item?.template, fallback)
    });
    dedupe.add(roleId);
  }
  return output;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPercent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

function normalizeIdSet(ids) {
  if (!Array.isArray(ids)) return null;
  const output = new Set();
  for (const id of ids) {
    const normalized = String(id || "").trim();
    if (normalized) output.add(normalized);
  }
  return output;
}

function getManagedGuilds(client, allowedGuildIds) {
  const allGuilds = Array.from(client?.guilds?.cache?.values?.() || []);
  if (!allowedGuildIds || !allowedGuildIds.size) return allGuilds;
  return allGuilds.filter((guild) => allowedGuildIds.has(String(guild.id)));
}

function sumGuildMembers(guilds) {
  let total = 0;
  for (const guild of guilds) {
    total += toNumber(guild?.memberCount, 0);
  }
  return total;
}

function estimateTotalConfessions(store, allowedGuildIds) {
  if (!store || !(store.anonymousIdByGuildUser instanceof Map)) return 0;
  if (!allowedGuildIds || !allowedGuildIds.size) return store.anonymousIdByGuildUser.size;

  let total = 0;
  for (const key of store.anonymousIdByGuildUser.keys()) {
    const guildId = String(key || "").split(":")[0];
    if (allowedGuildIds.has(guildId)) total += 1;
  }
  return total;
}

function estimateWeeklyActivity(totalConfessions) {
  const base = Math.max(8, Math.round(totalConfessions / 24));
  const labels = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  return labels.map((label, index) => {
    const wave = Math.sin((index / labels.length) * Math.PI * 2);
    const value = Math.max(1, Math.round(base + wave * (base * 0.35) + index * 0.8));
    return { label, value };
  });
}

function estimateMonthlyActivity(totalConfessions) {
  const base = Math.max(35, Math.round(totalConfessions / 4));

  return [
    { label: "January", value: Math.round(base * 0.78) },
    { label: "February", value: Math.round(base * 0.84) },
    { label: "March", value: Math.round(base * 0.9) },
    { label: "April", value: Math.round(base * 1.02) },
    { label: "May", value: Math.round(base * 1.08) },
    { label: "June", value: Math.round(base * 1.12) }
  ];
}

function buildTopServers(guilds) {
  return guilds
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      members: toNumber(guild.memberCount, 0),
      confessions: Math.max(1, Math.round(toNumber(guild.memberCount, 0) * 0.11))
    }))
    .sort((a, b) => b.confessions - a.confessions)
    .slice(0, 6);
}

function inferBotHealth({ client, uptimeSeconds }) {
  const wsPing = toNumber(client?.ws?.ping, 0);
  const status = client?.isReady?.() ? "Connected" : "Disconnected";

  let level = "healthy";
  if (!client?.isReady?.()) {
    level = "critical";
  } else if (wsPing > 250) {
    level = "warning";
  }

  return {
    status,
    level,
    uptimeSeconds,
    wsPing,
    memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024)
  };
}

function buildCaseQuery(guildIds) {
  if (!guildIds?.length) return null;
  return { guildId: { $in: guildIds } };
}

async function fetchModerationCaseStats(moderationStore, guildIds) {
  if (!moderationStore?.ready || !moderationStore.cases) {
    return {
      totalCases: 0,
      pendingQueue: 0,
      severeCases: 0,
      lowConfidenceCases: 0,
      aiUsageToday: 0,
      recentCases: []
    };
  }

  if (Array.isArray(guildIds) && guildIds.length === 0) {
    return {
      totalCases: 0,
      pendingQueue: 0,
      severeCases: 0,
      lowConfidenceCases: 0,
      aiUsageToday: 0,
      recentCases: []
    };
  }

  const baseQuery = buildCaseQuery(guildIds);
  const now = Date.now();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

  const mergeQuery = (extra) => {
    if (!baseQuery) return extra;
    return { ...baseQuery, ...extra };
  };

  const [
    totalCases,
    pendingQueue,
    severeCases,
    lowConfidenceCases,
    aiUsageToday,
    recentCases
  ] = await Promise.all([
    moderationStore.cases.countDocuments(baseQuery || {}),
    moderationStore.cases.countDocuments(
      mergeQuery({
        lowConfidence: true,
        override: null
      })
    ),
    moderationStore.cases.countDocuments(mergeQuery({ finalSeverity: { $gte: 4 } })),
    moderationStore.cases.countDocuments(mergeQuery({ lowConfidence: true })),
    moderationStore.cases.countDocuments(
      mergeQuery({
        createdAt: { $gte: oneDayAgo }
      })
    ),
    moderationStore.cases
      .find(baseQuery || {})
      .sort({ createdAt: -1 })
      .limit(8)
      .project({
        caseId: 1,
        category: 1,
        actionTaken: 1,
        userTag: 1,
        guildId: 1,
        createdAt: 1
      })
      .toArray()
  ]);

  return {
    totalCases,
    pendingQueue,
    severeCases,
    lowConfidenceCases,
    aiUsageToday,
    recentCases
  };
}

function buildActivityFeed({ recentCases, topServers }) {
  const activity = [];

  for (const item of recentCases) {
    activity.push({
      id: item.caseId,
      title: `Case ${item.category} - ${item.actionTaken}`,
      subtitle: item.userTag ? `User: ${item.userTag}` : "Unknown user",
      timestamp: new Date(item.createdAt || Date.now()).toISOString(),
      type: "moderation"
    });
  }

  for (const server of topServers.slice(0, 2)) {
    activity.push({
      id: `server-${server.id}`,
      title: `High activity in ${server.name}`,
      subtitle: `${server.confessions} confessions in the current period`,
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      type: "server"
    });
  }

  if (!activity.length) {
    activity.push({
      id: "bootstrap",
      title: "Dashboard is ready",
      subtitle: "Start by linking servers and enabling settings",
      timestamp: new Date().toISOString(),
      type: "system"
    });
  }

  return activity.slice(0, 10);
}

function buildRecentUsersList(items) {
  if (!Array.isArray(items)) return [];

  const normalized = items
    .map((item) => ({
      submissionId: String(item?.submissionId || ""),
      guildId: String(item?.guildId || ""),
      guildName: String(item?.guildName || "Unknown Server"),
      userId: String(item?.userId || ""),
      userTag: String(item?.userTag || item?.userId || "Unknown User"),
      category: String(item?.category || "general"),
      status: String(item?.status || "UNKNOWN").toUpperCase(),
      createdAt: new Date(item?.createdAt || Date.now()).toISOString()
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unique = [];
  const seenUsers = new Set();
  for (const item of normalized) {
    if (!item.userId) continue;
    if (seenUsers.has(item.userId)) continue;
    seenUsers.add(item.userId);
    unique.push(item);
    if (unique.length >= 12) break;
  }

  return unique;
}

function buildRecentConfessionsFromStore({
  client,
  confessionStore,
  allowedGuildIds,
  guildNamesById,
  limit = 30
}) {
  const safeLimit = parsePositiveInt(limit, 30);
  if (typeof confessionStore?.listRecentConfessions !== "function") return [];

  const rows = confessionStore.listRecentConfessions(safeLimit, allowedGuildIds);
  if (!Array.isArray(rows) || !rows.length) return [];

  return rows.map((item) => {
    const userId = String(item?.userId || "").trim();
    const guildId = String(item?.guildId || "").trim();
    const cachedUser = userId ? client?.users?.cache?.get(userId) : null;
    const message = String(item?.message || "").trim();

    return {
      id: String(item?.id || `${item?.lastSeenAt || Date.now()}:${userId}`),
      userId,
      userTag: String(item?.userTag || cachedUser?.tag || cachedUser?.username || userId || "Unknown User"),
      guildId,
      guildName: guildId ? guildNamesById.get(guildId) || "Unknown Server" : "Unknown Server",
      source: String(item?.source || "confession"),
      message,
      preview: message.length > 140 ? `${message.slice(0, 140)}...` : message,
      createdAt: new Date(item?.lastSeenAt || Date.now()).toISOString()
    };
  });
}

function buildRecentConfessionsFallbackFromUsers(recentUsers = []) {
  if (!Array.isArray(recentUsers) || !recentUsers.length) return [];

  return recentUsers.map((item, index) => {
    const userId = String(item?.userId || "").trim();
    const createdAt = new Date(item?.createdAt || Date.now()).toISOString();
    const fallbackMessage = "Message preview unavailable for older records. Send a new confession to capture full text.";

    return {
      id: `fallback-${String(item?.guildId || "g")}:${userId || `u${index}`}:${createdAt}`,
      userId,
      userTag: String(item?.userTag || userId || "Unknown User"),
      guildId: String(item?.guildId || ""),
      guildName: String(item?.guildName || "Unknown Server"),
      source: String(item?.status || "ACTIVE"),
      message: fallbackMessage,
      preview: fallbackMessage,
      createdAt
    };
  });
}

function buildRecentUsersFromStore({ client, confessionStore, allowedGuildIds, guildNamesById, limit = 12 }) {
  const safeLimit = parsePositiveInt(limit, 12);
  if (typeof confessionStore?.listRecentBotUsers === "function") {
    const rows = confessionStore.listRecentBotUsers(safeLimit, allowedGuildIds);
    if (Array.isArray(rows) && rows.length) {
      return rows.map((item) => {
        const userId = String(item?.userId || "").trim();
        const guildId = String(item?.guildId || "").trim();
        const cachedUser = userId ? client?.users?.cache?.get(userId) : null;

        return {
          submissionId: "",
          guildId,
          guildName: guildId ? guildNamesById.get(guildId) || "Unknown Server" : "Unknown Server",
          userId,
          userTag: String(item?.userTag || cachedUser?.tag || cachedUser?.username || userId || "Unknown User"),
          category: "general",
          status: "ACTIVE",
          createdAt: new Date(item?.lastSeenAt || Date.now()).toISOString()
        };
      });
    }
  }

  if (!(confessionStore?.lastSubmissionByUser instanceof Map)) return [];
  const userGuildHints = new Map();
  const anonymousMap = confessionStore?.anonymousIdByGuildUser;
  if (anonymousMap instanceof Map) {
    for (const key of anonymousMap.keys()) {
      const [guildIdRaw, userIdRaw] = String(key || "").split(":");
      const guildId = String(guildIdRaw || "").trim();
      const userId = String(userIdRaw || "").trim();
      if (!guildId || !userId) continue;
      if (allowedGuildIds?.size && !allowedGuildIds.has(guildId)) continue;
      if (!userGuildHints.has(userId)) {
        userGuildHints.set(userId, guildId);
      }
    }
  }

  const list = [];
  for (const [rawUserId, rawTimestamp] of confessionStore.lastSubmissionByUser.entries()) {
    const userId = String(rawUserId || "").trim();
    const timestamp = Number(rawTimestamp || 0);
    if (!userId || !Number.isFinite(timestamp) || timestamp <= 0) continue;

    const guildId = userGuildHints.get(userId) || "";
    const guildName = guildId ? guildNamesById.get(guildId) || "Unknown Server" : "Unknown Server";
    const cachedUser = client?.users?.cache?.get(userId);
    const userTag = cachedUser?.tag || cachedUser?.username || userId;

    list.push({
      submissionId: "",
      guildId,
      guildName,
      userId,
      userTag,
      category: "general",
      status: "ACTIVE",
      createdAt: new Date(timestamp).toISOString()
    });
  }

  return list
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, safeLimit);
}

function buildModerationHeatmap(casesCount) {
  const weeks = 8;
  const days = 7;
  const output = [];

  for (let w = 0; w < weeks; w += 1) {
    const row = [];
    for (let d = 0; d < days; d += 1) {
      const base = Math.max(0, Math.round(casesCount / 120 + Math.sin((w + d) * 0.9) * 2 + d * 0.2));
      row.push(Math.min(5, Math.max(0, base)));
    }
    output.push(row);
  }

  return output;
}

function buildDefaultCategories() {
  return [
    { id: "general", name: "General", color: "#7c5cff", icon: "hashtag", active: true, order: 1 },
    { id: "conflict", name: "Conflict", color: "#ff6b8a", icon: "alert", active: true, order: 2 },
    { id: "suggestions", name: "Suggestions", color: "#3dd4a7", icon: "spark", active: true, order: 3 },
    { id: "feedback", name: "Feedback", color: "#57a4ff", icon: "message", active: true, order: 4 },
    { id: "sensitive", name: "Sensitive", color: "#f6a11a", icon: "shield", active: false, order: 5 }
  ];
}

function buildDemoLogs(topServers) {
  const serverName = topServers[0]?.name || "Primary Server";
  return [
    {
      id: "LOG-001",
      server: serverName,
      category: "General",
      status: "APPROVED",
      author: "Anonymous #219",
      contentPreview: "Short confession sample used for dashboard testing...",
      createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      action: "Posted"
    },
    {
      id: "LOG-002",
      server: serverName,
      category: "Conflict",
      status: "REJECTED",
      author: "Anonymous #884",
      contentPreview: "Content with direct abuse that was blocked automatically...",
      createdAt: new Date(Date.now() - 1000 * 60 * 33).toISOString(),
      action: "Auto Rejected"
    },
    {
      id: "LOG-003",
      server: topServers[1]?.name || "Secondary Server",
      category: "Suggestions",
      status: "PENDING",
      author: "Anonymous #114",
      contentPreview: "Suggestion to improve anonymous reply features...",
      createdAt: new Date(Date.now() - 1000 * 60 * 84).toISOString(),
      action: "Pending Review"
    }
  ];
}

function buildGuildChannelOptions(guild) {
  const channels = Array.from(guild?.channels?.cache?.values?.() || []);

  return channels
    .filter((channel) => channel?.isTextBased?.() && !channel?.isDMBased?.() && !channel?.isThread?.())
    .sort((a, b) => {
      const aPos = toNumber(a.rawPosition, 0);
      const bPos = toNumber(b.rawPosition, 0);
      if (aPos !== bPos) return aPos - bPos;
      return String(a.name || "").localeCompare(String(b.name || ""), "en");
    })
    .slice(0, 250)
    .map((channel) => ({
      id: String(channel.id),
      name: String(channel.name || channel.id),
      type: String(channel.type)
    }));
}

function buildGuildVoiceChannelOptions(guild) {
  const channels = Array.from(guild?.channels?.cache?.values?.() || []);

  return channels
    .filter((channel) => channel?.type === 2 || channel?.type === 13)
    .sort((a, b) => {
      const aPos = toNumber(a.rawPosition, 0);
      const bPos = toNumber(b.rawPosition, 0);
      if (aPos !== bPos) return aPos - bPos;
      return String(a.name || "").localeCompare(String(b.name || ""), "en");
    })
    .slice(0, 250)
    .map((channel) => ({
      id: String(channel.id),
      name: String(channel.name || channel.id),
      type: String(channel.type)
    }));
}

function buildGuildRoleOptions(guild) {
  const roles = Array.from(guild?.roles?.cache?.values?.() || []);
  const everyoneRoleId = String(guild?.id || "");

  return roles
    .filter((role) => role && String(role.id || "") !== everyoneRoleId)
    .sort((a, b) => {
      const aPos = toNumber(a.position, 0);
      const bPos = toNumber(b.position, 0);
      if (aPos !== bPos) return bPos - aPos;
      return String(a.name || "").localeCompare(String(b.name || ""), "en");
    })
    .slice(0, 250)
    .map((role) => ({
      id: String(role.id),
      name: String(role.name || role.id),
      color: toNumber(role.color, 0),
      position: toNumber(role.position, 0)
    }));
}

async function buildServerSettings(guilds, confessionStore, moderationStore) {
  const maxMessageLength = parsePositiveInt(
    process.env.USER_PORTAL_MAX_MESSAGE_LENGTH,
    DEFAULT_MAX_MESSAGE_LENGTH
  );

  return Promise.all(
    guilds.slice(0, 30).map(async (guild) => {
      const guildId = String(guild.id);
      const aiSettings = moderationStore?.ready
        ? await moderationStore.getGuildSettings(guildId).catch(() => null)
        : null;
      const dailyMessageQuota =
        typeof confessionStore?.getDailyConfessionQuota === "function"
          ? confessionStore.getDailyConfessionQuota(guildId)
          : 50;
      const dailyUsage =
        typeof confessionStore?.getDailyConfessionUsage === "function"
          ? confessionStore.getDailyConfessionUsage(guildId)
          : {
              used: 0,
              remaining: dailyMessageQuota
            };

      return {
        guildId,
        guildName: guild.name,
        confessionChannelId: confessionStore?.getChannel?.(guildId) || null,
        panelChannelId:
          typeof confessionStore?.getPanelChannel === "function"
            ? confessionStore.getPanelChannel(guildId) || null
            : null,
        logsChannelId: confessionStore?.getLogChannel?.(guildId) || null,
        logAlertSettings:
          typeof confessionStore?.getLogAlertSettings === "function"
            ? confessionStore.getLogAlertSettings(guildId)
            : null,
        moderationChannelId: aiSettings?.logChannelId || null,
        toxicityThreshold: toNumber(aiSettings?.minConfidence, DEFAULT_MIN_CONFIDENCE),
        botEnabled:
          typeof confessionStore?.isBotEnabled === "function"
            ? confessionStore.isBotEnabled(guildId)
            : true,
        developerBlocked:
          typeof confessionStore?.isDeveloperBlocked === "function"
            ? confessionStore.isDeveloperBlocked(guildId)
            : false,
        anonymousPosting:
          typeof confessionStore?.isAnonymousPostingEnabled === "function"
            ? confessionStore.isAnonymousPostingEnabled(guildId)
            : true,
        dailyMessageQuota: toNumber(dailyMessageQuota, 50),
        dailyMessageUsed: toNumber(dailyUsage?.used, 0),
        dailyMessageRemaining: toNumber(dailyUsage?.remaining, toNumber(dailyMessageQuota, 50)),
        cooldownSeconds: toNumber(confessionStore?.cooldownMs, 30000) / 1000,
        maxMessageLength,
        repliesEnabled:
          typeof confessionStore?.isRepliesEnabled === "function"
            ? confessionStore.isRepliesEnabled(guildId)
            : true,
        aiModerationEnabled: Boolean(aiSettings?.enabled),
        availableChannels: buildGuildChannelOptions(guild),
        availableVoiceChannels: buildGuildVoiceChannelOptions(guild),
        availableRoles: buildGuildRoleOptions(guild)
      };
    })
  );
}

function buildHelpContent() {
  return {
    quickStart: [
      "1) Invite the bot to your server.",
      "2) Select your server from the sidebar.",
      "3) Set a confessions channel and a logs channel.",
      "4) Save settings on the same page."
    ],
    commands: [
      "/setup: set the confessions channel.",
      "/panel: post the confession panel in your server.",
      "/ai-mod settings: view smart moderation settings.",
      "/points, /daily, /shop, /buy, /top: points economy and shop.",
      "/points-admin reward|deduct|set: manual admin points control.",
      "/help: show available commands."
    ],
    faq: [
      "If your servers do not appear: verify you logged in with the correct Discord account.",
      "If channels are empty: make sure the bot is in the server and can view channels.",
      "If sending fails: check the bot permissions for Send Messages and Embed Links."
    ]
  };
}

function mapThemeToUiTheme(theme, fallback = "dark-violet") {
  const normalized = String(theme || "").toLowerCase();
  if (normalized === "blue" || normalized === "cyan" || normalized === "teal") return "dark-indigo";
  if (normalized === "rose" || normalized === "red" || normalized === "pink") return "dark-rose";
  if (normalized === "purple" || normalized === "dark") return "dark-violet";
  return fallback || "dark-violet";
}

function buildDashboardFormsByGuild(serverSettings, confessionStore, moderationStore) {
  const categoriesByGuild = {};
  const moderationByGuild = {};
  const aiByGuild = {};
  const brandingByGuild = {};
  const languageByGuild = {};
  const welcomeByGuild = {};
  const levelsByGuild = {};
  const economyByGuild = {};
  const panelEditorByGuild = {};
  const announcementsByGuild = {};

  for (const server of serverSettings) {
    const guildId = String(server.guildId || "");
    if (!guildId) continue;

    const storedCategories =
      typeof confessionStore?.getDashboardCategories === "function"
        ? confessionStore.getDashboardCategories(guildId)
        : [];
    categoriesByGuild[guildId] =
      Array.isArray(storedCategories) && storedCategories.length
        ? storedCategories
        : buildDefaultCategories();

    const storedModeration =
      typeof confessionStore?.getDashboardModerationForm === "function"
        ? confessionStore.getDashboardModerationForm(guildId)
        : {};
    const blockedWords =
      typeof confessionStore?.getBlockedWords === "function" ? confessionStore.getBlockedWords(guildId) : [];
    moderationByGuild[guildId] = {
      badWordsFilterEnabled:
        typeof confessionStore?.isWordFilterEnabled === "function"
          ? confessionStore.isWordFilterEnabled(guildId)
          : true,
      aiModerationEnabled: Boolean(server.aiModerationEnabled),
      toxicityThreshold: toNumber(
        server.toxicityThreshold,
        moderationStore?.ready ? DEFAULT_MIN_CONFIDENCE : 70
      ),
      spamDetectionEnabled:
        typeof storedModeration.spamDetectionEnabled === "boolean"
          ? storedModeration.spamDetectionEnabled
          : true,
      linkRestrictionEnabled: Boolean(storedModeration.linkRestrictionEnabled),
      imageRestrictionEnabled: Boolean(storedModeration.imageRestrictionEnabled),
      autoRejectEnabled: Boolean(storedModeration.autoRejectEnabled),
      badWordsText: Array.isArray(blockedWords) ? blockedWords.join(", ") : ""
    };

    const storedAi =
      typeof confessionStore?.getDashboardAiForm === "function"
        ? confessionStore.getDashboardAiForm(guildId)
        : {};
    aiByGuild[guildId] = {
      integrationStatus: moderationStore?.ready ? "CONNECTED" : "LIMITED",
      provider: "OpenAI",
      aiAutoReply: Boolean(storedAi.aiAutoReply),
      smartSuggestions:
        typeof storedAi.smartSuggestions === "boolean" ? storedAi.smartSuggestions : true,
      creativity: toNumber(storedAi.creativity, 45),
      strictness: toNumber(storedAi.strictness, 72),
      moderationPrompt:
        String(storedAi.moderationPrompt || "").trim() ||
        "Classify confession risk and provide safe moderation action.",
      conversationPrompt:
        String(storedAi.conversationPrompt || "").trim() ||
        "Generate concise, respectful, and neutral suggestions."
    };

    const storedBranding =
      typeof confessionStore?.getDashboardBrandingForm === "function"
        ? confessionStore.getDashboardBrandingForm(guildId)
        : {};
    const storeTheme =
      typeof confessionStore?.getTheme === "function" ? confessionStore.getTheme(guildId) : null;
    const storeLanguage =
      typeof confessionStore?.getLanguage === "function" ? confessionStore.getLanguage(guildId) : null;

    const resolvedLanguage = String(storeLanguage || storedBranding.language || "en")
      .toLowerCase()
      .trim() === "ar"
      ? "ar"
      : "en";

    brandingByGuild[guildId] = {
      embedColor: String(storedBranding.embedColor || "#7c5cff"),
      botFooter: String(storedBranding.botFooter || "Zllawi be honest"),
      successMessage: String(storedBranding.successMessage || "Message sent successfully"),
      errorMessage: String(storedBranding.errorMessage || "Unable to send message"),
      uiTheme: String(storedBranding.uiTheme || mapThemeToUiTheme(storeTheme, "dark-violet"))
    };

    languageByGuild[guildId] = {
      language: resolvedLanguage
    };

    const storedWelcome =
      typeof confessionStore?.getWelcomeSettings === "function"
        ? confessionStore.getWelcomeSettings(guildId)
        : {};

    welcomeByGuild[guildId] = {
      enabled: Boolean(storedWelcome?.enabled),
      channelId: storedWelcome?.channelId ? String(storedWelcome.channelId) : "",
      message: String(storedWelcome?.message || "Welcome {user} to {server}!"),
      backgroundImage: String(storedWelcome?.backgroundImage || "asset://welcome-default.png"),
      mentionUser: storedWelcome?.mentionUser !== false,
      overlayText: String(storedWelcome?.overlayText || ""),
      overlayTextSize: Number(storedWelcome?.overlayTextSize || 100),
      overlayTextX: Number(storedWelcome?.overlayTextX || 73),
      overlayTextY: Number(storedWelcome?.overlayTextY || 50),
      avatarScale: Number(storedWelcome?.avatarScale || 100),
      avatarX: Number(storedWelcome?.avatarX || 30.2),
      avatarY: Number(storedWelcome?.avatarY || 48.8),
      imageFilter: String(storedWelcome?.imageFilter || "none"),
      roleFilters: Array.isArray(storedWelcome?.roleFilters)
        ? storedWelcome.roleFilters
            .map((item) => ({
              roleId: String(item?.roleId || ""),
              filter: String(item?.filter || "none")
            }))
            .filter((item) => item.roleId)
        : []
    };

    const storedLevelSettings =
      typeof confessionStore?.getLevelSettings === "function"
        ? confessionStore.getLevelSettings(guildId)
        : {};
    const storedLevelRewards =
      typeof confessionStore?.getLevelRoleRewards === "function"
        ? confessionStore.getLevelRoleRewards(guildId)
        : [];

    const minXp = Math.max(1, Math.min(500, toNumber(storedLevelSettings?.minXp, 10)));
    const maxXp = Math.max(
      minXp,
      Math.min(5000, toNumber(storedLevelSettings?.maxXp, Math.max(20, minXp)))
    );
    const cooldownMs = Math.max(0, toNumber(storedLevelSettings?.cooldownMs, 60_000));
    const cardTemplate = normalizeLevelCardTemplateKey(storedLevelSettings?.cardTemplate, "blue");

    levelsByGuild[guildId] = {
      enabled: storedLevelSettings?.enabled !== false,
      minXp,
      maxXp,
      cooldownSeconds: Math.max(0, Math.min(900, Math.round(cooldownMs / 1000))),
      imageFilter: String(storedLevelSettings?.imageFilter || "none"),
      roleFilters: Array.isArray(storedLevelSettings?.roleFilters)
        ? storedLevelSettings.roleFilters
            .map((item) => ({
              roleId: String(item?.roleId || "").trim(),
              filter: String(item?.filter || "none")
            }))
            .filter((item) => item.roleId)
        : [],
      cardTemplate,
      roleCardTemplates: normalizeLevelCardRoleTemplates(
        storedLevelSettings?.roleCardTemplates,
        cardTemplate
      ),
      avatarScale: clampInteger(storedLevelSettings?.avatarScale, 55, 180, 100),
      usernameScale: clampInteger(storedLevelSettings?.usernameScale, 70, 170, 100),
      statsScale: clampInteger(storedLevelSettings?.statsScale, 70, 170, 100),
      levelUpAlertsEnabled: storedLevelSettings?.levelUpAlertsEnabled !== false,
      levelUpChannelId: String(storedLevelSettings?.levelUpChannelId || ""),
      levelUpMessage: String(
        storedLevelSettings?.levelUpMessage || "🎉 {user} reached level **{level}**!"
      ),
      levelUpMentionUser: storedLevelSettings?.levelUpMentionUser !== false,
      rewards: Array.isArray(storedLevelRewards)
        ? storedLevelRewards
            .map((item) => ({
              level: Math.max(1, Math.min(10000, toNumber(item?.level, 1))),
              roleId: String(item?.roleId || "").trim()
            }))
            .filter((item) => item.roleId)
        : []
    };

    const storedEconomySettings =
      typeof confessionStore?.getEconomySettings === "function"
        ? confessionStore.getEconomySettings(guildId)
        : {};
    const storedShopItems =
      typeof confessionStore?.getShopItems === "function"
        ? confessionStore.getShopItems(guildId, { includeDisabled: true })
        : [];

    economyByGuild[guildId] = {
      enabled: storedEconomySettings?.enabled !== false,
      shopChannelId: String(storedEconomySettings?.shopChannelId || ""),
      purchaseLogChannelId: String(storedEconomySettings?.purchaseLogChannelId || ""),
      messagePoints: Math.max(0, toNumber(storedEconomySettings?.messagePoints, 2)),
      messageCooldownSeconds: Math.max(1, toNumber(storedEconomySettings?.messageCooldownSeconds, 45)),
      messageDailyLimit: Math.max(0, toNumber(storedEconomySettings?.messageDailyLimit, 250)),
      voicePointsPerMinute: Math.max(0, toNumber(storedEconomySettings?.voicePointsPerMinute, 1)),
      voiceDailyLimit: Math.max(0, toNumber(storedEconomySettings?.voiceDailyLimit, 200)),
      reactionReceivedPoints: Math.max(0, toNumber(storedEconomySettings?.reactionReceivedPoints, 1)),
      reactionDailyLimit: Math.max(0, toNumber(storedEconomySettings?.reactionDailyLimit, 100)),
      dailyRewardAmount: Math.max(0, toNumber(storedEconomySettings?.dailyRewardAmount, 75)),
      dailyEarningLimit: Math.max(1, toNumber(storedEconomySettings?.dailyEarningLimit, 500)),
      purchaseTaxPercent: Math.max(0, Math.min(100, toNumber(storedEconomySettings?.purchaseTaxPercent, 0))),
      purchaseCooldownSeconds: Math.max(0, toNumber(storedEconomySettings?.purchaseCooldownSeconds, 30)),
      roleDurationDays: Math.max(0, toNumber(storedEconomySettings?.roleDurationDays, 0)),
      allowedRoleIds: Array.isArray(storedEconomySettings?.allowedRoleIds)
        ? storedEconomySettings.allowedRoleIds.map((id) => String(id)).filter(Boolean)
        : [],
      exclusiveRoleIds: Array.isArray(storedEconomySettings?.exclusiveRoleIds)
        ? storedEconomySettings.exclusiveRoleIds.map((id) => String(id)).filter(Boolean)
        : [],
      blockedBuyerRoleIds: Array.isArray(storedEconomySettings?.blockedBuyerRoleIds)
        ? storedEconomySettings.blockedBuyerRoleIds.map((id) => String(id)).filter(Boolean)
        : [],
      shopItems: Array.isArray(storedShopItems)
        ? storedShopItems.map((item) => ({
            id: String(item?.id || ""),
            name: String(item?.name || "Shop Item"),
            description: String(item?.description || ""),
            price: Math.max(0, toNumber(item?.price, 0)),
            category: String(item?.category || "basic"),
            type: String(item?.type || "role"),
            enabled: item?.enabled !== false,
            roleId: String(item?.roleId || ""),
            nickname: String(item?.nickname || ""),
            message: String(item?.message || ""),
            featureKey: String(item?.featureKey || ""),
            cardInventory: Array.isArray(item?.cardInventory)
              ? item.cardInventory
                  .map((entry) => ({
                    id: String(entry?.id || ""),
                    code: String(entry?.code || ""),
                    sold: entry?.sold === true,
                    soldAt: Number(entry?.soldAt || 0),
                    soldToUserId: String(entry?.soldToUserId || ""),
                    purchaseId: String(entry?.purchaseId || "")
                  }))
                  .filter((entry) => entry.code)
              : [],
            durationDays: Math.max(0, toNumber(item?.durationDays, 0)),
            cooldownSeconds: Math.max(0, toNumber(item?.cooldownSeconds, 0)),
            cardCooldownDays:
              String(item?.type || "role") === "card"
                ? Math.max(0, toNumber(item?.cardCooldownDays, 1))
                : 0,
            limitedUntil: String(item?.limitedUntil || ""),
            purchaseLimit: Math.max(0, toNumber(item?.purchaseLimit, 0)),
            userPurchaseLimit: Math.max(0, toNumber(item?.userPurchaseLimit, 0))
          }))
        : []
    };

    const storedPanelText =
      typeof confessionStore?.getPanelText === "function" ? confessionStore.getPanelText(guildId) : {};
    const storedPanelEditor =
      typeof confessionStore?.getPanelEditorSettings === "function"
        ? confessionStore.getPanelEditorSettings(guildId)
        : {};
    const hasStoredUploadedImage =
      typeof confessionStore?.getPanelImage === "function"
        ? Boolean(confessionStore.getPanelImage(guildId))
        : false;

    panelEditorByGuild[guildId] = {
      title: String(storedPanelText?.title || ""),
      description: String(storedPanelText?.description || ""),
      buttonLabel: String(storedPanelText?.buttonLabel || ""),
      imageUrl: String(storedPanelEditor?.imageUrl || ""),
      thumbnailUrl: String(storedPanelEditor?.thumbnailUrl || ""),
      footerText: String(storedPanelEditor?.footerText || ""),
      accentColor: String(storedPanelEditor?.accentColor || ""),
      hasStoredUploadedImage
    };

    const storedAnnouncement =
      typeof confessionStore?.getAnnouncementSettings === "function"
        ? confessionStore.getAnnouncementSettings(guildId)
        : {};
    const storedPoll =
      storedAnnouncement?.poll && typeof storedAnnouncement.poll === "object"
        ? storedAnnouncement.poll
        : {};
    const storedGiveaway =
      storedAnnouncement?.giveaway && typeof storedAnnouncement.giveaway === "object"
        ? storedAnnouncement.giveaway
        : {};
    announcementsByGuild[guildId] = {
      channelId: String(storedAnnouncement?.channelId || ""),
      title: String(storedAnnouncement?.title || ""),
      message: String(storedAnnouncement?.message || ""),
      imageUrl: String(storedAnnouncement?.imageUrl || ""),
      mentionEveryone: Boolean(storedAnnouncement?.mentionEveryone),
      poll: {
        responseChannelId: String(storedPoll?.responseChannelId || ""),
        durationMinutes: Math.max(1, Math.min(60 * 24 * 14, toNumber(storedPoll?.durationMinutes, 60))),
        allowTextResponses: storedPoll?.allowTextResponses !== false,
        choicesText: String(storedPoll?.choicesText || "")
      },
      giveaway: {
        responseChannelId: String(storedGiveaway?.responseChannelId || ""),
        durationMinutes: Math.max(
          1,
          Math.min(60 * 24 * 14, toNumber(storedGiveaway?.durationMinutes, 60))
        ),
        prize: String(storedGiveaway?.prize || ""),
        winnersCount: Math.max(1, Math.min(10, toNumber(storedGiveaway?.winnersCount, 1)))
      }
    };
  }

  return {
    categoriesByGuild,
    moderationByGuild,
    aiByGuild,
    brandingByGuild,
    languageByGuild,
    welcomeByGuild,
    levelsByGuild,
    economyByGuild,
    panelEditorByGuild,
    announcementsByGuild
  };
}

async function buildDashboardBootstrap({
  client,
  confessionStore,
  moderationStore,
  userPortalService = null,
  allowedGuildIds = null,
  sessionUser = null,
  runtimeFeatures = {},
  developerAccess = false,
  developerOverview = null
}) {
  const allowedSet = normalizeIdSet(allowedGuildIds);
  const managedGuilds = getManagedGuilds(client, allowedSet);
  const managedGuildIds = managedGuilds.map((guild) => String(guild.id));
  const guildNamesById = new Map(
    managedGuilds.map((guild) => [String(guild.id), String(guild.name || guild.id)])
  );

  const totalServers = managedGuilds.length;
  const totalUsers = sumGuildMembers(managedGuilds);
  const totalConfessions = estimateTotalConfessions(confessionStore, allowedSet);
  const botReady = Boolean(client?.isReady?.());
  const uptimeSeconds = Math.floor(process.uptime());

  const moderationStats = await fetchModerationCaseStats(moderationStore, managedGuildIds);
  const topServers = buildTopServers(managedGuilds);
  const serverSettings = await buildServerSettings(managedGuilds, confessionStore, moderationStore);
  const selectedGuildId = serverSettings[0]?.guildId || null;
  const formsByGuild = buildDashboardFormsByGuild(serverSettings, confessionStore, moderationStore);
  let recentBotUsers = [];
  let recentConfessions = [];

  if (userPortalService && typeof userPortalService.listRecentBotUsers === "function") {
    recentBotUsers = await userPortalService
      .listRecentBotUsers({
        guildIds: managedGuildIds,
        limit: 12
      })
      .catch(() => []);
  }
  const storeRecentUsers = buildRecentUsersFromStore({
    client,
    confessionStore,
    allowedGuildIds: new Set(managedGuildIds),
    guildNamesById,
    limit: 12
  });
  recentBotUsers = buildRecentUsersList([...(recentBotUsers || []), ...storeRecentUsers]);
  recentConfessions = buildRecentConfessionsFromStore({
    client,
    confessionStore,
    allowedGuildIds: new Set(managedGuildIds),
    guildNamesById,
    limit: 30
  });
  if (!recentConfessions.length && recentBotUsers.length) {
    recentConfessions = buildRecentConfessionsFallbackFromUsers(recentBotUsers);
  }

  const cards = {
    totalServers,
    totalUsers,
    totalConfessions,
    botStatus: botReady ? "ONLINE" : "OFFLINE",
    aiUsageToday: moderationStats.aiUsageToday,
    pendingModerationQueue: moderationStats.pendingQueue
  };

  const weekly = estimateWeeklyActivity(totalConfessions + moderationStats.totalCases);
  const monthly = estimateMonthlyActivity(totalConfessions + moderationStats.totalCases);

  const aiUsageBreakdown = {
    automatedActions: moderationStats.totalCases - moderationStats.lowConfidenceCases,
    lowConfidenceOnly: moderationStats.lowConfidenceCases,
    severeCases: moderationStats.severeCases,
    moderationAccuracyHint: Math.max(
      52,
      94 - toPercent(moderationStats.lowConfidenceCases, moderationStats.totalCases || 1)
    )
  };
  const defaultCategories = buildDefaultCategories();
  const defaultModerationForm = {
    badWordsFilterEnabled: true,
    aiModerationEnabled: true,
    toxicityThreshold: moderationStore?.ready ? DEFAULT_MIN_CONFIDENCE : 70,
    spamDetectionEnabled: true,
    linkRestrictionEnabled: false,
    imageRestrictionEnabled: false,
    autoRejectEnabled: false,
    badWordsText: ""
  };
  const defaultAiForm = {
    integrationStatus: moderationStore?.ready ? "CONNECTED" : "LIMITED",
    provider: "OpenAI",
    aiAutoReply: false,
    smartSuggestions: true,
    creativity: 45,
    strictness: 72,
    moderationPrompt: "Classify confession risk and provide safe moderation action.",
    conversationPrompt: "Generate concise, respectful, and neutral suggestions."
  };
  const defaultBrandingForm = {
    embedColor: "#7c5cff",
    botFooter: "Zllawi be honest",
    successMessage: "Message sent successfully",
    errorMessage: "Unable to send message",
    uiTheme: "dark-violet"
  };
  const defaultLanguageForm = {
    language: "en"
  };
  const defaultWelcomeForm = {
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
  const defaultLevelsForm = {
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
    levelUpAlertsEnabled: true,
    levelUpChannelId: "",
    levelUpMessage: "🎉 {user} reached level **{level}**!",
    levelUpMentionUser: true,
    rewards: []
  };
  const defaultEconomyForm = {
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
  const defaultPanelEditorForm = {
    title: "",
    description: "",
    buttonLabel: "",
    imageUrl: "",
    thumbnailUrl: "",
    footerText: "",
    accentColor: "",
    hasStoredUploadedImage: false
  };
  const defaultAnnouncementsForm = {
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

  return {
    generatedAt: new Date().toISOString(),
    runtime: {
      features:
        runtimeFeatures && typeof runtimeFeatures === "object"
          ? runtimeFeatures
          : {}
    },
    developer: {
      access: Boolean(developerAccess),
      overview:
        developerAccess && developerOverview && typeof developerOverview === "object"
          ? developerOverview
          : null
    },
    auth: {
      loggedIn: Boolean(sessionUser?.id),
      user: sessionUser
        ? {
            id: String(sessionUser.id),
            username: String(sessionUser.username || sessionUser.tag || "Discord User"),
            tag: String(sessionUser.tag || sessionUser.username || "Discord User"),
            avatarUrl: sessionUser.avatarUrl ? String(sessionUser.avatarUrl) : null
          }
        : null
    },
    oauth: {
      connected: Boolean(sessionUser?.id),
      provider: "Discord OAuth2",
      note: sessionUser?.id
        ? "Discord account connected successfully."
        : "Sign in with Discord to manage bot settings."
    },
    cards,
    activity: {
      weekly,
      monthly,
      feed: buildActivityFeed({ recentCases: moderationStats.recentCases, topServers })
    },
    widgets: {
      botHealth: inferBotHealth({ client, uptimeSeconds }),
      topServers,
      aiUsageBreakdown,
      heatmap: buildModerationHeatmap(moderationStats.totalCases),
      recentUsers: recentBotUsers,
      recentConfessions
    },
    tables: {
      logs: buildDemoLogs(topServers)
    },
    forms: {
      serverSettings,
      categoriesByGuild: formsByGuild.categoriesByGuild,
      moderationByGuild: formsByGuild.moderationByGuild,
      aiByGuild: formsByGuild.aiByGuild,
      brandingByGuild: formsByGuild.brandingByGuild,
      languageByGuild: formsByGuild.languageByGuild,
      welcomeByGuild: formsByGuild.welcomeByGuild,
      levelsByGuild: formsByGuild.levelsByGuild,
      economyByGuild: formsByGuild.economyByGuild,
      panelEditorByGuild: formsByGuild.panelEditorByGuild,
      announcementsByGuild: formsByGuild.announcementsByGuild,
      categories: selectedGuildId
        ? formsByGuild.categoriesByGuild[selectedGuildId] || defaultCategories
        : defaultCategories,
      moderation: selectedGuildId
        ? formsByGuild.moderationByGuild[selectedGuildId] || defaultModerationForm
        : defaultModerationForm,
      ai: selectedGuildId ? formsByGuild.aiByGuild[selectedGuildId] || defaultAiForm : defaultAiForm,
      branding: selectedGuildId
        ? formsByGuild.brandingByGuild[selectedGuildId] || defaultBrandingForm
        : defaultBrandingForm,
      language: selectedGuildId
        ? formsByGuild.languageByGuild[selectedGuildId] || defaultLanguageForm
        : defaultLanguageForm,
      welcome: selectedGuildId
        ? formsByGuild.welcomeByGuild[selectedGuildId] || defaultWelcomeForm
        : defaultWelcomeForm,
      levels: selectedGuildId
        ? formsByGuild.levelsByGuild[selectedGuildId] || defaultLevelsForm
        : defaultLevelsForm,
      economy: selectedGuildId
        ? formsByGuild.economyByGuild[selectedGuildId] || defaultEconomyForm
        : defaultEconomyForm,
      panelEditor: selectedGuildId
        ? formsByGuild.panelEditorByGuild[selectedGuildId] || defaultPanelEditorForm
        : defaultPanelEditorForm,
      announcements: selectedGuildId
        ? formsByGuild.announcementsByGuild[selectedGuildId] || defaultAnnouncementsForm
        : defaultAnnouncementsForm
    },
    help: buildHelpContent()
  };
}

module.exports = {
  buildDashboardBootstrap
};
