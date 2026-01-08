import { NextResponse } from "next/server";
import { trackPurchaseCAPI, trackSubscribeCAPI, generateEventId } from "@/lib/meta-capi";

/**
 * Test endpoint for verifying Meta Pixel + CAPI setup
 * 
 * Usage: POST /api/test/pixel
 * Headers: x-internal-secret: <INTERNAL_NOTIFY_SECRET>
 * Body: { "event": "purchase" | "subscribe", "test": true }
 * 
 * After deployment, verify in Meta Events Manager:
 * https://business.facebook.com/events_manager2/list/pixel/1191876055285693/test_events
 */

export async function POST(request: Request) {
  // Verify internal secret
  const secret = request.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_NOTIFY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { event } = await request.json();

  if (!event) {
    return NextResponse.json({ error: "Missing event type" }, { status: 400 });
  }

  const testUserId = "test-user-" + Date.now();
  const testEventId = generateEventId("test");

  let result = false;

  if (event === "purchase") {
    result = await trackPurchaseCAPI({
      eventId: testEventId,
      userId: testUserId,
      email: "test@blanklogo.app",
      value: 9.99,
      currency: "USD",
      contentIds: ["pack_10"],
      contentName: "10 Credits Pack (TEST)",
      orderId: "test-order-" + Date.now(),
    });
  } else if (event === "subscribe") {
    result = await trackSubscribeCAPI({
      eventId: testEventId,
      userId: testUserId,
      email: "test@blanklogo.app",
      value: 29.00,
      currency: "USD",
      contentIds: ["pro"],
      contentName: "Pro Subscription (TEST)",
      predictedLtv: 348,
    });
  } else {
    return NextResponse.json({ error: "Invalid event type. Use 'purchase' or 'subscribe'" }, { status: 400 });
  }

  return NextResponse.json({
    success: result,
    event,
    eventId: testEventId,
    message: result 
      ? "Event sent to Meta CAPI. Check Events Manager: https://business.facebook.com/events_manager2/list/pixel/1191876055285693/test_events"
      : "Failed to send event. Check META_CAPI_ACCESS_TOKEN is configured.",
    pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID || "NOT_SET",
    capiConfigured: !!process.env.META_CAPI_ACCESS_TOKEN,
  });
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID || "NOT_SET",
    capiConfigured: !!process.env.META_CAPI_ACCESS_TOKEN,
    testUrl: "POST /api/test/pixel with x-internal-secret header",
    eventsManager: "https://business.facebook.com/events_manager2/list/pixel/1191876055285693/test_events",
  });
}
