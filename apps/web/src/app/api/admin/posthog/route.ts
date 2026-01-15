/**
 * PostHog Query API for Admin Dashboard
 * 
 * Fetches real analytics data from PostHog for the admin tracking page.
 * Requires POSTHOG_PERSONAL_API_KEY environment variable.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = ["isaiahdupree33@gmail.com"];
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.posthog.com";
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "";
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY || "";

// Verify admin access
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.substring(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  return !!user && ADMIN_EMAILS.includes(user.email || "");
}

// Query PostHog events API
async function queryPostHogEvents(params: {
  event?: string;
  after?: string;
  before?: string;
  limit?: number;
}): Promise<unknown[]> {
  if (!POSTHOG_PERSONAL_API_KEY || !POSTHOG_PROJECT_ID) {
    console.log("[PostHog API] Missing credentials, returning empty");
    return [];
  }

  const url = new URL(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/events/`);
  if (params.event) url.searchParams.set("event", params.event);
  if (params.after) url.searchParams.set("after", params.after);
  if (params.before) url.searchParams.set("before", params.before);
  url.searchParams.set("limit", String(params.limit || 100));

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("[PostHog API] Error:", response.status, await response.text());
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("[PostHog API] Fetch error:", error);
    return [];
  }
}

// Query PostHog insights (for aggregated stats)
async function queryPostHogInsight(query: {
  events: Array<{ id: string; name?: string; type?: string; math?: string }>;
  date_from?: string;
  date_to?: string;
  breakdown?: string;
  breakdown_type?: string;
}): Promise<unknown> {
  if (!POSTHOG_PERSONAL_API_KEY || !POSTHOG_PROJECT_ID) {
    return null;
  }

  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/insights/trend/`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      console.error("[PostHog Insight] Error:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("[PostHog Insight] Fetch error:", error);
    return null;
  }
}

// Run HogQL query for complex analytics
async function queryPostHogHogQL(query: string): Promise<unknown[]> {
  if (!POSTHOG_PERSONAL_API_KEY || !POSTHOG_PROJECT_ID) {
    return [];
  }

  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: query,
        },
      }),
    });

    if (!response.ok) {
      console.error("[PostHog HogQL] Error:", response.status, await response.text());
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("[PostHog HogQL] Fetch error:", error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  // Verify admin access
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const timeRange = searchParams.get("timeRange") || "24h";

  // Calculate date range
  const now = new Date();
  let afterDate: Date;
  switch (timeRange) {
    case "1h":
      afterDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case "7d":
      afterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "24h":
    default:
      afterDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const dateFrom = afterDate.toISOString();

  // Check if PostHog is configured
  if (!POSTHOG_PERSONAL_API_KEY || !POSTHOG_PROJECT_ID) {
    return NextResponse.json({
      configured: false,
      message: "PostHog API not configured. Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID.",
      events: [],
      stats: null,
    });
  }

  try {
    // Fetch recent events
    const recentEvents = await queryPostHogEvents({
      after: dateFrom,
      limit: 50,
    });

    // Run HogQL queries for aggregated stats
    const [
      pageViewsResult,
      platformUsageResult,
      inputModeResult,
      deviceBreakdownResult,
      engagementResult,
    ] = await Promise.all([
      // Top pages
      queryPostHogHogQL(`
        SELECT 
          properties.$current_url as page,
          count() as count
        FROM events
        WHERE event = '$pageview'
          AND timestamp > now() - INTERVAL ${timeRange === "1h" ? "1 HOUR" : timeRange === "7d" ? "7 DAY" : "1 DAY"}
        GROUP BY page
        ORDER BY count DESC
        LIMIT 10
      `),

      // Platform usage
      queryPostHogHogQL(`
        SELECT 
          properties.platform as platform,
          count() as count
        FROM events
        WHERE event = 'platform_selected'
          AND timestamp > now() - INTERVAL ${timeRange === "1h" ? "1 HOUR" : timeRange === "7d" ? "7 DAY" : "1 DAY"}
        GROUP BY platform
        ORDER BY count DESC
        LIMIT 10
      `),

      // Input mode (URL vs Upload)
      queryPostHogHogQL(`
        SELECT 
          properties.input_type as input_type,
          count() as count
        FROM events
        WHERE event IN ('url_submitted', 'video_upload_started')
          AND timestamp > now() - INTERVAL ${timeRange === "1h" ? "1 HOUR" : timeRange === "7d" ? "7 DAY" : "1 DAY"}
        GROUP BY input_type
      `),

      // Device breakdown
      queryPostHogHogQL(`
        SELECT 
          properties.$device_type as device,
          count() as count
        FROM events
        WHERE event = '$pageview'
          AND timestamp > now() - INTERVAL ${timeRange === "1h" ? "1 HOUR" : timeRange === "7d" ? "7 DAY" : "1 DAY"}
        GROUP BY device
      `),

      // Engagement metrics (scroll depth, rage clicks, etc.)
      queryPostHogHogQL(`
        SELECT 
          event,
          count() as count,
          avg(toFloat64OrNull(toString(properties.depth_percent))) as avg_depth
        FROM events
        WHERE event IN ('scroll_milestone', 'rage_click', 'user_idle', 'form_abandoned')
          AND timestamp > now() - INTERVAL ${timeRange === "1h" ? "1 HOUR" : timeRange === "7d" ? "7 DAY" : "1 DAY"}
        GROUP BY event
      `),
    ]);

    // Process page views
    const pageViews = (pageViewsResult as Array<[string, number]>).map(([page, count]) => ({
      page: page ? new URL(page).pathname : "/unknown",
      count: Number(count),
    }));

    // Process platform usage
    const platformUsage = (platformUsageResult as Array<[string, number]>).map(([platform, count]) => ({
      platform: platform || "unknown",
      count: Number(count),
    }));

    // Process input mode
    const inputModeData = inputModeResult as Array<[string, number]>;
    const inputModeUsage = {
      url: inputModeData.find(([type]) => type === "url")?.[1] || 0,
      upload: inputModeData.find(([type]) => type === "upload")?.[1] || 0,
    };

    // Process device breakdown
    const deviceData = deviceBreakdownResult as Array<[string, number]>;
    const deviceBreakdown = {
      desktop: Number(deviceData.find(([d]) => d === "Desktop")?.[1] || 0),
      mobile: Number(deviceData.find(([d]) => d === "Mobile")?.[1] || 0),
      tablet: Number(deviceData.find(([d]) => d === "Tablet")?.[1] || 0),
    };

    // Process engagement metrics
    const engagementData = engagementResult as Array<[string, number, number | null]>;
    const scrollData = engagementData.find(([e]) => e === "scroll_milestone");
    const avgScrollDepth = scrollData?.[2] || 0;
    const rageClicks = Number(engagementData.find(([e]) => e === "rage_click")?.[1] || 0);
    const idleSessions = Number(engagementData.find(([e]) => e === "user_idle")?.[1] || 0);
    const formAbandonment = Number(engagementData.find(([e]) => e === "form_abandoned")?.[1] || 0);

    // Format events for response
    const formattedEvents = (recentEvents as Array<{
      id: string;
      event: string;
      timestamp: string;
      properties: Record<string, unknown>;
      distinct_id?: string;
    }>).slice(0, 20).map((e) => ({
      id: e.id,
      event: e.event,
      timestamp: e.timestamp,
      properties: e.properties || {},
      user_id: e.distinct_id,
    }));

    // Build stats object
    const stats = {
      pageViews: pageViews.slice(0, 5),
      avgScrollDepth: Math.round(avgScrollDepth),
      avgTimeOnPage: 120, // TODO: Calculate from session data
      bounceRate: 25, // TODO: Calculate from session data
      platformUsage,
      inputModeUsage,
      rageClicks,
      idleSessions,
      videoInteractions: { play: 0, pause: 0, seek: 0, complete: 0 }, // TODO: Add video queries
      formAbandonment,
      deviceBreakdown,
    };

    return NextResponse.json({
      configured: true,
      events: formattedEvents,
      stats,
      timeRange,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[PostHog API] Error fetching data:", error);
    return NextResponse.json(
      { error: "Failed to fetch PostHog data", details: String(error) },
      { status: 500 }
    );
  }
}
