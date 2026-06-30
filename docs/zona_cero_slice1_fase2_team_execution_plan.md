# Plan de ejecución Slice 1 / Fase 2 - Contratos compartidos

Este plan coordina la **Slice 1 - Contratos compartidos** con la **Fase 2 - Extraer contratos compartidos** del monorepo. El objetivo es que los tres equipos trabajen en paralelo sin crear tres dialectos distintos del dominio.

## Decisión principal

El trabajo se ejecuta con este modelo:

1. **Discovery paralelo por equipo.**
2. **Contrato canónico centralizado en Equipo B.**
3. **Validación obligatoria de A y C como consumidores.**
4. **Implementación solapada, pero con gates secuenciales.**

Equipo B posee el contrato canónico. Equipo A y Equipo C no crean contratos paralelos; entregan requisitos, fixtures esperadas y validación de consumo.

## Responsabilidades por equipo

| Equipo | Responsabilidad | No debe hacer | Handoff principal |
|---|---|---|---|
| **A - Telegram + Web UI** | Definir demanda de canal: flows, errores visibles, estados conversacionales y payloads de enlaces web. | Definir reglas de dominio, permisos, auditoría o schemas privados. | Tabla `flow -> operación -> payload mínimo -> errores visibles -> estado -> web link -> fixture esperada`. |
| **B - Backend + Cloudflare** | Definir `packages/contracts`, schemas, errores canónicos, fixtures y política de cambios breaking. | Optimizar el contrato para un único cliente o filtrar UX hacia backend. | Contrato consumible por mobile, backend y Telegram/Web. |
| **C - App nativa** | Adaptar mobile para consumir contratos compartidos sin romper operación firmada, outbox, materializer ni offline-first. | Mantener contratos mobile-only o mover runtime/adaptadores nativos fuera de mobile. | Mapa `operación mobile actual -> contrato final -> impacto offline`. |

## Gate 0 - Resolver drift de operaciones

Antes de implementar la extracción, hay que reconciliar el drift actual entre mobile y contracts.

| Área | Mobile actual | Contracts actual | Decisión requerida |
|---|---|---|---|
| Presencia | `presence.pause` | `presence.pause` | Canónico reconciliado para pausa offline. |
| Recursos | `resource_report.create` | `resource_report.create` | Canónico reconciliado para reportes de recursos. |
| Dispatch | `dispatch_event.create/update` | `dispatch_event.create/update` | Canónico reconciliado para eventos de dispatch. |
| SOS | `sos.create/cancel` | `sos.create/cancel` | Canónico reconciliado para ciclo SOS. |

**Regla:** ningún equipo implementa sobre nombres divergentes. Primero se aprueba la tabla canónica de operaciones.

## Secuencia de trabajo

### Paso 1 - Equipo A entrega demanda de canal

Equipo A prepara una tabla con:

| Campo | Descripción |
|---|---|
| Flow | Comando, conversación o pantalla web. |
| Operación requerida | Nombre deseado o intención funcional, no schema final. |
| Payload mínimo | Datos mínimos que el canal necesita enviar. |
| Errores visibles | Errores que deben mostrarse al usuario. |
| Estado conversacional | Pendiente, confirmado, cancelado, expirado, recuperable o bloqueante. |
| Web link | Si requiere enlace web, scope, TTL y retorno esperado. |
| Fixture esperada | Caso happy path/error que B debe cubrir. |

### Paso 2 - Equipo C entrega mapa mobile/offline

Equipo C prepara un mapa con:

| Campo | Descripción |
|---|---|
| Operación mobile actual | Nombre y uso actual. |
| Contrato propuesto | Nombre canónico esperado tras reconciliación. |
| Estado local | Impacto en `syncState`, `sync_ops`, outbox y materializer. |
| Migración necesaria | Import, test, schema o adapter que debe cambiar. |
| Riesgo offline | Qué comportamiento podría romperse sin red. |

### Paso 3 - Equipo B propone contrato canónico

Equipo B define el primer contrato compartido en `packages/contracts`:

- `OperationType` canónico.
- `OperationFamily`.
- `SignedOperationSchema`.
- `SyncPushRequestSchema` y `SyncPushResponseSchema`.
- `WebLinkRequestSchema` y `WebLinkSessionSchema` para enlaces Web UI.
- Errores estables.
- Semántica estable de cada error canónico y mapping visible Telegram/Web.
- Fixtures válidas e inválidas, incluyendo operación firmada, sync push y web links.
- Golden compatibility vectors para canonicalización, firma fake y `opId`.
- Tabla `OperationType -> OperationFamily`.
- Política inicial de cambios breaking.

Separación esperada:

| Paquete | Contenido |
|---|---|
| `packages/contracts` | DTOs públicos, schemas, errores, operation types y fixtures contractuales. |
| `packages/domain` | Reglas puras, policies, permisos e invariantes. |
| `packages/crypto` | Canonicalización, hashing e interfaces de firma/verificación. |

### Paso 4 - Revisión A/C del contrato

A valida:

- todos los flows están representados;
- los errores son mostrables;
- los web links tienen scope, TTL y correlación;
- cada flow de Equipo A tiene fixture happy path y fixture de error antes de cerrar Slice 1;
- no se fuerza UX desde backend.

C valida:

