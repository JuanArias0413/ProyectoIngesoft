import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth.js';
import { cleanupE2ERentals } from './helpers/cleaner.js';

test.describe('F4.1 — E2E Devolución de Jurídica', () => {
  test.beforeAll(async () => {
    await cleanupE2ERentals();
  });

  test.afterAll(async () => {
    await cleanupE2ERentals();
  });

  test('devolución por Jurídica, corrección y aprobación en segunda ronda, firma del Secretario', async ({
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

    // Cliente
    await page.selectOption('#customerType', 'NATURAL');
    await page.selectOption('#documentType', 'CC');
    await page.fill('#documentNumber', '11222333');
    await page.fill('#name', 'Rebeca Torres E2E');
    await page.fill('#email', 'rebeca.e2e@example.com');
    await page.fill('#phone', '3129876543');
    await page.fill('#address', 'Cra 10 # 20-30, Pereira');

    // Evento
    await page.fill('#eventName', 'Taller de Arte E2E Devolución');
    await page.fill('#eventDescription', 'Taller artístico para verificar flujo de devolución jurídica');
    await page.selectOption('#purpose', 'NON_LUCRATIVE');
    await page.fill('#expectedAttendees', '30');
    await page.selectOption('#channel', 'EMAIL');

    // Espacio y fechas (mañana, 3 horas)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    const dayAfter = new Date(tomorrow);
    dayAfter.setHours(tomorrow.getHours() + 3);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    const venueSelect = page.locator('#venueId');
    await venueSelect.waitFor({ state: 'visible' });
    await venueSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    const spaceSelect = page.locator('#spaceId');
    await spaceSelect.waitFor({ state: 'visible' });
    await spaceSelect.selectOption({ index: 1 });

    await page.fill('#startsAt', fmt(tomorrow));
    await page.fill('#endsAt', fmt(dayAfter));

    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Verificar REGISTERED
    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/Registrada/i);
    const solicitudUrl = page.url();

    // =========================================================================
    // 2. Auxiliar: Responder con radicado
    // =========================================================================
    const respondForm = page.locator('form[action*="/transiciones/respond"]');
    await respondForm.waitFor({ state: 'visible' });
    await respondForm.locator('input[name="responseRadicado"]').fill('RAD-LEGAL-2026-001');
    await respondForm.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/Respondida/i);

    // =========================================================================
    // 3. Auxiliar: Verificar documentos
    // =========================================================================
    const verifyBtn = page.locator('button:has-text("Verificar"), form[action*="verifyDocuments"] button').first();
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
      await page.waitForLoadState('networkidle');
    }
    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/Documentos verificados/i);

    // =========================================================================
    // 4. Auxiliar: Elaborar contrato
    // =========================================================================
    const draftBtn = page.locator('form[action*="draftContract"] button, button:has-text("Elaborar contrato")').first();
    await draftBtn.waitFor({ state: 'visible' });
    await draftBtn.click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/Contrato elaborado/i);

    // =========================================================================
    // 5. Auxiliar: Registrar pago
    // =========================================================================
    const payForm = page.locator('form[action*="registerPayment"]');
    await payForm.waitFor({ state: 'visible' });
    await payForm.locator('input[name="receiptNumber"]').fill('REC-E2E-LEGAL-001');
    await payForm.locator('input[name="bankName"]').fill('Bancolombia');
    await payForm.locator('input[name="voucherNumber"]').fill('VOUCH-E2E-LEGAL-001');
    const amountInput = payForm.locator('input[name="amountPesos"]');
    const amountValue = await amountInput.getAttribute('placeholder') ?? '750000';
    await amountInput.fill(amountValue.replace(/[^0-9]/g, '') || '750000');
    await payForm.locator('input[name="invoiceNumber"]').fill('FAC-E2E-LEGAL-001');
    const today = new Date().toISOString().split('T')[0];
    await payForm.locator('input[name="invoiceDate"]').fill(today);
    await payForm.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/Pagado/i);

    // =========================================================================
    // 6. Auxiliar: Enviar a Jurídica
    // =========================================================================
    const submitLegalBtn = page.locator('form[action*="submitToLegal"] button').first();
    await submitLegalBtn.waitFor({ state: 'visible' });
    await submitLegalBtn.click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/revisión jurídica/i);

    // =========================================================================
    // 7. Jurídica: DEVOLVER con observación (Ronda 1)
    // =========================================================================
    await logout(page);
    await loginAs(page, 'juridica@sgec.local', 'Cambiar123!');
    await page.goto(solicitudUrl);

    const returnForm = page.locator('form[action*="returnLegal"]');
    await returnForm.waitFor({ state: 'visible' });
    await returnForm.locator('textarea[name="observations"], input[name="observations"]').fill(
      'El clausulado no especifica las obligaciones de limpieza post-evento.',
    );
    await returnForm.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/Devuelto por Jurídica/i);

    // =========================================================================
    // 8. Auxiliar: Corregir y reenviar (Ronda 2)
    // =========================================================================
    await logout(page);
    await loginAs(page, 'auxiliar@sgec.local', 'Cambiar123!');
    await page.goto(solicitudUrl);

    // Editar cláusulas adicionales si el formulario está disponible
    const editClausesForm = page.locator('form[action*="contrato"]');
    if (await editClausesForm.isVisible()) {
      const clausesInput = editClausesForm.locator('textarea[name="additionalClauses"]');
      await clausesInput.fill('El arrendatario se compromete a dejar el espacio en condiciones de limpieza iguales a las de entrega.');
      await editClausesForm.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
    }

    const resubmitBtn = page.locator('form[action*="resubmitToLegal"] button').first();
    await resubmitBtn.waitFor({ state: 'visible' });
    await resubmitBtn.click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/revisión jurídica/i);

    // =========================================================================
    // 9. Jurídica: APROBAR (Ronda 2)
    // =========================================================================
    await logout(page);
    await loginAs(page, 'juridica@sgec.local', 'Cambiar123!');
    await page.goto(solicitudUrl);

    const approveForm = page.locator('form[action*="approveLegal"]');
    await approveForm.waitFor({ state: 'visible' });
    const checks = approveForm.locator('input[type="checkbox"]');
    const count = await checks.count();
    for (let i = 0; i < count; i++) {
      await checks.nth(i).check();
    }
    await approveForm.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/Pendiente de firma/i);

    // Verificar historial: 2 rondas de revisión
    const timeline = page.locator('[class*="timeline"], .timeline, ol, ul').first();
    const timelineText = await timeline.textContent();
    expect(timelineText).toMatch(/returnLegal|Devuelto|RETURNED/i);
    expect(timelineText).toMatch(/approveLegal|Aprobado|APPROVED/i);

    // =========================================================================
    // 10. Secretario: Firmar
    // =========================================================================
    await logout(page);
    await loginAs(page, 'secretario@sgec.local', 'Cambiar123!');
    await page.goto(solicitudUrl);

    const signForm = page.locator('form[action*="signAndNumber"]');
    await signForm.waitFor({ state: 'visible' });
    await signForm.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.badge, [class*="badge"]').first()).toContainText(/Legalizado/i);
    await expect(page.locator('body')).toContainText(/ARR-/i);

    await logout(page);
  });
});
