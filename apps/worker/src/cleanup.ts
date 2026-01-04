/**
 * Video File Cleanup Module
 * Removes expired videos from storage to prevent bloat
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const STORAGE_BUCKET = 'bl_videos';

interface CleanupResult {
  deletedCount: number;
  freedBytes: number;
  errors: string[];
}

/**
 * Clean up expired videos from storage
 * Videos are considered expired after 7 days (based on expires_at field)
 */
export async function cleanupExpiredVideos(): Promise<CleanupResult> {
  console.log('[Cleanup] Starting expired video cleanup...');
  
  const result: CleanupResult = {
    deletedCount: 0,
    freedBytes: 0,
    errors: [],
  };

  try {
    // Get all expired jobs
    const { data: expiredJobs, error: fetchError } = await supabase
      .from('bl_jobs')
      .select('id, output_url, output_size_bytes, input_url, input_size_bytes')
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'completed');

    if (fetchError) {
      result.errors.push(`Failed to fetch expired jobs: ${fetchError.message}`);
      return result;
    }

    if (!expiredJobs || expiredJobs.length === 0) {
      console.log('[Cleanup] No expired videos found');
      return result;
    }

    console.log(`[Cleanup] Found ${expiredJobs.length} expired jobs to clean up`);

    for (const job of expiredJobs) {
      try {
        // Extract file paths from URLs
        const filesToDelete: string[] = [];
        
        if (job.output_url) {
          const outputPath = extractPathFromUrl(job.output_url);
          if (outputPath) filesToDelete.push(outputPath);
        }
        
        if (job.input_url && job.input_url.includes(STORAGE_BUCKET)) {
          const inputPath = extractPathFromUrl(job.input_url);
          if (inputPath) filesToDelete.push(inputPath);
        }

        // Delete files from storage
        for (const filePath of filesToDelete) {
          const { error: deleteError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([filePath]);

          if (deleteError) {
            result.errors.push(`Failed to delete ${filePath}: ${deleteError.message}`);
          } else {
            result.deletedCount++;
            result.freedBytes += (job.output_size_bytes || 0) + (job.input_size_bytes || 0);
            console.log(`[Cleanup] Deleted: ${filePath}`);
          }
        }

        // Update job to mark as cleaned
        await supabase
          .from('bl_jobs')
          .update({ 
            output_url: null, 
            input_url: null,
            cleaned_at: new Date().toISOString() 
          })
          .eq('id', job.id);

      } catch (err) {
        result.errors.push(`Error processing job ${job.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    console.log(`[Cleanup] Completed: ${result.deletedCount} files deleted, ${formatBytes(result.freedBytes)} freed`);
    if (result.errors.length > 0) {
      console.log(`[Cleanup] Errors: ${result.errors.length}`);
    }

  } catch (error) {
    result.errors.push(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * Extract file path from storage URL
 */
function extractPathFromUrl(url: string): string | null {
  try {
    // URL format: .../storage/v1/object/public/bl_videos/processed/job_xxx/file.mp4
    const match = url.match(/bl_videos\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Run cleanup as standalone script
 */
export async function runCleanup(): Promise<void> {
  console.log('[Cleanup] ═══════════════════════════════════════════');
  console.log('[Cleanup] Video Cleanup Job Started');
  console.log('[Cleanup] ═══════════════════════════════════════════');
  
  const result = await cleanupExpiredVideos();
  
  console.log('[Cleanup] ═══════════════════════════════════════════');
  console.log(`[Cleanup] Summary:`);
  console.log(`[Cleanup]   Files deleted: ${result.deletedCount}`);
  console.log(`[Cleanup]   Space freed: ${formatBytes(result.freedBytes)}`);
  console.log(`[Cleanup]   Errors: ${result.errors.length}`);
  console.log('[Cleanup] ═══════════════════════════════════════════');
}

// Allow running as standalone script
if (require.main === module) {
  runCleanup().then(() => process.exit(0)).catch(() => process.exit(1));
}
