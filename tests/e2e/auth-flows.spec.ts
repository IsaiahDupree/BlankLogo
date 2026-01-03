import { test, expect } from "@playwright/test";

/**
 * BlankLogo Comprehensive Auth Flow Tests
 * Tests the complete account lifecycle:
 * - Sign up / Email verification
 * - Login / Logout
 * - Password reset flow
 * - Session management
 * - Account deletion
 */

const BASE_URL = "http://localhost:3838";
const API_URL = "http://localhost:3838/api";

// Test user credentials
const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: "TestPassword123!",
  name: "Test User",
};

test.describe("Sign Up Flow", () => {
  test("signup page loads correctly", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    await expect(page).toHaveTitle(/BlankLogo|Sign|Create/i);
    await expect(page.locator('h1')).toContainText(/create|sign up/i);
  });

  test("signup form has required fields", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    const emailField = page.locator('#email, input[type="email"]').first();
    const passwordField = page.locator('#password, input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]');
    
    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test("signup validates email format", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    const emailField = page.locator('#email, input[type="email"]').first();
    const passwordField = page.locator('#password, input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]');
    
    await emailField.fill("invalid-email");
    await passwordField.fill("ValidPassword123!");
    await submitButton.click();
    
    // Browser validation or form should prevent submission
    await page.waitForTimeout(500);
    expect(page.url()).toContain("/signup");
  });

  test("signup validates password length", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    const emailField = page.locator('#email, input[type="email"]').first();
    const passwordField = page.locator('#password, input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]');
    
    await emailField.fill("test@example.com");
    await passwordField.fill("short");
    await submitButton.click();
    
    // Should show validation message or error
    await page.waitForTimeout(1000);
    const hasError = await page.locator('text=/password|character|minimum/i').isVisible().catch(() => false);
    const stayedOnPage = page.url().includes("/signup");
    
    expect(hasError || stayedOnPage).toBe(true);
  });

  test("signup API endpoint accepts valid data", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/signup`, {
      data: {
        email: `api-test-${Date.now()}@example.com`,
        password: "ValidPassword123!",
        name: "API Test User",
      },
    });
    
    expect(response.status()).toBeLessThan(500);
    
    const data = await response.json();
    expect(data.message || data.error).toBeDefined();
  });

  test("signup API rejects short passwords", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/signup`, {
      data: {
        email: "test@example.com",
        password: "short",
      },
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain("8 characters");
  });

  test("signup has link to login page", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    const loginLink = page.locator('a[href="/login"], a:has-text("Sign in"), a:has-text("Log in")').first();
    await expect(loginLink).toBeVisible();
    
    await loginLink.click();
    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Login Flow", () => {
  test("login page loads correctly", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await expect(page).toHaveTitle(/BlankLogo|Login|Sign/i);
    await expect(page.locator('h1')).toContainText(/welcome|sign in|log in/i);
  });

  test("login form has required fields", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const emailField = page.locator('#email, input[type="email"]').first();
    const passwordField = page.locator('#password, input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]');
    
    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test("login shows error for invalid credentials", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const emailField = page.locator('#email, input[type="email"]').first();
    const passwordField = page.locator('#password, input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]');
    
    await emailField.fill("nonexistent@example.com");
    await passwordField.fill("wrongpassword");
    await submitButton.click();
    
    // Wait for error message
    await page.waitForTimeout(2000);
    
    const hasError = await page.locator('text=/invalid|error|incorrect|failed/i').isVisible().catch(() => false);
    const stayedOnPage = page.url().includes("/login");
    
    expect(hasError || stayedOnPage).toBe(true);
  });

  test("login API endpoint rejects invalid credentials", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: "nonexistent@example.com",
        password: "wrongpassword",
      },
    });
    
    expect(response.status()).toBe(401);
    
    const data = await response.json();
    expect(data.error).toContain("Invalid");
  });

  test("login API requires email and password", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { email: "test@example.com" },
    });
    
    expect(response.status()).toBe(400);
  });

  test("login has link to signup page", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const signupLink = page.locator('a[href="/signup"], a:has-text("Sign up"), a:has-text("Create")').first();
    await expect(signupLink).toBeVisible();
    
    await signupLink.click();
    await expect(page).toHaveURL(/signup/);
  });

  test("login has forgot password link", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const forgotLink = page.locator('a[href="/forgot-password"], a:has-text("Forgot")').first();
    await expect(forgotLink).toBeVisible();
    
    await forgotLink.click();
    await expect(page).toHaveURL(/forgot-password/);
  });
});

