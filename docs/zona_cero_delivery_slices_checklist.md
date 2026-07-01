# Checklist de slices por equipo - Zona Cero

Este documento sirve para controlar el avance de las slices entre los tres equipos de ingeniería:

- **Equipo A:** Telegram + Web UI.
- **Equipo B:** Backend + infraestructura Cloudflare.
- **Equipo C:** App nativa.

## Reparto base de ownership

Usar este reparto como contrato de trabajo para todas las slices. La clave es que cada equipo pueda avanzar en paralelo sin duplicar reglas críticas ni bloquear a los demás por decisiones implícitas.

| Equipo | Responsabilidad principal | Debe entregar | No debería poseer |
|---|---|---|---|
| **Equipo A: Telegram + Web UI** | Bot flows, comandos, mensajes, enlaces presignados, pantallas web ligeras y UX conversacional. | Flows de canal, copy, estados de conversación, pantallas web mínimas, eventos de UX y necesidades de contrato hacia backend. | Reglas de negocio críticas, permisos, auditoría central, sync/offline nativo o lógica duplicada en clientes. |
| **Equipo B: Backend + Cloudflare** | Modelo de dominio, APIs, auth, permisos, sync, auditoría, Workers/D1/R2/Queues/Durable Objects y webhooks Telegram. | Contratos, endpoints, webhooks, persistencia, políticas de permisos, auditoría, fixtures y errores estables. | UX nativa, UX conversacional final, lógica duplicada en clientes o decisiones de interacción de campo. |
| **Equipo C: App nativa** | Offline-first, mapa offline, presencia, outbox firmada, SOS crítico, Meshtastic y UX de campo. | Operaciones firmadas, materialización local, outbox, estados offline/sync, UX nativa y comportamiento sin red. | Lógica central de negocio que deba compartir Telegram/Web, permisos centrales o auditoría canónica. |

## Cómo leer cada slice

- **Owns:** lo que el equipo decide e implementa.
- **Consume de:** dependencias que necesita de otro equipo para avanzar correctamente.
- **No debe hacer:** límites explícitos para evitar duplicación o ownership incorrecto.
- **Handoff esperado:** artefacto concreto que deja listo para los demás equipos.

## Estado global

| Slice | Objetivo | Equipo A | Equipo B | Equipo C | Estado |
|---|---|---:|---:|---:|---|
| 0 | Monorepo foundation | 🟢 | 🟢 | 🟢 | Hecho |
| 1 | Contratos compartidos | 🟢 | 🟢 | 🟢 | Hecho |
| 2 | Incidentes + identidad básica | 🟢 | 🟢 | 🟢 | Hecho |
| 3 | Centros de trabajo | 🟢 | 🟢 | 🟢 | Hecho |
| 4 | Recursos + logística | 🟢 | 🟢 | 🟢 | Hecho |
| 5 | SOS conectado + nativo crítico | 🟢 | 🟢 | 🟢 | Hecho |
| 6 | Reunificación familiar web | 🟢 | 🟢 | 🟢 | Hecho |
| 7 | Sync/offline hardening | 🟢 | 🟢 | 🟢 | Hecho |
| 8 | Observabilidad + seguridad | 🟢 | 🟢 | 🟢 | Hecho |
| 9 | Localización multi-idioma | 🟢 | 🟢 | 🟢 | Hecho |
| 10 | Telegram intent routing con Workers AI | 🟢 | 🟢 | 🟢 | Hecho |

Leyenda sugerida: ⬜ No iniciado · 🟡 En progreso · 🟢 Hecho · 🔴 Bloqueado.

## Slice 0 - Monorepo foundation

**Objetivo:** preparar el repo para trabajo paralelo sin cambiar comportamiento funcional.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Validación de necesidades iniciales de Web UI y Telegram dentro del monorepo. | Estructura de workspaces definida por B y límites de carpeta de todos. | Introducir flows funcionales antes de contratos compartidos. | Confirmación de nombres, runtime esperado y ownership de `apps/web-ui` / `apps/telegram-channel`. |
| B | Estructura base de monorepo, `services/api`, paquetes compartidos mínimos y workspaces. | Necesidades de A y movimiento de Expo validado por C. | Definir UX de canal o app nativa desde infraestructura. | Workspaces reales, scripts raíz equivalentes y límites de paquetes compartidos. |
| C | Validación del traslado de Expo a `apps/mobile` y mapeo de scripts móviles. | Workspaces y aliases definidos por B. | Cambiar comportamiento funcional de producto durante la fundación. | App actual funcionando en el nuevo workspace sin romper `pnpm test:strict`. |
| Todos | Ownership por carpeta y gate raíz equivalente. | Acuerdos de los tres equipos. | Empezar features sin límites de carpeta claros. | Base segura para trabajo paralelo. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Validar nombres de `apps/web-ui` y `apps/telegram-channel`. |
| A | 🟢 Definir necesidades iniciales de runtime web. |
| B | 🟢 Definir `services/api` y paquetes compartidos mínimos. |
| B | 🟢 Actualizar `pnpm-workspace.yaml` con workspaces reales. |
| C | 🟢 Validar qué archivos Expo deben moverse a `apps/mobile`. |
| C | 🟢 Confirmar que scripts actuales de mobile quedan mapeados. |
| Todos | 🟢 Acordar ownership por carpeta. |
| Todos | 🟢 Mantener `pnpm test:strict` equivalente antes/después. |

