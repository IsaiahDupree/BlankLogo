/**
 * Centralized logging utility for BlankLogo
 * All logs include timestamps, context, and are formatted for easy debugging
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  component?: string;
  userId?: string;
  action?: string;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const prefix = context?.component ? `[${context.component}]` : "[APP]";
  const emoji = {
    info: "ℹ️",
    warn: "⚠️",
    error: "❌",
    debug: "🔍",
  }[level];
  
  return `${emoji} ${prefix} ${message}`;
}

export const logger = {
  info: (message: string, context?: LogContext) => {
    console.log(formatLog("info", message, context), context || "");
  },
  
  warn: (message: string, context?: LogContext) => {
    console.warn(formatLog("warn", message, context), context || "");
  },
  
  error: (message: string, error?: unknown, context?: LogContext) => {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    console.error(formatLog("error", message, context), { ...context, error: errorDetails });
  },
  
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === "development") {
      console.log(formatLog("debug", message, context), context || "");
    }
  },
  
  api: {
    request: (method: string, path: string, context?: LogContext) => {
      console.log(`[API] ➡️ ${method} ${path}`, context || "");
    },
    
    response: (method: string, path: string, status: number, duration?: number) => {
      const emoji = status >= 400 ? "❌" : "✅";
      const time = duration ? ` (${duration}ms)` : "";
      console.log(`[API] ${emoji} ${method} ${path} ${status}${time}`);
    },
    
    error: (method: string, path: string, error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[API] ❌ ${method} ${path} - ${errorMessage}`, error);
    },
  },
  
  auth: {
    login: (email: string, success: boolean) => {
      console.log(`[AUTH] ${success ? "✅" : "❌"} Login attempt: ${email}`);
    },
    
    logout: (userId?: string) => {
      console.log(`[AUTH] 👋 Logout: ${userId || "unknown"}`);
    },
    
    session: (action: string, userId?: string) => {
      console.log(`[AUTH] 🔐 ${action}: ${userId || "no user"}`);
    },
  },
  
  db: {
    query: (table: string, operation: string, context?: LogContext) => {
      console.log(`[DB] 📊 ${operation} on ${table}`, context || "");
    },
    
    error: (table: string, operation: string, error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[DB] ❌ ${operation} on ${table} failed: ${errorMessage}`);
    },
  },
};

/**
 * Wrap async functions with error logging
 */
export function withErrorLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(`Error in ${context}`, error, { component: context });
      throw error;
    }
  }) as T;
}

/**
 * Safe JSON parse with logging
 */
export function safeJsonParse<T>(json: string, fallback: T, context?: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    logger.warn(`Failed to parse JSON${context ? ` in ${context}` : ""}`, { error });
    return fallback;
  }
}

export default logger;
