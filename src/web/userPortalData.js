const crypto = require("node:crypto");
const { EmbedBuilder } = require("discord.js");
const { findBlockedWord } = require("../utils/badWordsFilter");
const { t } = require("../utils/localization");

const DEFAULT_MAX_MESSAGE_LENGTH = 500;
const DEFAULT_CATEGORY = "general";

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

function normalizeGuildId(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeCategory(value) {
  const allowed = new Set(["general", "conflict", "suggestions", "feedback", "sensitive"]);
  const normalized = String(value || DEFAULT_CATEGORY).toLowerCase().trim();
  return allowed.has(normalized) ? normalized : DEFAULT_CATEGORY;
}

function sanitizeContent(value, maxLen) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, maxLen);
}

function categoryLabel(category) {
  const table = {
    general: "عام",
    conflict: "خلافات",
    suggestions: "اقتراحات",
    feedback: "Feedback",
    sensitive: "حساس"
  };
  return table[category] || "عام";
}

function buildRulesList() {
  return [
    "ممنوع الإهانة والتهديد وخطاب الكراهية.",
    "ممنوع نشر بيانات شخصية أو معلومات حساسة.",
    "الرسائل المخالفة قد تُرفض تلقائيًا أو تُراجع من الإدارة.",
    "باستخدامك هذه الواجهة أنت توافق على قوانين السيرفر."
  ];
}

function buildStatusLabel(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "APPROVED") return "تم النشر";
  if (normalized === "REJECTED") return "مرفوض";
  if (normalized === "PENDING") return "قيد المراجعة";
  return "غير معروف";
}

function safeSession(session) {
  if (!session?.user?.id) return null;
  return {
    user: {
      id: String(session.user.id),
      username: String(session.user.username || "Discord User"),
      tag: String(session.user.tag || session.user.username || "Discord User"),
      avatarUrl: session.user.avatarUrl ? String(session.user.avatarUrl) : null
    },
    guildIds: Array.isArray(session.guildIds) ? session.guildIds.map((id) => String(id)) : []
  };
}

function isGuildBotEnabled(store, guildId) {
  if (!guildId || typeof store?.isBotEnabled !== "function") return true;
  return store.isBotEnabled(guildId) !== false;
}

function isGuildAnonymousPostingEnabled(store, guildId) {
  if (!guildId || typeof store?.isAnonymousPostingEnabled !== "function") return true;
  return store.isAnonymousPostingEnabled(guildId) !== false;
}

function isGuildRepliesEnabled(store, guildId) {
  if (!guildId || typeof store?.isRepliesEnabled !== "function") return true;
  return store.isRepliesEnabled(guildId) !== false;
}

