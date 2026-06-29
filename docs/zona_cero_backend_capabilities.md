# Backend capabilities - Zona Cero

Este documento define las capacidades que debe poseer el backend para servir a Telegram + Web UI y a la app nativa sin duplicar reglas de negocio en los clientes.

## Principio arquitectónico

**Backend owns capabilities. Clients own channels.**

El backend no debe ser un CRUD pasivo. Debe concentrar reglas de dominio compartidas, permisos, auditoría, sincronización, derivaciones y estados derivados. Telegram/Web y móvil solo adaptan la experiencia al canal.

## Estado actual del repo

El repo actual ya es un monorepo pnpm con la app Expo/Tamagui en `apps/mobile`:

- El `package.json` raíz orquesta scripts Expo/Jest hacia `@zona-cero/mobile` y mantiene comandos Maestro/visual audit desde la raíz.
- `apps/mobile/src/app/` contiene rutas Expo Router.
- `apps/mobile/src/features/operations/` ya implementa pantallas y tests de operación.
- `apps/mobile/src/infrastructure/local-db/` contiene una base local en memoria/RxDB-facing.
- `apps/mobile/src/infrastructure/oplog/` contiene materialización y outbox de operaciones firmadas.
- `apps/mobile/src/infrastructure/security/operation-signer.ts` define tipos de operación firmada.
- `apps/mobile/src/infrastructure/maps/` contiene adaptadores y lógica de paquetes offline.
- `pnpm-workspace.yaml` declara `apps/*`, `services/*` y `packages/*`; `services/api` y los paquetes compartidos existen como placeholders.

Eso significa que el backend debería nacer extrayendo contratos y dominio compartidos, no reescribiendo el producto desde cero.

## Capacidades backend por dominio

| Dominio | Backend debe poseer | Consumidores |
|---|---|---|
| Identidad | Identidad seudónima por incidente, mapeo de identidades de canal, roles y permisos. | Telegram/Web, móvil. |
| Incidentes | Crear/unir incidente, celdas, estado, configuración y paquetes asociados. | Telegram/Web, móvil. |
| Operaciones firmadas | Validar forma, idempotencia, familia, actor, permisos y deduplicación. | Móvil principalmente; Telegram/Web como canal conectado. |
| Centros de trabajo | Estados derivados, transición, reportes falso/duplicado/peligroso/resuelto. | Telegram/Web, móvil. |
| Presencia | Calcular score a partir de señales recibidas y explicar confianza. | Móvil aporta señales fuertes; Telegram aporta señales explícitas débiles. |
| Recursos | Faltantes, sobrantes, categorías configurables, frescura, confianza y restricciones. | Telegram/Web, móvil. |
| Logística | Matching simple, tareas, estados y despacho manual asistido. | Telegram/Web, móvil. |
| SOS | Estado, prioridad, propagación conectada, acuse y auditoría. | Telegram/Web, móvil. |
| Reunificación | Datos públicos mínimos, capa privada, límites anti-abuso, TTL y derivación. | Web UI, personal verificado. |
| Sincronización | Push/pull por incidente, celda y cursor lógico. | Móvil. |
| Auditoría | Ledger de cambios críticos, canal, actor, decisión y resultado. | Todos. |

## Cloudflare target architecture

| Componente | Uso previsto |
|---|---|
| Cloudflare Workers | API HTTP, webhooks Telegram, endpoints de enlaces firmados. |
| Durable Objects | Coordinación por incidente/celda, cursors, deduplicación y estado caliente. |
| D1 | Datos relacionales de incidentes, roles, permisos, auditoría resumida y configuración. |
| R2 | Exportaciones, adjuntos permitidos, paquetes o artefactos no sensibles si aplica. |
| Queues | Fan-out de notificaciones, procesamiento de operaciones, tareas async y webhooks. |
| KV | Configuración cacheable, rate-limit metadata de bajo riesgo y flags. |
| Turnstile | Protección anti-abuso en formularios web públicos/sensibles. |
| Analytics/Logs | Métricas operativas, errores, latencia y abuso. |

## Boundaries de equipo

| Área | Equipo B posee | Equipos A/C no deben duplicar |
|---|---|---|
| Dominio | Estados, validaciones, permisos y reglas críticas. | Reglas de transición y permisos. |
| API | Contratos, versionado, errores, idempotencia. | Endpoints ad hoc por canal. |
| Sync | Cursors, conflicto, deduplicación, materialización compartida. | Resolución de conflicto propia. |
| Seguridad | Firma, scopes, expiración de enlaces, rate limits, auditoría. | Validaciones sensibles solo cliente. |
| Infra | Workers, colas, D1, R2, secretos y despliegue. | Infra paralela no coordinada. |

## Primeras APIs necesarias

| Capability | Endpoint lógico | Prioridad |
|---|---|---|
| Incidentes | `GET /incidents`, `POST /incidents/:id/join` | Alta |
| Identidad de canal | `POST /channel-identities/telegram` | Alta |
| Centros | `POST /operations/work-center.create`, `GET /incidents/:id/centers` | Alta |
| Recursos | `POST /operations/resource-report.create` | Alta |
| Logística | `POST /dispatch-tasks`, `PATCH /dispatch-tasks/:id/state` | Media |
| SOS | `POST /operations/sos.create`, `POST /sos/:id/ack` | Alta |
| Web links | `POST /web-links`, `GET /web-links/:token/session` | Alta |
| Sync móvil | `POST /sync/push`, `GET /sync/pull` | Alta para app nativa |

## Reglas de implementación

- Los clientes envían intención; el backend decide si es válida.
- Toda mutación crítica debe ser idempotente.
- Las operaciones deben conservar trazabilidad del canal: `mobile`, `telegram`, `web-ui`, `system`.
- Los errores deben ser operativos, no técnicos: `requires_verified_role`, `stale_incident`, `unsafe_for_role`, `link_expired`.
- Las lecturas para Telegram deben estar resumidas y minimizadas.
- Las lecturas para móvil deben soportar sincronización por incidente/celda.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Backend se convierte en CRUD | Mantener capabilities y políticas como módulos de dominio. |
| Telegram introduce datos sensibles | Usar Web UI privada y minimizar mensajes de chat. |
| Móvil y Telegram divergen | Contratos compartidos + tests contractuales. |
| Cloudflare limita patrones tradicionales | Diseñar para Workers, Durable Objects y colas desde el principio. |
| Operación offline mal modelada | Mantener operación firmada y sync móvil como capability de primera clase. |
