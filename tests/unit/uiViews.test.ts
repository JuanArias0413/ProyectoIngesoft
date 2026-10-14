import { describe, it, expect, beforeAll } from 'vitest';
import nunjucks from 'nunjucks';
import path from 'node:path';

describe('UI Views & Templates (F2.11, F2.12)', () => {
  let env: nunjucks.Environment;

  beforeAll(() => {
    const viewsPath = path.resolve(process.cwd(), 'src/views');
    env = nunjucks.configure(viewsPath, {
      autoescape: true,
      noCache: true,
    });
  });

  describe('partials/badge.njk', () => {
    const states = [
      { status: 'REGISTERED', text: 'Registrada', css: 'badge-status-REGISTERED' },
      { status: 'RESPONDED', text: 'Respondida', css: 'badge-status-RESPONDED' },
      { status: 'DOCUMENTS_VERIFIED', text: 'Documentos verificados', css: 'badge-status-DOCUMENTS_VERIFIED' },
      { status: 'CONTRACT_DRAFTED', text: 'Contrato elaborado', css: 'badge-status-CONTRACT_DRAFTED' },
      { status: 'PAID', text: 'Pagado', css: 'badge-status-PAID' },
      { status: 'LEGAL_REVIEW', text: 'En revisión jurídica', css: 'badge-status-LEGAL_REVIEW' },
      { status: 'RETURNED_BY_LEGAL', text: 'Devuelto por Jurídica', css: 'badge-status-RETURNED_BY_LEGAL' },
      { status: 'PENDING_SIGNATURE', text: 'Pendiente de firma', css: 'badge-status-PENDING_SIGNATURE' },
      { status: 'LEGALIZED', text: 'Legalizado', css: 'badge-status-LEGALIZED' },
      { status: 'CANCELLED', text: 'Cancelada', css: 'badge-status-CANCELLED' },
      { status: 'HELD', text: 'Provisional', css: 'badge-status-REGISTERED' },
      { status: 'CONFIRMED', text: 'Confirmada', css: 'badge-status-LEGALIZED' },
      { status: 'RELEASED', text: 'Liberada', css: 'badge-status-CANCELLED' },
    ];

    for (const { status, text, css } of states) {
      it(`renders badge for status ${status} with both text "${text}" and CSS class "${css}"`, () => {
        const output = env.render('partials/badge.njk', { status });
        expect(output).toContain(text);
        expect(output).toContain(css);
        expect(output).toContain('role="status"');
      });
    }

    it('supports large badge variant', () => {
      const output = env.render('partials/badge.njk', { status: 'LEGALIZED', large: true });
      expect(output).toContain('badge-lg');
      expect(output).toContain('Legalizado');
    });
  });

  describe('partials/flash.njk', () => {
    it('renders success alert', () => {
      const html = env.render('partials/flash.njk', { flash: { success: 'Operación exitosa' } });
      expect(html).toContain('alert-success');
      expect(html).toContain('Operación exitosa');
    });

    it('renders error alert', () => {
      const html = env.render('partials/flash.njk', { error: 'Ha ocurrido un problema' });
      expect(html).toContain('alert-error');
      expect(html).toContain('Ha ocurrido un problema');
    });

    it('renders info and warning alerts', () => {
      const htmlInfo = env.render('partials/flash.njk', { info: 'Nota informativa' });
      expect(htmlInfo).toContain('alert-info');
      expect(htmlInfo).toContain('Nota informativa');

      const htmlWarn = env.render('partials/flash.njk', { warning: 'Alerta preventiva' });
      expect(htmlWarn).toContain('alert-warning');
      expect(htmlWarn).toContain('Alerta preventiva');
    });
  });

  describe('partials/pagination.njk', () => {
    it('renders pagination with previous, next and page links', () => {
      const html = env.render('partials/pagination.njk', {
        page: 2,
        totalPages: 5,
        totalItems: 95,
        baseUrl: '/solicitudes',
      });
      expect(html).toContain('Página anterior');
      expect(html).toContain('Página siguiente');
      expect(html).toContain('Mostrando página <strong>2</strong> de <strong>5</strong>');
      expect(html).toContain('95 registros');
    });

    it('disables previous on first page and next on last page', () => {
      const firstPage = env.render('partials/pagination.njk', { page: 1, totalPages: 3 });
      expect(firstPage).toContain('disabled');

      const lastPage = env.render('partials/pagination.njk', { page: 3, totalPages: 3 });
      expect(lastPage).toContain('disabled');
    });
  });

  describe('partials/nav.njk', () => {
    it('renders login link when unauthenticated', () => {
      const html = env.render('partials/nav.njk', { user: null });
      expect(html).toContain('/login');
      expect(html).toContain('Iniciar sesión');
    });

    it('renders admin assistant navigation with Nueva Solicitud', () => {
      const html = env.render('partials/nav.njk', {
        user: { name: 'Carlos Auxiliar', role: 'ADMIN_ASSISTANT' },
        csrfToken: 'test-csrf-token',
      });
      expect(html).toContain('/solicitudes/nueva');
      expect(html).toContain('+ Nueva Solicitud');
      expect(html).toContain('/solicitudes');
      expect(html).toContain('/agenda');
      expect(html).toContain('/tarifas');
      expect(html).toContain('Auxiliar Administrativo');
      expect(html).toContain('/logout');
    });

    it('renders legal user navigation without Nueva Solicitud', () => {
      const html = env.render('partials/nav.njk', {
        user: { name: 'Dra. María Legal', role: 'LEGAL' },
        csrfToken: 'test-csrf-token',
      });
      expect(html).not.toContain('/solicitudes/nueva');
      expect(html).toContain('/solicitudes');
      expect(html).toContain('/agenda');
      expect(html).not.toContain('/tarifas');
      expect(html).toContain('Oficina Jurídica');
    });

    it('renders secretary navigation', () => {
      const html = env.render('partials/nav.njk', {
        user: { name: 'Dr. Roberto Secretario', role: 'SECRETARY' },
        csrfToken: 'test-csrf-token',
      });
      expect(html).toContain('/solicitudes');
      expect(html).toContain('/agenda');
      expect(html).not.toContain('/tarifas');
      expect(html).toContain('Secretario de Cultura');
    });

    it('renders operations tech navigation with only agenda', () => {
      const html = env.render('partials/nav.njk', {
        user: { name: 'Andrés Técnico', role: 'OPERATIONS_TECH' },
        csrfToken: 'test-csrf-token',
      });
      expect(html).not.toContain('/solicitudes/nueva');
      expect(html).not.toContain('/solicitudes"');
      expect(html).toContain('/agenda');
      expect(html).toContain('Técnico Operativo');
    });

    it('renders maintenance tech navigation with only home', () => {
      const html = env.render('partials/nav.njk', {
        user: { name: 'Pedro Mantenimiento', role: 'MAINTENANCE_TECH' },
        csrfToken: 'test-csrf-token',
      });
      expect(html).not.toContain('/solicitudes/nueva');
      expect(html).not.toContain('/solicitudes"');
      expect(html).not.toContain('/agenda"');
      expect(html).toContain('Técnico Mantenimiento');
    });
  });

  describe('pages/home/index.njk', () => {
    it('renders welcome screen for unauthenticated visitors', () => {
      const html = env.render('pages/home/index.njk', { user: null });
      expect(html).toContain('Sistema de Gestión de Escenarios y Bienes Culturales');
      expect(html).toContain('/login');
    });

    it('renders pending items for ADMIN_ASSISTANT', () => {
      const html = env.render('pages/home/index.njk', {
        user: { name: 'Carlos Auxiliar', role: 'ADMIN_ASSISTANT' },
        pendingRequests: [
          {
            id: 'req-1',
            requestRadicado: 'SAIA-2026-0001',
            customerName: 'Fundación Cultural',
            eventName: 'Concierto',
            spaceName: 'Auditorio',
            status: 'REGISTERED',
          },
        ],
      });
      expect(html).toContain('Pendientes para mí');
      expect(html).toContain('SAIA-2026-0001');
      expect(html).toContain('Responder oficio');
    });

    it('renders empty pending message when no pending items', () => {
      const html = env.render('pages/home/index.njk', {
        user: { name: 'Carlos Auxiliar', role: 'ADMIN_ASSISTANT' },
        pendingRequests: [],
      });
      expect(html).toContain('No tienes trámites pendientes por atender');
    });
  });

  describe('pages/agenda/_disponibilidad.njk', () => {
    it('renders incomplete data message when parameters missing', () => {
      const html = env.render('pages/agenda/_disponibilidad.njk', { incomplete: true });
      expect(html).toContain('Verificación de disponibilidad');
      expect(html).toContain('Seleccione el espacio y defina las fechas');
    });

    it('renders available confirmation when free', () => {
      const html = env.render('pages/agenda/_disponibilidad.njk', {
        spaceId: 'sp-1',
        startsAt: '2026-11-20T10:00',
        endsAt: '2026-11-20T14:00',
        available: true,
      });
      expect(html).toContain('¡Espacio disponible!');
      expect(html).toContain('reserva provisional (HELD)');
    });

    it('renders conflict error with reservation status when occupied', () => {
      const html = env.render('pages/agenda/_disponibilidad.njk', {
        spaceId: 'sp-1',
        startsAt: '2026-11-20T10:00',
        endsAt: '2026-11-20T14:00',
        available: false,
        conflict: {
          requestId: 'REQ-999',
          status: 'HELD',
          startsAtFormatted: '2026-11-20 09:00',
          endsAtFormatted: '2026-11-20 12:00',
        },
      });
      expect(html).toContain('Espacio no disponible');
      expect(html).toContain('REQ-999');
      expect(html).toContain('Provisional');
    });
  });

  describe('pages/solicitudes/nueva.njk', () => {
    it('renders full registration form with HTMX attributes and CSRF', () => {
      const html = env.render('pages/solicitudes/nueva.njk', {
        csrfToken: 'csrf-1234',
        venues: [{ id: 'v1', name: 'Centro Cultural Lucy Tejada' }],
        spaces: [{ id: 's1', name: 'Auditorio', venueId: 'v1', capacity: 300 }],
        values: {},
        errors: {},
      });
      expect(html).toContain('Registrar Nueva Solicitud de Alquiler');
      expect(html).toContain('name="_csrf" value="csrf-1234"');
      expect(html).toContain('hx-get="/agenda/disponibilidad"');
      expect(html).toContain('customerType');
      expect(html).toContain('documentNumber');
      expect(html).toContain('eventName');
      expect(html).toContain('purpose');
      expect(html).toContain('startsAt');
      expect(html).toContain('endsAt');
      expect(html).toContain('disponibilidad-result');
    });
  });

  describe('pages/solicitudes/index.njk', () => {
    it('renders requests table with badge and action links', () => {
      const html = env.render('pages/solicitudes/index.njk', {
        user: { role: 'ADMIN_ASSISTANT' },
        requests: [
          {
            id: 'r1',
            requestRadicado: 'ARR-2026-001',
            customerName: 'Juan Pérez',
            eventName: 'Conferencia',
            spaceName: 'Sala Múltiple',
            status: 'DOCUMENTS_VERIFIED',
          },
        ],
        query: {},
      });
      expect(html).toContain('Solicitudes de Alquiler de Escenarios');
      expect(html).toContain('+ Nueva Solicitud');
      expect(html).toContain('ARR-2026-001');
      expect(html).toContain('Juan Pérez');
      expect(html).toContain('Documentos verificados');
      expect(html).toContain('Ver detalle');
    });
  });

  describe('pages/solicitudes/detalle.njk', () => {
    it('renders detail page with header, timeline, checklist and dialogs', () => {
      const html = env.render('pages/solicitudes/detalle.njk', {
        user: { role: 'SECRETARY' },
        csrfToken: 'csrf-secret',
        solicitud: {
          id: 'req-uuid',
          requestRadicado: 'SAIA-001',
          status: 'PENDING_SIGNATURE',
          eventName: 'Festival Internacional',
          customer: { name: 'Corporación Danza', documentType: 'NIT', documentNumber: '900111222' },
          space: { name: 'Teatro Santiago Londoño', venue: { name: 'Teatro Municipal' } },
          requestDocuments: [],
          generatedDocuments: [],
          transitions: [],
        },
      });
      expect(html).toContain('Solicitud SAIA-001');
      expect(html).toContain('Pendiente de firma');
      expect(html).toContain('dialog-firmar-contrato');
      expect(html).toContain('dialog-cancelar');
      expect(html).toContain('Firmar y Legalizar Contrato');
    });
  });

  describe('pages/agenda/index.njk', () => {
    it('renders 30-day agenda view with reservations', () => {
      const html = env.render('pages/agenda/index.njk', {
        reservations: [
          {
            space: { name: 'Auditorio', venue: { name: 'Lucy Tejada' } },
            eventName: 'Ensayos Orquesta',
            customerName: 'Banda Sinfónica',
            status: 'CONFIRMED',
          },
        ],
      });
      expect(html).toContain('Agenda de Escenarios Culturales');
      expect(html).toContain('Modo solo lectura (AC-02.4)');
      expect(html).toContain('Ensayos Orquesta');
      expect(html).toContain('Confirmada');
    });
  });

  describe('pages/tarifas/index.njk', () => {
    it('renders tariffs table and shows edit button only for OFFICE_HEAD', () => {
      const htmlAssistant = env.render('pages/tarifas/index.njk', {
        user: { role: 'ADMIN_ASSISTANT' },
        tariffs: [{ space: { name: 'Auditorio', venue: { name: 'Lucy Tejada' } }, purpose: 'LUCRATIVE', unit: 'HOUR', pricePesos: 450000 }],
      });
      expect(htmlAssistant).toContain('Modo Solo Lectura');
      expect(htmlAssistant).not.toContain('dialog-editar-tarifa');

      const htmlHead = env.render('pages/tarifas/index.njk', {
        user: { role: 'OFFICE_HEAD' },
        csrfToken: 'csrf-head',
        tariffs: [{ id: 't1', space: { name: 'Auditorio', venue: { name: 'Lucy Tejada' } }, purpose: 'LUCRATIVE', unit: 'HOUR', pricePesos: 450000 }],
      });
      expect(htmlHead).toContain('Modo Edición Habilitado (Jefe de Oficina)');
      expect(htmlHead).toContain('dialog-editar-tarifa');
      expect(htmlHead).toContain('Modificar');
    });
  });

  describe('pages/errors/', () => {
    it('renders 403, 404 and 500 error pages with user-friendly messages', () => {
      const h403 = env.render('pages/errors/403.njk', {});
      expect(h403).toContain('403 · Acceso Denegado');

      const h404 = env.render('pages/errors/404.njk', {});
      expect(h404).toContain('404 · Página no encontrada');

      const h500 = env.render('pages/errors/500.njk', { reqId: 'req-trace-123' });
      expect(h500).toContain('500 · Error Interno del Servidor');
      expect(h500).toContain('req-trace-123');
    });
  });
});
