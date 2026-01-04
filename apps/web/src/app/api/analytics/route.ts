/**
 * Analytics API Route
 * Provides job statistics and usage data for the dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * GET /api/analytics
 * Get user's analytics overview
 */
export async function GET(request: NextRequest) {
  try {
    // Get user from auth header or session
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify the token and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = user.id;

    // Get job statistics
    const { data: jobs, error: jobsError } = await supabase
      .from("bl_jobs")
      .select("id, status, platform, credits_charged, created_at, completed_at")
      .eq("user_id", userId);

    if (jobsError) {
      console.error("[Analytics] Jobs fetch error:", jobsError);
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }

    // Calculate statistics
    const stats = {
      total: jobs?.length || 0,
      completed: jobs?.filter(j => j.status === "completed").length || 0,
      failed: jobs?.filter(j => j.status === "failed").length || 0,
      processing: jobs?.filter(j => j.status === "processing").length || 0,
      queued: jobs?.filter(j => j.status === "queued").length || 0,
    };

    // Get credit balance
    const { data: balance } = await supabase.rpc("bl_get_credit_balance", {
      p_user_id: userId,
    });

    // Calculate credits used
    const creditsUsed = jobs?.reduce((sum, j) => sum + (j.credits_charged || 0), 0) || 0;

    // Platform breakdown
    const platforms: Record<string, number> = {};
    jobs?.forEach(job => {
      const platform = job.platform || "unknown";
      platforms[platform] = (platforms[platform] || 0) + 1;
    });

    // Recent jobs (last 5)
    const recentJobs = jobs
      ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(j => ({
        id: j.id,
        status: j.status,
        platform: j.platform,
        createdAt: j.created_at,
      })) || [];

    // Calculate success rate
    const successRate = stats.total > 0 
      ? Math.round((stats.completed / stats.total) * 100) 
      : 0;

    // Average processing time for completed jobs
    const completedWithTime = jobs?.filter(j => 
      j.status === "completed" && j.completed_at && j.created_at
    ) || [];
    
    const avgProcessingTime = completedWithTime.length > 0
      ? Math.round(
          completedWithTime.reduce((sum, j) => {
            const start = new Date(j.created_at).getTime();
            const end = new Date(j.completed_at).getTime();
            return sum + (end - start);
          }, 0) / completedWithTime.length / 1000
        )
      : 0;

    return NextResponse.json({
      jobs: stats,
      credits: {
        balance: balance || 0,
        used: creditsUsed,
      },
      successRate,
      avgProcessingTime, // in seconds
      platforms,
      recentJobs,
    });
  } catch (error) {
    console.error("[Analytics] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