**Definition of Done**

- Workspaces declarados.
- Estructura base creada.
- App actual sigue funcionando.
- No hay cambio funcional de producto.

**Cierre Slice 0**

- Workspaces reales declarados en `pnpm-workspace.yaml`: `apps/*`, `services/*`, `packages/*`.
- Estructura base creada con `package.json` de workspace y README de propósito, ownership y límites por carpeta.
- Slice 0 preparó `apps/mobile`; Fase 1 ya movió la app Expo real a ese workspace.
- Scripts móviles actuales quedan mapeados con aliases `mobile:*` sin romper los scripts raíz existentes.
- `pnpm test:strict` se mantiene como gate raíz equivalente.

## Slice 1 - Contratos compartidos

**Objetivo:** crear lenguaje común antes de implementar canales nuevos.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Necesidades de contrato para comandos, bot flows, errores visibles y links web. | Schemas y errores estables de B. | Definir reglas de dominio o formatos privados del backend. | Lista de operaciones de canal, estados conversacionales y errores que necesita mostrar. |
| B | `packages/contracts`, operation types, schemas, errores canónicos y fixtures firmados. | Casos de uso de A y C. | Optimizar contratos para un único cliente o filtrar lógica de dominio hacia canales. | Paquete consumible, fixtures y política de cambios breaking. |
| C | Adaptación de tipos de operaciones firmadas y validación con outbox/materializer. | Contratos y fixtures de B. | Crear contratos paralelos solo para mobile. | Tests verdes de operación firmada y compatibilidad offline. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Revisar contratos necesarios para bot flows y web links. |
| B | 🟢 Crear `packages/contracts` con operation types, errores y schemas iniciales. |
| B | 🟢 Crear fixtures de operaciones firmadas. |
| B | 🟢 Añadir fixtures compartidas happy/error para operación firmada, sync push y web links. |
| B | 🟢 Añadir golden compatibility vectors para canonicalización, firma y `opId`. |
| C | 🟢 Migrar o adaptar tipos actuales de operaciones firmadas. |
| C | 🟢 Confirmar que tests de outbox/materializer siguen pasando. |
| Todos | 🟢 Aprobar política de cambios breaking. |

**Definition of Done**

- Contratos consumibles por mobile, backend y Telegram/Web.
- Tests contractuales mínimos.
- Errores estables documentados.

**Avance Slice 1**

- `packages/contracts` contiene vocabulario canónico reconciliado con mobile, schemas de operación firmada, errores estables y schema de sync push.
- `packages/contracts` añade schemas de Web links con scopes estables, TTL, correlación, retorno, expiración, single-use y auditoría.
- Los errores canónicos incluyen semántica estable y mapping visible Telegram/Web.
- Mobile consume tipos compartidos desde `@zona-cero/contracts` y mantiene la firma/canonical payload local.
- `SyncPushRequestSchema` acepta solo operaciones `pending`.
- El vocabulario runtime compartido vive en `@zona-cero/contracts/operation-vocabulary` para evitar cargar Zod en mobile cuando solo hacen falta constantes.
- Fixtures y tests contractuales actualizados con operación firmada válida/inválida, sync push válido/inválido, web link request/session válidos/inválidos, fixtures happy/error por scope final de Equipo A y golden vector de canonicalización/firma/`opId`.
- Evidencias añadidas y aprobadas por A/B/C para cerrar la política de cambios breaking.
- Verificación ejecutada: `pnpm contracts:test`, `pnpm --filter @zona-cero/mobile test:strict`, `pnpm test:strict` y export Expo iOS.
- Aprobación explícita recibida: Equipo A, Equipo B y Equipo C aprobaron la política de cambios breaking tras revalidar los artefactos.

## Slice 2 - Incidentes + identidad básica

**Objetivo:** permitir alta multi-canal sin login tradicional.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | `/start`, selección de incidente, seudónimo, rol conversacional y pantalla web auxiliar si hace falta. | Incident list/join, channel identity y errores de B. | Resolver permisos localmente en Telegram/Web. | Flow de entrada validado con casos felices, cancelaciones y errores visibles. |
| B | Incidentes, join, identidad por canal, roles, permisos y auditoría mínima. | Requisitos UX de A y compatibilidad de identidad local de C. | Acoplar identidad a Telegram como canal obligatorio. | API/contrato para alta multi-canal, permisos y trazabilidad de actor/canal. |
| C | Onboarding nativo con identidad local y preparación de consumo de incident config. | Configuración de incidente y permisos de B. | Depender de Telegram para entrar al incidente. | Mobile entra sin red/Telegram y se reconcilia cuando haya backend. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Implementar `/start`, selección de incidente, seudónimo y rol. |
| A | 🟢 Validar que la pantalla web de selección queda diferida porque el flow conversacional cubre el primer corte. |
| B | 🟢 Implementar incident list/join y channel identity. |
| B | 🟢 Persistir roles, permisos y auditoría mínima. |
| C | 🟢 Mantener onboarding nativo con identidad local. |
| C | 🟢 Preparar consumo de incident config desde backend cuando haya red. |

