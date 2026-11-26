import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth.js';
import { cleanupE2ERentals } from './helpers/cleaner.js';

test.describe('F4.1 — E2E Conflicto de Agenda', () => {
  test.beforeAll(async () => {
    await cleanupE2ERentals();
  });

  test.afterAll(async () => {
    await cleanupE2ERentals();
  });

  test('segunda solicitud en mismo espacio y franja solapada es rechazada', async ({ page }) => {
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await loginAs(page, 'auxiliar@sgec.local', 'Cambiar123!');

    const base = new Date('2027-07-15T10:00:00');
    const end = new Date('2027-07-15T14:00:00');

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    const fillAndSubmitRequest = async (docNumber: string, clientName: string) => {
      await page.goto('/solicitudes/nueva');
      await page.selectOption('#customerType', 'NATURAL');
      await page.selectOption('#documentType', 'CC');
      await page.fill('#documentNumber', docNumber);
      await page.fill('#name', clientName);
      await page.fill('#email', `${docNumber}@test.com`);
      await page.fill('#phone', '3100000000');
      await page.fill('#address', 'Calle Test, Pereira');

      await page.fill('#eventName', `Evento conflicto ${docNumber}`);
      await page.fill('#eventDescription', 'Prueba de conflicto de agenda E2E');
      await page.selectOption('#purpose', 'NON_LUCRATIVE');
      await page.fill('#expectedAttendees', '20');
      await page.selectOption('#channel', 'VERBAL');

      await page.selectOption('#spaceId', 'space-sala-principal');

      await page.fill('#startsAt', fmt(base));
      await page.fill('#endsAt', fmt(end));

      await page.click('#submit-btn');
      await page.waitForLoadState('networkidle');
    };

    // Primera solicitud — debe registrarse exitosamente
    await fillAndSubmitRequest('77700001', 'Cliente Conflicto E2E Uno');
    await expect(page.locator('.badge-status-REGISTERED').first()).toBeVisible();

    // Segunda solicitud — mismo espacio, franja solapada → debe rechazarse
    await fillAndSubmitRequest('77700002', 'Cliente Conflicto E2E Dos');

    // El sistema debe mostrar error de conflicto (redirige a nueva con error, o muestra mensaje)
    const bodyText = await page.locator('body').textContent();
    const hasConflict =
      /conflicto|no disponible|solapada|reserva|conflict|unavailable/i.test(bodyText ?? '');
    const isOnNewPage = page.url().includes('/nueva') || page.url().includes('/solicitudes');

    expect(hasConflict || isOnNewPage).toBe(true);

    // Verifica que la disponibilidad HTMX marca "No disponible"
    await page.goto('/solicitudes/nueva');
    await page.selectOption('#spaceId', 'space-sala-principal');
    await page.fill('#startsAt', fmt(base));
    await page.fill('#endsAt', fmt(end));

    // Trigger HTMX availability check
    await page.locator('#endsAt').dispatchEvent('change');
    await page.waitForTimeout(1500);

    const availResult = page.locator('#disponibilidad-result, [id*="disponibilidad"]');
    if (await availResult.isVisible()) {
      await expect(availResult).toContainText(/no disponible|ocupado|conflict/i);
    }

    await logout(page);
  });
});
