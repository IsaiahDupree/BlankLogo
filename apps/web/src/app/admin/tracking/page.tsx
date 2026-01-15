"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  Activity,
  Eye,
  MousePointer,
  Clock,
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Monitor,
  Smartphone,
  Globe,
  Video,
  Upload,
  Link as LinkIcon,
  Zap,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Target,
  Users,
  Navigation,
} from "lucide-react";

const ADMIN_EMAILS = ["isaiahdupree33@gmail.com"];

interface TrackingEvent {
  id: string;
  event: string;
  timestamp: string;
  properties: Record<string, unknown>;
  user_id?: string;
}

interface BehaviorStats {
  pageViews: { page: string; count: number }[];
  avgScrollDepth: number;
  avgTimeOnPage: number;
  bounceRate: number;
  platformUsage: { platform: string; count: number }[];
  inputModeUsage: { url: number; upload: number };
  rageClicks: number;
  idleSessions: number;
  videoInteractions: { play: number; pause: number; seek: number; complete: number };
  formAbandonment: number;
  deviceBreakdown: { desktop: number; mobile: number; tablet: number };
}

function EventBadge({ event }: { event: string }) {
  const colors: Record<string, string> = {
    page_viewed: "bg-blue-500/20 text-blue-400",
    page_left: "bg-gray-500/20 text-gray-400",
    button_clicked: "bg-green-500/20 text-green-400",
    tab_switched: "bg-purple-500/20 text-purple-400",
    platform_selected: "bg-yellow-500/20 text-yellow-400",
    form_submitted: "bg-green-500/20 text-green-400",
    form_abandoned: "bg-red-500/20 text-red-400",
    video_play_started: "bg-indigo-500/20 text-indigo-400",
    video_ended: "bg-indigo-500/20 text-indigo-400",
    scroll_milestone: "bg-cyan-500/20 text-cyan-400",
    rage_click: "bg-red-500/20 text-red-400",
    user_idle: "bg-orange-500/20 text-orange-400",
    setting_changed: "bg-purple-500/20 text-purple-400",
  };

  const color = colors[event] || "bg-white/10 text-gray-400";

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {event.replace(/_/g, " ")}
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: "blue" | "green" | "red" | "yellow" | "purple" | "cyan";
}) {
  const colorClasses = {
    blue: "bg-blue-500/20 text-blue-400",
    green: "bg-green-500/20 text-green-400",
    red: "bg-red-500/20 text-red-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    purple: "bg-purple-500/20 text-purple-400",
    cyan: "bg-cyan-500/20 text-cyan-400",
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-gray-400 text-xs font-medium">{title}</h3>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function TrackingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [stats, setStats] = useState<BehaviorStats | null>(null);
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d">("24h");
  const [apiConfigured, setApiConfigured] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (authorized) {
      fetchTrackingData();
    }
  }, [authorized, timeRange]);

  async function checkAdminAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
        router.push("/admin");
        return;
      }
      setAuthorized(true);
    } catch {
      router.push("/admin");
    } finally {
      setLoading(false);
    }
  }

  async function fetchTrackingData() {
    setRefreshing(true);
    setFetchError(null);
    
    try {
      // Get auth token for API request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setFetchError("No auth session");
        setRefreshing(false);
        return;
      }

      // Fetch real data from PostHog API
      const response = await fetch(`/api/admin/posthog?timeRange=${timeRange}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.configured) {
        setApiConfigured(false);
        // Use sample data as fallback when API not configured
        setEvents(getSampleEvents());
        setStats(getSampleStats());
      } else {
        setApiConfigured(true);
        setEvents(data.events || []);
        setStats(data.stats || getSampleStats());
      }
    } catch (error) {
      console.error("Failed to fetch tracking data:", error);
      setFetchError(error instanceof Error ? error.message : "Failed to fetch data");
      // Fallback to sample data on error
      setEvents(getSampleEvents());
      setStats(getSampleStats());
    } finally {
      setRefreshing(false);
    }
  }

  // Sample data fallback
  function getSampleEvents(): TrackingEvent[] {
    return [
      { id: "1", event: "page_viewed", timestamp: new Date().toISOString(), properties: { page_path: "/app/remove" } },
      { id: "2", event: "platform_selected", timestamp: new Date(Date.now() - 60000).toISOString(), properties: { platform_id: "sora", platform_name: "Sora" } },
      { id: "3", event: "tab_switched", timestamp: new Date(Date.now() - 120000).toISOString(), properties: { from_tab: "url", to_tab: "upload" } },
      { id: "4", event: "scroll_milestone", timestamp: new Date(Date.now() - 180000).toISOString(), properties: { depth_percent: 75 } },
      { id: "5", event: "button_clicked", timestamp: new Date(Date.now() - 240000).toISOString(), properties: { button_text: "Remove Watermark" } },
    ];
  }

  function getSampleStats(): BehaviorStats {
    return {
      pageViews: [
        { page: "/app/remove", count: 245 },
        { page: "/app", count: 189 },
        { page: "/app/credits", count: 67 },
        { page: "/app/settings", count: 23 },
      ],
      avgScrollDepth: 68,
      avgTimeOnPage: 142,
      bounceRate: 24,
      platformUsage: [
        { platform: "auto", count: 156 },
        { platform: "sora", count: 89 },
        { platform: "runway", count: 45 },
        { platform: "pika", count: 32 },
        { platform: "kling", count: 18 },
      ],
      inputModeUsage: { url: 234, upload: 89 },
      rageClicks: 12,
      idleSessions: 34,
      videoInteractions: { play: 189, pause: 145, seek: 67, complete: 98 },
      formAbandonment: 18,
      deviceBreakdown: { desktop: 312, mobile: 145, tablet: 23 },
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 hover:bg-white/10 rounded-lg transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="w-6 h-6 text-cyan-400" />
                Live Tracking
              </h1>
              <p className="text-gray-400 text-sm">Real-time user behavior analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex bg-white/5 rounded-lg p-1">
              {(["1h", "24h", "7d"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded text-sm transition ${
                    timeRange === range
                      ? "bg-cyan-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            <button
              onClick={fetchTrackingData}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* API Status Banner */}
        {!apiConfigured && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium">PostHog API Not Configured</p>
              <p className="text-gray-400 text-sm mt-1">
                Showing sample data. To see live analytics, set <code className="bg-white/10 px-1 rounded">POSTHOG_PERSONAL_API_KEY</code> and <code className="bg-white/10 px-1 rounded">POSTHOG_PROJECT_ID</code> environment variables.
              </p>
            </div>
          </div>
        )}

        {fetchError && apiConfigured && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Failed to fetch data</p>
              <p className="text-gray-400 text-sm mt-1">{fetchError}</p>
            </div>
          </div>
        )}

        {apiConfigured && !fetchError && (
          <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <p className="text-green-400 text-sm">Live PostHog data</p>
          </div>
        )}

        {/* Key Metrics */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            Engagement Metrics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Avg Scroll Depth"
              value={`${stats?.avgScrollDepth || 0}%`}
              subtitle="how far users scroll"
              icon={TrendingUp}
              color="cyan"
            />
            <StatCard
              title="Avg Time on Page"
              value={`${Math.floor((stats?.avgTimeOnPage || 0) / 60)}m ${(stats?.avgTimeOnPage || 0) % 60}s`}
              subtitle="per page visit"
              icon={Clock}
              color="blue"
            />
            <StatCard
              title="Bounce Rate"
              value={`${stats?.bounceRate || 0}%`}
              subtitle="single page sessions"
              icon={Navigation}
              color="yellow"
            />
            <StatCard
              title="Rage Clicks"
              value={stats?.rageClicks || 0}
              subtitle="frustrated interactions"
              icon={AlertTriangle}
              color="red"
            />
          </div>
        </section>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Page Views */}
            <section className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-400" />
                Top Pages
              </h3>
              <div className="space-y-3">
                {stats?.pageViews.map((pv, i) => (
                  <div key={pv.page} className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{pv.page}</span>
                        <span className="text-sm text-gray-400">{pv.count}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(pv.count / (stats?.pageViews[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Platform Usage */}
            <section className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Platform Selection
              </h3>
              <div className="space-y-3">
                {stats?.platformUsage.map((p) => (
                  <div key={p.platform} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-20 capitalize">{p.platform}</span>
                    <div className="flex-1">
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-500 rounded-full"
                          style={{ width: `${(p.count / (stats?.platformUsage[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-400 w-12 text-right">{p.count}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Input Mode */}
            <section className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" />
                Input Method
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <LinkIcon className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                  <div className="text-2xl font-bold">{stats?.inputModeUsage.url || 0}</div>
                  <div className="text-xs text-gray-400">URL Paste</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                  <div className="text-2xl font-bold">{stats?.inputModeUsage.upload || 0}</div>
                  <div className="text-xs text-gray-400">File Upload</div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Live Event Stream */}
            <section className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400 animate-pulse" />
                Recent Events
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <EventBadge event={event.event} />
                      <span className="text-xs text-gray-400 truncate max-w-32">
                        {Object.values(event.properties)[0]?.toString() || ""}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Video Interactions */}
            <section className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Video className="w-4 h-4 text-indigo-400" />
                Video Player Interactions
              </h3>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <Play className="w-5 h-5 mx-auto mb-1 text-green-400" />
                  <div className="text-lg font-bold">{stats?.videoInteractions.play || 0}</div>
                  <div className="text-xs text-gray-400">Play</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <Pause className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
                  <div className="text-lg font-bold">{stats?.videoInteractions.pause || 0}</div>
                  <div className="text-xs text-gray-400">Pause</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <Activity className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                  <div className="text-lg font-bold">{stats?.videoInteractions.seek || 0}</div>
                  <div className="text-xs text-gray-400">Seek</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-400" />
                  <div className="text-lg font-bold">{stats?.videoInteractions.complete || 0}</div>
                  <div className="text-xs text-gray-400">Complete</div>
                </div>
              </div>
            </section>

            {/* Device Breakdown */}
            <section className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                Device Breakdown
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <Monitor className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                  <div className="text-xl font-bold">{stats?.deviceBreakdown.desktop || 0}</div>
                  <div className="text-xs text-gray-400">Desktop</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <Smartphone className="w-6 h-6 mx-auto mb-2 text-green-400" />
                  <div className="text-xl font-bold">{stats?.deviceBreakdown.mobile || 0}</div>
                  <div className="text-xs text-gray-400">Mobile</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <Monitor className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                  <div className="text-xl font-bold">{stats?.deviceBreakdown.tablet || 0}</div>
                  <div className="text-xs text-gray-400">Tablet</div>
                </div>
              </div>
            </section>

            {/* Session Quality */}
            <section className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Session Quality
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-400" />
                    <span className="text-sm">Idle Sessions</span>
                  </div>
                  <span className="text-lg font-bold">{stats?.idleSessions || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm">Form Abandons</span>
                  </div>
                  <span className="text-lg font-bold">{stats?.formAbandonment || 0}</span>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* PostHog Integration Note */}
        <div className="mt-8 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
          <h3 className="text-sm font-semibold text-cyan-400 mb-2">📊 PostHog Integration</h3>
          <p className="text-sm text-gray-400">
            This dashboard shows sample data. To see live data, connect the PostHog API with your project key.
            All events are being tracked in real-time and can be viewed in your{" "}
            <a
              href="https://us.posthog.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              PostHog dashboard
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
