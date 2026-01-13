"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  TrendingUp, 
  XCircle,
  Zap,
  Activity
} from "lucide-react";
import { retention } from "@/lib/posthog-events";

// Simple Card components
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>{children}</div>;
}
function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
}
function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
}
function CardDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-muted-foreground ${className}`}>{children}</p>;
}
function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

interface AnalyticsData {
  jobs: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
    queued: number;
  };
  credits: {
    balance: number;
    used: number;
  };
  successRate: number;
  avgProcessingTime: number;
  platforms: Record<string, number>;
  recentJobs: Array<{
    id: string;
    status: string;
    platform: string;
    createdAt: string;
  }>;
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend,
  loading 
}: { 
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className={`flex items-center text-xs mt-1 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className={`h-3 w-3 mr-1 ${!trend.positive && 'rotate-180'}`} />
            {trend.value}% from last week
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlatformBar({ name, count, total }: { name: string; count: number; total: number }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="capitalize">{name}</span>
        <span className="text-muted-foreground">{count} jobs</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function RecentJobItem({ job }: { job: AnalyticsData['recentJobs'][0] }) {
  const statusIcon = {
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    processing: <Activity className="h-4 w-4 text-blue-500 animate-pulse" />,
    queued: <Clock className="h-4 w-4 text-yellow-500" />,
  }[job.status] || <Clock className="h-4 w-4 text-muted-foreground" />;

  const timeAgo = getTimeAgo(new Date(job.createdAt));

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        {statusIcon}
        <div>
          <p className="text-sm font-medium capitalize">{job.platform}</p>
          <p className="text-xs text-muted-foreground">{job.id.slice(0, 12)}...</p>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{timeAgo}</span>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Track return session (check last visit timestamp)
    const lastVisit = localStorage.getItem('bl_last_dashboard_visit');
    if (lastVisit) {
      const lastVisitDate = new Date(lastVisit);
      const now = new Date();
      const hoursSince = (now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60);
      const daysSince = hoursSince / 24;
      
      // Only track if they've been away for at least 1 hour
      if (hoursSince >= 1) {
        retention.returnSession({
          days_since_last_visit: Math.floor(daysSince),
          hours_since_last_visit: Math.floor(hoursSince),
          is_first_return: daysSince >= 1,
        });
      }
    }
    // Update last visit timestamp
    localStorage.setItem('bl_last_dashboard_visit', new Date().toISOString());

    async function fetchAnalytics() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/analytics', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const result = await response.json();
        setData(result);
        
        // Track low credits warning if balance is low
        const LOW_CREDITS_THRESHOLD = 3;
        if (result.credits?.balance <= LOW_CREDITS_THRESHOLD && result.credits?.balance > 0) {
          retention.lowCreditsWarningShown({
            credits_balance: result.credits.balance,
            threshold: LOW_CREDITS_THRESHOLD,
            location: 'dashboard',
          });
        }
      } catch (err) {
        console.error('[Dashboard] Analytics fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Error: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPlatformJobs = data ? Object.values(data.platforms).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Your video processing analytics at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Jobs"
          value={data?.jobs.total || 0}
          description={`${data?.jobs.processing || 0} currently processing`}
          icon={BarChart3}
          loading={loading}
        />
        <StatCard
          title="Success Rate"
          value={`${data?.successRate || 0}%`}
          description={`${data?.jobs.completed || 0} completed successfully`}
          icon={CheckCircle2}
          loading={loading}
        />
        <StatCard
          title="Credits Balance"
          value={data?.credits.balance || 0}
          description={`${data?.credits.used || 0} credits used`}
          icon={CreditCard}
          loading={loading}
        />
        <StatCard
          title="Avg. Processing Time"
          value={formatTime(data?.avgProcessingTime || 0)}
          description="Per video"
          icon={Zap}
          loading={loading}
        />
      </div>

      {/* Secondary Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Usage</CardTitle>
            <CardDescription>Jobs processed by platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </>
            ) : data && Object.keys(data.platforms).length > 0 ? (
              Object.entries(data.platforms)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <PlatformBar 
                    key={name} 
                    name={name} 
                    count={count} 
                    total={totalPlatformJobs} 
                  />
                ))
            ) : (
              <p className="text-sm text-muted-foreground">No platform data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>Your latest processing jobs</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : data && data.recentJobs.length > 0 ? (
              <div>
                {data.recentJobs.map((job) => (
                  <RecentJobItem key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No jobs yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Job Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Job Status Overview</CardTitle>
          <CardDescription>Current status of all your jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex gap-4">
              <Skeleton className="h-20 flex-1" />
              <Skeleton className="h-20 flex-1" />
              <Skeleton className="h-20 flex-1" />
              <Skeleton className="h-20 flex-1" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {data?.jobs.completed || 0}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">Completed</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Activity className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {data?.jobs.processing || 0}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">Processing</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <Clock className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  {data?.jobs.queued || 0}
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">Queued</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {data?.jobs.failed || 0}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">Failed</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
