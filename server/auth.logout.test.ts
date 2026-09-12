import { compare, hash } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import { ensureBootstrapAdminUser } from "./mongoApi.js";
import { User } from "./mongodb.js";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("repairs a legacy admin account so bootstrap/login work again", async () => {
    const legacyUser = await User.collection.insertOne({
      name: "ARC Admin",
      email: "legacy-admin@example.com",
      passwordHash: await hash("old-password", 12),
      role: "admin",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await ensureBootstrapAdminUser();

    const user = await User.findById(legacyUser.insertedId).lean();
    expect(user).toMatchObject({
      username: "admin",
      role: "ADMIN",
      active: true,
      name: "ARC Admin",
    });
    expect(await compare("Admin123!", String(user?.passwordHash))).toBe(true);
  });
});
