const crypto = require("node:crypto");

const DEFAULT_SESSION_COOKIE_NAME = "zllawi_portal_session";

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

function toBase64Url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ""), "utf8");
  return buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromBase64Url(input) {
  const value = String(input || "").replaceAll("-", "+").replaceAll("_", "/");
  const padLength = value.length % 4 === 0 ? 0 : 4 - (value.length % 4);
  return Buffer.from(value + "=".repeat(padLength), "base64");
}

function signValue(value, secret) {
  return toBase64Url(crypto.createHmac("sha256", secret).update(String(value)).digest());
}

function signPayload(payload, secret) {
  const data = toBase64Url(JSON.stringify(payload || {}));
  const signature = signValue(data, secret);
  return `${data}.${signature}`;
}

function verifyPayload(token, secret) {
  const [data, signature] = String(token || "").split(".");
  if (!data || !signature) return null;

  const expected = signValue(data, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(data).toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const output = {};
  const source = String(cookieHeader || "");
  if (!source) return output;

  for (const part of source.split(";")) {
    const item = part.trim();
    if (!item) continue;
    const separatorIndex = item.indexOf("=");
    if (separatorIndex < 1) continue;
    const key = item.slice(0, separatorIndex).trim();
    const value = item.slice(separatorIndex + 1).trim();
    if (!key) continue;
    try {
      output[key] = decodeURIComponent(value);
    } catch {
      output[key] = value;
    }
  }

  return output;
}

function sanitizeReturnTo(value) {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/")) return "/app";
  if (normalized.startsWith("//")) return "/app";
  return normalized;
}

function createUserPortalAuth(options = {}) {
  const cookieName = String(options.cookieName || DEFAULT_SESSION_COOKIE_NAME).trim();
  const secret = String(
    options.secret || process.env.WEB_SESSION_SECRET || process.env.DISCORD_TOKEN || "change-me"
  );
  const clientId = String(
    options.clientId || process.env.DISCORD_OAUTH_CLIENT_ID || process.env.CLIENT_ID || ""
  ).trim();
  const clientSecret = String(
    options.clientSecret || process.env.DISCORD_OAUTH_CLIENT_SECRET || ""
  ).trim();
  const baseUrl = String(
    options.baseUrl || process.env.PUBLIC_BASE_URL || `http://localhost:${options.port || 3000}`
  ).replace(/\/+$/g, "");
  const redirectUri = String(
    options.redirectUri || process.env.DISCORD_OAUTH_REDIRECT_URI || `${baseUrl}/auth/discord/callback`
  ).trim();
  const scopes = String(options.scopes || process.env.DISCORD_OAUTH_SCOPES || "identify guilds")
    .trim()
    .replace(/\s+/g, " ");
  const sessionTtlMs = parsePositiveInt(options.sessionTtlMs || process.env.WEB_SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000);
  const stateTtlMs = parsePositiveInt(options.stateTtlMs || process.env.WEB_OAUTH_STATE_TTL_MS, 10 * 60 * 1000);
  const secureCookies = String(options.secureCookies || process.env.WEB_SECURE_COOKIES || "")
    .toLowerCase()
    .trim();

  const sessions = new Map();

  function isConfigured() {
    return Boolean(clientId && clientSecret && redirectUri);
  }

  function resolveSecureCookie(req) {
    if (["1", "true", "yes", "on"].includes(secureCookies)) return true;
    if (req?.secure) return true;
    const proto = String(req?.headers?.["x-forwarded-proto"] || "");
    return proto.toLowerCase().includes("https");
  }

  function pruneExpiredSessions() {
    const now = Date.now();
    for (const [sid, session] of sessions.entries()) {
      if (!session?.expiresAt || session.expiresAt <= now) {
        sessions.delete(sid);
      }
    }
  }

  function setCookie(res, value, req, maxAgeMs = sessionTtlMs) {
    const secure = resolveSecureCookie(req);
    const parts = [
      `${cookieName}=${encodeURIComponent(value)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`
    ];
    if (secure) {
      parts.push("Secure");
    }
    res.setHeader("Set-Cookie", parts.join("; "));
  }

  function clearCookie(res, req) {
    const secure = resolveSecureCookie(req);
    const parts = [
      `${cookieName}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0"
    ];
    if (secure) {
      parts.push("Secure");
    }
    res.setHeader("Set-Cookie", parts.join("; "));
  }

  function createLoginUrl(returnTo = "/app") {
    const state = signPayload(
      {
        type: "oauth-state",
        ts: Date.now(),
        nonce: crypto.randomUUID(),
        returnTo: sanitizeReturnTo(returnTo)
      },
      secret
    );

    const query = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: scopes,
      state
    });

    return `https://discord.com/oauth2/authorize?${query.toString()}`;
  }

  function parseCookiesFromReq(req) {
    return parseCookies(req?.headers?.cookie || "");
  }

  function getCurrentSession(req) {
    pruneExpiredSessions();
    const cookies = parseCookiesFromReq(req);
    const token = cookies[cookieName];
    if (!token) return null;

    const payload = verifyPayload(token, secret);
    if (!payload || payload.type !== "session" || !payload.sid) {
      return null;
    }

    const session = sessions.get(payload.sid);
    if (!session || session.expiresAt <= Date.now()) {
      sessions.delete(payload.sid);
      return null;
    }

    return {
      sid: payload.sid,
      user: session.user,
      guildIds: session.guildIds,
      guilds: session.guilds,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    };
  }

  function destroyCurrentSession(req) {
    const current = getCurrentSession(req);
    if (!current?.sid) return;
    sessions.delete(current.sid);
  }

  async function fetchDiscordIdentity(code) {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: String(code || ""),
        redirect_uri: redirectUri
      })
    });

    const tokenJson = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenJson?.access_token) {
      throw new Error("Failed to exchange Discord OAuth code.");
    }

    const accessToken = tokenJson.access_token;

    const [userResponse, guildsResponse] = await Promise.all([
      fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      }),
      fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    ]);

    const userJson = await userResponse.json().catch(() => null);
    if (!userResponse.ok || !userJson?.id) {
      throw new Error("Failed to fetch Discord user profile.");
    }

    const guildsJson = await guildsResponse.json().catch(() => []);
    const guilds = Array.isArray(guildsJson)
      ? guildsJson
          .map((item) => ({
            id: String(item?.id || ""),
            name: String(item?.name || ""),
            owner: Boolean(item?.owner),
            permissions: String(item?.permissions || "0")
          }))
          .filter((item) => item.id)
      : [];
    const guildIds = guilds.map((item) => item.id);

    return {
      user: {
        id: String(userJson.id),
        username: String(userJson.global_name || userJson.username || "Discord User"),
        tag:
          userJson.discriminator && userJson.discriminator !== "0"
            ? `${userJson.username}#${userJson.discriminator}`
            : String(userJson.username || "Discord User"),
        avatarUrl:
          userJson.avatar && userJson.id
            ? `https://cdn.discordapp.com/avatars/${userJson.id}/${userJson.avatar}.png?size=128`
            : null
      },
      guildIds,
      guilds
    };
  }

  function createSessionAndSetCookie({ user, guildIds, guilds }, req, res) {
    const sid = crypto.randomUUID();
    const now = Date.now();

    sessions.set(sid, {
      user: {
        id: String(user?.id || ""),
        username: String(user?.username || "Discord User"),
        tag: String(user?.tag || ""),
        avatarUrl: user?.avatarUrl ? String(user.avatarUrl) : null
      },
      guildIds: Array.isArray(guildIds) ? guildIds.map((id) => String(id)) : [],
      guilds: Array.isArray(guilds)
        ? guilds.map((item) => ({
            id: String(item?.id || ""),
            name: String(item?.name || ""),
            owner: Boolean(item?.owner),
            permissions: String(item?.permissions || "0")
          }))
        : [],
      createdAt: now,
      expiresAt: now + sessionTtlMs
    });

    const signed = signPayload(
      {
        type: "session",
        sid,
        ts: now
      },
      secret
    );

    setCookie(res, signed, req, sessionTtlMs);
  }

  function validateState(value) {
    const payload = verifyPayload(value, secret);
    if (!payload || payload.type !== "oauth-state" || !payload.ts) return null;
    if (Date.now() - Number(payload.ts) > stateTtlMs) return null;
    return sanitizeReturnTo(payload.returnTo);
  }

  return {
    cookieName,
    redirectUri,
    baseUrl,
    isConfigured,
    createLoginUrl,
    validateState,
    getCurrentSession,
    destroyCurrentSession,
    clearCookie,
    fetchDiscordIdentity,
    createSessionAndSetCookie
  };
}

module.exports = {
  createUserPortalAuth
};
