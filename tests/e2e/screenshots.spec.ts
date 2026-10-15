import { test, expect } from '@playwright/test';
import { loginAs, logout } from './helpers/auth.js';
import { prisma } from '../../src/infra/prisma.js';

test.describe('F5.3 — Generación de Capturas para Manual de Usuario', () => {
  test('captura de pantallas clave del sistema', async ({ page }) => {
    // 1. Pantalla de Login
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await page.screenshot({ path: 'docs/img/01-login.png', fullPage: true });

    // 2. Dashboard Auxiliar Administrativo
    await loginAs(page, 'auxiliar@sgec.local', 'Cambiar123!');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/img/02-dashboard-auxiliar.png', fullPage: true });

    // 3. Formulario Nueva Solicitud
    await page.goto('/solicitudes/nueva');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/img/03-nueva-solicitud.png', fullPage: true });

    // 4. Listado de Solicitudes con Filtros e Insignias
    await page.goto('/solicitudes');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/img/04-solicitudes-listado.png', fullPage: true });

    // 5. Detalle de Solicitud (usar una de las solicitudes existentes en el seed)
    const sampleRental = await prisma.rentalRequest.findFirst({
      where: { status: { in: ['PAID', 'LEGAL_REVIEW', 'CONTRACT_DRAFTED', 'LEGALIZED'] } },
      select: { id: true },
    });
    const rentalId = sampleRental?.id;
    if (rentalId) {
      await page.goto(`/solicitudes/${rentalId}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'docs/img/05-detalle-solicitud.png', fullPage: true });

      // Documento Imprimible (Oficio o Minuta)
      const sampleDoc = await prisma.generatedDocument.findFirst({
        where: { rentalRequestId: rentalId },
        select: { kind: true },
      });
      if (sampleDoc) {
        await page.goto(`/solicitudes/${rentalId}/documentos/${sampleDoc.kind}`);
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'docs/img/10-documento-impreso.png', fullPage: true });
      }
    }

    // 6. Agenda de Escenarios (30 días)
    await page.goto('/agenda');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/img/06-agenda.png', fullPage: true });

    // 7. Catálogo de Tarifas
    await page.goto('/tarifas');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/img/07-tarifas.png', fullPage: true });

    // 8. Dashboard Jurídica
    await logout(page);
    await loginAs(page, 'juridica@sgec.local', 'Cambiar123!');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/img/08-dashboard-juridica.png', fullPage: true });

    // 9. Dashboard Secretario
    await logout(page);
    await loginAs(page, 'secretario@sgec.local', 'Cambiar123!');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'docs/img/09-dashboard-secretario.png', fullPage: true });

    await logout(page);
  });
});