function createUserPortalService({ client, confessionStore, moderationStore }) {
  const maxMessageLength = parsePositiveInt(
    process.env.USER_PORTAL_MAX_MESSAGE_LENGTH,
    DEFAULT_MAX_MESSAGE_LENGTH
  );
  const collectionName = String(
    process.env.MONGODB_USER_PORTAL_SUBMISSIONS_COLLECTION || "user_portal_submissions"
  ).trim();

  let ensuredIndexes = false;

  async function getCollection() {
    if (!moderationStore?.ready || !moderationStore.db) return null;
    const collection = moderationStore.db.collection(collectionName);

    if (!ensuredIndexes) {
      await Promise.all([
        collection.createIndex({ submissionId: 1 }, { unique: true }),
        collection.createIndex({ guildId: 1, userId: 1, createdAt: -1 }),
        collection.createIndex({ guildId: 1, status: 1, createdAt: -1 })
      ]);
      ensuredIndexes = true;
    }

    return collection;
  }

  function listGuildsForSession(session) {
    const normalizedSession = safeSession(session);
    if (!normalizedSession) return [];

    const ownedGuildIds = new Set(normalizedSession.guildIds);
    const guilds = Array.from(client?.guilds?.cache?.values() || []);
    const filtered = guilds.filter((guild) =>
      ownedGuildIds.size ? ownedGuildIds.has(String(guild.id)) : false
    );

    return filtered
      .map((guild) => {
        const confessionChannelId = confessionStore?.getChannel?.(guild.id) || null;
        const botEnabled = isGuildBotEnabled(confessionStore, guild.id);
        const anonymousPostingEnabled = isGuildAnonymousPostingEnabled(confessionStore, guild.id);
        const repliesEnabled = isGuildRepliesEnabled(confessionStore, guild.id);
        return {
          id: String(guild.id),
          name: guild.name,
          iconUrl: guild.iconURL({ size: 128, extension: "png" }) || null,
          confessionChannelId,
          botEnabled,
          anonymousPostingEnabled,
          repliesEnabled,
          confessionEnabled: Boolean(confessionChannelId && botEnabled && anonymousPostingEnabled),
          language: confessionStore?.getLanguage?.(guild.id) || "en",
          themeColor: confessionStore?.getThemeColor?.(guild.id) || 0x8b5cf6
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
  }

  async function buildBootstrap({ session, oauthConfigured }) {
    const normalizedSession = safeSession(session);
    const guilds = normalizedSession ? listGuildsForSession(normalizedSession) : [];
    const selectedGuild = guilds.find((item) => item.confessionEnabled) || guilds[0] || null;

    return {
      generatedAt: new Date().toISOString(),
      auth: {
        oauthConfigured: Boolean(oauthConfigured),
        loggedIn: Boolean(normalizedSession),
        user: normalizedSession?.user || null
      },
      guilds,
      selectedGuildId: selectedGuild?.id || null,
      limits: {
        maxMessageLength,
        cooldownSeconds: Math.round((confessionStore?.cooldownMs || 30000) / 1000)
      },
      categories: [
        { id: "general", label: "عام" },
        { id: "conflict", label: "خلافات" },
        { id: "suggestions", label: "اقتراحات" },
        { id: "feedback", label: "Feedback" },
        { id: "sensitive", label: "حساس" }
      ],
      rules: buildRulesList(),
      storageReady: Boolean(moderationStore?.ready && moderationStore?.db)
    };
  }

  function resolveGuildForUser(session, guildId) {
    const normalizedSession = safeSession(session);
    if (!normalizedSession) return null;

    const normalizedGuildId = normalizeGuildId(guildId);
    if (!normalizedGuildId) return null;

    if (!normalizedSession.guildIds.includes(normalizedGuildId)) {
      return null;
    }

    const guild = client?.guilds?.cache?.get(normalizedGuildId) || null;
    if (!guild) return null;

    return guild;
  }

  async function saveSubmissionRecord(record) {
    const collection = await getCollection();
    if (!collection) return null;
    await collection.insertOne(record);
    return record;
  }

  async function listUserSubmissions({ session, guildId, limit = 30 }) {
    const normalizedSession = safeSession(session);
    if (!normalizedSession) return [];

    const normalizedGuildId = normalizeGuildId(guildId);
    if (!normalizedGuildId) return [];
    if (!normalizedSession.guildIds.includes(normalizedGuildId)) return [];

    const collection = await getCollection();
    if (!collection) return [];

    const docs = await collection
      .find({
        guildId: normalizedGuildId,
        userId: normalizedSession.user.id
      })
      .sort({ createdAt: -1 })
      .limit(parsePositiveInt(limit, 30))
      .toArray();

    return docs.map((doc) => ({
      submissionId: doc.submissionId,
      guildId: doc.guildId,
      category: doc.category,
      categoryLabel: categoryLabel(doc.category),
      status: doc.status,
      statusLabel: buildStatusLabel(doc.status),
      preview: String(doc.content || "").slice(0, 140),
      reason: doc.reason || null,
      createdAt: doc.createdAt
    }));
  }

  async function listRecentBotUsers({ guildIds, limit = 12 }) {
    const normalizedGuildIds = Array.isArray(guildIds)
      ? guildIds.map((id) => normalizeGuildId(id)).filter(Boolean)
      : [];
    if (!normalizedGuildIds.length) return [];

    const collection = await getCollection();
    if (!collection) return [];

    const uniqueGuildIds = Array.from(new Set(normalizedGuildIds));
    const safeLimit = Math.min(parsePositiveInt(limit, 12), 50);
    const scanLimit = Math.max(safeLimit * 8, 80);

    const docs = await collection
      .find({
        guildId: { $in: uniqueGuildIds }
      })
      .sort({ createdAt: -1 })
      .limit(scanLimit)
      .project({
        submissionId: 1,
        guildId: 1,
        userId: 1,
        userTag: 1,
        category: 1,
        status: 1,
        createdAt: 1
      })
      .toArray();

    const seenUsers = new Set();
    const recentUsers = [];
    for (const doc of docs) {
      const userId = String(doc?.userId || "").trim();
      if (!userId || seenUsers.has(userId)) continue;
      seenUsers.add(userId);

      const guildId = String(doc?.guildId || "").trim();
      const guildName = client?.guilds?.cache?.get(guildId)?.name || "Unknown Server";
      recentUsers.push({
        submissionId: String(doc?.submissionId || ""),
        guildId,
        guildName,
        userId,
        userTag: String(doc?.userTag || userId),
        category: String(doc?.category || DEFAULT_CATEGORY),
        status: String(doc?.status || "UNKNOWN"),
        createdAt: doc?.createdAt || new Date()
      });

      if (recentUsers.length >= safeLimit) break;
    }

    return recentUsers;
  }

  async function submitConfession({ session, guildId, category, content }) {
    const normalizedSession = safeSession(session);
    if (!normalizedSession) {
      return { ok: false, status: 401, error: "يجب تسجيل الدخول عبر Discord أولاً." };
    }

    const guild = resolveGuildForUser(normalizedSession, guildId);
    if (!guild) {
      return { ok: false, status: 403, error: "لا تملك صلاحية الوصول لهذا السيرفر." };
    }

    if (!isGuildBotEnabled(confessionStore, guild.id)) {
      return { ok: false, status: 403, error: t(confessionStore, guild.id, "botDisabled") };
    }
    if (!isGuildAnonymousPostingEnabled(confessionStore, guild.id)) {
      return {
        ok: false,
        status: 403,
        error: t(confessionStore, guild.id, "anonymousPostingDisabled")
      };
    }

    const targetChannelId = confessionStore?.getChannel?.(guild.id);
    if (!targetChannelId) {
      return { ok: false, status: 400, error: "قناة الاعترافات غير مفعلة في هذا السيرفر." };
    }

    const text = sanitizeContent(content, maxMessageLength);
    if (!text) {
      return { ok: false, status: 400, error: "الرسالة فارغة." };
    }

    const remainingMs = confessionStore?.getCooldownRemainingMs?.(normalizedSession.user.id) || 0;
    if (remainingMs > 0) {
      return {
        ok: false,
        status: 429,
        error: `انتظر ${Math.ceil(remainingMs / 1000)} ثانية قبل إرسال رسالة جديدة.`
      };
    }

    const normalizedCategory = normalizeCategory(category);
    const blockedWord = findBlockedWord(text, {
      store: confessionStore,
      guildId: guild.id
    });

    const now = new Date();
    const submissionId = `SUB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    if (blockedWord) {
      const rejectedDoc = {
        submissionId,
        guildId: guild.id,
        userId: normalizedSession.user.id,
        userTag: normalizedSession.user.tag,
        category: normalizedCategory,
        status: "REJECTED",
        reason: "تم رفض الرسالة تلقائيًا بسبب مخالفة الفلتر.",
        blockedWord,
        content: text,
        targetChannelId,
        postedMessageId: null,
        createdAt: now,
        updatedAt: now
      };

      await saveSubmissionRecord(rejectedDoc);
      return {
        ok: false,
        status: 400,
        error: "رسالتك تحتوي على كلمات محظورة وتم رفضها.",
        submission: {
          submissionId,
          status: "REJECTED",
          statusLabel: buildStatusLabel("REJECTED")
        }
      };
    }

    const targetChannel =
      client.channels.cache.get(targetChannelId) ||
      (await client.channels.fetch(targetChannelId).catch(() => null));

    if (!targetChannel || !targetChannel.isTextBased?.() || targetChannel.isDMBased?.()) {
      return { ok: false, status: 500, error: "تعذر الوصول إلى قناة الاعترافات." };
    }

    const quotaReservation =
      typeof confessionStore.reserveDailyConfessionSlot === "function"
        ? confessionStore.reserveDailyConfessionSlot(guild.id)
        : {
            allowed: true,
            used: 0,
            quota: 0
          };
    const hasReservedQuota =
      Boolean(quotaReservation?.allowed) &&
      typeof confessionStore.releaseDailyConfessionSlot === "function";
    if (!quotaReservation?.allowed) {
      return {
        ok: false,
        status: 429,
        error: t(confessionStore, guild.id, "dailyQuotaReached", {
          used: Number(quotaReservation.used || 0),
          quota: Number(quotaReservation.quota || 0)
        })
      };
    }

    const senderAnonymousId = confessionStore.getOrCreateAnonymousId(guild.id, normalizedSession.user.id);
    const panelChannelId =
      typeof confessionStore.getPanelChannel === "function"
        ? String(confessionStore.getPanelChannel(guild.id) || "").trim()
        : "";
    const confessionPanelMention = panelChannelId ? `<#${panelChannelId}>` : `<#${targetChannel.id}>`;

    const embed = new EmbedBuilder()
      .setTitle(t(confessionStore, guild.id, "confessionPostedTitle"))
      .setDescription(text)
      .setColor(confessionStore.getThemeColor(guild.id))
      .addFields({
        name: "\u200b",
        value: t(confessionStore, guild.id, "confessionSourceLabel", {
          channel: confessionPanelMention
        }),
        inline: false
      })
      .setFooter({
        text: t(confessionStore, guild.id, "senderIdLabel", { senderId: senderAnonymousId })
      })
      .setTimestamp();

    let postedMessage = null;
    try {
      postedMessage = await targetChannel.send({ embeds: [embed] });
    } catch {
      try {
        postedMessage = await targetChannel.send({
          content: `${t(confessionStore, guild.id, "confessionPostedTitle")}\n${t(
            confessionStore,
            guild.id,
            "confessionSourceLabel",
            { channel: confessionPanelMention }
          )}\n${text}\n${t(
            confessionStore,
            guild.id,
            "senderIdLabel",
            { senderId: senderAnonymousId }
          )}`
        });
      } catch {
        if (hasReservedQuota) {
          confessionStore.releaseDailyConfessionSlot(guild.id);
        }
        const pendingDoc = {
          submissionId,
          guildId: guild.id,
          userId: normalizedSession.user.id,
          userTag: normalizedSession.user.tag,
          category: normalizedCategory,
          status: "PENDING",
          reason: "تعذر النشر المباشر. يلزم مراجعة الإعدادات.",
          blockedWord: null,
          content: text,
          targetChannelId,
          postedMessageId: null,
          createdAt: now,
          updatedAt: now
        };
        await saveSubmissionRecord(pendingDoc);
        return {
          ok: false,
          status: 500,
          error: "تعذر نشر الرسالة الآن. تم حفظها كمعلقة للمراجعة."
        };
      }
    }

    confessionStore.setCooldown(normalizedSession.user.id, {
      guildId: guild.id,
      userTag: normalizedSession.user.tag || normalizedSession.user.username || normalizedSession.user.id,
      source: "confession-user-portal",
      message: text
    });

    const approvedDoc = {
      submissionId,
      guildId: guild.id,
      userId: normalizedSession.user.id,
      userTag: normalizedSession.user.tag,
      category: normalizedCategory,
      status: "APPROVED",
      reason: null,
      blockedWord: null,
      content: text,
      targetChannelId,
      postedMessageId: postedMessage?.id || null,
      anonymousId: senderAnonymousId,
      createdAt: now,
      updatedAt: now
    };

    await saveSubmissionRecord(approvedDoc);

    return {
      ok: true,
      status: 200,
      message: "تم إرسال اعترافك بنجاح.",
      submission: {
        submissionId,
        status: "APPROVED",
        statusLabel: buildStatusLabel("APPROVED"),
        anonymousId: senderAnonymousId
      }
    };
  }

  return {
    buildBootstrap,
    listUserSubmissions,
    listRecentBotUsers,
    submitConfession
  };
}

module.exports = {
  createUserPortalService
};
