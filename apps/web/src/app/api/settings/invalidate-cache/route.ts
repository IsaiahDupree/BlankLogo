/**
 * API Route to invalidate user preferences cache
 * Called after settings are saved to ensure workers use fresh data
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8989";

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Call API to invalidate cache (API has Redis access)
    try {
      await fetch(`${API_URL}/api/v1/cache/invalidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({ userId: user.id, type: "prefs" }),
      });
      console.log(`[CacheInvalidate] Requested cache invalidation for user: ${user.id}`);
    } catch (err) {
      // Non-critical - cache will expire naturally
      console.log("[CacheInvalidate] API call failed, cache will expire naturally");
    }

    return NextResponse.json({ 
      success: true, 
      message: "Cache invalidation requested" 
    });
  } catch (error) {
    console.error("[CacheInvalidate] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
