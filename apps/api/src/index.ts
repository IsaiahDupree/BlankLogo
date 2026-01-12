import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import os from 'os';
import { validateVideoUrl } from './utils/urlValidator.js';
import { jobsRateLimiter, apiRateLimiter } from './middleware/rateLimiter.js';

config();

const app: express.Application = express();
const PORT = process.env.PORT || 8989;

// ═══════════════════════════════════════════════════════════════════
// SERVICE STATE MACHINE & STRUCTURED LOGGING
// ═══════════════════════════════════════════════════════════════════

type ServiceState = 'starting' | 'ready' | 'degraded' | 'stopping' | 'stopped' | 'crashed';
type LifecycleEvent = 'STARTING' | 'READY' | 'STOPPING' | 'STOPPED' | 'CRASH' | 
                      'DEPENDENCY_DOWN' | 'DEPENDENCY_UP' | 'READY_TIMEOUT' | 'CRASH_LOOP' |
                      'CAPABILITIES_ANNOUNCED' | 'CAPABILITIES_CHANGED' | 'INCOMPATIBLE_CAPABILITIES';

const SERVICE_NAME = 'api';
const RUN_ID = `${SERVICE_NAME}-${uuidv4().slice(0, 8)}`;
const INSTANCE_ID = `${os.hostname()}:${PORT}`;
const startTimestamp = Date.now();
const BUILD_VERSION = process.env.BUILD_VERSION || '1.0.0';
const BUILD_COMMIT = process.env.BUILD_COMMIT || 'dev';
const PROTOCOL_VERSION = 1;

// ═══════════════════════════════════════════════════════════════════
// CAPABILITIES DEFINITION
// ═══════════════════════════════════════════════════════════════════

interface ServiceCapabilities {
  schema: string;
  service: string;
  run_id: string;
  instance_id: string;
  build: {
    version: string;
    commit: string;
    built_at: string;
  };
  protocol: {
    name: string;
    version: number;
  };
  endpoints: Record<string, string>;
  features: Record<string, boolean | string>;
  events: {
    produces: string[];
    consumes: string[];
  };
  dependencies: Array<{
    name: string;
    required: boolean;
    min_protocol_version: number;
  }>;
  limits: {
    max_payload_kb: number;
    rate_limit_rps: number;
    max_video_size_mb: number;
  };
}

let capabilities: ServiceCapabilities = {
  schema: 'capabilities/v1',
  service: SERVICE_NAME,
  run_id: RUN_ID,
  instance_id: INSTANCE_ID,
  build: {
    version: BUILD_VERSION,
    commit: BUILD_COMMIT,
    built_at: new Date().toISOString(),
  },
  protocol: {
    name: 'blanklogo-api',
    version: PROTOCOL_VERSION,
  },
  endpoints: {
    healthz: '/healthz',
    readyz: '/readyz',
    capabilities: '/capabilities',
    status: '/status',
    jobs: '/api/v1/jobs',
    platforms: '/api/v1/platforms',
  },
  features: {
    watermark_removal: true,
    batch_processing: true,
    webhook_notifications: true,
    inpaint_mode: process.env.ENABLE_INPAINT === 'true',
    custom_crop: true,
  },
  events: {
    produces: ['JOB_CREATED', 'JOB_COMPLETED', 'JOB_FAILED', 'STATUS_CHANGED', 'CAPABILITIES_CHANGED'],
    consumes: ['PROCESS_VIDEO'],
  },
  dependencies: [
    { name: 'redis', required: true, min_protocol_version: 1 },
    { name: 'supabase', required: true, min_protocol_version: 1 },
    { name: 'worker', required: false, min_protocol_version: 1 },
  ],
  limits: {
    max_payload_kb: 512,
    rate_limit_rps: 60,
    max_video_size_mb: 500,
  },
};

// Track dependency capabilities
const dependencyCapabilities: Record<string, ServiceCapabilities | null> = {
  worker: null,
};

// Check if a dependency is compatible
function checkDependencyCompatibility(depName: string, depCaps: ServiceCapabilities | null): { compatible: boolean; reason?: string } {
  if (!depCaps) {
    return { compatible: true }; // Can't check if no caps available
  }
  
  const dep = capabilities.dependencies.find(d => d.name === depName);
  if (!dep) {
    return { compatible: true };
  }
  
  if (depCaps.protocol.version < dep.min_protocol_version) {
    return {
      compatible: false,
      reason: `${depName} protocol version ${depCaps.protocol.version} < required ${dep.min_protocol_version}`,
    };
  }
  
  return { compatible: true };
}

let currentState: ServiceState = 'starting';
let previousState: ServiceState = 'stopped';

// Dependency status tracking
const dependencies = {
  redis: { up: false, lastCheck: 0, consecutiveFailures: 0, consecutiveSuccesses: 0 },
  supabase: { up: false, lastCheck: 0, consecutiveFailures: 0, consecutiveSuccesses: 0 },
};

// Structured log function
function logEvent(event: LifecycleEvent, reason: string, extra?: Record<string, unknown>) {
  const logEntry = {
    ts: new Date().toISOString(),
    service: SERVICE_NAME,
    event,
    state: currentState,
    reason,
    run_id: RUN_ID,
    uptime_ms: Date.now() - startTimestamp,
    ...extra,
  };
  console.log(JSON.stringify(logEntry));
}

// State transition function
function setState(newState: ServiceState, reason: string) {
  if (newState === currentState) return;
  
  previousState = currentState;
  currentState = newState;
  
  const eventMap: Record<ServiceState, LifecycleEvent> = {
    starting: 'STARTING',
    ready: 'READY',
    degraded: 'DEPENDENCY_DOWN',
    stopping: 'STOPPING',
    stopped: 'STOPPED',
    crashed: 'CRASH',
  };
  
  logEvent(eventMap[newState], reason, { previous_state: previousState });
}

