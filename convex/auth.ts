import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function uint8ToHex(uint8: Uint8Array): string {
  return Array.from(uint8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = uint8ToHex(salt);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashHex = uint8ToHex(new Uint8Array(derivedBits));
  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = new Uint8Array(
    parts[2].match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const expectedHash = parts[3];
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const actualHash = uint8ToHex(new Uint8Array(derivedBits));
  return actualHash === expectedHash;
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return uint8ToHex(bytes);
}

export const register = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      throw new Error("Email already registered");
    }

    const hashedPassword = await hashPassword(args.password);

    const userId = await ctx.db.insert("users", {
      email: args.email,
      hashedPassword,
      name: args.name,
      tier: "free",
      analysesCount: 0,
      compilationsCount: 0,
    });

    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresAt = Date.now() + 3600 * 1000;

    await ctx.db.insert("sessions", {
      userId,
      token: accessToken,
      refreshToken,
      expiresAt,
    });

    const user = await ctx.db.get(userId);

    return {
      user: {
        id: userId,
        email: user!.email,
        name: user!.name,
        tier: user!.tier,
      },
      tokens: {
        access: accessToken,
        refresh: refreshToken,
        expiresIn: 3600,
      },
    };
  },
});

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user || !user.hashedPassword) {
      throw new Error("Invalid email or password");
    }

    const valid = await verifyPassword(args.password, user.hashedPassword);
    if (!valid) {
      throw new Error("Invalid email or password");
    }

    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresAt = Date.now() + 3600 * 1000;

    await ctx.db.insert("sessions", {
      userId: user._id,
      token: accessToken,
      refreshToken,
      expiresAt,
    });

    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
      tokens: {
        access: accessToken,
        refresh: refreshToken,
        expiresIn: 3600,
      },
    };
  },
});

export const refreshToken = mutation({
  args: { refreshToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_refresh", (q) => q.eq("refreshToken", args.refreshToken))
      .first();

    if (!session) throw new Error("Session not found");

    const user = await ctx.db.get(session.userId);
    if (!user) throw new Error("User not found");

    const newAccess = generateToken();
    const newRefresh = generateToken();
    const expiresAt = Date.now() + 3600 * 1000;

    await ctx.db.patch(session._id, {
      token: newAccess,
      refreshToken: newRefresh,
      expiresAt,
    });

    return {
      access: newAccess,
      refresh: newRefresh,
      expiresIn: 3600,
    };
  },
});

export const getProfile = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db.get(session.userId);
    if (!user) throw new Error("User not found");

    const activeDrafts = await ctx.db
      .query("drafts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "optimizing")
      )
      .collect();

    const limits = {
      free: { analyses: 5, compilations: 2, drafts: 2 },
      pro: { analyses: 50, compilations: 20, drafts: 10 },
      premium: { analyses: 999, compilations: 999, drafts: 50 },
      team: { analyses: 999, compilations: 999, drafts: 50 },
    };
    const l = limits[user.tier as keyof typeof limits] || limits.free;

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      onboardingCompleted: user.onboardingCompleted ?? false,
      usage: {
        analysesThisMonth: user.analysesCount,
        analysesLimit: l.analyses,
        compilationsThisMonth: user.compilationsCount,
        compilationsLimit: l.compilations,
        draftsActive: activeDrafts.length,
        draftsLimit: l.drafts,
      },
    };
  },
});

export const completeOnboarding = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(session.userId, { onboardingCompleted: true });
    return { ok: true };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return { ok: true };
  },
});

export const clerkSync = mutation({
  args: {
    syncSecret: v.string(),
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.CLERK_SYNC_SECRET;
    if (!expected || args.syncSecret !== expected) {
      throw new Error("Unauthorized");
    }

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .first();

      if (byEmail) {
        await ctx.db.patch(byEmail._id, {
          clerkId: args.clerkId,
          name: byEmail.name || args.name,
        });
        user = (await ctx.db.get(byEmail._id))!;
      } else {
        const userId = await ctx.db.insert("users", {
          email: args.email,
          clerkId: args.clerkId,
          name: args.name || args.email.split("@")[0],
          tier: "free",
          analysesCount: 0,
          compilationsCount: 0,
        });
        user = (await ctx.db.get(userId))!;
      }
    }

    const accessToken = generateToken();
    const refreshToken = generateToken();
    const expiresAt = Date.now() + 3600 * 1000;

    await ctx.db.insert("sessions", {
      userId: user._id,
      token: accessToken,
      refreshToken,
      expiresAt,
    });

    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        onboardingCompleted: user.onboardingCompleted ?? false,
      },
      tokens: {
        access: accessToken,
        refresh: refreshToken,
        expiresIn: 3600,
      },
    };
  },
});

export const getOrCreateAnonUser = mutation({
  args: {},
  handler: async (ctx) => {
    const anonUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "anon@resumeforge.local"))
      .first();
    if (anonUser) return anonUser._id;
    return await ctx.db.insert("users", {
      email: "anon@resumeforge.local",
      name: "Anonymous",
      tier: "free",
      analysesCount: 0,
      compilationsCount: 0,
    });
  },
});
