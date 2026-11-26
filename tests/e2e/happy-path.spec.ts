import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth.js';
import { cleanupE2ERentals } from './helpers/cleaner.js';

test.describe('F4.1 — E2E Camino Feliz (Happy Path)', () => {
  test.beforeAll(async () => {
    await cleanupE2ERentals();
  });

  test.afterAll(async () => {
    await cleanupE2ERentals();
  });

  test('recorrido completo de punta a punta: Auxiliar -> Jurídica -> Secretario -> Jefe consulta', async ({
    page,
  }) => {
    // Escuchar diálogos de confirmación nativos del navegador
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // =========================================================================
    // 1. Auxiliar Administrativo: Iniciar sesión y registrar solicitud
    // =========================================================================
    await loginAs(page, 'auxiliar@sgec.local', 'Cambiar123!');

    await page.goto('/solicitudes/nueva');
    await expect(page.locator('h1')).toContainText('Registrar Nueva Solicitud');

    // Diligenciar solicitante persona jurídica
    await page.selectOption('#customerType', 'LEGAL');
    await page.selectOption('#documentType', 'NIT');
    await page.fill('#documentNumber', '901889900-1');
    await page.fill('#name', 'Asociación Cultural del Eje Cafetero');
    await page.fill('#legalRepresentative', 'Claudia Patricia Duque');
    await page.fill('#email', 'contacto@asocultura.org');
    await page.fill('#phone', '3158899000');
    await page.fill('#address', 'Calle 19 # 7-40, Pereira');

    // Diligenciar evento
    await page.fill('#eventName', 'Festival Sinfónico de las Flores 2027');
    await page.fill(
      '#eventDescription',
      'Encuentro regional de orquestas sinfónicas juveniles con participación comunitaria.',
    );
    await page.selectOption('#purpose', 'NON_LUCRATIVE');
    await page.fill('#expectedAttendees', '400');
    await page.selectOption('#channel', 'WRITTEN');
    await page.fill('#requestRadicado', 'SAIA-2027-E2E-01');

    // Espacio y fechas (Teatro Municipal Santiago Londoño, Sala Principal)
    await page.selectOption('#spaceId', 'space-sala-principal');
    await page.fill('#startsAt', '2027-06-10T08:00');
    await page.fill('#endsAt', '2027-06-10T20:00');

    console.info('--- Submitting new rental form ---');
    await page.click('#submit-btn');
    await page.waitForLoadState('load');

    // Verificar redirección a detalle de solicitud
    expect(page.url()).toMatch(/\/solicitudes\/[a-zA-Z0-9-]+$/);
    const rentalUrl = page.url();
    const rentalId = rentalUrl.split('/').pop()!;
    console.info('--- Rental created:', rentalId, '---');

    // Estado inicial: REGISTERED
    await expect(page.locator('.badge-status-REGISTERED').first()).toBeVisible();
    console.info('--- Status is REGISTERED ---');

    // =========================================================================
    // 2. Auxiliar: T2 Responder solicitud y generar oficio
    // =========================================================================
    const openBtn = page.locator('button:has-text("Responder Solicitud y Emitir Oficio")');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    await page.locator('#dialog-responder input#responseRadicado').fill('OFC-2027-E2E-01');
    await page.locator('#dialog-responder button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.badge-status-RESPONDED').first()).toBeVisible();
    console.info('--- Status is RESPONDED ---');

    // =========================================================================
    // 3. Auxiliar: T3 Verificar requisitos documentales y aprobar checklist
    // =========================================================================
    console.info('--- Verifying documents ---');
    let verifyCount = 0;
    while (verifyCount < 10) {
      const verifyButton = page.locator('form[action*="/verificar"] button[type="submit"]').first();
      if ((await verifyButton.count()) === 0 || !(await verifyButton.isVisible())) {
        break;
      }
      verifyCount++;
      console.info(`--- Clicking verify document #${verifyCount} ---`);
      await verifyButton.click();
      await page.waitForLoadState('load');
    }

    // Aprobar checklist general
    console.info('--- Approving checklist ---');
    const approveDocsBtn = page.locator(
      'form[action*="/transiciones/verifyDocuments"] button[type="submit"]',
    );
    await expect(approveDocsBtn).toBeVisible();
    await approveDocsBtn.click();
    await page.waitForLoadState('load');

    await expect(page.locator('.badge-status-DOCUMENTS_VERIFIED').first()).toBeVisible();
    console.info('--- Status is DOCUMENTS_VERIFIED ---');

    // =========================================================================
    // 4. Auxiliar: T4 Elaborar estudio previo y contrato
    // =========================================================================
    console.info('--- Drafting contract ---');
    await page.click('button:has-text("Elaborar Estudio Previo y Contrato")');
    await page.locator('#dialog-elaborar-contrato button[type="submit"]').click();
    await page.waitForLoadState('load');

    await expect(page.locator('.badge-status-CONTRACT_DRAFTED').first()).toBeVisible();
    console.info('--- Status is CONTRACT_DRAFTED ---');

    // =========================================================================
    // 5. Auxiliar: T5 Registrar soporte de pago y factura
    // =========================================================================
    console.info('--- Registering payment ---');
    await page.click('button:has-text("Registrar Pago y Facturación")');
    await page.locator('#dialog-registrar-pago input#receiptNumber').fill('REC-2027-001');
    await page.locator('#dialog-registrar-pago input#bankName').fill('Banco de Occidente');
    await page.locator('#dialog-registrar-pago input#voucherNumber').fill('VOUCH-2027-99');
    await page.locator('#dialog-registrar-pago input#paidAt').fill('2027-06-01');
    await page.locator('#dialog-registrar-pago input#invoiceNumber').fill('FAC-2027-001');
    await page.locator('#dialog-registrar-pago input#invoiceDate').fill('2027-06-01');
    await page.locator('#dialog-registrar-pago button[type="submit"]').click();
    await page.waitForLoadState('load');

    await expect(page.locator('.badge-status-PAID').first()).toBeVisible();
    console.info('--- Status is PAID ---');

    // =========================================================================
    // 6. Auxiliar: T6 Enviar contrato a revisión jurídica
    // =========================================================================
    console.info('--- Submitting to legal ---');
    await page.click('button:has-text("Enviar Contrato a Revisión Jurídica")');
    await page.waitForLoadState('load');

    await expect(page.locator('.badge-status-LEGAL_REVIEW').first()).toBeVisible();
    console.info('--- Status is LEGAL_REVIEW ---');

    await logout(page);
    console.info('--- Logged out Auxiliar ---');

    // =========================================================================
    // 7. Abogado Jurídico: Revisión y aprobación jurídica con 3 checks
    // =========================================================================
    console.info('--- Logging in as Jurídica ---');
    await loginAs(page, 'juridica@sgec.local', 'Cambiar123!');
    await page.goto(`/solicitudes/${rentalId}`);

    await expect(page.locator('.badge-status-LEGAL_REVIEW').first()).toBeVisible();

    console.info('--- Approving legal review ---');
    await page.click('button:has-text("Aprobar Revisión Jurídica")');
    await page.locator('#dialog-aprobar-juridica input#checkDocumentsOk').check();
    await page.locator('#dialog-aprobar-juridica input#checkCustomerDataOk').check();
    await page.locator('#dialog-aprobar-juridica input#checkClausesOk').check();
    await page
      .locator('#dialog-aprobar-juridica textarea#legalApproveNotes')
      .fill('Aprobación jurídica emitida tras validar requisitos y normatividad.');
    await page.locator('#dialog-aprobar-juridica button[type="submit"]').click();
    await page.waitForLoadState('load');

    await expect(page.locator('.badge-status-PENDING_SIGNATURE').first()).toBeVisible();
    console.info('--- Status is PENDING_SIGNATURE ---');

    await logout(page);
    console.info('--- Logged out Jurídica ---');

    // =========================================================================
    // 8. Secretario de Cultura: Firma electrónica y numeración oficial
    // =========================================================================
    console.info('--- Logging in as Secretario ---');
    await loginAs(page, 'secretario@sgec.local', 'Cambiar123!');
    await page.goto(`/solicitudes/${rentalId}`);

    await expect(page.locator('.badge-status-PENDING_SIGNATURE').first()).toBeVisible();

    console.info('--- Signing contract ---');
    await page.click('button:has-text("Firmar y Legalizar Contrato")');
    await page.locator('#dialog-firmar-contrato button[type="submit"]').click();
    await page.waitForLoadState('load');

    // Verificar estado LEGALIZED y número de contrato asignado
    await expect(page.locator('.badge-status-LEGALIZED').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/ARR-\d{4}-\d{4}/);
    await expect(page.locator('body')).toContainText(
      /Trámite culminado con éxito\. Contrato legalizado e inmutable/i,
    );

    await logout(page);

    // =========================================================================
    // 9. Jefe de Oficina: Consulta del contrato legalizado
    // =========================================================================
    await loginAs(page, 'jefe@sgec.local', 'Cambiar123!');
    await page.goto('/solicitudes');

    // Verificar que aparece en el listado
    await expect(page.locator('table')).toContainText('Festival Sinfónico de las Flores 2027');

    // Ver detalle
    await page.goto(`/solicitudes/${rentalId}`);
    await expect(page.locator('.badge-status-LEGALIZED').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/ARR-\d{4}-\d{4}/);

    // Confirmar que no hay botones de cancelación o mutación indebida
    await expect(page.locator('button:has-text("Cancelar Trámite")')).toHaveCount(0);
  });
});
