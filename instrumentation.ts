/** Runs once when the server starts — report config problems up front. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnv } = await import("./lib/env-check");
    checkEnv();
  }
}
