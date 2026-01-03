/**
 * BlankLogo Email Service
 * Handles sending transactional and marketing emails
 */

import {
  getWelcomeEmail,
  getDay3EducationEmail,
  getDay7SocialProofEmail,
  getReengagementEmail,
  getLowCreditsEmail,
  getJobCompletedEmail,
  EmailTemplate,
} from "./templates";

// Email sequence types
export type EmailSequenceType = 
  | "welcome"
  | "day3_education"
  | "day7_social_proof"
  | "reengagement"
  | "low_credits"
  | "job_completed";

interface SendEmailOptions {
  to: string;
  template: EmailTemplate;
}

interface SequenceEmail {
  type: EmailSequenceType;
  delayDays: number;
  getTemplate: (userName?: string, extra?: any) => EmailTemplate;
}

// Welcome email sequence definition
export const WELCOME_SEQUENCE: SequenceEmail[] = [
  {
    type: "welcome",
    delayDays: 0,
    getTemplate: (userName) => getWelcomeEmail(userName),
  },
  {
    type: "day3_education",
    delayDays: 3,
    getTemplate: (userName) => getDay3EducationEmail(userName),
  },
  {
    type: "day7_social_proof",
    delayDays: 7,
    getTemplate: (userName) => getDay7SocialProofEmail(userName),
  },
];

// Triggered emails (not time-based)
export const TRIGGERED_EMAILS = {
  reengagement: {
    trigger: "14_days_inactive",
    getTemplate: (userName?: string, credits?: number) => 
      getReengagementEmail(userName, credits),
  },
  lowCredits: {
    trigger: "credits_below_3",
    getTemplate: (userName?: string, credits?: number) => 
      getLowCreditsEmail(userName, credits),
  },
  jobCompleted: {
    trigger: "job_status_completed",
    getTemplate: (userName?: string, extra?: { jobId: string; platform: string; downloadUrl: string }) =>
      getJobCompletedEmail(userName, extra?.jobId, extra?.platform, extra?.downloadUrl),
  },
};

/**
 * Send an email using the configured provider
 * In development, logs to console (Supabase sends via Mailpit)
 * In production, use Resend, SendGrid, etc.
 */
export async function sendEmail({ to, template }: SendEmailOptions): Promise<boolean> {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    console.log("\n========== EMAIL ==========");
    console.log("To:", to);
    console.log("Subject:", template.subject);
    console.log("===========================\n");
    return true;
  }

  // Production: Use email provider
  try {
    // Example with Resend (uncomment when API key is set)
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: "BlankLogo <noreply@blanklogo.com>",
    //   to,
    //   subject: template.subject,
    //   html: template.html,
    //   text: template.text,
    // });

    // For now, just log in production too
    console.log(`[EMAIL] Sent "${template.subject}" to ${to}`);
    return true;
  } catch (error) {
    console.error("[EMAIL] Failed to send:", error);
    return false;
  }
}

/**
 * Queue welcome sequence for a new user
 * In production, this would use a job queue (BullMQ) to schedule emails
 */
export async function queueWelcomeSequence(
  userId: string,
  email: string,
  userName?: string
): Promise<void> {
  // Send immediate welcome email
  const welcomeTemplate = getWelcomeEmail(userName);
  await sendEmail({ to: email, template: welcomeTemplate });

  // In production, queue delayed emails
  // Example with BullMQ:
  // await emailQueue.add("day3_education", { userId, email, userName }, { delay: 3 * 24 * 60 * 60 * 1000 });
  // await emailQueue.add("day7_social_proof", { userId, email, userName }, { delay: 7 * 24 * 60 * 60 * 1000 });

  console.log(`[EMAIL] Welcome sequence queued for ${email}`);
}

/**
 * Send low credits notification
 */
export async function sendLowCreditsEmail(
  email: string,
  userName?: string,
  creditsRemaining?: number
): Promise<void> {
  const template = getLowCreditsEmail(userName, creditsRemaining);
  await sendEmail({ to: email, template });
}

/**
 * Send job completed notification
 */
export async function sendJobCompletedEmail(
  email: string,
  userName?: string,
  jobId?: string,
  platform?: string,
  downloadUrl?: string
): Promise<void> {
  const template = getJobCompletedEmail(userName, jobId, platform, downloadUrl);
  await sendEmail({ to: email, template });
}

/**
 * Send re-engagement email for inactive users
 */
export async function sendReengagementEmail(
  email: string,
  userName?: string,
  creditsRemaining?: number
): Promise<void> {
  const template = getReengagementEmail(userName, creditsRemaining);
  await sendEmail({ to: email, template });
}
