export async function notifyJobEvent(
  jobId: string,
  event: "JOB_STARTED" | "JOB_COMPLETED" | "JOB_FAILED"
) {
  const baseUrl = process.env.APP_BASE_URL;
  const secret = process.env.INTERNAL_NOTIFY_SECRET;

  if (!baseUrl || !secret) {
    console.warn("Skipping notification: APP_BASE_URL or INTERNAL_NOTIFY_SECRET not set");
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/api/internal/job-status-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ jobId, event }),
    });

    if (!res.ok) {
      console.warn(`Notification failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.warn("Notification error:", err);
  }
}
