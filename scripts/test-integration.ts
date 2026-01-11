#!/usr/bin/env npx ts-node
/**
 * Integration Test Script - Tests Render Worker + Modal GPU Pipeline
 * 
 * Usage: npx ts-node scripts/test-integration.ts
 */

const WORKER_URL = process.env.WORKER_URL || 'https://blanklogo-worker.onrender.com';
const API_URL = process.env.API_URL || 'https://www.blanklogo.app';
const TEST_VIDEO_URL = 'https://pub-2d4af2c20c4a4bd38e95daec692ed698.r2.dev/sora-watermark.mp4';

interface HealthResponse {
  status: string;
  service: string;
  worker: string;
  uptime_ms: number;
}

interface JobStatus {
  id: string;
  status: string;
  progress: number;
  error_message?: string;
  output_url?: string;
}

async function log(msg: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
}

async function checkWorkerHealth(): Promise<boolean> {
  log('🔍 Checking worker health...');
  try {
    const res = await fetch(`${WORKER_URL}/health`);
    const data: HealthResponse = await res.json();
    log('✅ Worker health:', data);
    return data.status === 'healthy';
  } catch (error) {
    log('❌ Worker health check failed:', error);
    return false;
  }
}

async function checkModalHealth(): Promise<boolean> {
  log('🔍 Checking Modal GPU health...');
  try {
    // Try the inpaint health endpoint
    const res = await fetch('https://isaiahdupree--blanklogo-inpaint-health.modal.run', {
      method: 'GET',
    });
    const text = await res.text();
    log('📡 Modal response:', { status: res.status, body: text });
    return res.ok;
  } catch (error) {
    log('⚠️ Modal health check error:', error);
    return false;
  }
}

async function pollJobStatus(jobId: string, maxAttempts = 60): Promise<JobStatus | null> {
  log(`⏳ Polling job status: ${jobId}`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Query Supabase directly for job status
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        log('⚠️ Supabase credentials not available, using API');
        // Fallback to worker endpoint
        const res = await fetch(`${WORKER_URL}/jobs/${jobId}`);
        if (!res.ok) {
          log(`📊 Attempt ${i + 1}/${maxAttempts}: API returned ${res.status}`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return await res.json();
      }
      
      const res = await fetch(`${supabaseUrl}/rest/v1/bl_jobs?id=eq.${jobId}&select=*`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      
      const jobs = await res.json();
      if (jobs.length === 0) {
        log(`📊 Attempt ${i + 1}/${maxAttempts}: Job not found yet`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      
      const job = jobs[0];
      log(`📊 Attempt ${i + 1}/${maxAttempts}: ${job.status} (${job.progress}%)`);
      
      if (job.status === 'completed') {
        log('✅ Job completed!', job);
        return job;
      }
      
      if (job.status === 'failed') {
        log('❌ Job failed!', job);
        return job;
      }
      
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      log(`⚠️ Poll error on attempt ${i + 1}:`, error);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  
  log('⏰ Timeout waiting for job completion');
  return null;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 BLANKLOGO INTEGRATION TEST');
  console.log('='.repeat(60) + '\n');
  
  // Step 1: Health checks
  log('📋 Step 1: Health Checks');
  const workerHealthy = await checkWorkerHealth();
  const modalHealthy = await checkModalHealth();
  
  console.log('\n--- Health Check Results ---');
  console.log(`Worker: ${workerHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
  console.log(`Modal:  ${modalHealthy ? '✅ Healthy' : '⚠️ Unknown/Unhealthy'}`);
  
  if (!workerHealthy) {
    console.log('\n❌ Worker is unhealthy. Aborting test.');
    process.exit(1);
  }
  
  // Step 2: Check recent jobs
  log('\n📋 Step 2: Checking Recent Jobs');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/bl_jobs?select=id,status,progress,error_message,created_at,updated_at&order=created_at.desc&limit=5`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );
      const jobs = await res.json();
      log('Recent jobs:', jobs);
      
      // Check for stuck jobs
      const now = new Date();
      for (const job of jobs) {
        if (job.status === 'processing') {
          const updatedAt = new Date(job.updated_at);
          const stuckMinutes = (now.getTime() - updatedAt.getTime()) / 60000;
          if (stuckMinutes > 2) {
            log(`⚠️ STUCK JOB DETECTED: ${job.id} at ${job.progress}% for ${stuckMinutes.toFixed(1)} minutes`);
          }
        }
      }
    } catch (error) {
      log('⚠️ Could not fetch recent jobs:', error);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Integration test complete');
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
