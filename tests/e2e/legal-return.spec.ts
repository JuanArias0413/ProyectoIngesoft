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

    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

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

    // Espacio y fechas (2027-10-01)
    await page.selectOption('#spaceId', 'space-sala-principal');
    await page.fill('#startsAt', fmt(new Date('2027-10-01T09:00:00')));
    await page.fill('#endsAt', fmt(new Date('2027-10-01T13:00:00')));

    await page.click('#submit-btn');
    await page.waitForLoadState('networkidle');

    // Verificar REGISTERED
    await expect(page.locator('.badge-status-REGISTERED').first()).toBeVisible();
    const solicitudUrl = page.url();

    const match = solicitudUrl.match(/\/solicitudes\/([^/]+)/);
    const rentalId = match ? match[1] : null;
    expect(rentalId).not.toBeNull();

    // =========================================================================
    // 2. Auxiliar: Responder con radicado
    // =========================================================================
    await page.click('button:has-text("Responder Solicitud y Emitir Oficio")');
    await page.locator('#dialog-responder input#responseRadicado').fill('RAD-LEGAL-2027-001');
    await page.locator('#dialog-responder button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.badge-status-RESPONDED').first()).toBeVisible();

    // =========================================================================
    // 3. Auxiliar: Verificar documentos
    // =========================================================================
    let verifyCount = 0;
    while (verifyCount < 10) {
      const verifyButton = page.locator('form[action*="/verificar"] button[type="submit"]').first();
      if ((await verifyButton.count()) === 0 || !(await verifyButton.isVisible())) {
        break;
      }
      verifyCount++;
      await verifyButton.click();
      await page.waitForLoadState('load');
    }

    const approveDocsBtn = page.locator(
      'form[action*="/transiciones/verifyDocuments"] button[type="submit"]',
    );
    await expect(approveDocsBtn).toBeVisible();
    await approveDocsBtn.click();
    await page.waitForLoadState('load');

    await expect(page.locator('.badge-status-DOCUMENTS_VERIFIED').first()).toBeVisible();

    // =========================================================================
    // 4. Auxiliar: Elaborar contrato
    // =========================================================================
    await page.click('button:has-text("Elaborar Estudio Previo y Contrato")');
    await page.locator('#dialog-elaborar-contrato button[type="submit"]').click();
    await page.waitForLoadState('load');

    await expect(page.locator('.badge-status-CONTRACT_DRAFTED').first()).toBeVisible();

    // =========================================================================
    // 5. Auxiliar: Registrar pago
    // =========================================================================
    await page.click('button:has-text("Registrar Pago y Facturación")');
    await page.locator('#dialog-registrar-pago input#receiptNumber').fill('REC-E2E-LEGAL-001');
    await page.locator('#dialog-registrar-pago input#bankName').fill('Bancolombia');
    await page.locator('#dialog-registrar-pago input#voucherNumber').fill('VOUCH-E2E-LEGAL-001');
    await page.locator('#dialog-registrar-pago input#paidAt').fill('2027-06-01');
    await page.locator('#dialog-registrar-pago input#invoiceNumber').fill('FAC-E2E-LEGAL-001');
    await page.locator('#dialog-registrar-pago input#invoiceDate').fill('2027-06-01');
    await page.locator('#dialog-registrar-pago button[type="submit"]').click();
    await page.waitForLoadState('load');

    await expect(page.locator('.badge-status-PAID').first()).toBeVisible();

    // =========================================================================
    // 6. Auxiliar: Enviar a Jurídica
    // =========================================================================
    await page.click('button:has-text("Enviar Contrato a Revisión Jurídica")');
    await page.waitForLoadState('load');

    await expect(page.locator('.badge-status-LEGAL_REVIEW').first()).toBeVisible();

    // =========================================================================
    // 7. Jurídica: DEVOLVER con observación (Ronda 1)
    // =========================================================================
    await logout(page);
    await loginAs(page, 'juridica@sgec.local', 'Cambiar123!');
    await page.goto(solicitudUrl);

    await expect(page.locator('.badge-status-LEGAL_REVIEW').first()).toBeVisible();

    await page.click('button:has-text("Devolver con Observaciones")');
    await page
      .locator('#dialog-devolver-juridica textarea#returnObservations')
      .fill('El clausulado no especifica las obligaciones de aseo y entrega post-evento.');
    await page.locator('#dialog-devolver-juridica button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.badge-status-RETURNED_BY_LEGAL').first()).toBeVisible();

    // =========================================================================
    // 8. Auxiliar: Corregir y reenviar (Ronda 2)
    // =========================================================================
    await logout(page);
    await loginAs(page, 'auxiliar@sgec.local', 'Cambiar123!');
    await page.goto(solicitudUrl);

    await expect(page.locator('.badge-status-RETURNED_BY_LEGAL').first()).toBeVisible();

    await page.click('button:has-text("Corregir y Reenviar a Jurídica")');
    await page
      .locator('#dialog-reenviar-juridica textarea#resubmitClauses')
      .fill('El arrendatario se compromete a entregar el espacio en perfecto estado de limpieza.');
    await page
      .locator('#dialog-reenviar-juridica textarea#resubmitNote')
      .fill('Se subsanaron las observaciones de limpieza indicadas por Jurídica.');
    await page.locator('#dialog-reenviar-juridica button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.badge-status-LEGAL_REVIEW').first()).toBeVisible();

    // =========================================================================
    // 9. Jurídica: APROBAR (Ronda 2)
    // =========================================================================
    await logout(page);
    await loginAs(page, 'juridica@sgec.local', 'Cambiar123!');
    await page.goto(solicitudUrl);

    await expect(page.locator('.badge-status-LEGAL_REVIEW').first()).toBeVisible();

    await page.click('button:has-text("Aprobar Revisión Jurídica")');
    await page.locator('#dialog-aprobar-juridica input#checkDocumentsOk').check();
    await page.locator('#dialog-aprobar-juridica input#checkCustomerDataOk').check();
    await page.locator('#dialog-aprobar-juridica input#checkClausesOk').check();
    await page
      .locator('#dialog-aprobar-juridica textarea#legalApproveNotes')
      .fill('Aprobado en segunda ronda tras verificar cláusula de aseo.');
    await page.locator('#dialog-aprobar-juridica button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.badge-status-PENDING_SIGNATURE').first()).toBeVisible();

    // Verificar historial / timeline
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent).toMatch(/returnLegal|Devuelto|RETURNED/i);
    expect(bodyContent).toMatch(/approveLegal|Aprobado|APPROVED/i);

    // =========================================================================
    // 10. Secretario: Firmar
    // =========================================================================
    await logout(page);
    await loginAs(page, 'secretario@sgec.local', 'Cambiar123!');
    await page.goto(solicitudUrl);

    await expect(page.locator('.badge-status-PENDING_SIGNATURE').first()).toBeVisible();

    await page.click('button:has-text("Firmar y Legalizar Contrato")');
    await page.locator('#dialog-firmar-contrato button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.badge-status-LEGALIZED').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/ARR-\d{4}-\d{4}/);

    await logout(page);
  });
});
