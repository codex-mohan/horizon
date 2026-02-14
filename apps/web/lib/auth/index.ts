import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { db, type Session, type User } from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "horizon-local-secret-key-change-in-production"
);

const SESSION_COOKIE_NAME = "horizon-session";
const SESSION_DURATION_SHORT = 24 * 60 * 60 * 1000; // 1 day
const SESSION_DURATION_LONG = 30 * 24 * 60 * 60 * 1000; // 30 days (remember me)

// Generate unique IDs
function generateId(): string {
  return crypto.randomUUID();
}

// Hash password
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create JWT token
async function createToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ userId, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

// Verify JWT token
async function verifyToken(
  token: string
): Promise<{ userId: string; sessionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      sessionId: payload.sessionId as string,
    };
  } catch {
    return null;
  }
}

// Public user type (without sensitive fields)
export interface PublicUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: Date;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

// Register a new user
export async function registerUser(
  username: string,
  password: string,
  displayName?: string
): Promise<{ success: boolean; user?: PublicUser; error?: string }> {
  try {
    // Check if username already exists
    const existing = db.users.findByUsername(username.toLowerCase());

    if (existing) {
      return { success: false, error: "Username already taken" };
    }

    // Validate password strength
    if (password.length < 6) {
      return {
        success: false,
        error: "Password must be at least 6 characters",
      };
    }

    const now = new Date();
    const passwordHash = await hashPassword(password);

    const newUser: User = {
      id: generateId(),
      username: username.toLowerCase(),
      passwordHash,
      displayName: displayName || username,
      createdAt: now,
      updatedAt: now,
    };

    db.users.create(newUser);

    return { success: true, user: toPublicUser(newUser) };
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: "Failed to create account" };
  }
}

// Login user
export async function loginUser(
  username: string,
  password: string,
  rememberMe = false
): Promise<{
  success: boolean;
  user?: PublicUser;
  token?: string;
  error?: string;
}> {
  try {
    const user = db.users.findByUsername(username.toLowerCase());

    if (!user) {
      return { success: false, error: "Invalid username or password" };
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: "Invalid username or password" };
    }

    // Create session
    const sessionId = generateId();
    const expiresAt = new Date(
      Date.now() + (rememberMe ? SESSION_DURATION_LONG : SESSION_DURATION_SHORT)
    );
    const token = await createToken(user.id, sessionId);

    const newSession: Session = {
      id: sessionId,
      userId: user.id,
      token,
      expiresAt,
      rememberMe,
      createdAt: new Date(),
    };

    db.sessions.create(newSession);

    return { success: true, user: toPublicUser(user), token };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Failed to login" };
  }
}

// Logout user
export async function logoutUser(token: string): Promise<boolean> {
  try {
    return db.sessions.delete(token);
  } catch {
    return false;
  }
}

// Get current user from session
export async function getCurrentUser(): Promise<PublicUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
      return null;
    }

    const tokenData = await verifyToken(sessionCookie.value);
    if (!tokenData) {
      return null;
    }

    // Find session by iterating through user's sessions
    const user = db.users.findById(tokenData.userId);
    if (!user) {
      return null;
    }

    const userSessions = db.sessions.findByUserId(user.id);
    const session = userSessions.find((s) => s.id === tokenData.sessionId);

    if (!session || new Date(session.expiresAt) < new Date()) {
      // Clean up expired session
      if (session) {
        db.sessions.delete(session.token);
      }
      return null;
    }

    return toPublicUser(user);
  } catch {
    return null;
  }
}

// Validate session token
export async function validateSession(
  token: string
): Promise<{ valid: boolean; user?: PublicUser }> {
  try {
    const tokenData = await verifyToken(token);
    if (!tokenData) {
      return { valid: false };
    }

    const user = db.users.findById(tokenData.userId);
    if (!user) {
      return { valid: false };
    }

    const userSessions = db.sessions.findByUserId(user.id);
    const session = userSessions.find((s) => s.id === tokenData.sessionId);

    if (!session || new Date(session.expiresAt) < new Date()) {
      return { valid: false };
    }

    return { valid: true, user: toPublicUser(user) };
  } catch {
    return { valid: false };
  }
}

// Check if username is available
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const existing = db.users.findByUsername(username.toLowerCase());
  return !existing;
}

export { SESSION_COOKIE_NAME };