// Update dependency status (only log on transitions)
function updateDependency(name: keyof typeof dependencies, isUp: boolean, reason?: string) {
  const dep = dependencies[name];
  const wasUp = dep.up;
  
  if (isUp) {
    dep.consecutiveSuccesses++;
    dep.consecutiveFailures = 0;
    if (dep.consecutiveSuccesses >= 2 && !dep.up) {
      dep.up = true;
      logEvent('DEPENDENCY_UP', `${name} is now available`, { dependency: name });
    }
  } else {
    dep.consecutiveFailures++;
    dep.consecutiveSuccesses = 0;
    if (dep.consecutiveFailures >= 2 && dep.up) {
      dep.up = false;
      logEvent('DEPENDENCY_DOWN', reason || `${name} is unavailable`, { dependency: name });
    }
  }
  
  dep.lastCheck = Date.now();
  
  // Update overall state based on dependencies
  const allDepsUp = Object.values(dependencies).every(d => d.up);
  if (currentState === 'ready' && !allDepsUp) {
    setState('degraded', `Dependency ${name} is down`);
  } else if (currentState === 'degraded' && allDepsUp) {
    setState('ready', 'All dependencies restored');
  }
}

// Announce capabilities (log + optional registry)
async function announceCapabilities(trigger: 'startup' | 'ready' | 'config_change' | 'shutdown') {
  logEvent('CAPABILITIES_ANNOUNCED', `Capabilities announced on ${trigger}`, {
    capabilities: {
      schema: capabilities.schema,
      service: capabilities.service,
      version: capabilities.build.version,
      protocol_version: capabilities.protocol.version,
      features: Object.keys(capabilities.features).filter(k => capabilities.features[k]),
    },
    trigger,
  });
  
  // If a registry URL is configured, POST to it
  const registryUrl = process.env.REGISTRY_URL;
  if (registryUrl) {
    try {
      await fetch(`${registryUrl}/registry/announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: currentState,
          capabilities,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('[REGISTRY] Failed to announce capabilities:', err);
    }
  }
}

// Update and announce capability changes
function updateCapability(feature: string, value: boolean | string) {
  const oldValue = capabilities.features[feature];
  if (oldValue === value) return;
  
  capabilities.features[feature] = value;
  logEvent('CAPABILITIES_CHANGED', `Feature ${feature} changed from ${oldValue} to ${value}`, {
    feature,
    old_value: oldValue,
    new_value: value,
  });
  
  announceCapabilities('config_change');
}

// Log startup
logEvent('STARTING', 'API server initializing', { port: PORT });
announceCapabilities('startup');

// Redis connection with error handling
let redis: Redis | null = null;
let redisConnected = false;

try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  redis.on('connect', () => {
    console.log('[REDIS] ✅ Connected');
    redisConnected = true;
  });

  redis.on('error', (err) => {
    console.error('[REDIS] ❌ Connection error:', err.message);
    redisConnected = false;
  });

  redis.on('close', () => {
    console.log('[REDIS] 🔌 Connection closed');
    redisConnected = false;
  });

  // Try to connect but don't block
  redis.connect().catch((err) => {
    console.error('[REDIS] ❌ Initial connection failed:', err.message);
  });
} catch (err) {
  console.error('[REDIS] ❌ Failed to initialize Redis:', err);
}

// Job queue (may be null if Redis unavailable)
let jobQueue: Queue | null = null;
if (redis) {
  try {
    jobQueue = new Queue('watermark-removal', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
    console.log('[QUEUE] ✅ Job queue initialized');
  } catch (err) {
    console.error('[QUEUE] ❌ Failed to initialize job queue:', err);
  }
}

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));

// CORS - allow all origins (fixed 2026-01-08)
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
}));
app.use(express.json());

// Authentication middleware
interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email?: string;
  };
}

const authenticateToken = async (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  console.log('[AUTH] 🔐 Checking authentication...');

  if (!token) {
    console.log('[AUTH] ❌ No token provided');
    return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
  }

  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log('[AUTH] ❌ Invalid or expired token:', error?.message);
      return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    }

    console.log('[AUTH] ✅ Authenticated user:', user.id);
    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    console.error('[AUTH] ❌ Auth error:', err);
    return res.status(401).json({ error: 'Authentication failed', code: 'AUTH_ERROR' });
  }
};

// Optional auth - allows unauthenticated but attaches user if token present
const optionalAuth = async (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        req.user = { id: user.id, email: user.email };
        console.log('[AUTH] ✅ Optional auth: user attached:', user.id);
      }
    } catch {
      // Ignore errors for optional auth
    }
  }
  next();
};

// File upload config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, MOV, WebM, AVI allowed.'));
    }
  },
});

// Types
type ProcessingMode = 'crop' | 'inpaint' | 'auto';

interface JobData {
  jobId: string;
  inputUrl?: string;
  inputFilename: string;
  cropPixels: number;
  cropPosition: 'top' | 'bottom' | 'left' | 'right';
  platform: string;
  processingMode: ProcessingMode;
  webhookUrl?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

interface JobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  current_step?: string;
  input?: {
    filename: string;
    sizeBytes?: number;
    durationSec?: number;
    url?: string;  // Original video URL for before/after comparison
  };
  output?: {
    filename: string;
    sizeBytes?: number;
    downloadUrl?: string;
    expiresAt?: string;
  };
  error?: string;
  processingTimeMs?: number;
  createdAt: string;
  completedAt?: string;
}

// Platform-specific crop presets
const PLATFORM_PRESETS: Record<string, { cropPixels: number; cropPosition: 'bottom' | 'top' }> = {
  auto: { cropPixels: 0, cropPosition: 'bottom' },       // Auto-detect watermark
  sora: { cropPixels: 120, cropPosition: 'bottom' },
  tiktok: { cropPixels: 80, cropPosition: 'bottom' },
  runway: { cropPixels: 60, cropPosition: 'bottom' },
  pika: { cropPixels: 50, cropPosition: 'bottom' },
  midjourney: { cropPixels: 40, cropPosition: 'bottom' },
  kling: { cropPixels: 70, cropPosition: 'bottom' },
  luma: { cropPixels: 55, cropPosition: 'bottom' },
  instagram: { cropPixels: 0, cropPosition: 'bottom' },  // Meta/Instagram Reels
  facebook: { cropPixels: 0, cropPosition: 'bottom' },   // Meta/Facebook Videos
  meta: { cropPixels: 0, cropPosition: 'bottom' },       // Generic Meta watermarks
  custom: { cropPixels: 100, cropPosition: 'bottom' },
};

// Track server start time and request counts
const serverStartTime = new Date();
let requestCount = 0;
let errorCount = 0;

// Request counter middleware
app.use((req, res, next) => {
  requestCount++;
  res.on('finish', () => {
    if (res.statusCode >= 400) errorCount++;
  });
  next();
});

// ═══════════════════════════════════════════════════════════════════
// KUBERNETES-STYLE HEALTH ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

// /healthz - Liveness probe (is process alive?)
app.get('/healthz', (req, res) => {
  // Always return 200 if the process is running
  res.status(200).json({
    status: 'alive',
    service: SERVICE_NAME,
    run_id: RUN_ID,
    state: currentState,
    uptime_ms: Date.now() - startTimestamp,
    timestamp: new Date().toISOString(),
  });
});

// /capabilities - What this service can do
app.get('/capabilities', (req, res) => {
  res.status(200).json({
    ...capabilities,
    state: currentState,
    uptime_ms: Date.now() - startTimestamp,
    timestamp: new Date().toISOString(),
    compatibility: {
      status: 'ok',
      issues: [],
    },
  });
});

// /capabilities/download - Worker download capabilities for frontend
app.get('/capabilities/download', (req, res) => {
  const isCloud = !!(process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL);
  res.status(200).json({
    methods: [
      { name: 'direct', available: true, description: 'Direct fetch for .mp4 URLs' },
      { name: 'curl', available: true, description: 'curl with browser headers' },
      { name: 'puppeteer', available: true, description: 'Headless browser with stealth' },
      { name: 'puppeteer-stealth', available: true, description: 'Cloudflare bypass' },
      { name: 'yt-dlp', available: !process.env.VERCEL, description: '1000+ video sites' },
      { name: 'browserless', available: !!(process.env.BROWSERLESS_URL || process.env.BROWSERLESS_TOKEN), description: 'Cloud browser service' },
    ],
    environment: isCloud ? 'cloud' : 'local',
    notifications: {
      resend: !!process.env.RESEND_API_KEY,
      devEmail: process.env.DEV_NOTIFICATION_EMAIL ? 'configured' : 'default',
    },
    supported_sources: [
      'Direct video URLs (.mp4, .webm, .mov)',
      'YouTube, Vimeo, Twitter/X',
      'Sora (sora.chatgpt.com)',
      'Most video hosting platforms',
      'File upload',
    ],
    tips: [
      'For best results, right-click video → "Copy video address"',
      'Direct .mp4 URLs are fastest',
      'Upload files directly if URL fails',
    ],
  });
});

// /readyz - Readiness probe (can accept traffic?)
app.get('/readyz', async (req, res) => {
  // Check all dependencies
  let redisOk = false;
  let supabaseOk = false;
  
  // Redis check
  if (redis) {
    try {
      await redis.ping();
      redisOk = true;
      updateDependency('redis', true);
    } catch (err) {
      updateDependency('redis', false, `Redis ping failed: ${err}`);
    }
  }
  
  // Supabase check
  try {
    const { error } = await supabase.from('bl_jobs').select('id').limit(1);
    supabaseOk = !error;
    updateDependency('supabase', supabaseOk, error?.message);
  } catch (err) {
    updateDependency('supabase', false, `Supabase query failed: ${err}`);
  }
  
  const isReady = redisOk && supabaseOk && !!jobQueue;
  
  // Update state if needed
  if (isReady && currentState === 'starting') {
    setState('ready', 'All dependencies available');
  } else if (isReady && currentState === 'degraded') {
    setState('ready', 'Dependencies restored');
  } else if (!isReady && currentState === 'ready') {
    setState('degraded', 'One or more dependencies unavailable');
  }
  
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    service: SERVICE_NAME,
    run_id: RUN_ID,
    state: currentState,
    uptime_ms: Date.now() - startTimestamp,
    timestamp: new Date().toISOString(),
    checks: {
      redis: { up: redisOk, consecutive_failures: dependencies.redis.consecutiveFailures },
      supabase: { up: supabaseOk, consecutive_failures: dependencies.supabase.consecutiveFailures },
      queue: { up: !!jobQueue },
    },
  });
});

// Legacy endpoints (keep for backward compatibility)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      redis: redisConnected ? 'connected' : 'disconnected',
      queue: jobQueue ? 'ready' : 'unavailable',
    }
  });
});

app.get('/live', (req, res) => {
  res.status(200).json({ alive: true, timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  const checks = {
    redis: redisConnected,
    queue: !!jobQueue,
    supabase: false,
  };

  try {
    const { error } = await supabase.from('bl_jobs').select('id').limit(1);
    checks.supabase = !error;
  } catch {
    checks.supabase = false;
  }

  const isReady = checks.redis && checks.queue && checks.supabase;
  
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    timestamp: new Date().toISOString(),
    checks,
  });
});

// Comprehensive status endpoint
app.get('/status', async (req, res) => {
  console.log('[STATUS] Full status check requested');
  
  const uptime = Math.floor((Date.now() - serverStartTime.getTime()) / 1000);
  
  // Redis ping check
  let redisPing = false;
  let redisLatency = -1;
  if (redis) {
    try {
      const start = Date.now();
      await redis.ping();
      redisLatency = Date.now() - start;
      redisPing = true;
    } catch (err) {
      console.error('[STATUS] Redis ping failed:', err);
    }
  }

  // Supabase check
  let supabaseOk = false;
  let supabaseLatency = -1;
  try {
    const start = Date.now();
    const { error } = await supabase.from('bl_jobs').select('id').limit(1);
    supabaseLatency = Date.now() - start;
    supabaseOk = !error;
  } catch (err) {
    console.error('[STATUS] Supabase check failed:', err);
  }

  // Queue stats
  let queueStats = null;
  if (jobQueue) {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        jobQueue.getWaitingCount(),
        jobQueue.getActiveCount(),
        jobQueue.getCompletedCount(),
        jobQueue.getFailedCount(),
      ]);
      queueStats = { waiting, active, completed, failed };
    } catch (err) {
      console.error('[STATUS] Queue stats failed:', err);
    }
  }

  const status = {
    status: 'operational',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptime,
      human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
    },
    stats: {
      requestCount,
      errorCount,
      errorRate: requestCount > 0 ? ((errorCount / requestCount) * 100).toFixed(2) + '%' : '0%',
    },
    services: {
      redis: {
        connected: redisConnected,
        ping: redisPing,
        latencyMs: redisLatency,
      },
      queue: {
        available: !!jobQueue,
        stats: queueStats,
      },
      supabase: {
        connected: supabaseOk,
        latencyMs: supabaseLatency,
      },
    },
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    },
  };

  // Determine overall health
  const allHealthy = redisConnected && redisPing && supabaseOk && !!jobQueue;
  if (!allHealthy) {
    status.status = 'degraded';
  }

  console.log('[STATUS] Response:', status.status);
  res.json(status);
});

// ═══════════════════════════════════════════════════════════════════
// DIAGNOSTICS ENDPOINT - Self-test all connections
// ═══════════════════════════════════════════════════════════════════
app.get('/diagnostics', async (req, res) => {
  console.log('[DIAGNOSTICS] Running comprehensive diagnostics...');
  const startTime = Date.now();
  
  interface TestResult {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    latencyMs: number;
    details?: string;
    error?: string;
  }
  
  const tests: TestResult[] = [];
  
  // Test 1: Redis Connection
  const redisStart = Date.now();
  try {
    if (redis) {
      const pong = await redis.ping();
      tests.push({
        name: 'redis_connection',
        status: pong === 'PONG' ? 'pass' : 'fail',
        latencyMs: Date.now() - redisStart,
        details: `Response: ${pong}`,
      });
    } else {
      tests.push({
        name: 'redis_connection',
        status: 'fail',
        latencyMs: Date.now() - redisStart,
        error: 'Redis client not initialized',
      });
    }
  } catch (err) {
    tests.push({
      name: 'redis_connection',
      status: 'fail',
      latencyMs: Date.now() - redisStart,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
  
  // Test 2: Redis Read/Write
  const redisRWStart = Date.now();
  try {
    if (redis) {
      const testKey = `diag_test_${Date.now()}`;
      await redis.set(testKey, 'test_value', 'EX', 10);
      const value = await redis.get(testKey);
      await redis.del(testKey);
      tests.push({
        name: 'redis_read_write',
        status: value === 'test_value' ? 'pass' : 'fail',
        latencyMs: Date.now() - redisRWStart,
        details: 'SET/GET/DEL cycle completed',
      });
    } else {
      tests.push({
        name: 'redis_read_write',
        status: 'fail',
        latencyMs: Date.now() - redisRWStart,
        error: 'Redis client not available',
      });
    }
  } catch (err) {
    tests.push({
      name: 'redis_read_write',
      status: 'fail',
      latencyMs: Date.now() - redisRWStart,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
  
  // Test 3: BullMQ Queue
  const queueStart = Date.now();
  try {
    if (jobQueue) {
      const [waiting, active] = await Promise.all([
        jobQueue.getWaitingCount(),
        jobQueue.getActiveCount(),
      ]);
      tests.push({
        name: 'bullmq_queue',
        status: 'pass',
        latencyMs: Date.now() - queueStart,
        details: `Waiting: ${waiting}, Active: ${active}`,
      });
    } else {
      tests.push({
        name: 'bullmq_queue',
        status: 'fail',
        latencyMs: Date.now() - queueStart,
        error: 'Job queue not initialized',
      });
    }
  } catch (err) {
    tests.push({
      name: 'bullmq_queue',
      status: 'fail',
      latencyMs: Date.now() - queueStart,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
  
  // Test 4: Supabase Connection
  const supabaseStart = Date.now();
  try {
    const { data, error } = await supabase.from('bl_jobs').select('id').limit(1);
    tests.push({
      name: 'supabase_connection',
      status: error ? 'fail' : 'pass',
      latencyMs: Date.now() - supabaseStart,
      details: error ? undefined : 'Query executed successfully',
      error: error?.message,
    });
  } catch (err) {
    tests.push({
      name: 'supabase_connection',
      status: 'fail',
      latencyMs: Date.now() - supabaseStart,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
  
  // Test 5: Supabase Auth
  const authStart = Date.now();
  try {
    const { data, error } = await supabase.auth.getSession();
    tests.push({
      name: 'supabase_auth',
      status: error ? 'warn' : 'pass',
      latencyMs: Date.now() - authStart,
      details: 'Auth service reachable',
      error: error?.message,
    });
  } catch (err) {
    tests.push({
      name: 'supabase_auth',
      status: 'fail',
      latencyMs: Date.now() - authStart,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
  
  // Test 6: Supabase Storage
  const storageStart = Date.now();
  try {
    const { data, error } = await supabase.storage.listBuckets();
    tests.push({
      name: 'supabase_storage',
      status: error ? 'fail' : 'pass',
      latencyMs: Date.now() - storageStart,
      details: error ? undefined : `${data?.length || 0} buckets available`,
      error: error?.message,
    });
  } catch (err) {
    tests.push({
      name: 'supabase_storage',
      status: 'fail',
      latencyMs: Date.now() - storageStart,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
  
  // Test 7: Environment Configuration
  const envChecks = {
    REDIS_URL: !!process.env.REDIS_URL,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    PORT: !!process.env.PORT,
  };
  const missingEnv = Object.entries(envChecks).filter(([k, v]) => !v).map(([k]) => k);
  tests.push({
    name: 'environment_config',
    status: missingEnv.length === 0 ? 'pass' : 'warn',
    latencyMs: 0,
    details: missingEnv.length === 0 ? 'All required env vars set' : `Missing: ${missingEnv.join(', ')}`,
  });
  
  // Summary
  const passed = tests.filter(t => t.status === 'pass').length;
  const failed = tests.filter(t => t.status === 'fail').length;
  const warned = tests.filter(t => t.status === 'warn').length;
  
  const overallStatus = failed > 0 ? 'unhealthy' : warned > 0 ? 'degraded' : 'healthy';
  
  console.log(`[DIAGNOSTICS] Complete: ${passed} passed, ${failed} failed, ${warned} warnings`);
  
  res.status(failed > 0 ? 503 : 200).json({
    service: SERVICE_NAME,
    run_id: RUN_ID,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    overall_status: overallStatus,
    summary: {
      total: tests.length,
      passed,
      failed,
      warned,
    },
    tests,
    environment: process.env.NODE_ENV || 'development',
    version: capabilities.build.version,
  });
});

// Debug endpoint (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug', (req, res) => {
    console.log('[DEBUG] Debug info requested');
    res.json({
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: PORT,
        REDIS_URL: process.env.REDIS_URL ? '***configured***' : 'not set',
        SUPABASE_URL: process.env.SUPABASE_URL ? '***configured***' : 'not set',
      },
      process: {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
        uptime: process.uptime(),
      },
    });
  });
}

// API v1 Routes

// Calculate credits required for a job
function calculateCreditsRequired(processingMode: ProcessingMode): number {
  // Base cost is 1 credit per job
  // Inpaint mode costs more as it's more compute intensive
  return processingMode === 'inpaint' ? 2 : 1;
}

// Helper: Get user's credit balance
async function getUserCreditBalance(userId: string): Promise<{ balance: number; error?: string }> {
  const { data: balance, error: blError } = await supabase.rpc('bl_get_credit_balance', {
    p_user_id: userId,
  });
  
  if (!blError) {
    return { balance: balance || 0 };
  }
  
  // Fallback to original function
  const { data: origBalance, error: origError } = await supabase.rpc('get_credit_balance', {
    p_user_id: userId,
  });
  
  if (!origError) {
    return { balance: origBalance || 0 };
  }
  
  console.error('[API] ❌ Could not check credit balance');
  console.error('[API] bl_get_credit_balance error:', blError.message);
  console.error('[API] get_credit_balance error:', origError.message);
  return { balance: 0, error: 'Credit system unavailable' };
}

// Helper: Reserve credits for a job
async function reserveCredits(userId: string, jobId: string, amount: number): Promise<boolean> {
  const { error: blError } = await supabase.rpc('bl_reserve_credits', {
    p_user_id: userId,
    p_job_id: jobId,
    p_amount: amount,
  });
  
  if (!blError) {
    console.log(`[API] 💰 Reserved ${amount} credit(s) for job ${jobId}`);
    return true;
  }
  
  // Fallback to original function
  const { error: origError } = await supabase.rpc('reserve_credits', {
    p_user_id: userId,
    p_job_id: jobId,
    p_amount: amount,
  });
  
  if (!origError) {
    console.log(`[API] 💰 Reserved ${amount} credit(s) for job ${jobId} (fallback)`);
    return true;
  }
  
  console.warn('[API] ⚠️ Could not reserve credits');
  console.warn('[API] bl_reserve_credits error:', blError.message);
  console.warn('[API] reserve_credits error:', origError.message);
  return false;
}

// Create a new watermark removal job (requires authentication)
app.post('/api/v1/jobs', authenticateToken, jobsRateLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      video_url,
      crop_pixels,
      crop_position = 'bottom',
      platform = 'sora',
      processing_mode = process.env.DEFAULT_PROCESSING_MODE || 'inpaint',
      webhook_url,
      metadata,
    } = req.body;

    if (!video_url) {
      return res.status(400).json({ error: 'video_url is required' });
    }

    // Validate URL for security (SSRF prevention)
    const urlValidation = validateVideoUrl(video_url);
    if (!urlValidation.valid) {
      console.log(`[API] ❌ URL validation failed: ${urlValidation.error}`);
      return res.status(400).json({ error: `Invalid video URL: ${urlValidation.error}` });
    }

    // Validate processing mode
    const validModes: ProcessingMode[] = ['crop', 'inpaint', 'auto'];
    if (!validModes.includes(processing_mode)) {
      return res.status(400).json({ error: 'Invalid processing_mode. Must be: crop, inpaint, or auto' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Calculate credits required
    const creditsRequired = calculateCreditsRequired(processing_mode as ProcessingMode);

    // Check user's credit balance using helper
    const { balance: currentBalance, error: balanceError } = await getUserCreditBalance(userId);
    
    if (balanceError) {
      return res.status(503).json({ 
        error: 'Credit system unavailable',
        message: 'Unable to verify credit balance. Please try again later.'
      });
    }
    
    console.log(`[API] 💰 User credit balance: ${currentBalance}`);

    if (currentBalance < creditsRequired) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        credits_required: creditsRequired,
        credits_available: currentBalance,
        message: `You need ${creditsRequired} credit(s) but only have ${currentBalance}. Please purchase more credits.`
      });
    }

    const jobId = `job_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.custom;

    console.log(`[API] 🎬 Creating job ${jobId}`);
    console.log(`[API] 📥 Input URL: ${video_url}`);
    console.log(`[API] 🎯 Platform: ${platform}, Preset crop: ${preset.cropPixels}px`);
    console.log(`[API] ✂️ Final crop: ${crop_pixels || preset.cropPixels}px at ${crop_position || preset.cropPosition}`);

    const jobData: JobData = {
      jobId,
      inputUrl: video_url,
      inputFilename: video_url.split('/').pop() || 'video.mp4',
      cropPixels: crop_pixels || preset.cropPixels,
      cropPosition: crop_position || preset.cropPosition,
      platform,
      processingMode: processing_mode as ProcessingMode,
      webhookUrl: webhook_url,
      metadata,
      userId,
    };
    
    console.log(`[API] 📦 Job data:`, JSON.stringify(jobData, null, 2));

    // Store job in database first
    const { error: insertError } = await supabase.from('bl_jobs').insert({
      id: jobId,
      user_id: userId,
      status: 'queued',
      input_url: video_url,
      input_filename: jobData.inputFilename,
      crop_pixels: jobData.cropPixels,
      crop_position: jobData.cropPosition,
      platform,
      webhook_url: webhook_url,
      metadata,
      credits_required: creditsRequired,
    });

    if (insertError) {
      console.error('[API] ❌ Error inserting job:', insertError);
      console.error('[API] ❌ Insert error details:', JSON.stringify(insertError, null, 2));
      return res.status(500).json({ error: 'Failed to create job', details: insertError.message });
    }
    
    console.log(`[API] ✅ Job ${jobId} inserted into database`);

    // Reserve credits for this job using helper
    await reserveCredits(userId, jobId, creditsRequired);

    // Add to queue
    if (!jobQueue) {
      console.error('[API] ❌ Job queue not available');
      // Refund credits since queue is unavailable
      await supabase.rpc('bl_release_credits', { p_user_id: userId, p_job_id: jobId });
      await supabase.from('bl_jobs').delete().eq('id', jobId);
      return res.status(503).json({ error: 'Job queue unavailable. Please try again later.' });
    }
    
    console.log(`[API] 📤 Adding job ${jobId} to queue...`);
    await jobQueue.add('remove-watermark', jobData, { 
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 10s, 20s
      },
    });
    console.log(`[API] ✅ Job ${jobId} added to queue successfully`);

    const response = {
      job_id: jobId,
      jobId: jobId, // Also include camelCase for frontend compatibility
      status: 'queued',
      platform,
      crop_pixels: jobData.cropPixels,
      credits_charged: creditsRequired,
      created_at: new Date().toISOString(),
      estimated_completion: new Date(Date.now() + 15000).toISOString(),
    };
    
    console.log(`[API] 📤 Sending response:`, JSON.stringify(response));
    res.status(201).json(response);
  } catch (error) {
    console.error('[API] ❌ Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Upload video file directly (requires authentication)
app.post('/api/v1/jobs/upload', authenticateToken, jobsRateLimiter, upload.single('video'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const {
      crop_pixels,
      crop_position = 'bottom',
      platform = 'sora',
      processing_mode = process.env.DEFAULT_PROCESSING_MODE || 'inpaint', // Inpaint for corner watermarks like Sora
      webhook_url,
    } = req.body;

    const jobId = `job_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.custom;
    const filename = req.file.originalname;

    // Upload to R2/Supabase storage
    const storagePath = `uploads/${jobId}/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from('bl_videos')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('bl_videos')
      .getPublicUrl(storagePath);

    const userId = req.user?.id;
    const processingMode = (processing_mode as ProcessingMode) || 'crop';
    const creditsRequired = calculateCreditsRequired(processingMode);

    // Check credit balance if user is authenticated
    if (userId) {
      const { balance, error: balanceError } = await getUserCreditBalance(userId);
      console.log(`[API] 💰 User credit balance: ${balance}`);
      
      if (balanceError) {
        return res.status(503).json({ 
          error: 'Credit system unavailable',
          message: 'Unable to verify credit balance. Please try again later.'
        });
      }
      
      if (balance < creditsRequired) {
        return res.status(402).json({ 
          error: 'Insufficient credits',
          credits_required: creditsRequired,
          credits_available: balance,
        });
      }
    }

    const jobData: JobData = {
      jobId,
      inputUrl: urlData.publicUrl,
      inputFilename: filename,
      cropPixels: parseInt(crop_pixels) || preset.cropPixels,
      cropPosition: crop_position || preset.cropPosition,
      platform,
      processingMode,
      webhookUrl: webhook_url,
      userId,
    };

    // Add to queue
    if (!jobQueue) {
      console.error('[API] ❌ Job queue not available for upload');
      return res.status(503).json({ error: 'Job queue unavailable. Please try again later.' });
    }
    await jobQueue.add('remove-watermark', jobData, { 
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 10s, 20s
      },
    });

    // Store job in database with user_id and credits
    const { error: insertError } = await supabase.from('bl_jobs').insert({
      id: jobId,
      user_id: userId,
      status: 'queued',
      input_url: urlData.publicUrl,
      input_filename: filename,
      input_size_bytes: req.file.size,
      crop_pixels: jobData.cropPixels,
      crop_position: jobData.cropPosition,
      platform,
      webhook_url: webhook_url,
      credits_required: creditsRequired,
    });

    if (insertError) {
      console.error('[API] ❌ Error inserting job:', insertError);
      console.error('[API] ❌ Insert error details:', JSON.stringify(insertError, null, 2));
      return res.status(500).json({ error: 'Failed to create job', details: insertError.message });
    }
    
    console.log(`[API] ✅ Job ${jobId} inserted into database`);

    // Reserve credits for this job using helper
    if (userId) {
      await reserveCredits(userId, jobId, creditsRequired);
    }

    res.status(201).json({
      job_id: jobId,
      status: 'queued',
      platform,
      crop_pixels: jobData.cropPixels,
      file_size: req.file.size,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Get job status (requires authentication)
app.get('/api/v1/jobs/:jobId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { jobId } = req.params;
    console.log(`[JOB STATUS] 📊 Fetching job: ${jobId}`);

    const { data: job, error } = await supabase
      .from('bl_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      console.log(`[JOB STATUS] ❌ Job not found: ${jobId}`);
      return res.status(404).json({ error: 'Job not found' });
    }

    // Get real progress from database, or calculate based on status
    const realProgress = job.progress ?? (job.status === 'completed' ? 100 : job.status === 'failed' ? 0 : job.status === 'processing' ? 50 : 0);
    const currentStep = job.current_step || (job.status === 'queued' ? 'Waiting in queue' : job.status === 'completed' ? 'Complete' : 'Processing');
    console.log(`[JOB STATUS] ✅ Job ${jobId}: status=${job.status}, progress=${realProgress}%, current_step=${currentStep}`);
    
    const response: JobStatus = {
      jobId: job.id,
      status: job.status,
      progress: realProgress,
      current_step: currentStep,
      input: {
        filename: job.input_filename,
        sizeBytes: job.input_size_bytes,
        durationSec: job.input_duration_sec,
        url: job.input_url,  // Original video URL for before/after comparison
      },
      createdAt: job.created_at,
    };

    if (job.status === 'completed' && job.output_url) {
      response.output = {
        filename: job.output_filename,
        sizeBytes: job.output_size_bytes,
        downloadUrl: job.output_url,
        expiresAt: job.expires_at,
      };
      response.processingTimeMs = job.processing_time_ms;
      response.completedAt = job.completed_at;
    }

    if (job.status === 'failed') {
      response.error = job.error_message;
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Get download URL for completed job (requires authentication)
app.get('/api/v1/jobs/:jobId/download', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { jobId } = req.params;

    const { data: job, error } = await supabase
      .from('bl_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ 
        error: 'Job not completed', 
        status: job.status 
      });
    }

    res.json({
      download_url: job.output_url,
      filename: job.output_filename,
      expires_at: job.expires_at,
    });
  } catch (error) {
    console.error('Error fetching download URL:', error);
    res.status(500).json({ error: 'Failed to fetch download URL' });
  }
});

// Batch job creation (requires authentication)
app.post('/api/v1/jobs/batch', authenticateToken, jobsRateLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { videos, crop_pixels, crop_position, platform = 'sora', processing_mode = 'inpaint', webhook_url } = req.body;

    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ error: 'videos array is required' });
    }

    if (videos.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 videos per batch' });
    }

    const batchId = `batch_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.custom;
    const jobs: { job_id: string; status: string }[] = [];

    for (const video of videos) {
      const jobId = `job_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
      const videoUrl = video.video_url || video;

      const jobData: JobData = {
        jobId,
        inputUrl: videoUrl,
        inputFilename: videoUrl.split('/').pop() || 'video.mp4',
        cropPixels: video.crop_pixels || crop_pixels || preset.cropPixels,
        cropPosition: video.crop_position || crop_position || preset.cropPosition,
        platform,
        processingMode: (video.processing_mode || processing_mode || 'crop') as ProcessingMode,
        webhookUrl: webhook_url,
        metadata: { batch_id: batchId },
      };

      if (!jobQueue) {
        console.error('[API] ❌ Job queue not available for batch');
        return res.status(503).json({ error: 'Job queue unavailable. Please try again later.' });
      }
      await jobQueue.add('remove-watermark', jobData, { 
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 10s, 20s
      },
    });

      await supabase.from('bl_jobs').insert({
        id: jobId,
        batch_id: batchId,
        status: 'queued',
        input_url: videoUrl,
        input_filename: jobData.inputFilename,
        crop_pixels: jobData.cropPixels,
        crop_position: jobData.cropPosition,
        platform,
        webhook_url: webhook_url,
        metadata: { batch_id: batchId },
      });

      jobs.push({ job_id: jobId, status: 'queued' });
    }

    res.status(201).json({
      batch_id: batchId,
      jobs,
      total: jobs.length,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// Delete/cancel job (requires authentication) - refunds credits
app.delete('/api/v1/jobs/:jobId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;

    // Get job to check if it's cancellable and get user_id
    const { data: job, error: fetchError } = await supabase
      .from('bl_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Only allow cancelling queued or processing jobs
    if (!['queued', 'processing', 'validating'].includes(job.status)) {
      return res.status(400).json({ 
        error: 'Cannot cancel job', 
        message: `Job is already ${job.status}` 
      });
    }

    // Remove from queue if still pending
    if (jobQueue) {
      const queueJob = await jobQueue.getJob(jobId);
      if (queueJob) {
        await queueJob.remove();
      }
    }

    // Refund reserved credits
    if (job.user_id) {
      const { error: refundError } = await supabase.rpc('bl_release_credits', {
        p_user_id: job.user_id,
        p_job_id: jobId,
      });
      if (refundError) {
        console.error('[API] ⚠️ Error refunding credits:', refundError);
      } else {
        console.log(`[API] 💰 Refunded credits for cancelled job ${jobId}`);
      }
    }

    // Update database
    await supabase
      .from('bl_jobs')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    res.json({ message: 'Job cancelled and credits refunded', job_id: jobId });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// Internal endpoint: Update job status (called by worker)
// This handles credit finalization on success or refund on failure
app.post('/api/internal/jobs/:jobId/complete', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { 
      status, 
      output_url, 
      output_filename, 
      output_size_bytes,
      error_message,
      processing_time_ms 
    } = req.body;

    // Validate internal API key (simple security for internal calls)
    const internalKey = req.headers['x-internal-key'];
    if (internalKey !== process.env.INTERNAL_API_KEY && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get job details
    const { data: job, error: fetchError } = await supabase
      .from('bl_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const userId = job.user_id;
    const creditsRequired = job.credits_required || 1;

    if (status === 'completed') {
      // Job succeeded - finalize credits (keep them charged)
      if (userId) {
        const { error: finalizeError } = await supabase.rpc('bl_finalize_credits', {
          p_user_id: userId,
          p_job_id: jobId,
          p_final_cost: creditsRequired,
        });
        if (finalizeError) {
          console.error('[API] ⚠️ Error finalizing credits:', finalizeError);
        } else {
          console.log(`[API] 💰 Finalized ${creditsRequired} credit(s) for completed job ${jobId}`);
        }
      }

      // Update job as completed
      await supabase
        .from('bl_jobs')
        .update({
          status: 'completed',
          output_url,
          output_filename,
          output_size_bytes,
          processing_time_ms,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      res.json({ message: 'Job completed, credits charged', job_id: jobId });

    } else if (status === 'failed') {
      // Job failed - refund credits
      if (userId) {
        const { error: refundError } = await supabase.rpc('bl_release_credits', {
          p_user_id: userId,
          p_job_id: jobId,
        });
        if (refundError) {
          console.error('[API] ⚠️ Error refunding credits:', refundError);
        } else {
          console.log(`[API] 💰 Refunded credits for failed job ${jobId}`);
        }
      }

      // Update job as failed
      await supabase
        .from('bl_jobs')
        .update({
          status: 'failed',
          error_message: error_message || 'Processing failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      res.json({ message: 'Job failed, credits refunded', job_id: jobId });

    } else {
      // Just update status (e.g., processing)
      await supabase
        .from('bl_jobs')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      res.json({ message: 'Job status updated', job_id: jobId, status });
    }
  } catch (error) {
    console.error('Error completing job:', error);
    res.status(500).json({ error: 'Failed to complete job' });
  }
});

// Get supported platforms
app.get('/api/v1/platforms', (req, res) => {
  res.json({
    platforms: Object.entries(PLATFORM_PRESETS).map(([key, value]) => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      default_crop_pixels: value.cropPixels,
      crop_position: value.cropPosition,
    })),
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ERROR] Unhandled error:', err.message);
  console.error('[ERROR] Stack:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`[404] Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Graceful startup with port conflict handling
async function startServer(port: number, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = app.listen(port, () => {
          console.log('');
          console.log('╔════════════════════════════════════════════╗');
          console.log('║         BlankLogo API Server               ║');
          console.log('╠════════════════════════════════════════════╣');
          console.log(`║  Port:     ${port}                            ║`);
          console.log(`║  ENV:      ${(process.env.NODE_ENV || 'development').padEnd(28)}║`);
          console.log(`║  Redis:    ${(redisConnected ? '✅ Connected' : '❌ Disconnected').padEnd(28)}║`);
          console.log(`║  Queue:    ${(jobQueue ? '✅ Ready' : '❌ Unavailable').padEnd(28)}║`);
          console.log('╠════════════════════════════════════════════╣');
          console.log('║  Endpoints:                                ║');
          console.log('║    GET  /health  - Basic health check      ║');
          console.log('║    GET  /live    - Liveness probe          ║');
          console.log('║    GET  /ready   - Readiness probe         ║');
          console.log('║    GET  /status  - Full status report      ║');
          console.log('╚════════════════════════════════════════════╝');
          console.log('');
          resolve();
        });

        server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`[STARTUP] ❌ Port ${port} is already in use (attempt ${attempt}/${maxRetries})`);
            reject(err);
          } else {
            reject(err);
          }
        });
      });
      return; // Success
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`[STARTUP] ❌ Failed to start server after ${maxRetries} attempts`);
        console.error('[STARTUP] Try: lsof -ti:' + port + ' | xargs kill -9');
        process.exit(1);
      }
      // Wait before retry
      console.log(`[STARTUP] ⏳ Waiting 2s before retry...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received, shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer(Number(PORT));

export default app;
