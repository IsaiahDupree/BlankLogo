import { beforeAll, afterAll, vi } from "vitest";

// Mock environment variables for tests
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54341";
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

// Test timeout for async operations
export const TEST_TIMEOUT = 30000;
