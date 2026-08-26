export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startFollowUpWorker } = await import("./lib/followup");
    startFollowUpWorker();
  }
}
