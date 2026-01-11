import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

const TIMEOUT_WARNING = `
⏱️  TEST TIMEOUT (15s) - No response received!
   Systems may be unhealthy or assumed dead.
   Please check: API server, database connections, external services
`;

class TimeoutReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === "timedOut") {
      console.error(TIMEOUT_WARNING);
      console.error(`   Failed test: ${test.title}`);
      console.error(`   Location: ${test.location.file}:${test.location.line}\n`);
    }
  }
}

export default TimeoutReporter;