**Definition of Done**

- Usuario entra por Telegram y queda vinculado a incidente.
- Usuario entra por mobile sin depender de Telegram.
- Backend distingue canal, actor y permisos.

**Cierre Slice 2**

- `packages/contracts` define contratos canónicos para canales, roles, permisos, incident list/config y join multi-canal.
- `services/api` expone `GET /incidents`, `GET /incidents/:incidentId/config` y `POST /incidents/:incidentId/join` con D1 como fuente inicial de incidentes, identidades, memberships y auditoría.
- El webhook Telegram usa el flujo real `/start → incidente → seudónimo → rol → join` y persiste membership/audit vía backend.
- Mobile añade onboarding local offline-first con identidad local, rol self-declared y reconciliación posterior contra incident config/join sin recalcular permisos.
- La pantalla Web UI auxiliar queda diferida porque el flujo conversacional cubre el primer corte.
- Limitaciones aceptadas para producción: estado conversacional Telegram in-memory y store mobile persistente nativo quedan para hardening posterior.
- Verificación ejecutada: `pnpm contracts:test`, `pnpm api:test:strict`, `pnpm telegram:test:strict`, `pnpm mobile:test:strict` y `pnpm test:strict`.

## Slice 3 - Centros de trabajo

**Objetivo:** crear y consultar centros desde mobile y desde canal conectado.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Flow Telegram para reportar centro mínimo y Web UI online de mapa/detalle. | Endpoint, reglas de validación y estado derivado de B. | Decidir activación de centro por una sola señal. | Reporte de centro desde canal conectado con errores y confirmaciones claras. |
| B | `work_center.create`, modelo de centro, estado derivado, auditoría y reglas de activación. | Señales de A y operaciones offline de C. | Implementar UX de mapa nativo o lógica offline cliente. | Contrato idempotente, eventos/auditoría y criterios de frescura/confianza/riesgo. |
| C | Creación offline desde mapa, materialización local y visualización de frescura/confianza/riesgo. | Contrato y reglas de estado de B. | Duplicar reglas canónicas de activación. | Operación firmada sincronizable y experiencia offline coherente. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Flow Telegram para reportar centro mínimo. |
| A | 🟢 Web UI con mapa online/detalle de centro. |
| B | 🟢 Endpoint/operation `work_center.create`. |
| B | 🟢 Estado derivado y auditoría de centro. |
| C | 🟢 Crear centro desde mapa/offline usando outbox local. |
| C | 🟢 Mostrar frescura/confianza/riesgo en UI nativa. |

**Definition of Done**

- Un centro creado por Telegram aparece en backend/web/mobile cuando hay sync.
- Un centro creado offline en mobile se materializa localmente y se sincroniza después.
- El centro no pasa a `active` por una sola señal.

**Cierre Slice 3**

- `packages/contracts` define contratos canónicos de Work Centers: payload de `work_center.create`, list/detail/create responses, estados derivados, errores estables y compatibilidad de operación `version: 1`.
- `packages/domain` contiene las reglas puras de activación, frescura, confianza y riesgo; el centro no puede pasar a `active` por una sola señal débil.
- `services/api` expone `POST /incidents/:incidentId/work-centers`, `GET /incidents/:incidentId/work-centers` y `GET /incidents/:incidentId/work-centers/:workCenterId` con D1, señales, auditoría/sync y recomputación backend de frescura/riesgo en lectura.
- `/sync/push` materializa operaciones firmadas `work_center.create`, acepta duplicados idempotentes y rechaza versiones/payloads incompatibles con errores estables.
- Telegram añade el flow real `/workcenter` conectado al webhook con estado persistido y limpieza de estados terminales para no interferir con `/start`.
- Web UI muestra listado/detalle/mapa ligero consumiendo estado backend; no calcula activación, frescura, confianza ni riesgo localmente.
- Mobile usa `WorkCenterCreatePayloadSchema`, mantiene creación offline mediante outbox/materializer/local DB y marca centros locales como provisionales hasta sincronizar estado canónico.
- Verificación ejecutada: `pnpm contracts:test:strict`, `pnpm api:test:strict`, `pnpm telegram:test:strict`, `pnpm web:test:strict`, `pnpm mobile:test:strict`, `pnpm test:strict`, `git diff --check` y `pnpm e2e`.

## Slice 4 - Recursos + logística

**Objetivo:** conectar faltantes, sobrantes y tareas de traslado.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Bot flows para faltante/sobrante y aceptar/actualizar tarea logística. | Catálogos, matching, estados y errores de B. | Crear matching paralelo o estados propios de tarea. | Conversaciones de reporte/aceptación con payloads compatibles. |
| B | Modelo de resource report, frescura/confianza, matching simple y dispatch tasks. | Señales de A y reportes offline de C. | Resolver UX de campo o navegación logística nativa. | API/operaciones de reportes, sugerencias y estados de tarea. |
| C | Reporte offline desde centro activo y vista nativa de necesidades/sobrantes. | Modelo, catálogos y estados de B. | Inventar categorías o reglas de matching locales no compartidas. | Outbox de recursos y vista de campo que degrade cuando los datos estén stale. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Bot flow para faltante/sobrante. |
| A | 🟢 Bot flow para aceptar/actualizar tarea logística. |
| B | 🟢 Modelo de resource report con frescura/confianza. |
| B | 🟢 Matching simple y dispatch tasks. |
| C | 🟢 Reporte offline desde centro activo. |
| C | 🟢 Vista nativa de necesidades/sobrantes por centro. |

