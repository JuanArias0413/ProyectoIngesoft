import { expect, type Page } from '@playwright/test';

export async function loginAs(
  page: Page,
  email: string = 'auxiliar@sgec.local',
  password: string = 'Cambiar123!',
): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  // Wait for redirect to home, agenda or solicitudes
  await page.waitForLoadState('networkidle');
  await expect(page.locator('form[action="/logout"] button[type="submit"]')).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  const logoutBtn = page.locator('form[action="/logout"] button[type="submit"]');
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await page.waitForLoadState('networkidle');
  } else {
    await page.goto('/login');
  }
}
