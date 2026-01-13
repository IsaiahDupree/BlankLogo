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
          total: totalRevenue / 100, // Convert cents to dollars
          last30d: revenueLast30d / 100,
          subscriptions: subscriptionRevenue / 100,
          oneTime: oneTimeRevenue / 100,
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

function ServiceHealthCheck() {
  const [health, setHealth] = useState<{
    worker: { status: string; latency: number } | null;
    modal: { status: string; latency: number } | null;
    web: { status: string; latency: number } | null;
  }>({
    worker: null,
    modal: null,
    web: null,
  });
  const [checking, setChecking] = useState(false);

  async function checkHealth() {
    setChecking(true);
    
    // Check Worker
    try {
      const start = Date.now();
      const res = await fetch("https://blanklogo-worker.onrender.com/health");
      const data = await res.json();
      setHealth(h => ({ ...h, worker: { status: data.status, latency: Date.now() - start } }));
    } catch {
      setHealth(h => ({ ...h, worker: { status: "error", latency: 0 } }));
    }

    // Check Modal
    try {
      const start = Date.now();
      const res = await fetch("https://isaiahdupree33--blanklogo-watermark-removal-health.modal.run");
      const data = await res.json();
      setHealth(h => ({ ...h, modal: { status: data.status, latency: Date.now() - start } }));
    } catch {
      setHealth(h => ({ ...h, modal: { status: "error", latency: 0 } }));
    }

    // Check Web
    try {
      const start = Date.now();
      const res = await fetch("https://www.blanklogo.app");
      setHealth(h => ({ ...h, web: { status: res.ok ? "ok" : "error", latency: Date.now() - start } }));
    } catch {
      setHealth(h => ({ ...h, web: { status: "error", latency: 0 } }));
    }

    setChecking(false);
  }

  useEffect(() => {
    checkHealth();
  }, []);

  const services = [
    { name: "Render Worker", key: "worker" as const },
    { name: "Modal Inpaint", key: "modal" as const },
    { name: "Web App", key: "web" as const },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400">Real-time service status</span>
        <button
          onClick={checkHealth}
          disabled={checking}
          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${checking ? "animate-spin" : ""}`} />
          Check Now
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {services.map(({ name, key }) => {
          const service = health[key];
          const isHealthy = service?.status === "ok" || service?.status === "healthy";
          
          return (
            <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