**Definition of Done**

- Reportes tienen categoría, cantidad aproximada, urgencia y restricciones.
- Matching simple genera o sugiere tarea.
- Tareas tienen estados: pendiente, aceptada, en camino, entregada, cancelada.

**Cierre Slice 4**

- `packages/contracts` define contratos canónicos para recursos y logística: `ResourceReportPayload`, reportes `needed/surplus`, urgencias, restricciones, tareas de dispatch y estados `pending`, `accepted`, `en_route`, `delivered`, `cancelled`.
- `packages/domain` contiene el matching simple necesidad/sobrante por incidente, celda y categoría; Telegram, Web UI y Mobile no calculan matching paralelo.
- `services/api` añade la migración `0004_resource_reports_dispatch.sql`, endpoints de resource reports, matches y dispatch tasks, y materialización vía `/sync/push` para `resource_report.create`, `dispatch_event.create` y `dispatch_event.update`.
- La idempotencia de dispatch queda protegida: duplicados compatibles se aceptan y un segundo `dispatch_event.create` con el mismo `dispatchTaskId`/`entityId` pero payload incompatible se rechaza con `operation_conflict`.
- Telegram añade flows `/resource` y `/dispatch` conectados al webhook con estados namespaced para evitar interferencias con `/start` y `/workcenter`.
- Web UI muestra necesidades/sobrantes y tareas logísticas consumiendo contratos/endpoints backend; no inventa estados ni matching local.
- Mobile crea `resource_report.create` offline desde el centro activo, materializa necesidades/sobrantes localmente y muestra degradación visible como `Local pending` / `Offline provisional` hasta sincronizar.
- Verificación ejecutada: `pnpm contracts:test:strict`, `pnpm --filter @zona-cero/domain test:strict`, `pnpm api:test:strict`, `pnpm telegram:test:strict`, `pnpm web:test:strict`, `pnpm mobile:test:strict`, `pnpm test:integration`, `pnpm test:strict`, fresh review post-remediación y `pnpm e2e`.

## Slice 5 - SOS conectado + nativo crítico

**Objetivo:** cubrir SOS conectado en Telegram/Web y SOS crítico en app nativa.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | SOS conectado desde Telegram/Web, confirmación, acuse y comunicación de límites. | Cola crítica, estado SOS y fan-out de B. | Prometer precisión o prioridad que backend/app no garanticen. | Flow conectado con confirmación explícita y estados de acuse. |
| B | Cola crítica, estado SOS, auditoría, prioridad y fan-out/notificaciones. | Señales conectadas de A y SOS offline de C. | Implementar comportamiento offline nativo o Meshtastic. | Contrato crítico, idempotencia, trazabilidad y fan-out observable. |
| C | SOS nativo rápido, cola local, comportamiento sin red y spike/adapter Meshtastic. | Reglas de estado/fan-out de B. | Depender de red para registrar intención crítica. | SOS local-first que sincroniza después sin falsa precisión. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Comando/botón SOS conectado con confirmación. |
| A | 🟢 Acuse de recibo desde Telegram. |
| B | 🟢 Cola crítica, estado SOS y auditoría. |
| B | 🟢 Notificaciones/fan-out con prioridad. |
| C | 🟢 SOS nativo de acceso rápido. |
| C | 🟢 Cola local y comportamiento sin red. |
| C | 🟢 Spike/adapter Meshtastic según fase. |

**Definition of Done**

- SOS con red se propaga y recibe acuse.
- SOS nativo queda en cola si no hay red.
- La UI nunca promete profundidad exacta ni precisión falsa.

**Cierre Slice 5**

- `packages/contracts` define contratos canónicos de SOS: payload de creación/cancelación, alerta, estado, fan-out observable y request/response conectado.
- `services/api` añade persistencia crítica con `sos_alerts`, `sos_events` y `critical_fanout_jobs`; `/sync/push` materializa `sos.create` y `sos.cancel` sin falsos accepted.
- Telegram expone `/sos` con confirmación explícita `CONFIRM SOS`, estado namespaced y acuse honesto desde el webhook real.
- Web UI añade SOS conectado con confirmación fuerte, idempotencia de submit, identidad demo con membership sembrada y render de estado/fan-out backend.
- Mobile añade SOS nativo local-first, cancelación local, materialización visible de estado pendiente y transporte Meshtastic como adapter seguro sin prometer ACK.
- El copy de todos los canales distingue guardado local, registro backend y fan-out observable; no promete entrega, rescate, prioridad absoluta ni ubicación exacta.
- Verificación ejecutada: `git diff --check`, `pnpm contracts:test:strict`, `pnpm api:test:strict`, `pnpm telegram:test:strict`, `pnpm web:test:strict`, `pnpm mobile:test:strict`, `pnpm test:strict` y fresh-context review sin P0/P1/P2.

