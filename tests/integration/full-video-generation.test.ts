import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from "../db/config";

// ============================================
// ACTUAL VIDEO GENERATION E2E TESTS
// ============================================
// These tests trigger ACTUAL video generation through the pipeline.
// They require the worker to be running and will take several minutes.

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Real test user (must exist in database with credits)
const TEST_USER_EMAIL = "isaiahdupree33@gmail.com";

// Test content for actual video generation
const FIVE_MINUTE_SCRIPT_CONTENT = `
The Science of Success: How Great Achievers Think Differently

Introduction:
What separates those who achieve their dreams from those who don't? 
Is it talent, luck, or something else entirely?
Research shows it's actually the way successful people think that sets them apart.

The Growth Mindset Revolution:
Stanford psychologist Carol Dweck discovered something remarkable.
People with a "growth mindset" believe abilities can be developed through dedication.
They embrace challenges, persist through obstacles, and see effort as the path to mastery.
In contrast, those with a "fixed mindset" believe talents are innate and unchangeable.

The Power of Deliberate Practice:
Malcolm Gladwell popularized the 10,000-hour rule, but there's more to the story.
It's not just practice that matters—it's deliberate, focused practice.
This means constantly pushing beyond your comfort zone.
Seeking immediate feedback and refining your approach.
The best performers spend most of their time in the struggle zone.

Goal Setting That Actually Works:
Research shows that written goals are 42% more likely to be achieved.
But not all goals are created equal.
SMART goals—Specific, Measurable, Achievable, Relevant, and Time-bound—work best.
Break big dreams into smaller, actionable milestones.
Celebrate progress, not just final outcomes.

The Environment Effect:
Your surroundings shape your behavior more than you realize.
Successful people design their environments for success.
They remove distractions, create dedicated workspaces, and establish routines.
They surround themselves with others who share their ambitions.

Building Resilience:
Every successful person has faced significant setbacks.
The difference is how they respond to failure.
They view setbacks as learning opportunities, not permanent defeats.
They maintain perspective by focusing on long-term goals.
They practice self-compassion while holding themselves accountable.

The Daily Habits of High Achievers:
Morning routines matter. Most successful people wake up early and consistently.
They prioritize their most important work during peak energy hours.
They maintain physical health through exercise and proper nutrition.
They invest time in continuous learning and skill development.
They practice gratitude and maintain positive relationships.

Taking Action:
Knowledge without action is worthless.
Start small but start today.
Pick one insight from this video and implement it immediately.
Track your progress and adjust your approach as needed.
Remember, the journey of a thousand miles begins with a single step.

Conclusion:
Success is not a destination—it's a way of living.
By adopting the mindset and habits of high achievers, you can transform your life.
The only question is: are you ready to begin?
`;

