/**
 * Email Test API Route
 * Tests all Resend email templates
 * 
 * POST /api/test/emails
 * Body: { email: "test@example.com", template?: "all" | "welcome" | ... }
 */

import { NextResponse } from "next/server";
import { getResend, FROM } from "@/lib/resend";
import {
  getWelcomeEmail,
  getDay3EducationEmail,
  getDay7SocialProofEmail,
  getReengagementEmail,
  getLowCreditsEmail,
  getJobCompletedEmail,
} from "@/lib/emails/templates";

// Only allow in development or with admin key
const isAuthorized = (request: Request): boolean => {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY || process.env.INTERNAL_NOTIFY_SECRET;
  
  if (process.env.NODE_ENV === "development") return true;
  if (authHeader === `Bearer ${adminKey}`) return true;
  
  return false;
};

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email, template = "all", userName = "Test User" } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const resend = getResend();
    const results: Record<string, { success: boolean; id?: string; error?: string }> = {};

    // Define all templates
    const templates = {
      welcome: {
        name: "Welcome Email",
        template: getWelcomeEmail(userName),
      },
      day3_education: {
        name: "Day 3 Education",
        template: getDay3EducationEmail(userName),
      },
      day7_social_proof: {
        name: "Day 7 Social Proof",
        template: getDay7SocialProofEmail(userName),
      },
      reengagement: {
        name: "Re-engagement (14 days inactive)",
        template: getReengagementEmail(userName, 5),
      },
      low_credits: {
        name: "Low Credits Warning",
        template: getLowCreditsEmail(userName, 2),
      },
      job_completed: {
        name: "Job Completed",
        template: getJobCompletedEmail(
          userName,
          "test-job-123",
          "sora",
          "https://example.com/download/test.mp4"
        ),
      },
    };

    // Send requested templates
    const templatesToSend = template === "all" 
      ? Object.keys(templates) 
      : [template];

    for (const key of templatesToSend) {
      const t = templates[key as keyof typeof templates];
      if (!t) {
        results[key] = { success: false, error: "Template not found" };
        continue;
      }

      try {
        const result = await resend.emails.send({
          from: FROM,
          to: email,
          subject: `[TEST] ${t.template.subject}`,
          html: t.template.html,
          text: t.template.text,
        });

        if (result.error) {
          results[key] = { success: false, error: result.error.message };
        } else {
          results[key] = { success: true, id: result.data?.id };
        }
      } catch (err) {
        results[key] = { 
          success: false, 
          error: err instanceof Error ? err.message : "Unknown error" 
        };
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;

    return NextResponse.json({
      success: successCount === totalCount,
      summary: `${successCount}/${totalCount} emails sent successfully`,
      results,
    });
  } catch (error) {
    console.error("[EMAIL TEST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send test emails" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    endpoint: "/api/test/emails",
    method: "POST",
    description: "Test Resend email templates",
    body: {
      email: "required - recipient email address",
      template: "optional - 'all' (default) or specific template name",
      userName: "optional - name to use in templates (default: 'Test User')",
    },
    templates: [
      "welcome",
      "day3_education", 
      "day7_social_proof",
      "reengagement",
      "low_credits",
      "job_completed",
    ],
    example: {
      email: "test@example.com",
      template: "welcome",
      userName: "John",
    },
  });
}