## Slice 6 - Reunificación familiar web

**Objetivo:** habilitar flujo sensible mediante web privada, no chat público.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Mensajería de límites, derivación desde bot y Web UI privada de búsqueda/derivación. | Tokens scoped, TTL, access control y auditoría de B. | Exponer datos sensibles en chat público. | Flujo web privado con copy claro, mínimos datos visibles y errores seguros. |
| B | Link tokens, scopes, expiración, auditoría, anti-abuso, TTL y access control. | Necesidades de derivación de A. | Poner lógica sensible en cliente o confiar en ocultación visual. | Seguridad server-side, trazabilidad y límites verificables. |
| C | Confirmar no bloqueo/no duplicación del flujo en MVP. | Decisión de alcance de A/B. | Reimplementar reunificación familiar nativa en MVP. | Validación de que mobile no contradice ni duplica el canal web privado. |

| Equipo | Checklist |
|---|---|
| A | ✅ Bot explica límites y deriva a enlace web seguro. |
| A | ✅ Web UI de búsqueda privada y derivación. |
| B | ✅ Link tokens con scope, expiración y auditoría. |
| B | ✅ Límites anti-abuso, TTL y access control. |
| C | ✅ Confirmar que mobile no bloquea ni duplica el flujo en MVP. |

**Definition of Done**

- ✅ No se publican fotos, ubicación exacta ni identidad completa de menores.
- ✅ Todo intento queda auditado.
- ✅ El sistema deriva a verificación presencial.

**Cierre Slice 6**

- Equipo A implementó derivación segura desde Telegram (`/familia`, `/reunificacion`) y Web UI privada con búsqueda minimizada y derivación presencial.
- Equipo B implementó autoridad server-side para private web links: token hasheado, scope `family_reunification.search`, TTL máximo server-side de 900s, `maxUses = 1`, consumo/debit en búsqueda sensible, auditoría y anti-abuso.
- Equipo C confirmó que mobile no bloquea ni duplica el flujo en MVP; reunificación familiar queda como flujo web privado.
- Fresh review final: 0 P0/P1/P2.

**Evidencia de verificación**

- `git diff --check` ✅
- `pnpm api:test:strict` ✅
- `pnpm telegram:test:strict` ✅
- `pnpm web:test:strict` ✅
- `pnpm mobile:test:strict` ✅
- `pnpm test:strict` ✅

## Slice 7 - Sync/offline hardening

**Objetivo:** consolidar la promesa local-first de la app nativa.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Comunicación de limitaciones del canal cuando no hay datos frescos. | Señales de frescura/staleness de B. | Simular offline-first en Telegram/Web. | Estados de canal claros cuando los datos no son confiables o recientes. |
| B | `sync/push`, `sync/pull`, cursores, deduplicación, idempotencia y scope por incidente/celda. | Operaciones/outbox de C y necesidades de visualización de A. | Meter resolución visual de conflictos en backend como UX final. | Sync API robusta, contratos de conflicto y garantías de idempotencia. |
| C | Persistencia local real, reintentos, conflictos visibles, outbox y map packs offline. | Sync API y reglas de conflicto de B. | Crear protocolo sync paralelo para mobile. | Mobile local-first operativo con degradación visible y sincronización sin duplicados. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Mostrar limitaciones del canal cuando no hay datos frescos. |
| B | 🟢 `sync/push` y `sync/pull` por incidente/celda/cursor. |
| B | 🟢 Deduplicación e idempotencia de operaciones. |
| C | 🟢 RxDB/SQLite real según diseño vigente. |
| C | 🟢 Reintentos, conflictos y estados visibles de outbox. |
| C | 🟢 Map packs offline operativos. |

**Definition of Done**

- 🟢 Acción offline aparece localmente de inmediato.
- 🟢 Acción sincroniza después sin duplicarse.
- 🟢 Datos stale se degradan visual y operativamente.

**Cierre Slice 7**

- Equipo B acotó los endpoints de sync por incidente/celda, añadió cursor/change log en `sync/pull`, protegió duplicados de forma idempotente, estructuró conflictos y expuso señales de frescura.
- Equipo A muestra limitaciones de canal en Telegram/Web para estados stale, expirados, ausentes o en conflicto, incluido el wiring real del webhook Telegram mediante `getChannelFreshness`, sin simular comportamiento offline-first.
- Equipo C usa cliente/servicio sync acotado, persistencia runtime RxDB/SQLite, estados visibles de reintento/conflicto en outbox, reconciliación segura ante duplicados y degradación de mapa offline.
- Fresh review inicial detectó un P1 de wiring real en Telegram y un P3 de copy móvil; ambos fueron remediados y revalidados.
- Fresh review final: 0 P0/P1/P2/P3.
- Hardening futuro no bloqueante: headers de autenticación mobile y auto-sync disparado por conectividad.

**Evidencia de verificación**

