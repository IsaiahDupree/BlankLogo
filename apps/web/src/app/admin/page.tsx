"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { 
  Users, 
  Video, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle,
  Loader2,
  RefreshCw,
  Shield,
  Mail,
  Globe,
  ExternalLink
} from "lucide-react";

// Admin emails allowed to access this page
const ADMIN_EMAILS = ["isaiahdupree33@gmail.com"];

// Test user emails/patterns to exclude from stats
const TEST_USER_PATTERNS = [
  "isaiahdupree33@gmail.com",
  "isaiahdupree",
  "test@",
  "e2e+",
  "e2e@",
  "test+",
  "@test.com",
  "@example.com",
];

// Helper to check if email is a test user
function isTestUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();
  return TEST_USER_PATTERNS.some(pattern => lowerEmail.includes(pattern.toLowerCase()));
}

interface AdminStats {
  users: {
    total: number;
    last24h: number;
    last7d: number;
    last30d: number;
  };
  jobs: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    last24h: number;
    last7d: number;
    successRate: number;
  };
  credits: {
    totalGranted: number;
    totalUsed: number;
    totalPurchased: number;
  };
  revenue: {
    total: number;
    last30d: number;
    subscriptions: number;
    oneTime: number;
  };
  userGrowth: { date: string; count: number }[];
  retention: {
    returnRate7d: number;
    returnRate30d: number;
    avgSessionsPerUser: number;
    usersWithMultipleSessions: number;
  };
  sessionDuration: {
    avgDurationMs: number;
    totalSessions: number;
    avgJobsPerSession: number;
  };
  emails: {
    total: number;
    sent: number;
    pending: number;
    failed: number;
    last24h: number;
    last7d: number;
    byType: Record<string, number>;
  };
  sources: {
    utmSources: Record<string, number>;
    utmMediums: Record<string, number>;
    utmCampaigns: Record<string, number>;
    referrers: Record<string, number>;
    total: number;
  };
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color = "blue" 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: React.ElementType;
  color?: "blue" | "green" | "red" | "yellow" | "purple";
}) {
  const colorClasses = {
    blue: "bg-blue-500/20 text-blue-400",
    green: "bg-green-500/20 text-green-400",
    red: "bg-red-500/20 text-red-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    purple: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className={`p-1.5 sm:p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <h3 className="text-gray-400 text-xs sm:text-sm font-medium">{title}</h3>
      </div>
      <p className="text-2xl sm:text-3xl font-bold">{value}</p>
      {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [includeTestUsers, setIncludeTestUsers] = useState(true); // Default to include all

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    checkAdminAccess();
  }, []);

  // Re-fetch stats when toggle changes
  useEffect(() => {
    if (authorized) {
      fetchStats();
    }
  }, [includeTestUsers]);

  async function checkAdminAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login?redirect=/admin");
        return;
      }

      if (!ADMIN_EMAILS.includes(user.email || "")) {
        setError("Access denied. Admin privileges required.");
        setLoading(false);
        return;
      }

      setAuthorized(true);
      await fetchStats();
    } catch (err) {
      console.error("Admin access check failed:", err);
      setError("Failed to verify admin access");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    setRefreshing(true);
    try {
      // Fetch user stats from bl_user_profiles (with email to filter test users)
      const { data: allUsers } = await supabase
        .from("bl_user_profiles")
        .select("id, email, created_at");

      // Filter out test users (unless includeTestUsers is true)
      const users = includeTestUsers 
        ? (allUsers || [])
        : (allUsers?.filter(u => !isTestUser(u.email)) || []);
      const testUserIds = includeTestUsers 
        ? new Set<string>() 
        : new Set(allUsers?.filter(u => isTestUser(u.email)).map(u => u.id) || []);

      const now = new Date();
      const day = 24 * 60 * 60 * 1000;
      const usersLast24h = users.filter(u => 
        new Date(u.created_at) > new Date(now.getTime() - day)
      ).length;
      const usersLast7d = users.filter(u => 
        new Date(u.created_at) > new Date(now.getTime() - 7 * day)
      ).length;
      const usersLast30d = users.filter(u => 
        new Date(u.created_at) > new Date(now.getTime() - 30 * day)
      ).length;

      // Fetch job stats (filter out jobs from test users)
      const { data: allJobs } = await supabase
        .from("bl_jobs")
        .select("user_id, status, created_at");
      
      // Filter out jobs from test users
      const jobs = allJobs?.filter(j => !testUserIds.has(j.user_id)) || [];

      const completedJobs = jobs?.filter(j => j.status === "completed").length || 0;
      const failedJobs = jobs?.filter(j => j.status === "failed" || j.status === "failed_terminal").length || 0;
      const pendingJobs = jobs?.filter(j => 
        ["queued", "processing", "claimed"].includes(j.status)
      ).length || 0;
      const jobsLast24h = jobs?.filter(j => 
        new Date(j.created_at) > new Date(now.getTime() - day)
      ).length || 0;
      const jobsLast7d = jobs?.filter(j => 
        new Date(j.created_at) > new Date(now.getTime() - 7 * day)
      ).length || 0;

      // Fetch credit stats (filter out test users)
      // bl_credit_ledger uses 'delta' for amount and 'reason' for type
      const { data: allCredits } = await supabase
        .from("bl_credit_ledger")
        .select("user_id, delta, reason, type, created_at");
      
      const credits = allCredits?.filter(c => !testUserIds.has(c.user_id)) || [];

      // delta > 0 = credits added, delta < 0 = credits used
      // reason/type can be: 'grant', 'purchase', 'reserve', 'release', 'welcome', etc.
      const totalGranted = credits.filter(c => 
        (c.delta > 0 || (c.type && c.delta > 0)) && 
        (c.reason === 'welcome' || c.reason === 'grant' || c.type === 'grant' || c.reason === 'promo')
      ).reduce((sum, c) => sum + Math.abs(c.delta), 0);
      
      const totalUsed = credits.filter(c => 
        c.delta < 0 && (c.reason === 'reserve' || c.type === 'reserve' || c.reason === 'job')
      ).reduce((sum, c) => sum + Math.abs(c.delta), 0);
      
      const totalPurchased = credits.filter(c => 
        c.delta > 0 && (c.reason === 'purchase' || c.type === 'purchase')
      ).reduce((sum, c) => sum + Math.abs(c.delta), 0);

      // Revenue: estimate from credit purchases (no separate transactions table)
      // Assuming $1 per 10 credits as rough estimate, or use Stripe data if available
      const CREDITS_PER_DOLLAR = 10;
      const purchaseCredits = credits.filter(c => 
        c.delta > 0 && (c.reason === 'purchase' || c.type === 'purchase')
      );
      
      const totalRevenue = purchaseCredits.reduce((sum, c) => sum + (Math.abs(c.delta) / CREDITS_PER_DOLLAR), 0);
      const revenueLast30d = purchaseCredits.filter(c => 
        new Date(c.created_at) > new Date(now.getTime() - 30 * day)
      ).reduce((sum, c) => sum + (Math.abs(c.delta) / CREDITS_PER_DOLLAR), 0);

      // Calculate user growth by day (last 30 days)
      const userGrowth: { date: string; count: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const dayStart = new Date(now.getTime() - i * day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + day);
        const count = users?.filter(u => {
          const created = new Date(u.created_at);
          return created >= dayStart && created < dayEnd;
        }).length || 0;
        userGrowth.push({
          date: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count,
        });
      }

      // Calculate retention metrics
      // Users who came back within 7 days of signup
      const usersWithJobs = new Set<string>();
      const userJobDates: Record<string, Date[]> = {};
      
      jobs?.forEach(j => {
        // Jobs have user_id - we need to track unique users with multiple sessions
        const jobDate = new Date(j.created_at);
        // Group by date to estimate sessions
      });

      // Estimate return rate from job activity
      const usersWithMultipleJobs = jobs ? 
        Object.values(
          jobs.reduce((acc, j) => {
            // This is a simplified metric - in production, you'd track actual sessions
            return acc;
          }, {} as Record<string, number>)
        ).filter(count => count > 1).length : 0;

      // Session duration estimates (from job processing times, excluding test users)
      const { data: allJobsWithDuration } = await supabase
        .from("bl_jobs")
        .select("user_id, created_at, completed_at, status")
        .eq("status", "completed");
      
      const jobsWithDuration = allJobsWithDuration?.filter(j => !testUserIds.has(j.user_id)) || [];

      const userSessions: Record<string, number> = {};
      jobsWithDuration.forEach(j => {
        if (j.user_id) {
          userSessions[j.user_id] = (userSessions[j.user_id] || 0) + 1;
        }
      });

      const usersWithMultipleSessions = Object.values(userSessions).filter(count => count > 1).length;
      const totalUsersWithSessions = Object.keys(userSessions).length;
      const avgSessionsPerUser = totalUsersWithSessions > 0 
        ? Object.values(userSessions).reduce((a, b) => a + b, 0) / totalUsersWithSessions 
        : 0;

      // Return rate: users who have more than 1 job
      const returnRate7d = totalUsersWithSessions > 0 
        ? Math.round((usersWithMultipleSessions / totalUsersWithSessions) * 100) 
        : 0;

      // Fetch email stats from both email_log and bl_notification_outbox
      const { data: emailLogs } = await supabase
        .from("email_log")
        .select("id, status, kind, created_at");
      
      const { data: notificationOutbox } = await supabase
        .from("bl_notification_outbox")
        .select("id, status, type, created_at");
      
      // Combine both sources
      const allEmails = [
        ...(emailLogs || []).map(e => ({ ...e, source: 'email_log' })),
        ...(notificationOutbox || []).map(e => ({ ...e, kind: e.type, source: 'notification' })),
      ];
      
      const emailsSent = allEmails.filter(e => e.status === 'sent' || e.status === 'delivered').length;
      const emailsPending = allEmails.filter(e => e.status === 'pending' || e.status === 'queued').length;
      const emailsFailed = allEmails.filter(e => e.status === 'failed' || e.status === 'error').length;
      const emailsLast24h = allEmails.filter(e => 
        new Date(e.created_at) > new Date(now.getTime() - day)
      ).length;
      const emailsLast7d = allEmails.filter(e => 
        new Date(e.created_at) > new Date(now.getTime() - 7 * day)
      ).length;
      
      // Group by type/kind
      const emailsByType: Record<string, number> = {};
      allEmails.forEach(e => {
        const type = e.kind || 'unknown';
        emailsByType[type] = (emailsByType[type] || 0) + 1;
      });

      // Fetch auth events for user acquisition sources (UTM, referrers)
      const { data: authEvents } = await supabase
        .from("bl_auth_events")
        .select("user_id, metadata, created_at")
        .eq("event_type", "signup");

      // Process source data from auth events
      const utmSources: Record<string, number> = {};
      const utmMediums: Record<string, number> = {};
      const utmCampaigns: Record<string, number> = {};
      const referrers: Record<string, number> = {};
      
      authEvents?.forEach(event => {
        const metadata = event.metadata as {
          utm_source?: string;
          utm_medium?: string;
          utm_campaign?: string;
          referrer?: string;
        } | null;
        
        if (metadata) {
          // UTM Source
          const source = metadata.utm_source || 'direct';
          utmSources[source] = (utmSources[source] || 0) + 1;
          
          // UTM Medium
          if (metadata.utm_medium) {
            utmMediums[metadata.utm_medium] = (utmMediums[metadata.utm_medium] || 0) + 1;
          }
          
          // UTM Campaign
          if (metadata.utm_campaign) {
            utmCampaigns[metadata.utm_campaign] = (utmCampaigns[metadata.utm_campaign] || 0) + 1;
          }
          
          // Referrer domain
          if (metadata.referrer) {
            try {
              const refUrl = new URL(metadata.referrer);
              const domain = refUrl.hostname.replace('www.', '');
              referrers[domain] = (referrers[domain] || 0) + 1;
            } catch {
              referrers['unknown'] = (referrers['unknown'] || 0) + 1;
            }
          }
        } else {
          utmSources['direct'] = (utmSources['direct'] || 0) + 1;
        }
      });

      // If no auth events, fall back to user count as direct
      if (!authEvents || authEvents.length === 0) {
        utmSources['direct'] = users.length;
      }

      setStats({
        users: {
          total: users.length,
          last24h: usersLast24h,
          last7d: usersLast7d,
          last30d: usersLast30d,
        },
        jobs: {
          total: jobs.length,
          completed: completedJobs,
          failed: failedJobs,
          pending: pendingJobs,
          last24h: jobsLast24h,
          last7d: jobsLast7d,
          successRate: jobs.length ? Math.round((completedJobs / (completedJobs + failedJobs)) * 100) : 0,
        },
        credits: {
          totalGranted,
          totalUsed,
          totalPurchased,
        },
        revenue: {
          total: totalRevenue,
          last30d: revenueLast30d,
          subscriptions: 0, // Would need Stripe integration for subscription tracking
          oneTime: totalRevenue, // All credit purchases are one-time for now
        },
        userGrowth,
        retention: {
          returnRate7d,
          returnRate30d: returnRate7d, // Simplified - same metric for now
          avgSessionsPerUser: Math.round(avgSessionsPerUser * 10) / 10,
          usersWithMultipleSessions,
        },
        sessionDuration: {
          avgDurationMs: 0, // Would need actual session tracking
          totalSessions: jobsWithDuration?.length || 0,
          avgJobsPerSession: avgSessionsPerUser,
        },
        emails: {
          total: allEmails.length,
          sent: emailsSent,
          pending: emailsPending,
          failed: emailsFailed,
          last24h: emailsLast24h,
          last7d: emailsLast7d,
          byType: emailsByType,
        },
        sources: {
          utmSources,
          utmMediums,
          utmCampaigns,
          referrers,
          total: authEvents?.length || users.length,
        },
      });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      setError("Failed to load statistics");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error && !authorized) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
              Admin Dashboard
            </h1>
            <p className="text-gray-400 mt-1 text-sm sm:text-base">BlankLogo site statistics</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Growth Center Link */}
            <Link
              href="/admin/growth"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition text-sm"
            >
              <TrendingUp className="w-4 h-4" />
              Growth Center
            </Link>
            {/* Live Tracking Link */}
            <Link
              href="/admin/tracking"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition text-sm"
            >
              <Clock className="w-4 h-4" />
              Live Tracking
            </Link>
            {/* Test Users Toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTestUsers}
                onChange={(e) => setIncludeTestUsers(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
              />
              Include test users
            </label>
            <button
              onClick={fetchStats}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* User Stats */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            Users
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <StatCard 
              title="Total Users" 
              value={stats?.users.total || 0} 
              icon={Users} 
              color="blue"
            />
            <StatCard 
              title="Last 24 Hours" 
              value={stats?.users.last24h || 0} 
              subtitle="new signups"
              icon={TrendingUp} 
              color="green"
            />
            <StatCard 
              title="Last 7 Days" 
              value={stats?.users.last7d || 0} 
              subtitle="new signups"
              icon={TrendingUp} 
              color="green"
            />
            <StatCard 
              title="Last 30 Days" 
              value={stats?.users.last30d || 0} 
              subtitle="new signups"
              icon={TrendingUp} 
              color="green"
            />
          </div>
        </section>

        {/* User Growth Chart */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
            <span className="hidden sm:inline">User Growth (Last 30 Days)</span>
            <span className="sm:hidden">Growth (30d)</span>
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
            <UserGrowthChart data={stats?.userGrowth || []} />
          </div>
        </section>

        {/* Retention & Engagement */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            <span className="hidden sm:inline">Retention & Engagement</span>
            <span className="sm:hidden">Retention</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <StatCard 
              title="Return Rate" 
              value={`${stats?.retention.returnRate7d || 0}%`} 
              subtitle="users who came back"
              icon={RefreshCw} 
              color="purple"
            />
            <StatCard 
              title="Repeat Users" 
              value={stats?.retention.usersWithMultipleSessions || 0} 
              subtitle="users with 2+ jobs"
              icon={Users} 
              color="blue"
            />
            <StatCard 
              title="Avg Jobs/User" 
              value={stats?.retention.avgSessionsPerUser || 0} 
              subtitle="average engagement"
              icon={Video} 
              color="green"
            />
            <StatCard 
              title="Total Sessions" 
              value={stats?.sessionDuration.totalSessions || 0} 
              subtitle="completed jobs"
              icon={CheckCircle} 
              color="green"
            />
          </div>
        </section>

        {/* Job Stats */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Video className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            Jobs
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <StatCard 
              title="Total Jobs" 
              value={stats?.jobs.total || 0} 
              icon={Video} 
              color="purple"
            />
            <StatCard 
              title="Completed" 
              value={stats?.jobs.completed || 0} 
              subtitle={`${stats?.jobs.successRate || 0}% success rate`}
              icon={CheckCircle} 
              color="green"
            />
            <StatCard 
              title="Failed" 
              value={stats?.jobs.failed || 0} 
              icon={XCircle} 
              color="red"
            />
            <StatCard 
              title="Pending" 
              value={stats?.jobs.pending || 0} 
              subtitle="in queue"
              icon={Clock} 
              color="yellow"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
            <StatCard 
              title="Jobs Last 24h" 
              value={stats?.jobs.last24h || 0} 
              icon={TrendingUp} 
              color="blue"
            />
            <StatCard 
              title="Jobs Last 7 Days" 
              value={stats?.jobs.last7d || 0} 
              icon={TrendingUp} 
              color="blue"
            />
          </div>
        </section>

        {/* Credits Stats */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            Credits
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <StatCard 
              title="Total Granted" 
              value={stats?.credits.totalGranted || 0} 
              subtitle="free credits given"
              icon={TrendingUp} 
              color="green"
            />
            <StatCard 
              title="Total Used" 
              value={stats?.credits.totalUsed || 0} 
              subtitle="credits consumed"
              icon={Video} 
              color="purple"
            />
            <StatCard 
              title="Total Purchased" 
              value={stats?.credits.totalPurchased || 0} 
              subtitle="credits bought"
              icon={DollarSign} 
              color="blue"
            />
          </div>
        </section>

        {/* Revenue Stats */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
            Revenue
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <StatCard 
              title="Total Revenue" 
              value={`$${(stats?.revenue.total || 0).toFixed(2)}`} 
              icon={DollarSign} 
              color="green"
            />
            <StatCard 
              title="Last 30 Days" 
              value={`$${(stats?.revenue.last30d || 0).toFixed(2)}`} 
              icon={TrendingUp} 
              color="green"
            />
            <StatCard 
              title="Subscriptions" 
              value={`$${(stats?.revenue.subscriptions || 0).toFixed(2)}`} 
              icon={Clock} 
              color="blue"
            />
            <StatCard 
              title="One-Time" 
              value={`$${(stats?.revenue.oneTime || 0).toFixed(2)}`} 
              icon={DollarSign} 
              color="purple"
            />
          </div>
        </section>

        {/* Email Stats */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            Emails
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <StatCard 
              title="Total Emails" 
              value={stats?.emails.total || 0} 
              subtitle="all time"
              icon={Mail} 
              color="purple"
            />
            <StatCard 
              title="Sent" 
              value={stats?.emails.sent || 0} 
              subtitle="delivered"
              icon={CheckCircle} 
              color="green"
            />
            <StatCard 
              title="Pending" 
              value={stats?.emails.pending || 0} 
              subtitle="in queue"
              icon={Clock} 
              color="yellow"
            />
            <StatCard 
              title="Failed" 
              value={stats?.emails.failed || 0} 
              subtitle="errors"
              icon={XCircle} 
              color="red"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
            <StatCard 
              title="Last 24h" 
              value={stats?.emails.last24h || 0} 
              icon={TrendingUp} 
              color="blue"
            />
            <StatCard 
              title="Last 7 Days" 
              value={stats?.emails.last7d || 0} 
              icon={TrendingUp} 
              color="blue"
            />
          </div>
          {stats?.emails.byType && Object.keys(stats.emails.byType).length > 0 && (
            <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">By Type</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.emails.byType).map(([type, count]) => (
                  <span 
                    key={type}
                    className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm"
                  >
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* User Sources */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            User Sources
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* UTM Sources */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Traffic Sources (UTM)
              </h3>
              {stats?.sources.utmSources && Object.keys(stats.sources.utmSources).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(stats.sources.utmSources)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([source, count]) => {
                      const total = stats.sources.total || 1;
                      const percentage = Math.round((count / total) * 100);
                      return (
                        <div key={source}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300 capitalize">{source}</span>
                            <span className="text-gray-400">{count} ({percentage}%)</span>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No source data available</p>
              )}
            </div>

            {/* Referrer Domains */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Referrer Domains
              </h3>
              {stats?.sources.referrers && Object.keys(stats.sources.referrers).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(stats.sources.referrers)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([domain, count]) => {
                      const total = Object.values(stats.sources.referrers).reduce((a, b) => a + b, 0);
                      const percentage = Math.round((count / total) * 100);
                      return (
                        <div key={domain}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300">{domain}</span>
                            <span className="text-gray-400">{count} ({percentage}%)</span>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No referrer data tracked yet</p>
              )}
            </div>
          </div>

          {/* UTM Mediums & Campaigns */}
          {((stats?.sources.utmMediums && Object.keys(stats.sources.utmMediums).length > 0) ||
            (stats?.sources.utmCampaigns && Object.keys(stats.sources.utmCampaigns).length > 0)) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {/* UTM Mediums */}
              {stats?.sources.utmMediums && Object.keys(stats.sources.utmMediums).length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Mediums</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.sources.utmMediums)
                      .sort((a, b) => b[1] - a[1])
                      .map(([medium, count]) => (
                        <span 
                          key={medium}
                          className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
                        >
                          {medium}: {count}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* UTM Campaigns */}
              {stats?.sources.utmCampaigns && Object.keys(stats.sources.utmCampaigns).length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Campaigns</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.sources.utmCampaigns)
                      .sort((a, b) => b[1] - a[1])
                      .map(([campaign, count]) => (
                        <span 
                          key={campaign}
                          className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm"
                        >
                          {campaign}: {count}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Service Health */}
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            Service Health
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
            <ServiceHealthCheck />
          </div>
        </section>
      </div>
    </div>
  );
}

interface ServiceHealthData {
  status: string;
  latency: number;
  response?: Record<string, unknown>;
  error?: string;
  logs?: string[];
}

function ServiceHealthCheck() {
  const [health, setHealth] = useState<{
    worker: ServiceHealthData | null;
    modal: ServiceHealthData | null;
    web: ServiceHealthData | null;
  }>({
    worker: null,
    modal: null,
    web: null,
  });
  const [checking, setChecking] = useState(false);
  const [selectedService, setSelectedService] = useState<'worker' | 'modal' | 'web' | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  async function checkHealth() {
    setChecking(true);
    
    // Check Worker
    try {
      const start = Date.now();
      const res = await fetch("https://blanklogo-worker.onrender.com/health");
      const data = await res.json();
      setHealth(h => ({ 
        ...h, 
        worker: { 
          status: data.status, 
          latency: Date.now() - start,
          response: data,
        } 
      }));
    } catch (err) {
      setHealth(h => ({ 
        ...h, 
        worker: { 
          status: "error", 
          latency: 0,
          error: err instanceof Error ? err.message : "Connection failed",
        } 
      }));
    }

    // Check Modal
    try {
      const start = Date.now();
      const res = await fetch("https://isaiahdupree33--blanklogo-watermark-removal-health.modal.run");
      const data = await res.json();
      setHealth(h => ({ 
        ...h, 
        modal: { 
          status: data.status, 
          latency: Date.now() - start,
          response: data,
        } 
      }));
    } catch (err) {
      setHealth(h => ({ 
        ...h, 
        modal: { 
          status: "error", 
          latency: 0,
          error: err instanceof Error ? err.message : "Connection failed",
        } 
      }));
    }

    // Check Web
    try {
      const start = Date.now();
      const res = await fetch("https://www.blanklogo.app");
      setHealth(h => ({ 
        ...h, 
        web: { 
          status: res.ok ? "ok" : "error", 
          latency: Date.now() - start,
          response: { statusCode: res.status, statusText: res.statusText },
        } 
      }));
    } catch (err) {
      setHealth(h => ({ 
        ...h, 
        web: { 
          status: "error", 
          latency: 0,
          error: err instanceof Error ? err.message : "Connection failed",
        } 
      }));
    }

    setChecking(false);
  }

  async function fetchLogs(service: 'worker' | 'modal' | 'web') {
    setSelectedService(service);
    setLoadingLogs(true);
    setLogs([]);

    const timestamp = new Date().toISOString();
    const newLogs: string[] = [
      `[${timestamp}] Fetching logs for ${service}...`,
    ];

    try {
      if (service === 'worker') {
        // Fetch worker health with more details
        const res = await fetch("https://blanklogo-worker.onrender.com/health");
        const data = await res.json();
        newLogs.push(`[${timestamp}] Worker Status: ${data.status}`);
        newLogs.push(`[${timestamp}] Worker ID: ${data.worker || 'unknown'}`);
        newLogs.push(`[${timestamp}] Run ID: ${data.run_id || 'unknown'}`);
        newLogs.push(`[${timestamp}] Uptime: ${data.uptime_ms ? `${Math.round(data.uptime_ms / 1000)}s` : 'unknown'}`);
        newLogs.push(`[${timestamp}] Timestamp: ${data.timestamp || timestamp}`);
        
        // Try to get queue stats
        try {
          const queueRes = await fetch("https://blanklogo-worker.onrender.com/queue/stats");
          if (queueRes.ok) {
            const queueData = await queueRes.json();
            newLogs.push(`[${timestamp}] Queue Pending: ${queueData.pending || 0}`);
            newLogs.push(`[${timestamp}] Queue Processing: ${queueData.processing || 0}`);
          }
        } catch {
          newLogs.push(`[${timestamp}] Queue stats not available`);
        }
      } else if (service === 'modal') {
        const res = await fetch("https://isaiahdupree33--blanklogo-watermark-removal-health.modal.run");
        const data = await res.json();
        newLogs.push(`[${timestamp}] Modal Status: ${data.status}`);
        newLogs.push(`[${timestamp}] Service: ${data.service || 'blanklogo-watermark-removal'}`);
        newLogs.push(`[${timestamp}] GPU Available: Yes (on-demand)`);
        newLogs.push(`[${timestamp}] Cold start expected: ~4-10s`);
      } else if (service === 'web') {
        const res = await fetch("https://www.blanklogo.app");
        newLogs.push(`[${timestamp}] Web Status: ${res.ok ? 'OK' : 'Error'}`);
        newLogs.push(`[${timestamp}] HTTP Code: ${res.status}`);
        newLogs.push(`[${timestamp}] Status Text: ${res.statusText}`);
        newLogs.push(`[${timestamp}] Response Time: ${health.web?.latency || 0}ms`);
      }
    } catch (err) {
      newLogs.push(`[${timestamp}] ERROR: ${err instanceof Error ? err.message : 'Failed to fetch logs'}`);
    }

    newLogs.push(`[${timestamp}] Log fetch complete`);
    setLogs(newLogs);
    setLoadingLogs(false);
  }

  useEffect(() => {
    checkHealth();
  }, []);

  const services = [
    { name: "Render Worker", key: "worker" as const, url: "https://blanklogo-worker.onrender.com" },
    { name: "Modal Inpaint", key: "modal" as const, url: "https://modal.com" },
    { name: "Web App", key: "web" as const, url: "https://www.blanklogo.app" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400">Real-time service status (click for logs)</span>
        <button
          onClick={checkHealth}
          disabled={checking}
          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${checking ? "animate-spin" : ""}`} />
          Check Now
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
        {services.map(({ name, key }) => {
          const service = health[key];
          const isHealthy = service?.status === "ok" || service?.status === "healthy";
          const isSelected = selectedService === key;
          
          return (
            <button
              key={key}
              onClick={() => fetchLogs(key)}
              className={`flex items-center justify-between p-3 rounded-lg transition cursor-pointer ${
                isSelected 
                  ? 'bg-blue-500/20 border border-blue-500' 
                  : 'bg-white/5 hover:bg-white/10 border border-transparent'
              }`}
            >
              <span className="font-medium">{name}</span>
              <div className="flex items-center gap-2">
                {service ? (
                  <>
                    <span className={`w-2 h-2 rounded-full ${isHealthy ? "bg-green-400" : "bg-red-400"}`} />
                    <span className="text-sm text-gray-400">
                      {isHealthy ? `${service.latency}ms` : "Error"}
                    </span>
                  </>
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Logs Panel */}
      {selectedService && (
        <div className="mt-4 bg-gray-900 rounded-lg border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
            <span className="text-sm font-medium">
              {services.find(s => s.key === selectedService)?.name} Logs
            </span>
            <button
              onClick={() => setSelectedService(null)}
              className="text-gray-400 hover:text-white text-sm"
            >
              Close
            </button>
          </div>
          <div className="p-4 font-mono text-xs max-h-64 overflow-y-auto">
            {loadingLogs ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Fetching logs...
              </div>
            ) : logs.length > 0 ? (
              logs.map((log, i) => (
                <div 
                  key={i} 
                  className={`py-1 ${
                    log.includes('ERROR') 
                      ? 'text-red-400' 
                      : log.includes('OK') || log.includes('healthy')
                        ? 'text-green-400'
                        : 'text-gray-300'
                  }`}
                >
                  {log}
                </div>
              ))
            ) : (
              <span className="text-gray-500">No logs available</span>
            )}
          </div>
          
          {/* Service Details */}
          {health[selectedService] && (
            <div className="px-4 py-3 bg-white/5 border-t border-white/10">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className={`ml-2 ${
                    health[selectedService]?.status === 'ok' || health[selectedService]?.status === 'healthy'
                      ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {health[selectedService]?.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Latency:</span>
                  <span className="ml-2 text-gray-300">{health[selectedService]?.latency}ms</span>
                </div>
                {health[selectedService]?.error && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Error:</span>
                    <span className="ml-2 text-red-400">{health[selectedService]?.error}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserGrowthChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data || data.length === 0) {
    return <div className="text-gray-400 text-center py-8">No data available</div>;
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  
  // Group data into periods
  const last7Days = data.slice(-7);
  const prev7Days = data.slice(-14, -7);
  const last7Total = last7Days.reduce((sum, d) => sum + d.count, 0);
  const prev7Total = prev7Days.reduce((sum, d) => sum + d.count, 0);
  const growthRate = prev7Total > 0 ? Math.round(((last7Total - prev7Total) / prev7Total) * 100) : 0;

  return (
    <div>
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="text-center">
          <p className="text-lg sm:text-2xl font-bold text-blue-400">{total}</p>
          <p className="text-xs sm:text-sm text-gray-400">Total (30d)</p>
        </div>
        <div className="text-center">
          <p className="text-lg sm:text-2xl font-bold text-green-400">{last7Total}</p>
          <p className="text-xs sm:text-sm text-gray-400">Last 7 Days</p>
        </div>
        <div className="text-center">
          <p className={`text-lg sm:text-2xl font-bold ${growthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {growthRate >= 0 ? '+' : ''}{growthRate}%
          </p>
          <p className="text-xs sm:text-sm text-gray-400">Growth</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex items-end gap-0.5 sm:gap-1 h-28 sm:h-40">
        {data.map((d, i) => {
          const height = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
          const isLast7 = i >= data.length - 7;
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative">
              <div 
                className={`w-full rounded-t transition-all ${
                  isLast7 ? 'bg-blue-500 hover:bg-blue-400' : 'bg-gray-600 hover:bg-gray-500'
                }`}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {d.date}: {d.count} users
              </div>
            </div>
          );
        })}
      </div>
      
      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>{data[0]?.date}</span>
        <span>{data[Math.floor(data.length / 2)]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span className="text-gray-400">Last 7 days</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-600 rounded" />
          <span className="text-gray-400">Previous days</span>
        </div>
      </div>
    </div>
  );
}
