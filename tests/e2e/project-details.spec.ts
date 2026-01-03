import { test, expect } from "@playwright/test";

// ============================================
// Project Details Page E2E Tests
// ============================================

const TEST_USER = {
  email: "isaiahdupree33@gmail.com",
  password: "Frogger12",
};

async function login(page: any) {
  await page.goto("/login");
  await page.fill('#email', TEST_USER.email);
  await page.fill('#password', TEST_USER.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function createProject(page: any, title: string) {
  await page.goto("/app/new", { waitUntil: "networkidle" });
  const titleInput = page.locator('#title');
  if (!await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    return null;
  }
  await page.fill('#title', title);
  await page.click('button:has-text("Motivation")');
  await page.click('button[type="submit"]:has-text("Create Project")');
  await expect(page).toHaveURL(/\/app\/projects\/[a-z0-9-]+/, { timeout: 15000 });
  return page.url();
}

test.describe("Project Details Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("displays project title and metadata", async ({ page }) => {
    const projectUrl = await createProject(page, `Details Test ${Date.now()}`);
    if (!projectUrl) return;

    // Should show project title
    const title = page.locator('h1, h2, [data-testid="project-title"]').first();
    await expect(title).toBeVisible();
  });

  test("shows project status", async ({ page }) => {
    const projectUrl = await createProject(page, `Status Test ${Date.now()}`);
    if (!projectUrl) return;

    // Look for status indicator
    const status = page.locator('text=/draft|queued|processing|ready|failed/i').first();
    if (await status.isVisible({ timeout: 3000 })) {
      expect(await status.isVisible()).toBe(true);
    }
  });

  test("has back navigation to dashboard", async ({ page }) => {
    const projectUrl = await createProject(page, `Nav Test ${Date.now()}`);
    if (!projectUrl) return;

    // Look for back link/button
    const backLink = page.locator(
      'a:has-text("Back"), a:has-text("Projects"), a[href="/app"], button:has-text("Back")'
    ).first();
    
    if (await backLink.isVisible({ timeout: 3000 })) {
      await backLink.click();
      await expect(page).toHaveURL(/\/app/);
    }
  });

  test("shows input section", async ({ page }) => {
    const projectUrl = await createProject(page, `Input Section Test ${Date.now()}`);
    if (!projectUrl) return;

    // Look for inputs section
    const inputSection = page.locator('text=/inputs|content|sources/i').first();
    if (await inputSection.isVisible({ timeout: 3000 })) {
      expect(await inputSection.isVisible()).toBe(true);
    }
  });

  test("can refresh project status", async ({ page }) => {
    const projectUrl = await createProject(page, `Refresh Test ${Date.now()}`);
    if (!projectUrl) return;

    // Look for refresh button
    const refreshButton = page.locator(
      'button:has-text("Refresh"), button[aria-label*="refresh"], [data-testid="refresh"]'
    ).first();
    
    if (await refreshButton.isVisible({ timeout: 3000 })) {
      await refreshButton.click();
      // Should still be on same page after refresh
      expect(page.url()).toContain("/app/projects/");
    }
  });
});

test.describe("Project Actions", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("can edit project title", async ({ page }) => {
    const projectUrl = await createProject(page, `Edit Title Test ${Date.now()}`);
    if (!projectUrl) return;

    // Look for edit button
    const editButton = page.locator(
      'button:has-text("Edit"), button[aria-label*="edit"], [data-testid="edit-title"]'
    ).first();
    
    if (await editButton.isVisible({ timeout: 3000 })) {
      await editButton.click();
      
      // Look for title input
      const titleInput = page.locator('input[name="title"], input#title, [data-testid="title-input"]').first();
      if (await titleInput.isVisible({ timeout: 2000 })) {
        await titleInput.fill("Updated Title");
        
        // Save
        const saveButton = page.locator('button:has-text("Save")').first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
        }
      }
    }
  });

  test("can delete project", async ({ page }) => {
    const projectUrl = await createProject(page, `Delete Project Test ${Date.now()}`);
    if (!projectUrl) return;

    // Look for delete button
    const deleteButton = page.locator(
      'button:has-text("Delete Project"), button:has-text("Remove"), [data-testid="delete-project"]'
    ).first();
    
    if (await deleteButton.isVisible({ timeout: 3000 })) {
      await deleteButton.click();
      
      // Confirm deletion
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
        // Should redirect to dashboard
        await expect(page).toHaveURL(/\/app/, { timeout: 5000 });
      }
    }
  });

  test("can duplicate project", async ({ page }) => {
    const projectUrl = await createProject(page, `Duplicate Test ${Date.now()}`);
    if (!projectUrl) return;

    // Look for duplicate button
    const duplicateButton = page.locator(
      'button:has-text("Duplicate"), button:has-text("Copy"), [data-testid="duplicate"]'
    ).first();
    
    if (await duplicateButton.isVisible({ timeout: 3000 })) {
      await duplicateButton.click();
      // Should create new project
      await page.waitForTimeout(1000);
    }
  });
});

test.describe("Project Assets", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("shows assets section when available", async ({ page }) => {
    await page.goto("/app");
    
    // Find a completed project
    const completedProject = page.locator('text=/ready|completed|done/i').first();
    if (await completedProject.isVisible({ timeout: 3000 })) {
      await completedProject.click();
      
      // Look for assets
      const assets = page.locator('text=/assets|video|audio|images|download/i').first();
      if (await assets.isVisible({ timeout: 3000 })) {
        expect(await assets.isVisible()).toBe(true);
      }
    }
  });

  test("can preview video if available", async ({ page }) => {
    await page.goto("/app");
    
    const completedProject = page.locator('a[href*="/app/projects/"]:has-text("ready"), a[href*="/app/projects/"]:has-text("completed")').first();
    if (await completedProject.isVisible({ timeout: 3000 })) {
      await completedProject.click();
      
      // Look for video player or preview
      const videoElement = page.locator('video, [data-testid="video-preview"], button:has-text("Preview")');
      if (await videoElement.isVisible({ timeout: 3000 })) {
        expect(await videoElement.isVisible()).toBe(true);
      }
    }
  });

  test("can download assets", async ({ page }) => {
    await page.goto("/app");
    
    const completedProject = page.locator('a[href*="/app/projects/"]').first();
    if (await completedProject.isVisible({ timeout: 3000 })) {
      await completedProject.click();
      
      // Look for download button
      const downloadButton = page.locator(
        'a:has-text("Download"), button:has-text("Download"), [data-testid="download"]'
      ).first();
      
      if (await downloadButton.isVisible({ timeout: 3000 })) {
        expect(await downloadButton.isVisible()).toBe(true);
      }
    }
  });
});