- `git diff --check` ✅
- `pnpm contracts:test:strict` ✅
- `pnpm api:test:strict` ✅
- `pnpm telegram:test:strict` ✅
- `pnpm web:test:strict` ✅
- `pnpm mobile:test:strict` ✅
- `pnpm test:strict` ✅

## Slice 8 - Observabilidad + seguridad

**Objetivo:** hacer operable y auditable el sistema multi-canal.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Métricas de comandos, abandonos, expiración de enlaces y errores de canal. | Taxonomía de auditoría/errores de B. | Registrar datos sensibles innecesarios en analítica de canal. | Eventos de UX/canal con mínimos datos y correlación segura. |
| B | Logs, métricas, rate limits, Turnstile, alertas, auditoría central y threat model técnico. | Eventos de A y métricas operativas de C. | Tratar observabilidad como logs sin modelo de auditoría. | Trazabilidad por operación/canal/actor y controles anti-abuso. |
| C | Métricas de batería, sync, mapas offline, outbox y fallos de campo. | Taxonomía y correlación de B. | Enviar telemetría sensible sin minimización. | Métricas nativas útiles para operar offline sin comprometer privacidad. |

| Equipo | Checklist |
|---|---|
| A | ✅ Métricas de comandos, abandonos y enlaces expirados. |
| B | ✅ Logs, métricas, rate limits, Turnstile y alertas. |
| B | ✅ Auditoría central por operación/canal/actor. |
| C | ✅ Métricas de batería, sync, offline maps y outbox. |
| Todos | ✅ Threat model actualizado para Telegram/Web + backend. |

**Definition of Done**

- Se puede investigar quién hizo qué, desde qué canal y con qué resultado.
- Hay límites anti-abuso para flujos sensibles.
- Las métricas distinguen errores de canal, dominio e infraestructura.

**Cierre Slice 8**

- Equipo B definió la taxonomía operacional compartida, auditoría central, rate limits reutilizables, Turnstile server-side con rollout seguro y logs estructurados minimizados.
- Equipo A instrumentó Telegram/Web UI con telemetría no bloqueante y sin PII, incluido forwarding de Turnstile en la búsqueda privada protegida.
- Equipo C añadió observabilidad nativa/offline para sync, outbox, mapas offline, batería y fallos de campo con sanitización y buckets seguros.
- Fresh review detectó y se remediaron P1/P2 de Turnstile observe, auditoría bloqueante, taxonomía errónea, wiring real del webhook Telegram y ruido de diff en API.
- Fresh review final: 0 P0/P1/P2.
- Riesgos no bloqueantes: configurar `TURNSTILE_SECRET_KEY`, decidir cuándo pasar `TURNSTILE_ROLLOUT` a `enforce`, incluir archivos nuevos/untracked al preparar commit/PR y conectar widget real de Turnstile antes de enforcement público.

**Evidencia de verificación**

- `git diff --check` ✅
- `pnpm api:test:strict` ✅
- `pnpm telegram:test:strict` ✅
- `pnpm web:test:strict` ✅
- `pnpm mobile:test:strict` ✅
- `pnpm test:strict` ✅
- Fresh review independiente final ✅

## Slice 9 - Localización multi-idioma

**Objetivo:** preparar Telegram y Web UI para el piloto en español sin cerrar la puerta a inglés u otros idiomas.

**Decisión técnica inicial:** usar una base compartida de mensajes ICU con FormatJS (`@formatjs/intl` / `intl-messageformat`) y añadir `react-intl` solo donde aporte valor en Web UI. Mantener los contratos/API en códigos canónicos; los canales traducen esos códigos a copy visible.

### Investigación de librerías i18n

| Librería | Encaje en Zona Cero | Tradeoff | Decisión |
|---|---|---|---|
| FormatJS / React Intl | ICU sólido, `createIntl` funciona fuera de React y `IntlProvider`/`useIntl` encajan con React 19. Permite compartir mensajes entre Web UI y Telegram Worker. | Requiere disciplina de IDs/catálogos y tooling si se activa extracción. | Recomendada para Slice 9. |
| i18next / react-i18next | Ecosistema muy completo: namespaces, fallback, detección, backend plugins, plural/context/interpolation. | Más superficie runtime y modelo global/plugin; útil si más adelante hay CMS o carga remota de traducciones. | No usar como primera base; reevaluar si aparece traducción remota. |
| Lingui | Buen DX para React, catálogos compilados y macros con Vite. | Añade plugin/macro/build step; menos directo para compartir el mismo núcleo con Telegram Worker. | Diferir hasta necesitar extracción editorial fuerte. |
| Messageformat standalone | Ligero y centrado en ICU/plurales. | Menos integración de app completa que FormatJS. | Alternativa viable si se quiere evitar React Intl. |

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Catálogo de copy para Telegram/Web UI, selector de idioma, `/idioma`/`/language`, mensajes críticos en español e inglés y pruebas de render por locale. | Locale persistido, códigos canónicos y errores estables de B. | Traducir enums/errores dentro de contratos o duplicar códigos de dominio. | Canales que resuelven locale y traducen sin mezclar español/inglés en flujos críticos. |
| B | Contrato de `locale`, persistencia de preferencia por identidad/canal, migración D1 y helpers seguros de fallback. | Necesidades de UX/copy de A. | Hacer que API devuelva copy localizado como fuente canónica del dominio. | `preferred_locale` auditado/persistido y errores/códigos estables traducibles por canal. |
| C | Confirmar que la app nativa no queda bloqueada por el modelo de locale y documentar si mobile adoptará el paquete i18n en una slice posterior. | Paquete compartido y contratos de B. | Mezclar esta slice con localización completa nativa si no forma parte del piloto. | Validación de compatibilidad y no regresión para flujos nativos existentes. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Crear `packages/i18n` con `es` como locale piloto y `en` como fallback completo. |
| A | 🟢 Migrar copy de Telegram a mensajes tipados, incluyendo SOS, reunificación familiar, frescura, errores y cancelaciones. |
| A | 🟢 Añadir comando `/idioma`/`/language` y resolver locale desde preferencia, `language_code`, query/localStorage o fallback. |
| A | 🟢 Migrar Web UI a provider/helper i18n, selector mínimo y `document.documentElement.lang`. |
| B | 🟢 Añadir contrato `SupportedLocale` y validación/fallback sin aceptar locales arbitrarios. |
| B | 🟢 Persistir `preferred_locale` por `channel_identity` o tabla de preferencias, con migración D1. |
| B | 🟢 Eliminar dependencias de lógica sobre texto traducido; usar estado/códigos, no `responseText.includes(...)`. |
| C | 🟢 Validar que los cambios de contrato no rompen mobile ni operación offline existente. |
| Todos | 🟢 Añadir test que falla si `es` y `en` no tienen las mismas keys. |

