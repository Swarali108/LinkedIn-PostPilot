import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import bcrypt from "bcryptjs";
import { getPool } from "./db";
import { linkEmail, sendEmail } from "./email";

/**
 * Server auth (Better Auth on Neon). Users, sessions and one-time tokens live in
 * the `user` / `session` / `account` / `verification` tables (db/schema.sql).
 *
 * Login is by username; email is used only for confirmation and password reset.
 */

export const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;

export const auth = betterAuth({
  database: getPool(),
  baseURL: process.env.NEXT_PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    requireEmailVerification: true,
    // Reset links are single-use; changing the password signs out every session.
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: hashPassword,
      // Accounts migrated from Supabase still carry bcrypt hashes ($2a$/$2b$).
      // They keep working; new and reset passwords use Better Auth's scrypt.
      verify: ({ hash, password }) =>
        hash.startsWith("$2") ? bcrypt.compare(password, hash) : verifyPassword({ hash, password }),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Reset your PostPilot password",
        linkEmail("Someone asked to reset the password for your PostPilot account.", "Choose a new password", url)
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Confirm your PostPilot account",
        linkEmail("Welcome to PostPilot! Confirm your email to finish signing up.", "Confirm email", url)
      );
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (u) => USERNAME_RE.test(u.toLowerCase()),
      displayUsername: false,
    }),
    nextCookies(),
  ],
});
