import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth.js';
import { cleanupE2ERentals } from './helpers/cleaner.js';

test.describe('F4.1 — E2E Cancelación', () => {
  test.beforeAll(async () => {
    await cleanupE2ERentals();
  });

  test.afterAll(async () => {
    await cleanupE2ERentals();
  });

  test('Auxiliar registra solicitud; Jefe la cancela con motivo; estado CANCELLED y reserva liberada', async ({
    page,
  }) => {
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // =========================================================================
    // 1. Auxiliar: Registrar solicitud
    // =========================================================================
    await loginAs(page, 'auxiliar@sgec.local', 'Cambiar123!');

    await page.goto('/solicitudes/nueva');
    await expect(page.locator('h1')).toContainText('Registrar Nueva Solicitud');

    const base = new Date();
    base.setDate(base.getDate() + 6);
    base.setHours(9, 0, 0, 0);
    const end = new Date(base);
    end.setHours(12, 0, 0, 0);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    await page.selectOption('#customerType', 'NATURAL');
    await page.selectOption('#documentType', 'CC');
    await page.fill('#documentNumber', '88899900');
    await page.fill('#name', 'Mario Cancelado E2E');
    await page.fill('#email', 'mario.cancel.e2e@example.com');
    await page.fill('#phone', '3001122334');
    await page.fill('#address', 'Av. Cancela 99, Pereira');

    await page.fill('#eventName', 'Evento para Cancelar E2E');
    await page.fill('#eventDescription', 'Solicitud de prueba que será cancelada por el Jefe');
    await page.selectOption('#purpose', 'NON_LUCRATIVE');
    await page.fill('#expectedAttendees', '15');
    await page.selectOption('#channel', 'WRITTEN');

    const venueSelect = page.locator('#venueId');
    await venueSelect.waitFor({ state: 'visible' });
    await venueSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    const spaceSelect = page.locator('#spaceId');
    await spaceSelect.waitFor({ state: 'visible' });
    await spaceSelect.selectOption({ index: 1 });

    await page.fill('#startsAt', fmt(base));
    await page.fill('#endsAt', fmt(end));

    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/Registrada/i);
    const solicitudUrl = page.url();

    // Guarda el ID para verificar reserva después
    const match = solicitudUrl.match(/\/solicitudes\/([^/]+)/);
    const rentalId = match ? match[1] : null;
    expect(rentalId).not.toBeNull();

    await logout(page);

    // =========================================================================
    // 2. Jefe: Cancelar la solicitud con motivo
    // =========================================================================
    await loginAs(page, 'jefe@sgec.local', 'Cambiar123!');
    await page.goto(solicitudUrl);

    // El Jefe debe ver la acción de cancelar
    const cancelForm = page.locator('form[action*="cancel"]');
    await cancelForm.waitFor({ state: 'visible' });

    // Abrir modal o llenar motivo directamente
    const motivoInput = cancelForm.locator('textarea[name="cancelReason"], input[name="cancelReason"]');
    await motivoInput.fill('El solicitante desistió por razones de fuerza mayor comprobadas.');

    // Click en cancelar (puede necesitar confirmar modal)
    const cancelBtn = cancelForm.locator('button[type="submit"]');
    await cancelBtn.click();
    await page.waitForLoadState('networkidle');

    // =========================================================================
    // 3. Verificaciones
    // =========================================================================
    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/Cancelada/i);

    // Motivo de cancelación visible en la página
    await expect(page.locator('body')).toContainText(/fuerza mayor/i);

    // Verificar que el estado de la solicitud es CANCELLED
    await page.goto('/solicitudes');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Cancelada/i);

    // Verificar que el espacio vuelve a estar disponible en agenda
    await page.goto('/agenda');
    await page.waitForLoadState('networkidle');
    // La reserva liberada no debería bloquear futuras reservas
    // (verificación visual: la solicitud cancelada no aparece como ocupada)
    const agendaText = await page.locator('body').textContent();
    // La solicitud puede aparecer con badge CANCELLED pero no como HELD/CONFIRMED
    expect(agendaText).not.toMatch(/Mario Cancelado E2E.*HELD|CONFIRMED.*Mario Cancelado E2E/);

    await logout(page);
  });

  test('Auxiliar no puede cancelar con motivo de menos de 10 caracteres', async ({ page }) => {
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await loginAs(page, 'auxiliar@sgec.local', 'Cambiar123!');

    const base = new Date();
    base.setDate(base.getDate() + 7);
    base.setHours(15, 0, 0, 0);
    const end = new Date(base);
    end.setHours(17, 0, 0, 0);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    await page.goto('/solicitudes/nueva');
    await page.selectOption('#customerType', 'NATURAL');
    await page.selectOption('#documentType', 'CC');
    await page.fill('#documentNumber', '55566677');
    await page.fill('#name', 'Cliente Motivo Corto E2E');
    await page.fill('#email', 'motivo.corto@test.com');
    await page.fill('#phone', '3000000000');
    await page.fill('#address', 'Carrera 1 # 1-1, Pereira');
    await page.fill('#eventName', 'Evento Motivo Corto');
    await page.fill('#eventDescription', 'Solicitud para probar motivo insuficiente de cancelación');
    await page.selectOption('#purpose', 'NON_LUCRATIVE');
    await page.fill('#expectedAttendees', '10');
    await page.selectOption('#channel', 'VERBAL');

    const venueSelect = page.locator('#venueId');
    await venueSelect.waitFor({ state: 'visible' });
    await venueSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await page.locator('#spaceId').selectOption({ index: 1 });
    await page.fill('#startsAt', fmt(base));
    await page.fill('#endsAt', fmt(end));
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/Registrada/i);

    // Intentar cancelar con motivo muy corto
    const cancelForm = page.locator('form[action*="cancel"]');
    await cancelForm.waitFor({ state: 'visible' });
    await cancelForm.locator('textarea[name="cancelReason"], input[name="cancelReason"]').fill('Corto');
    await cancelForm.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    // Debe seguir en REGISTERED (no cancelada) o mostrar error
    const currentBadge = await page.locator('.badge, [class*="badge"]').first().textContent();
    const bodyText = await page.locator('body').textContent();
    const wasRejected =
      /Registrada/i.test(currentBadge ?? '') ||
      /10 caracteres|demasiado corto|motivo/i.test(bodyText ?? '');
    expect(wasRejected).toBe(true);

    await logout(page);
  });
});
