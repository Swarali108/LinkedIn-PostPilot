import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

/** Better Auth endpoints: sign-up/in/out, email confirm, password reset links. */
export const { GET, POST } = toNextJsHandler(auth);
