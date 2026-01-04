import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getWelcomeEmail } from "@/lib/emails/templates";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "BlankLogo <noreply@blanklogo.app>";

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

    // Send via Resend in production
    if (RESEND_API_KEY) {
      const resend = new Resend(RESEND_API_KEY);
      
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      if (error) {
        console.error("[WelcomeEmail] Resend error:", error);
        return NextResponse.json(
          { error: "Failed to send email", details: error.message },
          { status: 500 }
        );
      }

      console.log(`[WelcomeEmail] Sent to ${email}, ID: ${data?.id}`);
      return NextResponse.json({ 
        success: true, 
        message: "Welcome email sent",
        emailId: data?.id,
      });
    }

    // Development fallback - log the email
    console.log("=== WELCOME EMAIL (dev mode) ===");
    console.log("To:", email);
    console.log("Subject:", template.subject);
    console.log("================================");

    return NextResponse.json({ 
      success: true, 
      message: "Welcome email logged (dev mode)" 
    });
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
