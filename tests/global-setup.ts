/**
 * BlankLogo - Playwright Global Setup
 * 
 * Runs before all tests to ensure services are available.
 * Fails fast with clear error messages if services are down.
 */

import { FullConfig } from "@playwright/test";

interface ServiceConfig {
  name: string;
  url: string;
  healthEndpoint?: string;
  required: boolean;
  timeout?: number;
}

interface HealthCheckResult {
  service: string;
  url: string;
  healthy: boolean;
  responseTime?: number;
  error?: string;
}

const API_URL = process.env.API_URL || "http://localhost:8989";
const BASE_URL = process.env.BASE_URL || "http://localhost:3939";

const SERVICES: ServiceConfig[] = [
  {
    name: "API",
    url: API_URL,
    healthEndpoint: "/health",
    required: true,
    timeout: 5000,
  },
  {
    name: "Web",
    url: BASE_URL,
    healthEndpoint: "",
    required: true,
    timeout: 5000,
  },
];

async function checkServiceHealth(config: ServiceConfig): Promise<HealthCheckResult> {
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

    return {
      service: config.name,
      url,
      healthy: response.ok,
      responseTime,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    let friendlyError = errorMessage;
    if (errorMessage.includes("ECONNREFUSED")) {
      friendlyError = `Connection refused - is ${config.name} running?`;
    } else if (errorMessage.includes("abort")) {
      friendlyError = `Timeout - service may be starting`;
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

async function globalSetup(config: FullConfig): Promise<void> {
  console.log("\n");
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║     BlankLogo E2E Test - Service Check        ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log("");

  const results = await Promise.all(SERVICES.map(checkServiceHealth));

  // Print results
  console.log("┌────────────┬──────────┬────────────┬─────────────────────────────┐");
  console.log("│ Service    │ Status   │ Time       │ URL                         │");
  console.log("├────────────┼──────────┼────────────┼─────────────────────────────┤");

  for (const result of results) {
    const status = result.healthy ? "✅ OK" : "❌ DOWN";
    const time = result.responseTime ? `${result.responseTime}ms`.padEnd(10) : "N/A".padEnd(10);
    const url = result.url.slice(0, 27).padEnd(27);
    console.log(`│ ${result.service.padEnd(10)} │ ${status.padEnd(8)} │ ${time} │ ${url} │`);
  }

  console.log("└────────────┴──────────┴────────────┴─────────────────────────────┘");
  console.log("");

  // Check for failures
  const failedRequired = results.filter((r, i) => !r.healthy && SERVICES[i].required);

  if (failedRequired.length > 0) {
    console.error("❌ REQUIRED SERVICES ARE DOWN!\n");
    
    for (const result of failedRequired) {
      console.error(`   ${result.service}: ${result.error}`);
    }
    
    console.error("\n┌─────────────────────────────────────────────────┐");
    console.error("│  How to fix:                                    │");
    console.error("├─────────────────────────────────────────────────┤");
    console.error("│  Option 1: Run startup script                   │");
    console.error("│    ./scripts/dev-start.sh                       │");
    console.error("│                                                 │");
    console.error("│  Option 2: Start manually                       │");
    console.error("│    pnpm --filter @blanklogo/api dev             │");
    console.error("│    pnpm --filter @blanklogo/web dev             │");
    console.error("│                                                 │");
    console.error("│  Option 3: Run tests with auto-start            │");
    console.error("│    pnpm test:e2e (uses webServer config)        │");
    console.error("└─────────────────────────────────────────────────┘");
    console.error("");

    throw new Error(
      `Tests cannot run: Required services unavailable (${failedRequired.map((r) => r.service).join(", ")})`
    );
  }

  // All good
  console.log("✅ All services healthy - starting tests...\n");
}

export default globalSetup;
