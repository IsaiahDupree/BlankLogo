/**
 * BlankLogo - Service Health Check Utilities
 * 
 * Provides utilities for checking service availability before running tests.
 * Fails fast with clear error messages if services are unavailable.
 */

export interface ServiceConfig {
  name: string;
  url: string;
  healthEndpoint?: string;
  required: boolean;
  timeout?: number;
}

export interface HealthCheckResult {
  service: string;
  url: string;
  healthy: boolean;
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

// Default service configurations
export const DEFAULT_SERVICES: ServiceConfig[] = [
  {
    name: "API",
    url: process.env.API_URL || "http://localhost:8989",
    healthEndpoint: "/health",
    required: true,
    timeout: 5000,
  },
  {
    name: "Web",
    url: process.env.BASE_URL || "http://localhost:3939",
    healthEndpoint: "",
    required: true,
    timeout: 5000,
  },
];

/**
 * Check if a single service is healthy
 */
export async function checkServiceHealth(config: ServiceConfig): Promise<HealthCheckResult> {
  const url = `${config.url}${config.healthEndpoint || ""}`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 5000);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      let details: Record<string, unknown> | undefined;
      try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          details = await response.json();
        }
      } catch {
        // Ignore JSON parse errors
      }

      return {
        service: config.name,
        url,
        healthy: true,
        responseTime,
        details,
      };
    }

    return {
      service: config.name,
      url,
      healthy: false,
      responseTime,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide helpful error messages
    let friendlyError = errorMessage;
    if (errorMessage.includes("ECONNREFUSED")) {
      friendlyError = `Connection refused - is ${config.name} server running?`;
    } else if (errorMessage.includes("abort")) {
      friendlyError = `Timeout after ${config.timeout}ms - service may be starting`;
    }

    return {
      service: config.name,
      url,
      healthy: false,
      responseTime,
      error: friendlyError,
    };
  }
}

/**
 * Check all services and return results
 */
export async function checkAllServices(
  services: ServiceConfig[] = DEFAULT_SERVICES
): Promise<HealthCheckResult[]> {
  const results = await Promise.all(services.map(checkServiceHealth));
  return results;
}

/**
 * Wait for a service to become healthy with retries
 */
export async function waitForService(
  config: ServiceConfig,
  maxRetries: number = 30,
  retryInterval: number = 1000
): Promise<HealthCheckResult> {
  let lastResult: HealthCheckResult | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    lastResult = await checkServiceHealth(config);

    if (lastResult.healthy) {
      return lastResult;
    }

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }
  }

  return lastResult!;
}

/**
 * Wait for all services to be healthy
 */
export async function waitForAllServices(
  services: ServiceConfig[] = DEFAULT_SERVICES,
  maxRetries: number = 30,
  retryInterval: number = 1000
): Promise<{ allHealthy: boolean; results: HealthCheckResult[] }> {
  const results = await Promise.all(
    services.map((service) => waitForService(service, maxRetries, retryInterval))
  );

  const allHealthy = results.every((r) => r.healthy);
  return { allHealthy, results };
}

/**
 * Assert all required services are healthy - throws if not
 */
export async function assertServicesHealthy(
  services: ServiceConfig[] = DEFAULT_SERVICES
): Promise<void> {
  console.log("\n🔍 Checking service health...\n");

  const results = await checkAllServices(services);

  // Print results table
  console.log("┌────────────┬──────────┬────────────┬─────────────────────────────────┐");
  console.log("│ Service    │ Status   │ Time       │ Details                         │");
  console.log("├────────────┼──────────┼────────────┼─────────────────────────────────┤");

  for (const result of results) {
    const status = result.healthy ? "✅ OK" : "❌ FAIL";
    const time = result.responseTime ? `${result.responseTime}ms` : "N/A";
    const details = result.error || (result.details ? "Connected" : "OK");
    console.log(
      `│ ${result.service.padEnd(10)} │ ${status.padEnd(8)} │ ${time.padEnd(10)} │ ${details.slice(0, 31).padEnd(31)} │`
    );
  }

  console.log("└────────────┴──────────┴────────────┴─────────────────────────────────┘\n");

  // Check for failures in required services
  const failedRequired = results.filter((r, i) => !r.healthy && services[i].required);

  if (failedRequired.length > 0) {
    console.error("❌ Required services are not available:\n");
    for (const result of failedRequired) {
      console.error(`   • ${result.service}: ${result.error}`);
    }
    console.error("\n📋 To start services, run:");
    console.error("   ./scripts/dev-start.sh\n");
    console.error("   Or manually:");
    console.error("   pnpm --filter @blanklogo/api dev");
    console.error("   pnpm --filter @blanklogo/web dev\n");

    throw new Error(
      `Required services unavailable: ${failedRequired.map((r) => r.service).join(", ")}`
    );
  }

  console.log("✅ All required services are healthy!\n");
}

/**
 * Playwright global setup function
 */
export async function playwrightGlobalSetup(): Promise<void> {
  await assertServicesHealthy();
}

// CLI execution
if (require.main === module) {
  assertServicesHealthy()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