**Definition of Done**

- Telegram y Web UI usan español por defecto para el piloto.
- Inglés existe como fallback completo y verificable por CI.
- La preferencia de idioma puede cambiarse sin perder estado conversacional.
- API/contratos siguen exponiendo códigos canónicos, no copy traducido.
- Ningún flujo crítico mezcla idiomas en una misma respuesta salvo datos operativos no traducibles.

**Riesgos y límites**

- Los nombres de incidentes, ubicaciones y categorías operativas sembradas pueden seguir siendo contenido operativo no traducido en esta slice.
- No se localiza la app nativa completa salvo validación de compatibilidad.
- No se introduce CMS ni carga remota de traducciones; los catálogos quedan versionados en repo.
- Antes de activar más idiomas, se necesita revisión humana del copy crítico: SOS, menores, privacidad y errores de seguridad.

**Evidencia esperada de verificación**

- `pnpm --filter @zona-cero/i18n test:strict`
- `pnpm telegram:test:strict`
- `pnpm web:test:strict`
- `pnpm contracts:test:strict`
- `pnpm mobile:test:strict`
- `pnpm test:strict`
- Fresh review independiente sin P0/P1/P2

**Cierre Slice 9**

- `packages/i18n` centraliza catálogos `es`/`en`, helper de formato ICU y test de paridad de keys.
- `packages/contracts` expone `SupportedLocale`, fallback seguro y códigos canónicos para copy traducible, incluyendo reunificación familiar.
- `services/api` persiste `preferred_locale` en `channel_identities` mediante migración D1 aditiva y mantiene la API como fuente de códigos/estado, no de copy localizado.
- Telegram localiza flujos críticos (`/start`, `/idioma`/`/language`, incident join, SOS y reunificación familiar), conserva el locale al cambiar idioma dentro de flujos activos y evita mezclar español/inglés en ramas de error o vacío.
- Web UI añade provider/helper i18n, selector mínimo, resolución por query/localStorage/navegador, `document.documentElement.lang` y render localizado de reunificación familiar sin mostrar copy inglés ni enums crudos de backend.
- Mobile queda compatible con el nuevo contrato sin adoptar localización nativa completa en esta slice; se corrigió una dependencia de UI sobre texto visible para usar estado canónico.
- Verificación ejecutada: `pnpm --filter @zona-cero/i18n test:strict`, `pnpm telegram:test:strict`, `pnpm web:test:strict`, `pnpm contracts:test:strict`, `pnpm api:test:strict`, `pnpm mobile:test:strict`, `pnpm test:strict`, `git diff --check` y `git status --short -- packages/i18n/node_modules`.
- Fresh review final independiente: P0/P1/P2/P3 = 0.

## Slice 10 - Telegram intent routing con Workers AI

**Objetivo:** permitir que Telegram entienda mensajes en lenguaje natural y los enrute a flujos existentes sin convertir al LLM en ejecutor de negocio.

**Decisión técnica:** usar Cloudflare Workers AI como clasificador de intención. El modelo por defecto es `@cf/qwen/qwen3-30b-a3b-fp8`, configurable por entorno. El router queda desactivable por feature flag y degrada a comportamiento seguro si la inferencia falla.

**Orden de prioridad del router**

