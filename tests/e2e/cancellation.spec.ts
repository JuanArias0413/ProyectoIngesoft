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

    await page.selectOption('#spaceId', 'space-sala-principal');
    await page.fill('#startsAt', fmt(new Date('2027-09-01T09:00:00')));
    await page.fill('#endsAt', fmt(new Date('2027-09-01T12:00:00')));

    await page.click('#submit-btn');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.badge-status-REGISTERED').first()).toBeVisible();
    const solicitudUrl = page.url();

    const match = solicitudUrl.match(/\/solicitudes\/([^/]+)/);
    const rentalId = match ? match[1] : null;
    expect(rentalId).not.toBeNull();

    await logout(page);

    // =========================================================================
    // 2. Jefe: Cancelar la solicitud con motivo
    // =========================================================================
    await loginAs(page, 'jefe@sgec.local', 'Cambiar123!');
    await page.goto(solicitudUrl);

    // Abrir modal de cancelación
    const cancelModalBtn = page.locator('button:has-text("Cancelar Trámite")');
    await expect(cancelModalBtn).toBeVisible();
    await cancelModalBtn.click();

    const motivoInput = page.locator('#dialog-cancelar textarea#cancelReason');
    await expect(motivoInput).toBeVisible();
    await motivoInput.fill('El solicitante desistió por razones de fuerza mayor comprobadas.');

    const cancelSubmitBtn = page.locator('#dialog-cancelar button[type="submit"]');
    await cancelSubmitBtn.click();
    await page.waitForLoadState('networkidle');

    // =========================================================================
    // 3. Verificaciones
    // =========================================================================
    await expect(page.locator('.badge-status-CANCELLED').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/fuerza mayor/i);

    // Verificar en listado de solicitudes
    await page.goto('/solicitudes');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Cancelada/i);

    // Verificar que el espacio vuelve a estar disponible en agenda
    await page.goto('/agenda');
    await page.waitForLoadState('networkidle');
    const agendaText = await page.locator('body').textContent();
    expect(agendaText).not.toMatch(/Mario Cancelado E2E.*CONFIRMED/);

    await logout(page);
  });

  test('Auxiliar no puede cancelar con motivo de menos de 10 caracteres', async ({ page }) => {
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await loginAs(page, 'auxiliar@sgec.local', 'Cambiar123!');

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

    await page.selectOption('#spaceId', 'space-sala-principal');
    await page.fill('#startsAt', fmt(new Date('2027-09-05T15:00:00')));
    await page.fill('#endsAt', fmt(new Date('2027-09-05T17:00:00')));
    await page.click('#submit-btn');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.badge-status-REGISTERED').first()).toBeVisible();

    // Intentar cancelar con motivo muy corto
    const cancelModalBtn = page.locator('button:has-text("Cancelar Trámite")');
    await expect(cancelModalBtn).toBeVisible();
    await cancelModalBtn.click();

    const motivoInput = page.locator('#dialog-cancelar textarea#cancelReason');
    await expect(motivoInput).toBeVisible();
    await motivoInput.fill('Corto');

    const cancelSubmitBtn = page.locator('#dialog-cancelar button[type="submit"]');
    await cancelSubmitBtn.click();
    await page.waitForTimeout(500);

    // Debe seguir en REGISTERED (no cancelada)
    await expect(page.locator('.badge-status-REGISTERED').first()).toBeVisible();

    // Cerrar modal
    await page.locator('#dialog-cancelar button:has-text("No, Volver")').click();

    await logout(page);
  });
});