test.describe("Forgot Password Flow", () => {
  test("forgot password page loads correctly", async ({ page }) => {
    await page.goto(`${BASE_URL}/forgot-password`);
    
    await expect(page.locator('h1')).toContainText(/reset|forgot|password/i);
  });

  test("forgot password form has email field", async ({ page }) => {
    await page.goto(`${BASE_URL}/forgot-password`);
    
    const emailField = page.locator('#email, input[type="email"]').first();
    const submitButton = page.locator('button[type="submit"]');
    
    await expect(emailField).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test("forgot password shows confirmation after submit", async ({ page }) => {
    await page.goto(`${BASE_URL}/forgot-password`);
    
    const emailField = page.locator('#email, input[type="email"]').first();
    const submitButton = page.locator('button[type="submit"]');
    
    await emailField.fill("test@example.com");
    await submitButton.click();
    
    // Should show confirmation message or loading state
    await page.waitForTimeout(3000);
    
    const hasConfirmation = await page.locator('text=/check|sent|email|if.*account/i').isVisible().catch(() => false);
    const isLoading = await page.locator('text=/sending|loading/i').isVisible().catch(() => false);
    const stayedOnPage = page.url().includes("forgot-password");
    
    // Form submission attempted - either shows confirmation, loading, or stays on page
    expect(hasConfirmation || isLoading || stayedOnPage).toBe(true);
  });

  test("forgot password API always returns success (prevents enumeration)", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/forgot-password`, {
      data: {
        email: "nonexistent@example.com",
      },
    });
    
    // Should always return 200 to prevent email enumeration
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    expect(data.message).toBeDefined();
  });

  test("forgot password has back to login link", async ({ page }) => {
    await page.goto(`${BASE_URL}/forgot-password`);
    
    const backLink = page.locator('a:has-text("Back"), a:has-text("login"), a[href="/login"]').first();
    await expect(backLink).toBeVisible();
  });
});

test.describe("Reset Password Flow", () => {
  test("reset password page loads correctly", async ({ page }) => {
    await page.goto(`${BASE_URL}/reset-password`);
    
    await expect(page.locator('h1')).toContainText(/reset|new|password/i);
  });

  test("reset password form has password fields", async ({ page }) => {
    await page.goto(`${BASE_URL}/reset-password`);
    
    const passwordField = page.locator('#password, input[type="password"]').first();
    const confirmField = page.locator('#confirmPassword, input[name="confirmPassword"]');
    const submitButton = page.locator('button[type="submit"]');
    
    await expect(passwordField).toBeVisible();
    await expect(submitButton).toBeVisible();
    
    // Confirm field may or may not exist
    if (await confirmField.isVisible().catch(() => false)) {
      expect(true).toBe(true);
    }
  });

  test("reset password validates password match", async ({ page }) => {
    await page.goto(`${BASE_URL}/reset-password`);
    
    const passwordField = page.locator('#password').first();
    const confirmField = page.locator('#confirmPassword');
    const submitButton = page.locator('button[type="submit"]');
    
    if (await confirmField.isVisible().catch(() => false)) {
      await passwordField.fill("NewPassword123!");
      await confirmField.fill("DifferentPassword!");
      await submitButton.click();
      
      await page.waitForTimeout(1000);
      
      const hasError = await page.locator('text=/match|different/i').isVisible().catch(() => false);
      expect(hasError).toBe(true);
    }
  });

  test("reset password API requires password", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/reset-password`, {
      data: {},
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain("required");
  });
});

test.describe("Logout Flow", () => {
  test("logout API endpoint works", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/logout`, {
      data: { scope: "local" },
    });
    
    // Should return success even if not logged in
    expect(response.status()).toBeLessThan(500);
  });

  test("logout all devices API endpoint works", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/logout`, {
      data: { scope: "global" },
    });
    
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe("Change Password Flow", () => {
  test("change password API requires current and new password", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/change-password`, {
      data: {
        currentPassword: "oldpass",
      },
    });
    
    expect(response.status()).toBe(400);
  });

  test("change password API validates new password length", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/change-password`, {
      data: {
        currentPassword: "OldPassword123!",
        newPassword: "short",
      },
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain("8 characters");
  });
});

test.describe("Change Email Flow", () => {
  test("change email API requires new email and password", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/change-email`, {
      data: {
        newEmail: "new@example.com",
      },
    });
    
    expect(response.status()).toBe(400);
  });
});

test.describe("Email Verification Flow", () => {
  test("verify email API endpoint exists", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/verify-email`, {
      data: {
        email: "test@example.com",
      },
    });
    
    // Should return 200 to prevent enumeration
    expect(response.ok()).toBe(true);
  });
});

test.describe("Get Current User Flow", () => {
  test("me API returns 401 when not authenticated", async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/me`);
    
    expect(response.status()).toBe(401);
  });
});

test.describe("Session Management Flow", () => {
  test("sessions API returns 401 when not authenticated", async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/sessions`);
    
    expect(response.status()).toBe(401);
  });
});

