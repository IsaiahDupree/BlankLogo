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

// Health check
app.get('/health', (req, res) => {
  console.log('[HEALTH] Health check requested');
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      redis: redisConnected ? 'connected' : 'disconnected',
      queue: jobQueue ? 'ready' : 'unavailable',
    }
  });
});

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

// Start server
app.listen(PORT, () => {
  console.log(`BlankLogo API running on port ${PORT}`);
});

export default app;
