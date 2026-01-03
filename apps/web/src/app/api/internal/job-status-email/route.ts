import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resend, FROM, BASE_URL } from "@/lib/resend";
import { escapeHtml } from "@/lib/utils";

function assertSecret(req: Request) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_NOTIFY_SECRET) {
    throw new Error("Unauthorized");
  }
}

export async function POST(req: Request) {
  try {
    assertSecret(req);

    const { jobId, event } = (await req.json()) as {
      jobId: string;
      event: "JOB_STARTED" | "JOB_COMPLETED" | "JOB_FAILED";
    };

    const supabase = createAdminClient();

    // Load job
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, user_id, project_id, status, error_message")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(job.user_id);
    const toEmail = userData?.user?.email;
    if (!toEmail) {
      return NextResponse.json({ ok: false, error: "User email missing" }, { status: 400 });
    }

    // Get notification prefs
    const { data: prefs } = await supabase
      .from("user_notification_prefs")
      .select("*")
      .eq("user_id", job.user_id)
      .maybeSingle();

    const shouldSend = (kind: string) => {
      if (!prefs) {
        return kind === "job_completed" || kind === "job_failed";
      }
      if (kind === "job_started") return prefs.email_job_started;
      if (kind === "job_completed") return prefs.email_job_completed;
      if (kind === "job_failed") return prefs.email_job_failed;
      return true;
    };

    const projectUrl = `${BASE_URL}/app/projects/${job.project_id}`;

    let kind: "job_started" | "job_completed" | "job_failed";
    if (event === "JOB_STARTED") kind = "job_started";
    else if (event === "JOB_COMPLETED") kind = "job_completed";
    else kind = "job_failed";

    if (!shouldSend(kind)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const subject =
      kind === "job_completed"
        ? "✅ Your CanvasCast video is ready"
        : kind === "job_started"
          ? "🎬 CanvasCast started rendering your video"
          : "❌ CanvasCast couldn't finish your render";

    const html =
      kind === "job_completed"
        ? jobCompletedEmail({ projectUrl })
        : kind === "job_started"
          ? jobStartedEmail({ projectUrl })
          : jobFailedEmail({ projectUrl, error: job.error_message });

    // Log email
    const { data: logRow } = await supabase
      .from("email_log")
      .insert({
        user_id: job.user_id,
        job_id: job.id,
        kind,
        to_email: toEmail,
        subject,
        status: "queued",
      })
      .select("id")
      .single();

    // Send via Resend
    const send = await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject,
      html,
    });

    if ("error" in send && send.error) {
      await supabase
        .from("email_log")
        .update({
          status: "failed",
          error_message: send.error?.message ?? "Resend error",
        })
        .eq("id", logRow?.id);

      return NextResponse.json({ ok: false, error: "Resend failed" }, { status: 500 });
    }

    await supabase
      .from("email_log")
      .update({
        status: "sent",
        resend_id: "data" in send ? send.data?.id : undefined,
      })
      .eq("id", logRow?.id);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}

function jobCompletedEmail({ projectUrl }: { projectUrl: string }) {
  return `
  <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
    <h2>✅ Your video is ready</h2>
    <p>Your CanvasCast render finished. You can download the MP4 + asset pack now.</p>
    <p><a href="${projectUrl}">Open your project →</a></p>
    <p style="color:#666;font-size:12px">CanvasCast</p>
  </div>`;
}

function jobStartedEmail({ projectUrl }: { projectUrl: string }) {
  return `
  <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
    <h2>🎬 Render started</h2>
    <p>CanvasCast is generating your script, voice, visuals, and render timeline.</p>
    <p><a href="${projectUrl}">View status →</a></p>
    <p style="color:#666;font-size:12px">CanvasCast</p>
  </div>`;
}

function jobFailedEmail({
  projectUrl,
  error,
}: {
  projectUrl: string;
  error?: string | null;
}) {
  const err = error
    ? `<pre style="background:#111;color:#eee;padding:12px;border-radius:8px;white-space:pre-wrap">${escapeHtml(error)}</pre>`
    : "";
  return `
  <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5">
    <h2>❌ Render failed</h2>
    <p>Something broke during the job. You can retry from the project page.</p>
    ${err}
    <p><a href="${projectUrl}">Open your project →</a></p>
    <p style="color:#666;font-size:12px">CanvasCast</p>
  </div>`;
}