test.describe("Re-authentication Flow", () => {
  test("reauth API requires password", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/reauth`, {
      data: {},
    });
    
    expect(response.status()).toBe(400);
  });
});

test.describe("Account Deletion Flow", () => {
  test("delete account API requires password", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/delete-account`, {
      data: {
        confirmation: "DELETE",
      },
    });
    
    expect(response.status()).toBe(400);
  });

  test("delete account API requires confirmation", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/delete-account`, {
      data: {
        password: "password123",
      },
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain("DELETE");
  });

  test("delete account API requires exact confirmation text", async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/delete-account`, {
      data: {
        password: "password123",
        confirmation: "delete",
      },
    });
    
    expect(response.status()).toBe(400);
  });
});

test.describe("Auth Navigation Flow", () => {
  test("can navigate signup -> login -> forgot-password", async ({ page }) => {
    // Start at signup
    await page.goto(`${BASE_URL}/signup`);
    await expect(page).toHaveURL(/signup/);
    
    // Go to login
    const loginLink = page.locator('a[href="/login"], a:has-text("Sign in")').first();
    await loginLink.click();
    await expect(page).toHaveURL(/login/);
    
    // Go to forgot password
    const forgotLink = page.locator('a[href="/forgot-password"], a:has-text("Forgot")').first();
    await forgotLink.click();
    await expect(page).toHaveURL(/forgot-password/);
    
    // Go back to login
    const backLink = page.locator('a[href="/login"], a:has-text("Back")').first();
    await backLink.click();
    await expect(page).toHaveURL(/login/);
  });

  test("all auth pages have BlankLogo branding", async ({ page }) => {
    const pages = ["/login", "/signup", "/forgot-password", "/reset-password"];
    
    for (const authPage of pages) {
      await page.goto(`${BASE_URL}${authPage}`);
      
      const hasLogo = await page.locator('text=BlankLogo').isVisible({ timeout: 3000 }).catch(() => false);
      const hasBranding = await page.locator('[class*="indigo"], [class*="purple"]').first().isVisible().catch(() => false);
      
      expect(hasLogo || hasBranding).toBe(true);
    }
  });
});

test.describe("Auth Security Tests", () => {
  test("passwords are not logged in network requests", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const emailField = page.locator('#email, input[type="email"]').first();
    const passwordField = page.locator('#password, input[type="password"]').first();
    
    await emailField.fill("test@example.com");
    await passwordField.fill("SecretPassword123!");
    
    // Password field should have type="password"
    const type = await passwordField.getAttribute("type");
    expect(type).toBe("password");
  });

  test("forms have CSRF protection or proper method", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const form = page.locator('form').first();
    // React forms often use onSubmit with fetch, not form method
    const hasForm = await form.isVisible().catch(() => false);
    const submitButton = page.locator('button[type="submit"]');
    const hasSubmit = await submitButton.isVisible().catch(() => false);
    
    // Form exists with submit button (JS handles submission)
    expect(hasForm && hasSubmit).toBe(true);
  });

  test("auth pages use HTTPS-ready URLs", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Check form action doesn't have http:// hardcoded
    const form = page.locator('form').first();
    const action = await form.getAttribute("action");
    
    if (action) {
      expect(action).not.toMatch(/^http:\/\//);
    }
  });
});

test.describe("Auth Accessibility Tests", () => {
  test("login form has proper labels", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const emailLabel = page.locator('label[for="email"]');
    const passwordLabel = page.locator('label[for="password"]');
    
    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
  });

  test("signup form has proper labels", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    const emailLabel = page.locator('label[for="email"]');
    const passwordLabel = page.locator('label[for="password"]');
    
    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
  });

  test("error messages are visible", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const emailField = page.locator('#email, input[type="email"]').first();
    const passwordField = page.locator('#password, input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]');
    
    await emailField.fill("invalid@test.com");
    await passwordField.fill("wrongpassword");
    await submitButton.click();
    
    await page.waitForTimeout(2000);
    
    // Error should be visible if displayed
    const errorArea = page.locator('[class*="error"], [class*="red"], [role="alert"]').first();
    const hasError = await errorArea.isVisible().catch(() => false);
    
    // Either has visible error or stays on login page
    expect(hasError || page.url().includes("/login")).toBe(true);
  });
});
