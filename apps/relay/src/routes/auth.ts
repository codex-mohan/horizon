import { Hono } from "hono";
import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { generateTokens, jose } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("Auth");

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production"
);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const auth = new Hono();

auth.post("/register", async (c) => {
  try {
    const body = await c.req.json<{ email: string; password: string; name?: string }>();
    const { email, password, name } = body;

    if (!email || typeof email !== "string") {
      return c.json({ error: "Email is required" }, 400);
    }

    if (!password || typeof password !== "string") {
      return c.json({ error: "Password is required" }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({ error: "Invalid email format" }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return c.json({ error: "User already exists" }, 409);
    }

    const passwordHash = await hash(password, 10);

    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: name || null,
      })
      .returning();

    if (!user) {
      return c.json({ error: "Failed to create user" }, 500);
    }

    const tokens = await generateTokens(user.id);

    logger.info("User registered", { userId: user.id, email: user.email });

    return c.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
        },
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      201
    );
  } catch (err) {
    logger.error("Registration failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

auth.post("/login", async (c) => {
  try {
    const body = await c.req.json<{ email: string; password: string }>();
    const { email, password } = body;

    if (!email || typeof email !== "string") {
      return c.json({ error: "Email is required" }, 400);
    }

    if (!password || typeof password !== "string") {
      return c.json({ error: "Password is required" }, 400);
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !user.passwordHash) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const tokens = await generateTokens(user.id);

    logger.info("User logged in", { userId: user.id, email: user.email });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    logger.error("Login failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

auth.get("/oauth/google", (c) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    logger.error("GOOGLE_CLIENT_ID not configured");
    return c.json({ error: "OAuth not configured" }, 500);
  }

  const redirectUri = `${FRONTEND_URL}/v1/auth/oauth/google/callback`;
  const state = crypto.randomUUID();

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "online");

  logger.info("Redirecting to Google OAuth");

  return c.redirect(url.toString());
});

auth.get("/oauth/google/callback", async (c) => {
  try {
    const code = c.req.query("code");
    if (!code) {
      return c.json({ error: "Missing authorization code" }, 400);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      logger.error("Google OAuth credentials not configured");
      return c.json({ error: "OAuth not configured" }, 500);
    }

    const redirectUri = `${FRONTEND_URL}/v1/auth/oauth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const error = await tokenRes.text();
      logger.error("Google token exchange failed", { error });
      return c.json({ error: "OAuth token exchange failed" }, 400);
    }

    const tokenData = await tokenRes.json();
    const accessToken = (tokenData as Record<string, string>).access_token;

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      const error = await userRes.text();
      logger.error("Google userinfo fetch failed", { error });
      return c.json({ error: "Failed to fetch user info" }, 400);
    }

    const googleUser = await userRes.json();
    const email = (googleUser as Record<string, string>).email;
    const name = (googleUser as Record<string, string>).name;
    const avatarUrl = (googleUser as Record<string, string>).picture;

    if (!email) {
      return c.json({ error: "Email not provided by Google" }, 400);
    }

    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      const [created] = await db
        .insert(users)
        .values({
          email,
          name: name || null,
          avatarUrl: avatarUrl || null,
          passwordHash: null,
        })
        .returning();

      if (!created) {
        return c.json({ error: "Failed to create user" }, 500);
      }

      user = created;
      logger.info("User created via Google OAuth", { userId: user.id, email });
    } else {
      logger.info("User logged in via Google OAuth", { userId: user.id, email });
    }

    const tokens = await generateTokens(user.id);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    logger.error("Google OAuth callback failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

auth.get("/oauth/github", (c) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    logger.error("GITHUB_CLIENT_ID not configured");
    return c.json({ error: "OAuth not configured" }, 500);
  }

  const redirectUri = `${FRONTEND_URL}/v1/auth/oauth/github/callback`;
  const state = crypto.randomUUID();

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);

  logger.info("Redirecting to GitHub OAuth");

  return c.redirect(url.toString());
});

auth.get("/oauth/github/callback", async (c) => {
  try {
    const code = c.req.query("code");
    if (!code) {
      return c.json({ error: "Missing authorization code" }, 400);
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      logger.error("GitHub OAuth credentials not configured");
      return c.json({ error: "OAuth not configured" }, 500);
    }

    const redirectUri = `${FRONTEND_URL}/v1/auth/oauth/github/callback`;

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const error = await tokenRes.text();
      logger.error("GitHub token exchange failed", { error });
      return c.json({ error: "OAuth token exchange failed" }, 400);
    }

    const tokenData = await tokenRes.json();
    const accessToken = (tokenData as Record<string, string>).access_token;

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!userRes.ok) {
      const error = await userRes.text();
      logger.error("GitHub user fetch failed", { error });
      return c.json({ error: "Failed to fetch user info" }, 400);
    }

    const githubUser = await userRes.json();

    let email = (githubUser as Record<string, string | null>).email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (emailsRes.ok) {
        const emails = await emailsRes.json();
        interface GitHubEmail {
          email: string;
          primary: boolean;
          verified: boolean;
        }
        const emailList = emails as GitHubEmail[];
        const primary = emailList.find((e) => e.primary && e.verified);
        const verified = emailList.find((e) => e.verified);
        email = primary?.email || verified?.email || emailList[0]?.email || null;
      }
    }

    if (!email) {
      return c.json({ error: "Email not provided by GitHub" }, 400);
    }

    const name = (githubUser as Record<string, string | null>).name || (githubUser as Record<string, string>).login;
    const avatarUrl = (githubUser as Record<string, string | null>).avatar_url;

    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      const [created] = await db
        .insert(users)
        .values({
          email,
          name: name || null,
          avatarUrl: avatarUrl || null,
          passwordHash: null,
        })
        .returning();

      if (!created) {
        return c.json({ error: "Failed to create user" }, 500);
      }

      user = created;
      logger.info("User created via GitHub OAuth", { userId: user.id, email });
    } else {
      logger.info("User logged in via GitHub OAuth", { userId: user.id, email });
    }

    const tokens = await generateTokens(user.id);

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    logger.error("GitHub OAuth callback failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

auth.post("/refresh", async (c) => {
  try {
    const body = await c.req.json<{ refreshToken: string }>();
    const { refreshToken } = body;

    if (!refreshToken || typeof refreshToken !== "string") {
      return c.json({ error: "Refresh token is required" }, 400);
    }

    const { payload } = await jose.jwtVerify(refreshToken, JWT_SECRET, {
      clockTolerance: 60,
    });

    if (payload.type !== "refresh") {
      return c.json({ error: "Invalid token type" }, 401);
    }

    const userId = payload.sub;
    if (!userId) {
      return c.json({ error: "Invalid token" }, 401);
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return c.json({ error: "User not found" }, 401);
    }

    const tokens = await generateTokens(user.id);

    logger.info("Tokens refreshed", { userId: user.id });

    return c.json({ token: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    logger.error("Token refresh failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }
});

export default auth;
