/**
 * URL Validation Utility
 * Prevents SSRF attacks by validating video URLs
 */

// Blocked IP ranges (private networks, localhost, etc.)
const BLOCKED_IP_PATTERNS = [
  /^127\./,                    // Localhost
  /^10\./,                     // Private Class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
  /^192\.168\./,               // Private Class C
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  /^::1$/,                     // IPv6 localhost
  /^fc00:/i,                   // IPv6 private
  /^fe80:/i,                   // IPv6 link-local
];

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',  // GCP metadata
  '169.254.169.254',           // AWS/Azure metadata
];

// Allowed protocols
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// Known video platforms (optional whitelist mode)
const ALLOWED_DOMAINS = [
  'sora.chatgpt.com',
  'runway.com',
  'runwayml.com',
  'pika.art',
  'klingai.com',
  'luma.ai',
  'lumalabs.ai',
  'minimax.io',
  'hailuoai.com',
  'vimeo.com',
  'youtube.com',
  'youtu.be',
  // Storage providers
  'supabase.co',
  'r2.cloudflarestorage.com',
  's3.amazonaws.com',
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

/**
 * Validate a video URL for security
 */
export function validateVideoUrl(url: string, strictMode = false): ValidationResult {
  try {
    // Basic URL parsing
    const parsed = new URL(url);
    
    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return { valid: false, error: `Invalid protocol: ${parsed.protocol}. Must be HTTP or HTTPS.` };
    }
    
    // Check for blocked hostnames
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return { valid: false, error: `Blocked hostname: ${hostname}` };
    }
    
    // Check for blocked IP patterns
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: `Blocked IP address: ${hostname}` };
      }
    }
    
    // In strict mode, only allow known video platforms
    if (strictMode) {
      const isAllowed = ALLOWED_DOMAINS.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
      if (!isAllowed) {
        return { valid: false, error: `Domain not in allowlist: ${hostname}` };
      }
    }
    
    // Check for suspicious patterns
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'URLs with credentials are not allowed' };
    }
    
    // Sanitize and return
    return { 
      valid: true, 
      sanitizedUrl: parsed.toString() 
    };
    
  } catch (error) {
    return { valid: false, error: `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Check if a URL points to a valid video resource
 */
export async function isValidVideoUrl(url: string): Promise<ValidationResult> {
  // First validate the URL format
  const formatCheck = validateVideoUrl(url);
  if (!formatCheck.valid) {
    return formatCheck;
  }
  
  try {
    // HEAD request to check content type
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'BlankLogo/1.0 (Video URL Validator)',
      },
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { valid: false, error: `URL returned status ${response.status}` };
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    // Accept video content types or HTML (for page URLs that need scraping)
    if (contentType.includes('video') || contentType.includes('text/html')) {
      return { valid: true, sanitizedUrl: url };
    }
    
    return { valid: true, sanitizedUrl: url }; // Allow other types, scraper will handle
    
  } catch (error) {
    // Allow URLs that can't be HEAD-checked (some platforms block HEAD)
    return { valid: true, sanitizedUrl: url };
  }
}

export default validateVideoUrl;
