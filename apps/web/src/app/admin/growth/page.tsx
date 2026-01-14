"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { 
  TrendingUp, 
  Users, 
  UserCheck,
  DollarSign,
  Activity,
  BarChart3,
  PieChart,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Zap,
  Target,
  Clock
} from "lucide-react";

const ADMIN_EMAILS = ["isaiahdupree33@gmail.com"];

interface GrowthStats {
  funnel: {
    totalUsers: number;
    activatedUsers: number;
    paidUsers: number;
    activationRate: number;
    paidRate: number;
  };
  activeUsers: {
    dau: number;
    wau: number;
    mau: number;
    stickiness: number;
  };
  segments: {
    power: number;
    regular: number;
    casual: number;
    dormant: number;
  };
  sources: Record<string, number>;
  trends: {
    dauTrend: number[];
    wauTrend: number[];
  };
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color = "blue",
  large = false
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: React.ElementType;
  color?: "blue" | "green" | "red" | "yellow" | "purple";
  large?: boolean;
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
      <p className={`font-bold ${large ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>{value}</p>
      {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function FunnelStep({ 
  label, 
  value, 
  rate, 
  isLast = false 
}: { 
  label: string; 
  value: number; 
  rate?: number;
  isLast?: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="bg-gradient-to-b from-blue-500/20 to-purple-500/20 border border-white/10 rounded-xl p-4 w-full text-center">
        <p className="text-2xl sm:text-3xl font-bold text-white">{value}</p>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">{label}</p>
      </div>
      {!isLast && (
        <div className="flex items-center gap-2 my-2">
          <div className="w-8 h-0.5 bg-gray-600"></div>
          {rate !== undefined && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${rate >= 50 ? 'bg-green-500/20 text-green-400' : rate >= 20 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
              {rate}%
            </span>
          )}
          <div className="w-8 h-0.5 bg-gray-600"></div>
        </div>
      )}
    </div>
  );
}

function SegmentBar({ segments }: { segments: GrowthStats['segments'] }) {
  const total = segments.power + segments.regular + segments.casual + segments.dormant;
  if (total === 0) return <div className="text-gray-400 text-center py-4">No user data</div>;

  const getWidth = (count: number) => Math.max((count / total) * 100, 0);

  return (
    <div className="space-y-3">
      <div className="flex h-8 rounded-lg overflow-hidden">
        <div 
          className="bg-purple-500 flex items-center justify-center text-xs font-medium"
          style={{ width: `${getWidth(segments.power)}%` }}
        >
          {segments.power > 0 && segments.power}
        </div>
        <div 
          className="bg-blue-500 flex items-center justify-center text-xs font-medium"
          style={{ width: `${getWidth(segments.regular)}%` }}
        >
          {segments.regular > 0 && segments.regular}
        </div>
        <div 
          className="bg-green-500 flex items-center justify-center text-xs font-medium"
          style={{ width: `${getWidth(segments.casual)}%` }}
        >
          {segments.casual > 0 && segments.casual}
        </div>
        <div 
          className="bg-gray-500 flex items-center justify-center text-xs font-medium"
          style={{ width: `${getWidth(segments.dormant)}%` }}
        >
          {segments.dormant > 0 && segments.dormant}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-500"></div>
          <span className="text-gray-400">Power ({segments.power})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500"></div>
          <span className="text-gray-400">Regular ({segments.regular})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span className="text-gray-400">Casual ({segments.casual})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gray-500"></div>
          <span className="text-gray-400">Dormant ({segments.dormant})</span>
        </div>
      </div>
    </div>
  );
}

function SourcesList({ sources }: { sources: Record<string, number> }) {
  const entries = Object.entries(sources).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  
  if (entries.length === 0) {
    return <div className="text-gray-400 text-center py-4">No source data available</div>;
  }

  return (
    <div className="space-y-2">
      {entries.slice(0, 8).map(([source, count]) => {
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={source} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300 capitalize">{source || 'Direct'}</span>
                <span className="text-gray-400">{count} ({percentage}%)</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function GrowthCenterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState<GrowthStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    checkAdminAccess();
  }, []);

  async function checkAdminAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login?redirect=/admin/growth");
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
      const now = new Date();
      const day = 24 * 60 * 60 * 1000;

      // Fetch all users
      const { data: users } = await supabase
        .from("bl_user_profiles")
        .select("id, email, created_at");

      // Fetch all jobs with user info
      const { data: jobs } = await supabase
        .from("bl_jobs")
        .select("user_id, status, created_at");

      // Fetch credit purchases
      const { data: credits } = await supabase
        .from("bl_credit_ledger")
        .select("user_id, delta, reason, type");

      // Fetch auth events for UTM data
      const { data: authEvents } = await supabase
        .from("bl_auth_events")
        .select("user_id, metadata, created_at")
        .eq("event_type", "signup");

      // Calculate funnel metrics
      const totalUsers = users?.length || 0;
      
      // Users with at least 1 completed job
      const usersWithJobs = new Set(
        jobs?.filter(j => j.status === 'completed').map(j => j.user_id) || []
      );
      const activatedUsers = usersWithJobs.size;

      // Users who made a purchase
      const paidUserIds = new Set(
        credits?.filter(c => 
          c.delta > 0 && (c.reason === 'purchase' || c.type === 'purchase')
        ).map(c => c.user_id) || []
      );
      const paidUsers = paidUserIds.size;

      // Calculate rates
      const activationRate = totalUsers > 0 ? Math.round((activatedUsers / totalUsers) * 100) : 0;
      const paidRate = activatedUsers > 0 ? Math.round((paidUsers / activatedUsers) * 100) : 0;

      // Calculate DAU/WAU/MAU
      const jobsLast24h = jobs?.filter(j => 
        new Date(j.created_at) > new Date(now.getTime() - day)
      ) || [];
      const jobsLast7d = jobs?.filter(j => 
        new Date(j.created_at) > new Date(now.getTime() - 7 * day)
      ) || [];
      const jobsLast30d = jobs?.filter(j => 
        new Date(j.created_at) > new Date(now.getTime() - 30 * day)
      ) || [];

      const dau = new Set(jobsLast24h.map(j => j.user_id)).size;
      const wau = new Set(jobsLast7d.map(j => j.user_id)).size;
      const mau = new Set(jobsLast30d.map(j => j.user_id)).size;
      const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

      // Calculate user segments
      const userJobCounts: Record<string, number> = {};
      jobs?.filter(j => j.status === 'completed').forEach(j => {
        userJobCounts[j.user_id] = (userJobCounts[j.user_id] || 0) + 1;
      });

      let power = 0, regular = 0, casual = 0, dormant = 0;
      users?.forEach(u => {
        const jobCount = userJobCounts[u.id] || 0;
        if (jobCount >= 10) power++;
        else if (jobCount >= 3) regular++;
        else if (jobCount >= 1) casual++;
        else dormant++;
      });

      // Extract UTM sources from auth events
      const sources: Record<string, number> = {};
      authEvents?.forEach(e => {
        const metadata = e.metadata as { utm_source?: string } | null;
        const source = metadata?.utm_source || 'direct';
        sources[source] = (sources[source] || 0) + 1;
      });

      // If no UTM data, create default
      if (Object.keys(sources).length === 0) {
        sources['direct'] = totalUsers;
      }

      setStats({
        funnel: {
          totalUsers,
          activatedUsers,
          paidUsers,
          activationRate,
          paidRate,
        },
        activeUsers: {
          dau,
          wau,
          mau,
          stickiness,
        },
        segments: {
          power,
          regular,
          casual,
          dormant,
        },
        sources,
        trends: {
          dauTrend: [],
          wauTrend: [],
        },
      });
    } catch (err) {
      console.error("Failed to fetch growth stats:", err);
      setError("Failed to load growth statistics");
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
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/" className="text-blue-400 hover:underline">
            Return to Home
          </Link>
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
            <div className="flex items-center gap-3 mb-2">
              <Link 
                href="/admin" 
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
                Growth Center
              </h1>
            </div>
            <p className="text-gray-400 text-sm sm:text-base ml-12">User acquisition, conversion & engagement metrics</p>
          </div>
          <button
            onClick={fetchStats}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Conversion Funnel */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            Conversion Funnel
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-2 items-center justify-between">
              <FunnelStep 
                label="Total Users" 
                value={stats?.funnel.totalUsers || 0} 
              />
              <div className="hidden sm:flex items-center">
                <div className="w-8 h-0.5 bg-gray-600"></div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded mx-2 ${
                  (stats?.funnel.activationRate || 0) >= 50 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {stats?.funnel.activationRate || 0}%
                </span>
                <div className="w-8 h-0.5 bg-gray-600"></div>
              </div>
              <FunnelStep 
                label="Activated" 
                value={stats?.funnel.activatedUsers || 0}
              />
              <div className="hidden sm:flex items-center">
                <div className="w-8 h-0.5 bg-gray-600"></div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded mx-2 ${
                  (stats?.funnel.paidRate || 0) >= 20 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {stats?.funnel.paidRate || 0}%
                </span>
                <div className="w-8 h-0.5 bg-gray-600"></div>
              </div>
              <FunnelStep 
                label="Paid" 
                value={stats?.funnel.paidUsers || 0}
                isLast
              />
            </div>
            <div className="sm:hidden flex justify-center gap-4 mt-4 text-xs text-gray-400">
              <span>Activation: {stats?.funnel.activationRate || 0}%</span>
              <span>Paid: {stats?.funnel.paidRate || 0}%</span>
            </div>
          </div>
        </section>

        {/* Active Users */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
            Active Users
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <StatCard 
              title="DAU" 
              value={stats?.activeUsers.dau || 0} 
              subtitle="Daily Active"
              icon={Users} 
              color="blue"
              large
            />
            <StatCard 
              title="WAU" 
              value={stats?.activeUsers.wau || 0} 
              subtitle="Weekly Active"
              icon={Users} 
              color="green"
              large
            />
            <StatCard 
              title="MAU" 
              value={stats?.activeUsers.mau || 0} 
              subtitle="Monthly Active"
              icon={Users} 
              color="purple"
              large
            />
            <StatCard 
              title="Stickiness" 
              value={`${stats?.activeUsers.stickiness || 0}%`} 
              subtitle="DAU/MAU ratio"
              icon={Zap} 
              color="yellow"
              large
            />
          </div>
        </section>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* User Segments */}
          <section>
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              User Segments
            </h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
              <div className="mb-4 text-sm text-gray-400">
                <p><strong>Power:</strong> 10+ jobs | <strong>Regular:</strong> 3-9 jobs | <strong>Casual:</strong> 1-2 jobs | <strong>Dormant:</strong> 0 jobs</p>
              </div>
              {stats?.segments && <SegmentBar segments={stats.segments} />}
            </div>
          </section>

          {/* Traffic Sources */}
          <section>
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              Traffic Sources
            </h2>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
              {stats?.sources && <SourcesList sources={stats.sources} />}
            </div>
          </section>
        </div>

        {/* Quick Stats Summary */}
        <section className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            Quick Insights
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Activation Rate</p>
              <p className="text-2xl font-bold mt-1">{stats?.funnel.activationRate || 0}%</p>
              <p className="text-xs text-gray-500 mt-1">Users who completed a job</p>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-white/10 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Paid Conversion</p>
              <p className="text-2xl font-bold mt-1">{stats?.funnel.paidRate || 0}%</p>
              <p className="text-xs text-gray-500 mt-1">Activated users who paid</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-white/10 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Power Users</p>
              <p className="text-2xl font-bold mt-1">{stats?.segments.power || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Users with 10+ jobs</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
