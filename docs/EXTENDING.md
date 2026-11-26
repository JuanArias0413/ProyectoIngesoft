# Guía de Extensibilidad — SGEC hacia Releases 2.0 y 3.0

Sistema de Gestión de Escenarios y Bienes Culturales  
Secretaría de Cultura de Pereira — Proyecto Académico

---

## 1. Introducción

El sistema SGEC Release 1.0 fue diseñado bajo el principio **Open/Closed** (abierto a la extensión, cerrado a la modificación). La arquitectura modular en capas y los patrones de diseño aplicados (**State**, **Strategy**, **Repository**) permiten incorporar nuevas funcionalidades para los Releases 2.0 (logística, actas, encuestas e informes) y 3.0 (mantenimiento preventivo y correctivo) sin alterar el núcleo preexistente.

Esta guía documenta los pasos precisos que deben seguir los desarrolladores para extender el sistema.

---

## 2. Cómo agregar un nuevo estado al ciclo de vida (Patrón State)

El trámite contractual utiliza el patrón State puro en memoria (`src/modules/rentals/domain/states/`).

### Paso 1: Declarar el nuevo estado en los tipos
Abra `src/modules/rentals/domain/states/types.ts` y agregue el nuevo valor al tipo de unión `RentalStatus`:
```typescript
export type RentalStatus =
  | 'REGISTERED'
  | 'RESPONDED'
  | ...
  | 'LEGALIZED'
  | 'CANCELLED'
  | 'IN_LOGISTICS'; // <-- Nuevo estado para Release 2.0
```
Si el estado introduce nuevas transiciones, agréguelas a `TransitionName` y defina su payload correspondiente.

### Paso 2: Crear la clase de estado concreta
Cree un nuevo archivo en `src/modules/rentals/domain/states/inLogisticsState.ts` implementando la interfaz `RentalState`:
```typescript
import type { RentalState } from './rentalState.js';
import type { RentalStatus, TransitionName, UserRole, CanTransitionResult } from './types.js';
import type { RentalContext } from './rentalContext.js';
import { DomainError, ForbiddenError, InvalidTransitionError } from '../../../../shared/errors.js';

export class InLogisticsState implements RentalState {
  public readonly status: RentalStatus = 'IN_LOGISTICS';
  public readonly label = 'En alistamiento logístico';

  public allowedTransitions(): TransitionName[] {
    return ['assignStaff', 'deliverVenue', 'cancel'];
  }

  public can(transition: TransitionName, actorRole: UserRole): CanTransitionResult {
    if (!this.allowedTransitions().includes(transition)) {
      return { allowed: false, reason: `Transición '${transition}' no permitida en estado ${this.status}` };
    }
    if (transition === 'assignStaff' && actorRole !== 'OPERATIONS_TECH') {
      return { allowed: false, reason: 'Solo el personal operativo puede asignar acompañamiento' };
    }
    return { allowed: true };
  }

  public apply(context: RentalContext, transition: TransitionName, payload?: unknown): RentalState {
    const check = this.can(transition, context.actorRole);
    if (!check.allowed) {
      throw new InvalidTransitionError(check.reason!);
    }
    // Retornar el nuevo estado destino
    return stateFor('VENUE_DELIVERED');
  }
}
```

### Paso 3: Registrar el estado en la fábrica
En `src/modules/rentals/domain/states/stateFactory.ts`, agregue el caso correspondiente:
```typescript
case 'IN_LOGISTICS':
  return new InLogisticsState();
```

### Paso 4: Exportar y verificar en tests
Exporte la nueva clase en `src/modules/rentals/domain/states/index.ts` y agregue los casos table-driven en `tests/unit/rentalState.test.ts`.

---

## 3. Cómo agregar una nueva estrategia de precios (Patrón Strategy)

Para soportar nuevas modalidades tarifarias (ej. tarifas por temporada alta/baja, convenios institucionales o descuentos por volumen):

### Paso 1: Implementar la interfaz `PricingStrategy`
Cree `src/modules/rentals/domain/pricing/seasonalPricing.ts`:
```typescript
import type { PricingStrategy, PricingCalculationResult } from './pricingStrategy.js';

export class SeasonalPricing implements PricingStrategy {
  public calculate(startsAt: Date, endsAt: Date, unitPricePesos: number): PricingCalculationResult {
    // Lógica de cálculo estacional
    const multiplier = 1.25; // Recargo de temporada
    const totalPesos = Math.round(unitPricePesos * multiplier);
    return {
      quantity: 1,
      unitPricePesos,
      totalPesos,
    };
  }
}
```

### Paso 2: Registrar en el selector de estrategias
En `src/modules/rentals/domain/pricing/pricingCalculator.ts`:
```typescript
export function getPricingStrategy(unit: TariffUnit): PricingStrategy {
  switch (unit) {
    case 'HOUR':
      return new HourlyPricing();
    case 'DAY':
      return new DailyPricing();
    case 'SEASON': // Nueva unidad tarifaria
      return new SeasonalPricing();
    default:
      throw new DomainError(`Unidad tarifaria desconocida: ${unit}`);
  }
}
```

---

## 4. Cómo agregar nuevos documentos oficiales imprimibles

Para agregar actas de entrega/recibo (CAR-11), encuestas de satisfacción (CAR-12) o constancias de cumplimiento:

### Paso 1: Actualizar el enumerador en Prisma
En `prisma/schema.prisma`:
```prisma
enum GeneratedDocumentKind {
  RESPONSE_LETTER
  PRIOR_STUDY
  CONTRACT
  DELIVERY_ACT      // <-- Release 2.0
  RETURN_ACT        // <-- Release 2.0
  SATISFACTION_SURVEY // <-- Release 2.0
}
```
Ejecute `npx prisma migrate dev --name add_logistics_documents`.

### Paso 2: Crear la plantilla Nunjucks
Cree `src/modules/documents/templates/deliveryAct.njk` con la estructura reglamentaria y las directivas `@media print` A4.

### Paso 3: Agregar el método al servicio `DocumentRenderer`
En `src/modules/documents/documentRenderer.ts`:
```typescript
public async generateDeliveryAct(rentalId: string, inventory: InventoryItem[]): Promise<void> {
  const rental = await this.prisma.rentalRequest.findUniqueOrThrow({ ... });
  const html = this.env.render('deliveryAct.njk', { rental, inventory, ... });
  await this.prisma.generatedDocument.create({
    data: {
      rentalRequestId: rentalId,
      kind: 'DELIVERY_ACT',
      version: 1,
      html,
      generatedById: '...',
    },
  });
}
```

---

## 5. Cómo incorporar nuevos módulos (Release 2.0 y 3.0)

Para mantener la pureza modular del sistema:

1. **Crear el módulo en `src/modules/<nuevo_modulo>/`:**
   - `domain/`: Entidades puras y puertos de repositorio.
   - `application/`: Casos de uso específicos del módulo.
   - `infra/`: Implementaciones de repositorios con Prisma.
   - `http/`: Rutas Express, esquemas Zod y controladores.

2. **Inyección en `src/container.ts`:**
   Instancie los repositorios, casos de uso y controladores en el contenedor de dependencias sin acoplar módulos horizontalmente.

3. **Montar rutas en `src/app.ts`:**
   Agregue el nuevo router protegiéndolo con los permisos correspondientes mediante `requirePermission()`.

4. **Vistas Nunjucks:**
   Cree las plantillas bajo `src/views/pages/<nuevo_modulo>/` extendiendo `layouts/base.njk`.
