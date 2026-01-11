import { beforeAll, afterAll, vi } from "vitest";

// Custom timeout handler - prints health check warning on timeout
const TIMEOUT_WARNING = `
⏱️  TEST TIMEOUT (15s) - No response received!
   Systems may be unhealthy or assumed dead.
   Please check: API server, database connections, external services
`;

// Override console.error to enhance timeout messages
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = args.join(' ');
  if (message.includes('Timeout') || message.includes('timed out')) {
    originalConsoleError(TIMEOUT_WARNING);
  }
  originalConsoleError(...args);
};

// Mock environment variables for tests
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54351";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-openai-key";
process.env.HF_TOKEN = process.env.HF_TOKEN || "test-hf-token";

// Global test setup
beforeAll(() => {
  // Silence console during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  }
});

afterAll(() => {
  vi.restoreAllMocks();
});

// Test user credentials
export const TEST_USER = {
  email: "isaiahdupree33@gmail.com",
  password: "Frogger12",
};

// Test timeout for async operations (15 seconds)
export const TEST_TIMEOUT = 15000;

// Timeout error message for manual use in tests
export const TIMEOUT_ERROR_MESSAGE = `
⏱️  TEST TIMEOUT (15s) - No response received!
   Systems may be unhealthy or assumed dead.
   Please check: API server, database connections, external services
`;
