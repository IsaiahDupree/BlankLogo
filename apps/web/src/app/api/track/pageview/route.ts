import { NextRequest, NextResponse } from "next/server";
import { trackPageViewCAPI } from "@/lib/meta-capi";

/**
 * POST /api/track/pageview
 * 
 * Receives PageView events from the client and forwards them to Meta CAPI.
 * This ensures PageView events are deduplicated between Pixel and CAPI.
 * 
 * The client sends:
 * - eventId: Unique event ID (same as sent to fbq)
 * - sourceUrl: The page URL
 * - fbc: Facebook click ID cookie (_fbc)
 * - fbp: Facebook browser ID cookie (_fbp)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, sourceUrl, fbc, fbp } = body;

    if (!eventId || !sourceUrl) {
      return NextResponse.json(
        { error: "Missing required fields: eventId, sourceUrl" },
        { status: 400 }
      );
    }

    // Extract client info from headers
    const ipAddress = 
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    // Send to CAPI (fire and forget for performance)
    trackPageViewCAPI({
      eventId,
      sourceUrl,
      ipAddress,
      userAgent,
      fbc,
      fbp,
    }).catch((err) => {
      console.error("[Track PageView] CAPI error:", err);
    });

    // Return immediately - don't wait for CAPI response
    return NextResponse.json({ success: true, eventId });
  } catch (error) {
    console.error("[Track PageView] Error:", error);
    return NextResponse.json(
      { error: "Failed to track pageview" },
      { status: 500 }
    );
  }
}
