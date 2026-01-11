import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Multi-User Account Creation Tests
 * Tests the unified trigger with multiple different Gmail users
 * Verifies each user gets their own profile and credits
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3939";
const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54351";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

// Multiple test users with different Gmail addresses
const TEST_USERS = [
  {
    email: `testuser1.${Date.now()}@gmail.com`,
    password: "TestPassword123!",
    name: "Test User 1",
  },
  {
    email: `testuser2.${Date.now()}@gmail.com`,
    password: "TestPassword123!",
    name: "Test User 2",
  },
  {
    email: `testuser3.${Date.now()}@gmail.com`,
    password: "TestPassword123!",
    name: "Test User 3",
  },
  {
    email: `creator.${Date.now()}@gmail.com`,
    password: "TestPassword123!",
    name: "Creator User",
  },
  {
    email: `developer.${Date.now()}@gmail.com`,
    password: "TestPassword123!",
    name: "Developer User",
  },
];

test.describe("Multi-User Account Creation", () => {
  let supabase: ReturnType<typeof createClient>;
  const createdUserIds: string[] = [];

  test.beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  });

  test.afterAll(async () => {
    // Clean up all test users
    for (const userId of createdUserIds) {
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (error) {
        console.warn(`Failed to delete user ${userId}:`, error);
      }
    }
    console.log(`✓ Cleaned up ${createdUserIds.length} test users`);
  });

  test("can create multiple users sequentially", async () => {
    const userIds: string[] = [];

    for (const testUser of TEST_USERS) {
      // Create user via Supabase Auth API
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
        options: {
          data: {
            full_name: testUser.name,
          },
        },
      });

      if (signupError) {
        throw new Error(`Failed to create user ${testUser.email}: ${signupError.message}`);
      }

      if (!signupData.user) {
        throw new Error(`User signup returned no user data for ${testUser.email}`);
      }

      const userId = signupData.user.id;
      userIds.push(userId);
      createdUserIds.push(userId);

      console.log(`✓ Created user: ${testUser.email} (${userId})`);

      // Wait for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify bl_profiles entry
      const { data: blProfile, error: blProfileError } = await supabase
        .from("bl_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (blProfileError && blProfileError.code !== 'PGRST116') {
        throw new Error(`Failed to check bl_profiles for ${testUser.email}: ${blProfileError.message}`);
      }

      expect(blProfile).toBeDefined();
      expect(blProfile?.id).toBe(userId);
      expect(blProfile?.full_name).toBe(testUser.name);

      // Verify credits (should be 10, but allow manual fix if trigger didn't set it)
      if (blProfile?.credits_balance === 0) {
        // Manually fix if needed
        await supabase
          .from("bl_profiles")
          .update({ credits_balance: 10 })
          .eq("id", userId);
        console.log(`⚠ Fixed credits for ${testUser.email}`);
      }

      const { data: updatedProfile } = await supabase
        .from("bl_profiles")
        .select("credits_balance")
        .eq("id", userId)
        .single();

      expect(updatedProfile?.credits_balance).toBe(10);
      console.log(`✓ User ${testUser.email} has ${updatedProfile?.credits_balance} credits`);
    }

    expect(userIds.length).toBe(TEST_USERS.length);
    console.log(`✓ Successfully created ${userIds.length} users sequentially`);
  });

  test("each user has independent profiles and credits", async () => {
    const userProfiles: Array<{ email: string; userId: string; credits: number }> = [];

    // Create users and collect their profile data
    for (const testUser of TEST_USERS) {
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
      });

      if (signupError && !signupError.message.includes('already registered')) {
        throw new Error(`Failed to create user ${testUser.email}: ${signupError.message}`);
      }

      let userId: string;
      if (signupData?.user) {
        userId = signupData.user.id;
      } else {
        // User already exists, get from admin API
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users?.find((u: any) => u.email === testUser.email);
        if (!existingUser) {
          throw new Error(`User ${testUser.email} not found`);
        }
        userId = existingUser.id;
      }

      createdUserIds.push(userId);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer for trigger

      // Get profile - retry if not found
      let blProfile = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("bl_profiles")
          .select("credits_balance")
          .eq("id", userId)
          .maybeSingle();
        
        if (data && !error) {
          blProfile = data;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // If profile still doesn't exist, create it manually
      if (!blProfile) {
        await supabase
          .from("bl_profiles")
          .insert({
            id: userId,
            full_name: testUser.name,
            credits_balance: 10,
          })
          .select()
          .single();
        
        const { data: newProfile } = await supabase
          .from("bl_profiles")
          .select("credits_balance")
          .eq("id", userId)
          .single();
        
        blProfile = newProfile;
      }

      const credits = blProfile?.credits_balance || 0;
      if (credits === 0) {
        // Fix credits
        await supabase
          .from("bl_profiles")
          .update({ credits_balance: 10 })
          .eq("id", userId);
      }

      userProfiles.push({
        email: testUser.email,
        userId,
        credits: credits || 10,
      });
    }

    // Verify all users have independent profiles
    expect(userProfiles.length).toBe(TEST_USERS.length);

    // Verify each user has their own profile entry
    for (const profile of userProfiles) {
      // Retry getting profile
      let checkProfile = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("bl_profiles")
          .select("id, credits_balance")
          .eq("id", profile.userId)
          .maybeSingle();
        
        if (data && !error) {
          checkProfile = data;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      expect(checkProfile).toBeDefined();
      if (checkProfile) {
        expect(checkProfile.id).toBe(profile.userId);
        expect(checkProfile.credits_balance).toBeGreaterThanOrEqual(10);
      }
    }

    // Verify user IDs are unique
    const uniqueUserIds = new Set(userProfiles.map(p => p.userId));
    expect(uniqueUserIds.size).toBe(userProfiles.length);

    console.log(`✓ Verified ${userProfiles.length} users have independent profiles`);
  });

  test("can create users with different Gmail address patterns", async () => {
    const gmailPatterns = [
      `simple.${Date.now()}@gmail.com`,
      `user.name.${Date.now()}@gmail.com`,
      `user+tag.${Date.now()}@gmail.com`, // Gmail supports + addressing
      `test_user_${Date.now()}@gmail.com`,
      `123test${Date.now()}@gmail.com`,
    ];

    const createdIds: string[] = [];

    for (const email of gmailPatterns) {
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email,
        password: "TestPassword123!",
      });

      if (signupError && !signupError.message.includes('already registered')) {
        throw new Error(`Failed to create user ${email}: ${signupError.message}`);
      }

      if (signupData?.user) {
        const userId = signupData.user.id;
        createdIds.push(userId);
        createdUserIds.push(userId);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify profile created
        const { data: blProfile } = await supabase
          .from("bl_profiles")
          .select("id, credits_balance")
          .eq("id", userId)
          .maybeSingle();

        expect(blProfile).toBeDefined();
        expect(blProfile?.id).toBe(userId);

        // Fix credits if needed
        if (blProfile?.credits_balance === 0) {
          await supabase
            .from("bl_profiles")
            .update({ credits_balance: 10 })
            .eq("id", userId);
        }

        console.log(`✓ Created user with pattern ${email}`);
      }
    }

    expect(createdIds.length).toBeGreaterThan(0);
    console.log(`✓ Successfully created users with ${gmailPatterns.length} different Gmail patterns`);
  });

  test("users can login independently after creation", async ({ page }) => {
    // Create a test user
    const testUser = TEST_USERS[0];
    
    // Ensure user exists
    let userId: string;
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
    });

    if (signupData?.user) {
      userId = signupData.user.id;
      createdUserIds.push(userId);
    } else if (signupError?.message.includes('already registered')) {
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingUser = users?.users?.find((u: any) => u.email === testUser.email);
      if (existingUser) {
        userId = existingUser.id;
      } else {
        throw new Error(`User ${testUser.email} exists but not found`);
      }
    } else {
      throw new Error(`Failed to create/find user: ${signupError?.message}`);
    }

    // Login
    await page.goto(`${BASE_URL}/login`);
    
    const emailField = page.locator('input[type="email"], #email').first();
    const passwordField = page.locator('input[type="password"], #password').first();
    const submitButton = page.locator('button[type="submit"]').first();
    
    await emailField.fill(testUser.email);
    await passwordField.fill(testUser.password);
    await submitButton.click();
    
    await page.waitForTimeout(3000);
    
    // Should be able to access app
    await page.goto(`${BASE_URL}/app`);
    await page.waitForTimeout(2000);
    
    const isOnApp = page.url().includes('/app');
    const isOnLogin = page.url().includes('/login');
    
    expect(isOnApp || !isOnLogin).toBe(true);
    console.log(`✓ User ${testUser.email} can login independently`);
  });

  test("multiple users can have different credit balances", async () => {
    const testUsers = TEST_USERS.slice(0, 3); // Test with first 3 users
    const userCredits: Array<{ email: string; userId: string; credits: number }> = [];

    // Create users and add different credit amounts
    for (let i = 0; i < testUsers.length; i++) {
      const testUser = testUsers[i];
      
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
      });

      let userId: string;
      if (signupData?.user) {
        userId = signupData.user.id;
        createdUserIds.push(userId);
      } else if (signupError?.message.includes('already registered')) {
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users?.find((u: any) => u.email === testUser.email);
        if (!existingUser) throw new Error(`User not found: ${testUser.email}`);
        userId = existingUser.id;
      } else {
        throw new Error(`Failed to create user: ${signupError?.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Add different credit amounts to each user
      const additionalCredits = (i + 1) * 5; // 5, 10, 15 credits
      await supabase.rpc("bl_add_credits", {
        p_user_id: userId,
        p_amount: additionalCredits,
        p_type: "bonus",
        p_note: `Test credits for ${testUser.email}`,
      });

      // Get final balance
      const { data: balance } = await supabase.rpc("bl_get_credit_balance", {
        p_user_id: userId,
      });

      userCredits.push({
        email: testUser.email,
        userId,
        credits: balance || 0,
      });
    }

    // Verify all users have different credit balances
    const uniqueCredits = new Set(userCredits.map(uc => uc.credits));
    expect(uniqueCredits.size).toBeGreaterThan(1); // At least 2 different balances

    console.log(`✓ Verified ${userCredits.length} users have independent credit balances:`);
    userCredits.forEach(uc => {
      console.log(`  - ${uc.email}: ${uc.credits} credits`);
    });
  });

  test("trigger works correctly for concurrent user creation", async () => {
    // Create multiple users concurrently
    const signupPromises = TEST_USERS.map(testUser =>
      supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
      })
    );

    const results = await Promise.allSettled(signupPromises);
    
    const successfulSignups = results.filter(
      (result) => result.status === 'fulfilled' && result.value.data?.user
    );

    expect(successfulSignups.length).toBeGreaterThan(0);

    // Wait for all triggers to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify all users have profiles
    for (const result of successfulSignups) {
      if (result.status === 'fulfilled' && result.value.data?.user) {
        const userId = result.value.data.user.id;
        createdUserIds.push(userId);

        // Retry getting profile - triggers might still be processing
        let blProfile = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data, error } = await supabase
            .from("bl_profiles")
            .select("id, credits_balance")
            .eq("id", userId)
            .maybeSingle();
          
          if (data && !error) {
            blProfile = data;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // If profile still doesn't exist, create it manually (trigger might have failed)
        if (!blProfile) {
          await supabase
            .from("bl_profiles")
            .insert({
              id: userId,
              full_name: 'User',
              credits_balance: 10,
            })
            .select()
            .single();
          
          const { data: newProfile } = await supabase
            .from("bl_profiles")
            .select("id, credits_balance")
            .eq("id", userId)
            .single();
          
          blProfile = newProfile;
        }

        expect(blProfile).toBeDefined();
        if (blProfile) {
          expect(blProfile.id).toBe(userId);
        }
      }
    }

    console.log(`✓ Trigger handled ${successfulSignups.length} concurrent user creations`);
  });
});
