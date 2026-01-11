/**
 * Modal GPU Client for BlankLogo
 * 
 * Calls Modal serverless GPU for watermark removal using YOLO + LAMA
 */

const MODAL_TOKEN_ID = process.env.MODAL_TOKEN_ID || "ak-pszSr5MyUohfmdbcBohF3w";
const MODAL_TOKEN_SECRET = process.env.MODAL_TOKEN_SECRET || "as-Ksu1Q3n2XXVXWjoZKX16dn";
const MODAL_APP_NAME = "blanklogo-watermark-removal";
const MODAL_WORKSPACE = "isaiahdupree33";

interface ModalJobResult {
  video_bytes: string; // base64 encoded
  stats: {
    mode: string;
    platform: string;
    input_size_mb: number;
    output_size_mb: number;
    frames_processed: number;
    watermarks_detected: number;
    processing_time_s: number;
  };
}

interface ModalError {
  error: string;
  traceback?: string;
}

/**
 * Call Modal GPU to process a video for watermark removal
 */
export async function processVideoWithModal(
  videoBytes: Buffer,
  mode: string = "inpaint",
  platform: string = "sora"
): Promise<{ outputBytes: Buffer; stats: ModalJobResult["stats"] }> {
  console.log(`[Modal] 🚀 Starting GPU processing...`);
  console.log(`[Modal]    Mode: ${mode}, Platform: ${platform}`);
  console.log(`[Modal]    Input size: ${(videoBytes.length / 1024 / 1024).toFixed(2)} MB`);

  // Modal Web Endpoint URL format: https://{workspace}--{app}-{function}.modal.run
  const modalUrl = `https://${MODAL_WORKSPACE}--${MODAL_APP_NAME}-process-video-http.modal.run`;
  
  const startTime = Date.now();

  try {
    const response = await fetch(modalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MODAL_TOKEN_ID}:${MODAL_TOKEN_SECRET}`,
      },
      body: JSON.stringify({
        video_bytes: videoBytes.toString("base64"),
        mode,
        platform,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Modal] ❌ HTTP ${response.status}: ${errorText}`);
      throw new Error(`Modal API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as ModalJobResult | ModalError;

    if ("error" in result) {
      console.error(`[Modal] ❌ Processing error: ${result.error}`);
      if (result.traceback) {
        console.error(`[Modal]    Traceback: ${result.traceback.slice(0, 500)}`);
      }
      throw new Error(`Modal processing error: ${result.error}`);
    }

    const outputBytes = Buffer.from(result.video_bytes, "base64");
    const duration = (Date.now() - startTime) / 1000;

    console.log(`[Modal] ✅ Processing complete in ${duration.toFixed(1)}s`);
    console.log(`[Modal]    Output size: ${(outputBytes.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`[Modal]    Frames: ${result.stats.frames_processed}`);
    console.log(`[Modal]    Watermarks detected: ${result.stats.watermarks_detected}`);

    return {
      outputBytes,
      stats: result.stats,
    };
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`[Modal] ❌ Failed after ${duration.toFixed(1)}s:`, error);
    throw error;
  }
}

/**
 * Check Modal health
 */
export async function checkModalHealth(): Promise<{ healthy: boolean; latencyMs: number }> {
  const healthUrl = `https://${MODAL_WORKSPACE}--${MODAL_APP_NAME}-health.modal.run`;
  const start = Date.now();

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${MODAL_TOKEN_ID}:${MODAL_TOKEN_SECRET}`,
      },
    });

    const latencyMs = Date.now() - start;

    if (response.ok) {
      const data = await response.json() as { status: string };
      return { healthy: data.status === "ok", latencyMs };
    }

    return { healthy: false, latencyMs };
  } catch (error) {
    return { healthy: false, latencyMs: Date.now() - start };
  }
}