- mobile puede consumir `@zona-cero/contracts`;
- el signer mobile no importa runtime desde el índice principal de `@zona-cero/contracts`; solo usa el subpath Zod-free `@zona-cero/contracts/operation-vocabulary` para constantes;
- no se pierde `syncState: pending` local;
- `SyncPushRequestSchema` sigue aceptando solo operaciones `pending`;
- outbox y materializer siguen funcionando;
- las operaciones offline existentes tienen equivalencia canónica.

### Paso 5 - Implementación solapada

Cuando el contrato base está aprobado:

| Equipo | Trabajo |
|---|---|
| B | Implementa/ajusta `packages/contracts`, fixtures y tests contractuales. |
| C | Reemplaza tipos locales compartidos por imports desde `@zona-cero/contracts`. |
| A | Construye flows contra fixtures/mocks, sin schema privado. |

## Tests y gates

| Gate | Owner | Comando/evidencia esperada |
|---|---|---|
| Contracts | B | `pnpm contracts:test` verde. |
| Testing fixtures | B | `pnpm --filter @zona-cero/testing test:strict` verde con fixtures happy/error, sync push, web links y golden vector. |
| Mobile offline | C | Tests de signer, outbox, materializer y local DB verdes. |
| Channel contract fit | A | Casos de canal mapeados contra fixtures. |
| Root strict | Todos | `pnpm test:strict` verde. |

Tests mobile que no deben romperse:

- `apps/mobile/src/infrastructure/security/operation-signer.test.ts`
- `apps/mobile/src/infrastructure/oplog/outbox-service.test.ts`
- `apps/mobile/src/infrastructure/oplog/materializer.test.ts`
- `apps/mobile/src/infrastructure/local-db/local-db.test.ts`
- `apps/mobile/src/features/operations/liveOperations.test.tsx`

## Política de cambios breaking

Un cambio es breaking si modifica:

- nombre de `OperationType`;
- campo requerido de una operación firmada;
- semántica de error estable;
- mapping visible Telegram/Web de un error canónico;
- forma de payload ya consumida por otro equipo;
- canonicalización o firma.
- vector de compatibilidad de canonicalización, firma o `opId`;
- `SyncPushRequestSchema` para aceptar estados distintos de `pending`, o para cambiar la semántica `pending-only`;
- import runtime del signer mobile para depender del índice principal de `@zona-cero/contracts` en vez del subpath Zod-free `@zona-cero/contracts/operation-vocabulary`;
- contrato de Web links: `scope`, `ttlSeconds`, `correlationId`, `returnState`, `expiresAt`, `singleUse` o semántica de expiración;
- scope estable de Web links: `incident.join`, `work_center.detail` o `family_reunification.search`.

Todo breaking requiere:

1. aprobación A+B+C;
2. fixture happy/error actualizada para cada flow afectado;
3. test de compatibilidad o rechazo explícito;
4. nota de migración.

## Artefactos verificables añadidos para revalidación

| Bloqueo | Artefacto esperado |
|---|---|
| Web links como breaking | `WebLinkRequestSchema`, `WebLinkSessionSchema`, scopes estables, errores `link_expired`, `invalid_link_scope`, `link_correlation_mismatch` y tests de rechazo. |
| Fixtures Equipo A | Fixtures compartidas de web link request/session válidas e inválidas, incluyendo pares happy/error por scope final: `incident.join`, `work_center.detail` y `family_reunification.search`. |
| Mapping de errores visibles | `contractErrorSemantics` con `meaning` y `visibleMappingKey.telegram/web` por código canónico. |
| Golden vectors Equipo B | `signedOperationGoldenVector` en `@zona-cero/testing`, consumido por tests mobile. |
| Sync push pending-only Equipo C | Test contractual de rechazo de operación no-`pending` y política breaking explícita. |
| Runtime Zod-free Equipo C | Mobile importa `operationTypeFamilies` desde `@zona-cero/contracts/operation-vocabulary`; el test compara contra el subpath Zod-free. |

## Definition of Done

Slice 1 / Fase 2 está cerrada cuando:

- `packages/contracts` es consumible por mobile, backend y Telegram/Web;
- no existen contratos paralelos mobile-only o channel-only;
- los operation types divergentes están reconciliados;
- hay fixtures válidas e inválidas compartidas;
- hay fixture happy/error para cada scope final de Equipo A;
- existen golden compatibility vectors para canonicalización/firma/`opId`;
- los errores estables están documentados;
- cada error canónico documenta semántica estable y mapping visible Telegram/Web;
- los contratos de Web links están en `packages/contracts`;
- mobile conserva operación firmada, outbox, materializer y comportamiento offline;
- mobile conserva el import runtime Zod-free del vocabulario de operaciones;
- A puede implementar flows contra fixtures sin inventar schemas;
- `pnpm contracts:test` y `pnpm test:strict` pasan.

## Riesgos principales

| Riesgo | Mitigación |
|---|---|
| Backend-driven contract | A y C aprueban consumo antes de implementar. |
| Contratos paralelos | Bloquear schemas privados en A/C. |
| Pérdida offline-first | C mantiene outbox/materializer local y solo extrae tipos puros. |
| Drift de operation types | Gate 0 obligatorio antes de cambios. |
| Breaking changes silenciosos | Política breaking + fixtures + tests. |

## Próximo paso recomendado

Crear la tabla canónica de operaciones de Slice 1 a partir de:

1. handoff de flows de Equipo A;
2. mapa de operaciones mobile de Equipo C;
3. propuesta de contrato de Equipo B.

Sin esa tabla, cualquier implementación va demasiado rápido y entiende demasiado poco.