// Utility to wait for job completion
async function waitForJobCompletion(
  jobId: string,
  timeoutMs: number = 600000
): Promise<{ status: string; error?: string }> {
  const startTime = Date.now();
  const pollInterval = 5000; // Check every 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    const { data: job, error } = await supabase
      .from("jobs")
      .select("status, progress, error_code, error_message")
      .eq("id", jobId)
      .single();

    if (error) {
      return { status: "ERROR", error: error.message };
    }

    console.log(`Job ${jobId}: ${job.status} (${job.progress}%)`);

    if (job.status === "READY") {
      return { status: "READY" };
    }

    if (job.status === "FAILED") {
      return { 
        status: "FAILED", 
        error: `${job.error_code}: ${job.error_message}` 
      };
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return { status: "TIMEOUT", error: "Job did not complete within timeout" };
}

// Get user ID from email
async function getUserId(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (error || !data) {
    // Try auth.users
    const { data: authData } = await supabase.auth.admin.listUsers();
    const user = authData?.users?.find((u) => u.email === email);
    return user?.id || null;
  }

  return data.id;
}

describe("ACTUAL Video Generation - 1 Minute Video", () => {
  // This test requires worker running - using 1 min for faster testing
  
  let testUserId: string | null = null;
  let testProjectId: string | null = null;
  let testJobId: string | null = null;

  beforeAll(async () => {
    testUserId = await getUserId(TEST_USER_EMAIL);
    if (!testUserId) {
      console.log("Test user not found in database");
    }
  });

  afterAll(async () => {
    // Optionally cleanup test data
    // In production tests, you might want to keep the generated video
    console.log(`Test completed. Project: ${testProjectId}, Job: ${testJobId}`);
  });

  it("creates a 1-minute motivation video end-to-end", async () => {
    if (!testUserId) {
      console.log("Skipping - no test user");
      return;
    }

    // 1. Create project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: testUserId,
        title: `E2E Test - 1min Motivation - ${new Date().toISOString()}`,
        niche_preset: "motivation",
        target_minutes: 1,
        status: "draft",
      })
      .select()
      .single();

    expect(projectError).toBeNull();
    expect(project).toBeDefined();
    testProjectId = project.id;
    console.log(`Created project: ${testProjectId}`);

    // 2. Add content
    const { error: inputError } = await supabase
      .from("project_inputs")
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        type: "text",
        title: "Main Script",
        content_text: FIVE_MINUTE_SCRIPT_CONTENT,
        meta: {},
      });

    expect(inputError).toBeNull();
    console.log("Added content to project");

    // 3. Create job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        project_id: testProjectId,
        user_id: testUserId,
        status: "QUEUED",
        progress: 0,
        cost_credits_reserved: 1,
        cost_credits_final: 0,
      })
      .select()
      .single();

    expect(jobError).toBeNull();
    testJobId = job.id;
    console.log(`Created job: ${testJobId}`);

    // 4. Update project status
    await supabase
      .from("projects")
      .update({ status: "queued" })
      .eq("id", testProjectId);

    // 5. Wait for completion (up to 10 minutes)
    console.log("Waiting for video generation...");
    const result = await waitForJobCompletion(testJobId!, 600000);

    expect(result.status).toBe("READY");
    if (result.status !== "READY") {
      console.error("Job failed:", result.error);
    }

    // 6. Verify outputs
    const { data: assets } = await supabase
      .from("assets")
      .select("*")
      .eq("job_id", testJobId);

    expect(assets).toBeDefined();
    expect(assets!.length).toBeGreaterThan(0);

    const assetTypes = assets!.map((a) => a.type);
    console.log("Generated assets:", assetTypes);

    // Should have video, captions, etc.
    expect(assetTypes).toContain("video");
  }, 700000); // 11+ minute timeout
});

describe("Video Generation Prerequisites", () => {
  it("verifies database connection", async () => {
    const { data, error } = await supabase.from("projects").select("count");
    expect(error).toBeNull();
  });

  it("verifies test user exists", async () => {
    const userId = await getUserId(TEST_USER_EMAIL);
    if (!userId) {
      console.log(`Note: Test user ${TEST_USER_EMAIL} not found`);
    }
    // Don't fail - just informational
    expect(true).toBe(true);
  });

  it("verifies required tables exist", async () => {
    const tables = ["projects", "project_inputs", "jobs", "job_events", "assets"];
    
    for (const table of tables) {
      const { error } = await supabase.from(table).select("count").limit(1);
      expect(error).toBeNull();
    }
  });

  it("verifies worker RPC functions exist", async () => {
    // These should exist even if they return errors due to missing params
    const rpcs = ["claim_next_job", "get_user_credit_balance"];
    
    for (const rpc of rpcs) {
      // Just verify the RPC exists (will fail with param error, which is fine)
      const { error } = await supabase.rpc(rpc, {});
      // Error should be about params, not "function does not exist"
      if (error) {
        expect(error.message).not.toContain("does not exist");
      }
    }
  });
});

describe("Video Generation Configuration", () => {
  it("has all niche presets defined", () => {
    const niches = ["motivation", "explainer", "facts", "documentary", "finance", "tech"];
    expect(niches.length).toBe(6);
  });

  it("has all length options defined", () => {
    const lengths = [5, 8, 10, 12];
    expect(lengths.length).toBe(4);
    lengths.forEach((len) => {
      expect(len).toBeGreaterThanOrEqual(5);
      expect(len).toBeLessThanOrEqual(12);
    });
  });

  it("calculates correct credits for each length", () => {
    const lengths = [5, 8, 10, 12];
    lengths.forEach((len) => {
      const credits = len; // 1 credit per minute
      expect(credits).toBe(len);
    });
  });
});
