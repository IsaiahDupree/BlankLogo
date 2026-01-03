import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

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
const INSTANCE_ID = `${require('os').hostname()}:${PORT}`;
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

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3838'],
  credentials: true,
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
  input?: {
    filename: string;
    sizeBytes?: number;
    durationSec?: number;
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
  sora: { cropPixels: 100, cropPosition: 'bottom' },
  tiktok: { cropPixels: 80, cropPosition: 'bottom' },
  runway: { cropPixels: 60, cropPosition: 'bottom' },
  pika: { cropPixels: 50, cropPosition: 'bottom' },
  midjourney: { cropPixels: 40, cropPosition: 'bottom' },
  kling: { cropPixels: 70, cropPosition: 'bottom' },
  luma: { cropPixels: 55, cropPosition: 'bottom' },
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

// Create a new watermark removal job (requires authentication)
app.post('/api/v1/jobs', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      video_url,
      crop_pixels,
      crop_position = 'bottom',
      platform = 'sora',
      processing_mode = 'crop',
      webhook_url,
      metadata,
    } = req.body;

    if (!video_url) {
      return res.status(400).json({ error: 'video_url is required' });
    }

    // Validate processing mode
    const validModes: ProcessingMode[] = ['crop', 'inpaint', 'auto'];
    if (!validModes.includes(processing_mode)) {
      return res.status(400).json({ error: 'Invalid processing_mode. Must be: crop, inpaint, or auto' });
    }

    const jobId = `job_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.custom;

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
    };

    // Add to queue
    if (!jobQueue) {
      console.error('[API] ❌ Job queue not available');
      return res.status(503).json({ error: 'Job queue unavailable. Please try again later.' });
    }
    await jobQueue.add('remove-watermark', jobData, { jobId });

    // Store job in database
    await supabase.from('bl_jobs').insert({
      id: jobId,
      user_id: req.user?.id,
      status: 'queued',
      input_url: video_url,
      input_filename: jobData.inputFilename,
      crop_pixels: jobData.cropPixels,
      crop_position: jobData.cropPosition,
      platform,
      webhook_url: webhook_url,
      metadata,
    });

    res.status(201).json({
      job_id: jobId,
      status: 'queued',
      platform,
      crop_pixels: jobData.cropPixels,
      created_at: new Date().toISOString(),
      estimated_completion: new Date(Date.now() + 15000).toISOString(),
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Upload video file directly (requires authentication)
app.post('/api/v1/jobs/upload', authenticateToken, upload.single('video'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const {
      crop_pixels,
      crop_position = 'bottom',
      platform = 'sora',
      processing_mode = 'crop',
      webhook_url,
    } = req.body;

    const jobId = `job_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.custom;
    const filename = req.file.originalname;

    // Upload to R2/Supabase storage
    const storagePath = `uploads/${jobId}/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(storagePath);

    const jobData: JobData = {
      jobId,
      inputUrl: urlData.publicUrl,
      inputFilename: filename,
      cropPixels: parseInt(crop_pixels) || preset.cropPixels,
      cropPosition: crop_position || preset.cropPosition,
      platform,
      processingMode: (processing_mode as ProcessingMode) || 'crop',
      webhookUrl: webhook_url,
    };

    // Add to queue
    if (!jobQueue) {
      console.error('[API] ❌ Job queue not available for upload');
      return res.status(503).json({ error: 'Job queue unavailable. Please try again later.' });
    }
    await jobQueue.add('remove-watermark', jobData, { jobId });

    // Store job in database
    await supabase.from('bl_jobs').insert({
      id: jobId,
      status: 'queued',
      input_url: urlData.publicUrl,
      input_filename: filename,
      input_size_bytes: req.file.size,
      crop_pixels: jobData.cropPixels,
      crop_position: jobData.cropPosition,
      platform,
      webhook_url: webhook_url,
    });

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

    const { data: job, error } = await supabase
      .from('bl_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const response: JobStatus = {
      jobId: job.id,
      status: job.status,
      progress: job.status === 'completed' ? 100 : job.status === 'processing' ? 50 : 0,
      input: {
        filename: job.input_filename,
        sizeBytes: job.input_size_bytes,
        durationSec: job.input_duration_sec,
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
app.post('/api/v1/jobs/batch', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { videos, crop_pixels, crop_position, platform = 'sora', processing_mode = 'crop', webhook_url } = req.body;

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
      await jobQueue.add('remove-watermark', jobData, { jobId });

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

// Delete/cancel job (requires authentication)
app.delete('/api/v1/jobs/:jobId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { jobId } = req.params;

    // Remove from queue if still pending
    if (jobQueue) {
      const job = await jobQueue.getJob(jobId);
      if (job) {
        await job.remove();
      }
    }

    // Update database
    await supabase
      .from('bl_jobs')
      .update({ status: 'cancelled' })
      .eq('id', jobId);

    res.json({ message: 'Job cancelled', job_id: jobId });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
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
