/**
 * Health Monitoring Routes
 * Provides system health checks and metrics for monitoring
 */

import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import os from 'os';

const router = Router();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    api: ComponentHealth;
    database: ComponentHealth;
    redis: ComponentHealth;
    storage: ComponentHealth;
  };
  system: SystemMetrics;
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

interface SystemMetrics {
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  cpu: {
    loadAvg: number[];
    cores: number;
  };
  process: {
    pid: number;
    memoryUsage: number;
    uptime: number;
  };
}

const startTime = Date.now();

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
});

/**
 * GET /health/detailed
 * Detailed health check with all component statuses
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const checks = await runHealthChecks();
  
  const overallStatus = determineOverallStatus(checks);
  
  const health: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || '1.0.0',
    checks,
    system: getSystemMetrics(),
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * GET /health/ready
 * Kubernetes readiness probe
 */
router.get('/ready', async (req: Request, res: Response) => {
  const checks = await runHealthChecks();
  const isReady = checks.database.status === 'up' && checks.redis.status === 'up';
  
  if (isReady) {
    res.json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: 'Dependencies not ready' });
  }
});

/**
 * GET /health/live
 * Kubernetes liveness probe
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({ alive: true, timestamp: new Date().toISOString() });
});

/**
 * GET /health/metrics
 * Prometheus-compatible metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  const metrics = getSystemMetrics();
  const checks = await runHealthChecks();
  
  const prometheusMetrics = `
# HELP blanklogo_uptime_seconds Time since service started
# TYPE blanklogo_uptime_seconds gauge
blanklogo_uptime_seconds ${Math.floor((Date.now() - startTime) / 1000)}

# HELP blanklogo_memory_usage_bytes Memory usage in bytes
# TYPE blanklogo_memory_usage_bytes gauge
blanklogo_memory_usage_bytes ${metrics.process.memoryUsage}

# HELP blanklogo_memory_total_bytes Total system memory in bytes
# TYPE blanklogo_memory_total_bytes gauge
blanklogo_memory_total_bytes ${metrics.memory.total}

# HELP blanklogo_cpu_load_average CPU load average (1m)
# TYPE blanklogo_cpu_load_average gauge
blanklogo_cpu_load_average ${metrics.cpu.loadAvg[0]}

# HELP blanklogo_component_up Component health status (1=up, 0=down)
# TYPE blanklogo_component_up gauge
blanklogo_component_up{component="api"} ${checks.api.status === 'up' ? 1 : 0}
blanklogo_component_up{component="database"} ${checks.database.status === 'up' ? 1 : 0}
blanklogo_component_up{component="redis"} ${checks.redis.status === 'up' ? 1 : 0}
blanklogo_component_up{component="storage"} ${checks.storage.status === 'up' ? 1 : 0}

# HELP blanklogo_component_latency_ms Component response latency in milliseconds
# TYPE blanklogo_component_latency_ms gauge
blanklogo_component_latency_ms{component="database"} ${checks.database.latency || 0}
blanklogo_component_latency_ms{component="redis"} ${checks.redis.latency || 0}
`.trim();

  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
});

async function runHealthChecks(): Promise<HealthStatus['checks']> {
  const [dbCheck, redisCheck, storageCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
  ]);

  return {
    api: { status: 'up', latency: 0 },
    database: dbCheck,
    redis: redisCheck,
    storage: storageCheck,
  };
}

async function checkDatabase(): Promise<ComponentHealth> {
  if (!supabaseUrl || !supabaseKey) {
    return { status: 'down', message: 'Database not configured' };
  }

  const start = Date.now();
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from('bl_jobs').select('id').limit(1);
    const latency = Date.now() - start;

    if (error) {
      return { status: 'degraded', latency, message: error.message };
    }
    return { status: 'up', latency };
  } catch (err) {
    return { 
      status: 'down', 
      latency: Date.now() - start,
      message: err instanceof Error ? err.message : 'Connection failed' 
    };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    const redis = new Redis(REDIS_URL, { 
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    
    await redis.connect();
    await redis.ping();
    const latency = Date.now() - start;
    await redis.quit();
    
    return { status: 'up', latency };
  } catch (err) {
    return { 
      status: 'down', 
      latency: Date.now() - start,
      message: err instanceof Error ? err.message : 'Connection failed' 
    };
  }
}

async function checkStorage(): Promise<ComponentHealth> {
  if (!supabaseUrl || !supabaseKey) {
    return { status: 'down', message: 'Storage not configured' };
  }

  const start = Date.now();
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.storage.listBuckets();
    const latency = Date.now() - start;

    if (error) {
      return { status: 'degraded', latency, message: error.message };
    }
    return { status: 'up', latency };
  } catch (err) {
    return { 
      status: 'down', 
      latency: Date.now() - start,
      message: err instanceof Error ? err.message : 'Connection failed' 
    };
  }
}

function getSystemMetrics(): SystemMetrics {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usagePercent: Math.round((usedMem / totalMem) * 100),
    },
    cpu: {
      loadAvg: os.loadavg(),
      cores: os.cpus().length,
    },
    process: {
      pid: process.pid,
      memoryUsage: process.memoryUsage().heapUsed,
      uptime: process.uptime(),
    },
  };
}

function determineOverallStatus(checks: HealthStatus['checks']): HealthStatus['status'] {
  const statuses = Object.values(checks).map(c => c.status);
  
  if (statuses.every(s => s === 'up')) return 'healthy';
  if (statuses.some(s => s === 'down')) return 'unhealthy';
  return 'degraded';
}

export default router;
