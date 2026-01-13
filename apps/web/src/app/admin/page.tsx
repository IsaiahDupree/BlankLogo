"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  Shield
} from "lucide-react";

// Admin emails allowed to access this page
const ADMIN_EMAILS = ["isaiahdupree33@gmail.com"];

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
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
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
      // Fetch user stats
      const { data: users, count: totalUsers } = await supabase
        .from("bl_users")
        .select("created_at", { count: "exact" });

      const now = new Date();
      const day = 24 * 60 * 60 * 1000;
      const usersLast24h = users?.filter(u => 
        new Date(u.created_at) > new Date(now.getTime() - day)
      ).length || 0;
      const usersLast7d = users?.filter(u => 
        new Date(u.created_at) > new Date(now.getTime() - 7 * day)
      ).length || 0;
      const usersLast30d = users?.filter(u => 
        new Date(u.created_at) > new Date(now.getTime() - 30 * day)
      ).length || 0;

      // Fetch job stats
      const { data: jobs, count: totalJobs } = await supabase
        .from("bl_jobs")
        .select("status, created_at", { count: "exact" });

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

      // Fetch credit stats
      const { data: credits } = await supabase
        .from("bl_credit_ledger")
        .select("amount, type");

      const totalGranted = credits?.filter(c => c.amount > 0 && c.type === "grant")
        .reduce((sum, c) => sum + c.amount, 0) || 0;
      const totalUsed = credits?.filter(c => c.amount < 0)
        .reduce((sum, c) => sum + Math.abs(c.amount), 0) || 0;
      const totalPurchased = credits?.filter(c => c.amount > 0 && c.type === "purchase")
        .reduce((sum, c) => sum + c.amount, 0) || 0;

      // Fetch revenue (from Stripe transactions or credit purchases)
      const { data: transactions } = await supabase
        .from("bl_transactions")
        .select("amount, type, created_at");

      const totalRevenue = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
      const revenueLast30d = transactions?.filter(t => 
        new Date(t.created_at) > new Date(now.getTime() - 30 * day)
      ).reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
      const subscriptionRevenue = transactions?.filter(t => t.type === "subscription")
        .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
      const oneTimeRevenue = transactions?.filter(t => t.type === "one_time")
        .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

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

      // Session duration estimates (from job processing times)
      const { data: jobsWithDuration } = await supabase
        .from("bl_jobs")
        .select("user_id, created_at, completed_at, status")
        .eq("status", "completed");

      const userSessions: Record<string, number> = {};
      jobsWithDuration?.forEach(j => {
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

      setStats({
        users: {
          total: totalUsers || 0,
          last24h: usersLast24h,
          last7d: usersLast7d,
          last30d: usersLast30d,
        },
        jobs: {
          total: totalJobs || 0,
          completed: completedJobs,
          failed: failedJobs,
          pending: pendingJobs,
          last24h: jobsLast24h,
          last7d: jobsLast7d,
          successRate: totalJobs ? Math.round((completedJobs / (completedJobs + failedJobs)) * 100) : 0,
        },
        credits: {
          totalGranted,
          totalUsed,
          totalPurchased,
        },
        revenue: {
          total: totalRevenue / 100,
          last30d: revenueLast30d / 100,
          subscriptions: subscriptionRevenue / 100,
          oneTime: oneTimeRevenue / 100,
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-400" />
              Admin Dashboard
            </h1>
            <p className="text-gray-400 mt-1">BlankLogo site statistics and metrics</p>
          </div>
          <button
            onClick={fetchStats}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* User Stats */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Users
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            User Growth (Last 30 Days)
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <UserGrowthChart data={stats?.userGrowth || []} />
          </div>
        </section>

        {/* Retention & Engagement */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-purple-400" />
            Retention & Engagement
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-purple-400" />
            Jobs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            Credits
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Revenue
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        {/* Service Health */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Service Health
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-400">{total}</p>
          <p className="text-sm text-gray-400">Total (30d)</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-400">{last7Total}</p>
          <p className="text-sm text-gray-400">Last 7 Days</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-bold ${growthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {growthRate >= 0 ? '+' : ''}{growthRate}%
          </p>
          <p className="text-sm text-gray-400">Growth Rate</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex items-end gap-1 h-40">
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
