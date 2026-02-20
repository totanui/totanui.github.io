import { test, expect } from '@playwright/test';

test.describe('Badminton Grouper', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start each test with a clean state
    await page.goto('/badminton/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('loads the app with title and subtitle', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Badminton Grouper');
    await expect(page.locator('.subtitle')).toContainText('2 courts');
  });

  test('can add a player', async ({ page }) => {
    await page.fill('input[placeholder="Add player name…"]', 'Alice');
    await page.click('button:has-text("Add")');
    await expect(page.locator('.player-chip')).toContainText('Alice');
  });

  test('Add button is disabled when input is empty', async ({ page }) => {
    await expect(page.locator('button:has-text("Add")')).toBeDisabled();
    await page.fill('input[placeholder="Add player name…"]', 'Bob');
    await expect(page.locator('button:has-text("Add")')).toBeEnabled();
  });

  test('can add a player by pressing Enter', async ({ page }) => {
    await page.fill('input[placeholder="Add player name…"]', 'Carol');
    await page.press('input[placeholder="Add player name…"]', 'Enter');
    await expect(page.locator('.player-chip')).toContainText('Carol');
    await expect(page.locator('input[placeholder="Add player name…"]')).toHaveValue('');
  });

  test('can remove a player', async ({ page }) => {
    await page.fill('input[placeholder="Add player name…"]', 'Dave');
    await page.click('button:has-text("Add")');
    await page.locator('.remove-btn').click();
    await expect(page.locator('.player-chip')).toHaveCount(0);
  });

  test('Next Round button is disabled with fewer than 4 players', async ({ page }) => {
    for (const name of ['P1', 'P2', 'P3']) {
      await page.fill('input[placeholder="Add player name…"]', name);
      await page.click('button:has-text("Add")');
    }
    await expect(page.locator('button:has-text("Next Round")')).toBeDisabled();
  });

  test('can generate a round with exactly 4 players', async ({ page }) => {
    for (const name of ['Alice', 'Bob', 'Carol', 'Dave']) {
      await page.fill('input[placeholder="Add player name…"]', name);
      await page.click('button:has-text("Add")');
    }
    await page.click('button:has-text("Next Round")');
    await expect(page.locator('.round-display')).toBeVisible();
    await expect(page.locator('.round-display h3')).toContainText('Round 1');
  });

  test('can generate multiple rounds', async ({ page }) => {
    for (const name of ['Alice', 'Bob', 'Carol', 'Dave']) {
      await page.fill('input[placeholder="Add player name…"]', name);
      await page.click('button:has-text("Add")');
    }
    await page.click('button:has-text("Next Round")');
    await page.click('button:has-text("Next Round")');
    await expect(page.locator('.round-display')).toHaveCount(2);
  });

  test('can reset session', async ({ page }) => {
    for (const name of ['Alice', 'Bob', 'Carol', 'Dave']) {
      await page.fill('input[placeholder="Add player name…"]', name);
      await page.click('button:has-text("Add")');
    }
    await page.click('button:has-text("Next Round")');
    await expect(page.locator('.round-display')).toBeVisible();
    await page.click('button:has-text("Reset Session")');
    await expect(page.locator('.round-display')).toHaveCount(0);
  });

  test('can generate a round with 8 players', async ({ page }) => {
    for (const name of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']) {
      await page.fill('input[placeholder="Add player name…"]', name);
      await page.click('button:has-text("Add")');
    }
    await page.click('button:has-text("Next Round")');
    await expect(page.locator('.court')).toHaveCount(2);
  });

  test('shows back to home link', async ({ page }) => {
    await expect(page.locator('a.home-link')).toBeVisible();
    await expect(page.locator('a.home-link')).toContainText('Back to Home');
  });
});
