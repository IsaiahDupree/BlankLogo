import { NextRequest, NextResponse } from "next/server";
import { getWelcomeEmail } from "@/lib/emails/templates";

/**
 * POST /api/emails/welcome
 * Sends welcome email to new users
 * Called by auth trigger or webhook after signup
 */
export async function POST(request: NextRequest) {
  try {
    const { email, userName } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const template = getWelcomeEmail(userName);

    // In production, send via Resend, SendGrid, or similar
    // For now, log the email (local dev uses Mailpit via Supabase)
    console.log("=== WELCOME EMAIL ===");
    console.log("To:", email);
    console.log("Subject:", template.subject);
    console.log("=====================");

    // TODO: Integrate with email provider
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: "BlankLogo <noreply@blanklogo.com>",
    //   to: email,
    //   subject: template.subject,
    //   html: template.html,
    //   text: template.text,
    // });

    return NextResponse.json({ 
      success: true, 
      message: "Welcome email queued" 
    });
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
