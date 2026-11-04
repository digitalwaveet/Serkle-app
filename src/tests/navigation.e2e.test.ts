import { test, expect } from '@playwright/test';

test.describe('Navigation E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
  });

  test('Home icon navigates to feed view', async ({ page }) => {
    // Navigate away from home first
    await page.click('[data-testid="nav-circles"]');
    await expect(page).toHaveURL(/.*circles/);
    
    // Click home icon
    await page.click('[data-testid="nav-home"]');
    await expect(page).toHaveURL('/');
    
    // Verify feed view is active
    await expect(page.locator('[data-testid="feed-view"]')).toBeVisible();
  });

  test('Circles icon navigates to circles page', async ({ page }) => {
    await page.click('[data-testid="nav-circles"]');
    await expect(page.locator('[data-testid="circles-page"]')).toBeVisible();
  });

  test('Ask icon navigates to ask page', async ({ page }) => {
    await page.click('[data-testid="nav-ask"]');
    await expect(page).toHaveURL('/ask');
    await expect(page.locator('[data-testid="ask-page"]')).toBeVisible();
  });

  test('Safe icon navigates to safe page', async ({ page }) => {
    await page.click('[data-testid="nav-safe"]');
    await expect(page.locator('[data-testid="safe-page"]')).toBeVisible();
  });

  test('Add button opens create modal', async ({ page }) => {
    await page.click('[data-testid="nav-add"]');
    await expect(page.locator('[data-testid="create-modal"]')).toBeVisible();
  });

  test('Header notifications icon navigates to notifications page', async ({ page }) => {
    await page.click('[data-testid="header-notifications"]');
    await expect(page).toHaveURL('/notifications');
    await expect(page.locator('[data-testid="notifications-page"]')).toBeVisible();
  });

  test('Header shop icon navigates to shop page', async ({ page }) => {
    await page.click('[data-testid="header-shop"]');
    await expect(page).toHaveURL('/shop');
    await expect(page.locator('[data-testid="shop-page"]')).toBeVisible();
  });

  test('Header messages navigation works', async ({ page }) => {
    // Open user menu
    await page.click('[data-testid="header-user-menu"]');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Click messages
    await page.click('[data-testid="menu-messages"]');
    await expect(page).toHaveURL('/messages');
    await expect(page.locator('[data-testid="messages-page"]')).toBeVisible();
  });

  test('Create options navigation works', async ({ page }) => {
    // Open create popup
    await page.click('[data-testid="nav-add"]');
    await expect(page.locator('[data-testid="create-popup"]')).toBeVisible();
    
    // Test Post creation
    await page.click('[data-testid="create-post"]');
    await expect(page).toHaveURL('/create/post');
    
    // Go back and test Circle creation
    await page.goto('/');
    await page.click('[data-testid="nav-add"]');
    await page.click('[data-testid="create-circle"]');
    await expect(page).toHaveURL('/create/circle');
    
    // Go back and test Shop creation
    await page.goto('/');
    await page.click('[data-testid="nav-add"]');
    await page.click('[data-testid="create-shop"]');
    await expect(page).toHaveURL('/create/shop');
  });

  test('Navigation state consistency', async ({ page }) => {
    // Test that navigation state is properly maintained
    await page.click('[data-testid="nav-circles"]');
    await expect(page.locator('[data-testid="nav-circles"]')).toHaveClass(/text-primary/);
    
    await page.click('[data-testid="nav-home"]');
    await expect(page.locator('[data-testid="nav-home"]')).toHaveClass(/text-primary/);
    
    await page.click('[data-testid="nav-ask"]');
    await expect(page.locator('[data-testid="nav-ask"]')).toHaveClass(/text-primary/);
  });

  test('Back navigation preserves correct state', async ({ page }) => {
    // Navigate through several pages
    await page.click('[data-testid="nav-ask"]');
    await page.goBack();
    
    // Should be back to home with feed view
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid="feed-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-home"]')).toHaveClass(/text-primary/);
  });
});