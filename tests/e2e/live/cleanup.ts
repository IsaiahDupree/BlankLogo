/**
 * E2E Test Data Cleanup Utility
 * 
 * Cleans up test data created during live e2e test runs:
 * - Users with email LIKE 'e2e+%'
 * - Jobs/projects with created_by = 'e2e'
 * - Storage objects under /e2e/
 * 
 * Run manually or as scheduled job in staging
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const MAX_AGE_HOURS = parseInt(process.env.E2E_CLEANUP_MAX_AGE_HOURS || "24");

async function cleanup() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const cutoffDate = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();
  
  console.log(`🧹 E2E Cleanup - Removing test data older than ${MAX_AGE_HOURS} hours`);
  console.log(`   Cutoff: ${cutoffDate}`);
  console.log("");

  // 1. Clean up e2e test jobs
  console.log("1️⃣  Cleaning up e2e jobs...");
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .delete()
    .or(`metadata->>created_by.eq.e2e,metadata->>run_id.like.e2e-%`)
    .lt("created_at", cutoffDate)
    .select("id");

  if (jobsError) {
    console.error("   ❌ Error deleting jobs:", jobsError.message);
  } else {
    console.log(`   ✅ Deleted ${jobs?.length || 0} jobs`);
  }

  // 2. Clean up e2e test users (profiles first due to FK)
  console.log("2️⃣  Cleaning up e2e profiles...");
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .delete()
    .like("email", "e2e+%")
    .lt("created_at", cutoffDate)
    .select("id, email");

  if (profilesError) {
    console.error("   ❌ Error deleting profiles:", profilesError.message);
  } else {
    console.log(`   ✅ Deleted ${profiles?.length || 0} profiles`);
  }

  // 3. Clean up e2e storage objects
  console.log("3️⃣  Cleaning up e2e storage objects...");
  const { data: files, error: filesError } = await supabase
    .storage
    .from("videos")
    .list("e2e", { limit: 1000 });

  if (filesError) {
    console.error("   ❌ Error listing storage:", filesError.message);
  } else if (files && files.length > 0) {
    const filesToDelete = files
      .filter(f => new Date(f.created_at) < new Date(cutoffDate))
      .map(f => `e2e/${f.name}`);

    if (filesToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .storage
        .from("videos")
        .remove(filesToDelete);

      if (deleteError) {
        console.error("   ❌ Error deleting files:", deleteError.message);
      } else {
        console.log(`   ✅ Deleted ${filesToDelete.length} storage objects`);
      }
    } else {
      console.log("   ✅ No old storage objects to delete");
    }
  } else {
    console.log("   ✅ No e2e storage objects found");
  }

  // 4. Clean up Supabase Auth users (requires admin API)
  console.log("4️⃣  Cleaning up e2e auth users...");
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error("   ❌ Error listing auth users:", authError.message);
  } else {
    const e2eUsers = authUsers.users.filter(u => 
      u.email?.startsWith("e2e+") && 
      new Date(u.created_at) < new Date(cutoffDate)
    );

    for (const user of e2eUsers) {
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteUserError) {
        console.error(`   ❌ Error deleting user ${user.email}:`, deleteUserError.message);
      }
    }
    console.log(`   ✅ Deleted ${e2eUsers.length} auth users`);
  }

  console.log("");
  console.log("🎉 Cleanup complete!");
}

// Run if called directly
if (require.main === module) {
  cleanup().catch(console.error);
}

export { cleanup };