1. Comando explícito (`/resource`, `/workcenter`, `/reunificacion`, etc.).
2. Flujo conversacional activo.
3. Clasificación LLM de texto libre.
4. Clarificación o fallback seguro para intención ambigua, desconocida o de baja confianza.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Contrato compartido de intención, tipos y tests de schema. | Necesidades de routing de B y casos UX de C. | Meter copy visible o reglas de dominio dentro del contrato. | `TelegramIntentClassification` validado, estricto y reusable por API. |
| B | Binding Workers AI, cliente clasificador, configuración por entorno y degradación segura. | Schema de A y umbrales/telemetría de C. | Ejecutar acciones de negocio desde la respuesta del LLM. | Helper que devuelve intención validada o fallback seguro sin romper webhook. |
| C | Integración del router en Telegram/API, UX de clarificación, telemetría sin PII y pruebas de prioridad. | Clasificador de B y contratos de A. | Saltarse flujos activos, loggear texto del usuario o confiar en baja confianza. | Routing determinista: comando → flujo activo → LLM → clarificación. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Añadir contrato `TelegramIntentClassification` con intención, confianza, razón opcional y facts JSON-safe. |
| A | 🟢 Cubrir intents `resource`, `workcenter`, `family_reunification`, `sos`, `dispatch`, `incident_join`, `unknown` y `ambiguous`. |
| B | 🟢 Añadir binding `AI` en Wrangler y typings de `Env`. |
| B | 🟢 Implementar clasificador Workers AI con JSON validado, `temperature: 0`, `max_tokens` bajo y fallback seguro. |
| B | 🟢 Configurar `TELEGRAM_INTENT_ROUTER_ENABLED`, `TELEGRAM_INTENT_MODEL` y `TELEGRAM_INTENT_CONFIDENCE_THRESHOLD`. |
| C | 🟢 Integrar clasificación solo después de comandos explícitos y flujos activos. |
| C | 🟢 Enrutar lenguaje natural a `/resource`, `/workcenter`, `/reunificacion`, `/sos`, `/dispatch` o join sin ejecutar la acción final automáticamente. |
| C | 🟢 Añadir telemetría de clasificación sin registrar texto libre ni PII. |
| Todos | 🟢 Fresh review independiente sin defectos confirmados. |

**Definition of Done**

- El LLM clasifica intención; la lógica de dominio sigue ejecutándose de forma determinista.
- Los comandos explícitos y los estados activos nunca son hijackeados por la clasificación.
- Baja confianza, `ambiguous`, `unknown`, JSON inválido o fallo de Workers AI terminan en clarificación/fallback seguro.
- No se registra texto del usuario ni PII en telemetría del router.
- El modelo por defecto puede cambiarse por configuración sin tocar código.
- El router puede permanecer desactivado en entornos donde no se quiera inferencia.

**Riesgos y límites**

- La calidad real depende del comportamiento runtime del modelo con mensajes de desastre en español; los tests cubren routing determinista con clasificación mockeada.
- Antes de activar en piloto público conviene ejecutar una matriz de evaluación con frases reales o sintéticas revisadas por producto.
- Las acciones sensibles como SOS o reunificación familiar siguen requiriendo confirmación dentro del flujo correspondiente.

**Evidencia de verificación**

- `pnpm --filter @zona-cero/contracts test:strict` ✅
- `pnpm --filter @zona-cero/contracts build` ✅
- `pnpm --filter @zona-cero/api test:strict` ✅
- `pnpm --filter @zona-cero/api typecheck` ✅
- `pnpm --filter @zona-cero/api build` ✅
- `pnpm --filter @zona-cero/api exec wrangler deploy --dry-run --env staging` ✅
- `git diff --check` ✅
- Fresh review independiente final ✅

**Cierre Slice 10**

- `packages/contracts` expone el contrato canónico de clasificación de intención para Telegram con schema estricto y facts JSON-safe.
- `services/api` configura Workers AI mediante binding `AI`, variables de router y helper de clasificación con `@cf/qwen/qwen3-30b-a3b-fp8` como modelo por defecto.
- El webhook de Telegram enruta lenguaje natural hacia flujos existentes respetando prioridad: comando explícito, flujo activo, clasificación LLM y clarificación/fallback.
- La telemetría del router queda minimizada y sin texto libre del usuario.
- Fresh review final independiente: 0 defectos confirmados.

## Gates antes de implementar cada slice

- ⬜ Contratos definidos o cambio de contrato aprobado.
- ⬜ Owner por carpeta confirmado.
- ⬜ Riesgos de privacidad revisados.
- ⬜ Tests mínimos acordados.
- ⬜ No se duplica lógica crítica en clientes.
- ⬜ Plan de rollback o degradación definido.

## Gates antes de cerrar cada slice

- ⬜ Tests del equipo owner pasan.
- ⬜ Contract tests pasan.
- ⬜ Documentación de endpoint/flow actualizada.
- ⬜ Auditoría y errores estables implementados.
- ⬜ Demo multi-canal validada si aplica.
- ⬜ Checklist de riesgos actualizado.

**Cierre Slice 1**

- Equipo A aprobó la política breaking tras validar Web links, scopes finales y fixtures happy/error por scope.
- Equipo B aprobó la política breaking tras validar golden vectors, fixtures compartidas y semántica estable de errores.
- Equipo C aprobó la política breaking tras validar sync push pending-only y runtime Zod-free para mobile.
- `pnpm test:strict` queda como gate raíz de cierre de Slice 1.
