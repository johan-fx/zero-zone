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
| 11 | Telegram intent extraction v2 + prefill seguro | 🟢 | 🟢 | 🟢 | Hecho |
| 12 | Telegram resource need matching + recomendaciones | 🟢 | 🟢 | ⬜ | Implementado |
| 13 | Telegram channel modularization | 🟢 | 🟢 | N/A | Implementado |
| 14 | Telegram intent facts v3 contract + router context | 🟢 | 🟢 | 🟢 | Hecho |
| 15 | Telegram `/workcenter` natural-language prefill | 🟢 | 🟢 | 🟢 | Hecho |
| 16 | Telegram `/sos` natural-language prefill | 🟢 | 🟢 | 🟢 | Hecho |
| 17 | Telegram `/reunificacion` natural-language assistant | 🟢 | 🟢 | 🟢 | Hecho |
| 18 | Telegram `/dispatch` natural-language assistant | 🟢 | 🟢 | 🟢 | Hecho |
| 19 | Telegram `/start` + incident join natural-language onboarding | 🟢 | 🟢 | N/A | Hecho |

Leyenda sugerida: ⬜ No iniciado · 🟡 En progreso · 🟢 Hecho · 🔴 Bloqueado · N/A No aplica.

`N/A` significa que el canal/equipo no aplica a esa slice; no debe leerse como trabajo pendiente ni como implementación mobile.

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

### Seguimiento 2026-07-03 - mapa operativo Web UI + E2E Telegram

**Rama:** `feat/operational-map-dashboard`

| Equipo | Checklist |
|---|---|
| A | 🟢 Añadir dashboard Web UI con mapa operativo, selector de país derivado y lista accesible de marcadores. |
| A | 🟢 Añadir soporte Telegram para `message.location` en el flow `/workcenter`. |
| A | 🟢 Añadir E2E local Telegram → API `/map` → Web UI map panel. |
| B | 🟢 Exponer endpoints públicos de mapa operativo con países derivados de incidentes/centros geolocalizados. |
| B | 🟢 Reducir precisión pública de coordenadas de incidentes/centros a dos decimales y excluir SOS del mapa público. |
| Todos | 🟢 Revisar con subagentes el diff de mapa operativo y el E2E antes de commit. |
| Todos | 🟡 Ejecutar el E2E Playwright completo en CI o entorno local con Chromium operativo. |

**Commits**

- `778b690 feat: add operational map dashboard`
- `da78853 test: cover operational map e2e`

**Evidencia ejecutada**

- `pnpm --filter @zona-cero/contracts test:strict`
- `pnpm --filter @zona-cero/api test:strict`
- `pnpm --filter @zona-cero/web-ui test:strict`
- `pnpm --filter @zona-cero/telegram-channel test:strict`
- `pnpm e2e:telegram:typecheck`
- `pnpm api:migrate:local`
- `pnpm api:seed:local`
- Verificación manual real con Chrome DevTools MCP: `/telegram/webhook` creó un centro con `message.location`, `/map?countryCode=ES` devolvió el marcador con coordenadas públicas redondeadas y `/#/map` mostró `Map overview`, conteos, lista de marcadores y tiles OpenStreetMap `200`.

**Pendiente**

- El comando `pnpm exec playwright test e2e/operational-map.spec.ts` queda listo, pero en este entorno local Chromium falla al arrancar por `MachPortRendezvousServer Permission denied (1100)`. Debe ejecutarse en CI o en una sesión local con permisos de Chromium válidos para generar la captura Playwright persistida.

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

## Slice 11 - Telegram intent extraction v2 + prefill seguro

**Objetivo:** mejorar el routing de lenguaje natural para que el bot no solo detecte la intención, sino que extraiga datos operativos útiles y los use como prefill seguro dentro del flujo correspondiente.

**Decisión técnica:** evolucionar `extractedFacts` desde un objeto genérico hacia facts tipados por intención. La primera implementación se limita a recursos porque es el caso de menor riesgo para aprender: frases como “tengo agua potable, dónde la necesitan?” deben enrutar a `/resource` y conservar que el recurso es `agua potable`.

**Principio de seguridad:** el LLM puede proponer datos iniciales, pero no crea operaciones de dominio. Todo prefill debe mostrarse o confirmarse dentro del flujo determinista antes de persistir.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Contratos tipados de extracted facts por intención, empezando por `resource`. | Necesidades de prefill de B/C. | Convertir facts en acciones ejecutables o aceptar campos libres sin schema. | Schema estricto para facts de recurso, compatible con JSON y testeado. |
| B | Prompt/schema Workers AI v2, ejemplos reales, thresholds por intención y tests del clasificador. | Contratos de A y escenarios UX de C. | Bajar umbrales globalmente sin criterio o depender solo de prompt wording. | Clasificador que devuelve `resource` con facts para ofertas/necesidades de agua, comida, medicina, transporte, refugio, combustible o equipamiento. |
| C | Integración de prefill seguro en Telegram, empezando por flujo `/resource`. | Facts tipados de A y clasificación de B. | Crear reportes automáticamente o saltarse preguntas obligatorias del flujo. | El flujo resource arranca con contexto útil y pide confirmación/datos faltantes sin duplicar lógica de dominio. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Definir facts de recurso: `resourceDirection`, `resourceType`, `resourceLabel`, cantidad/unidad opcional, ubicación opcional y pregunta implícita opcional. |
| A | 🟢 Añadir tests de contrato para facts válidos e inválidos. |
| B | 🟢 Mejorar prompt con ejemplos: “tengo agua potable, dónde la necesitan?”, “puedo llevar comida”, “me sobra medicina”, “necesitamos mantas”. |
| B | 🟢 Añadir tests del clasificador con respuestas mockeadas y parsing de facts. |
| C | 🟢 Pasar facts aceptados al inicio del flujo resource como contexto/preface seguro. |
| C | 🟢 Responder en español con confirmación contextual cuando el intent venga de lenguaje natural. |
| Todos | 🟢 Fresh review independiente antes de cerrar. |

**Definition of Done**

- “tengo agua potable, dónde la necesitan?” clasifica como `resource` con `resourceDirection = offer` y `resourceLabel = agua potable`.
- El router conserva facts de recurso y los entrega al flujo sin registrar texto libre ni PII.
- El flujo `/resource` no crea un reporte final por clasificación; solicita confirmación o datos faltantes.
- `unknown`, `ambiguous`, baja confianza o fallo de Workers AI siguen degradando a clarificación segura; facts de recurso inválidos se ignoran y el flujo determinista continúa sin prefill.
- Las pruebas cubren clasificación, validación de facts, routing y prefill de recurso.

**Riesgos y límites**

- Esta slice no resuelve prefill completo para reunificación familiar ni SOS; esos flujos son más sensibles y requieren una slice dedicada.
- El modelo puede clasificar bien en tests mockeados y fallar en runtime; se necesita una matriz de evaluación con frases reales antes de piloto amplio.
- No se debe usar extracted facts como fuente de verdad; son hipótesis del usuario/modelo hasta que el flujo las confirme.

**Evidencia esperada de verificación**

- `pnpm contracts:test:strict`
- `pnpm --filter @zona-cero/api test -- src/telegram-intent-classifier.test.ts`
- `pnpm --filter @zona-cero/api test -- src/index.test.ts`
- `pnpm --filter @zona-cero/api typecheck`
- `pnpm --filter @zona-cero/api build`
- `git diff --check`
- Fresh review independiente sin defectos confirmados

**Cierre Slice 11**

- Los facts de recurso están tipados en contratos y cubren dirección, tipo, etiqueta, cantidad aproximada, ubicación textual y pregunta implícita.
- El clasificador conserva facts de recurso para frases como “tengo agua potable, dónde la necesitan?” y mantiene fallback seguro para baja confianza, facts inválidos o fallo de Workers AI.
- El router API valida `extractedFacts` antes de construir `TelegramFlowContext`; no concatena texto libre ni registra PII.
- El flujo `/resource` usa los facts como contexto/preface seguro antes del flujo; no crea reportes ni carga campos persistidos sin confirmación.

**Evidencia ejecutada en reconciliación documental**

- `pnpm --filter @zona-cero/contracts test:strict` — ✅ 27 tests.
- `pnpm --filter @zona-cero/api exec vitest run src/telegram-intent-classifier.test.ts src/index.test.ts` — ✅ 115 tests.
- `pnpm --filter @zona-cero/telegram-channel test:strict` — ✅ 68 tests.
- `git diff --check` — ✅.
- Fresh review independiente — ✅ sin CRITICAL; se ajustó la redacción de `prefill` a contexto/preface para no sobreprometer.
- No se re-ejecutaron `typecheck` ni `build` en esta reconciliación; quedan cubiertos como gates esperados si se prepara release/PR.

## Slice 12 - Telegram resource need matching + recomendaciones

**Objetivo:** cuando un usuario ofrece recursos en lenguaje natural y pregunta dónde se necesitan, el bot debe priorizar destinos según necesidades reales reportadas, no listar incidentes o centros de forma genérica.

**Decisión técnica:** reutilizar el modelo canónico de recursos `needed/surplus` y el matching determinista del dominio. El LLM solo clasifica intención y extrae facts (`resourceType`, `resourceLabel`, dirección e implicit question); la recomendación se calcula con datos persistidos de backend.

**Principio de seguridad:** una recomendación logística no crea una tarea ni confirma una entrega. El usuario elige destino o decide registrar la oferta; el flujo mantiene confirmación antes de persistir operaciones.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | UX conversacional de recomendaciones en Telegram, copy localizado, selección de destino y fallback cuando no hay necesidades. | Ranking/matches de B y facts extraídos por Slice 11. | Inventar ranking local no compartido o prometer disponibilidad no verificada. | Mensaje corto con destinos ordenados y continuidad hacia el flujo `/resource` sin mezclar idiomas. |
| B | Consulta/ranking de necesidades por categoría, normalización de categorías/sinónimos y puertos API para Telegram. | Casos UX de A y resource reports existentes. | Usar el LLM para decidir destino o saltarse permisos/auditoría. | Servicio determinista que devuelve necesidades compatibles ordenadas por urgencia, frescura, confianza y centro. |
| C | Validación de compatibilidad con datos nativos/offline existentes. | Contratos/matching de B. | Reimplementar recomendaciones en mobile en esta slice. | Confirmación de que el contrato no rompe materialización offline ni vista de recursos. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Detectar en Telegram ofertas con pregunta implícita `where_needed` y mostrar recomendaciones antes de pedir incidente genérico. |
| A | 🟢 Permitir elegir destino recomendado por número o continuar con registro manual de oferta. |
| A | 🟢 Mantener respuesta localizada usando `preferredLocale` y no mezclar español/inglés. |
| B | 🟢 Normalizar categorías de recurso para casos frecuentes: medicamentos/medicine, agua/water, comida/food, mantas/blankets, combustible/fuel, transporte/transport, refugio/shelter, equipamiento/equipment. |
| B | 🟢 Añadir consulta determinista de necesidades compatibles por recurso, ordenada por urgencia, frescura, confianza y especificidad de centro. |
| B | 🟢 Conectar Telegram a la consulta sin exponer PII ni registrar texto libre del usuario. |
| C | ⬜ Verificar que los contratos usados siguen siendo compatibles con outbox/materializer mobile. |
| Todos | 🟢 Fresh review independiente antes de cerrar. |

**Definition of Done**

- “tengo medicamentos, dónde la necesitan?” devuelve una lista breve de necesidades compatibles ordenadas por prioridad si existen.
- La recomendación muestra centro/destino, categoría, cantidad aproximada, urgencia y motivo de ranking sin crear operaciones automáticamente.
- Si no hay necesidades compatibles, el bot cae al flujo seguro actual para registrar oferta o elegir incidente manualmente.
- Las necesidades registradas desde `/resource` o desde centros activos alimentan el ranking sin lógica paralela en Telegram.
- El ranking es determinista, testeado y no depende del LLM para decidir destino.
- Las respuestas respetan `preferredLocale` y los logs no incluyen texto libre ni facts sensibles.

**Riesgos y límites**

- La calidad del ranking depende de que existan reportes `needed` recientes y categorizados correctamente.
- La normalización de categorías debe empezar con sinónimos simples; un catálogo operativo más rico puede requerir una slice posterior.
- Esta slice recomienda destinos; no optimiza rutas, disponibilidad de transporte ni capacidad real de recepción.

**Evidencia de verificación**

- ✅ `pnpm --filter @zona-cero/domain test:strict`
- ✅ `pnpm --filter @zona-cero/telegram-channel test:strict`
- ✅ `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts`
- ✅ `pnpm --filter @zona-cero/api typecheck`
- ✅ `pnpm --filter @zona-cero/i18n test:strict`
- ✅ `pnpm --filter @zona-cero/api build`
- ✅ Smoke local de webhook con Workers AI remoto para “tengo medicamentos, dónde la necesitan?” con necesidades seeded desde `resource_reports` y centros activos.
- ✅ `git diff --check`
- ✅ Fresh review independiente final sin defectos confirmados.


## Slice 13 - Telegram channel modularization

**Objetivo:** reducir el tamaño y acoplamiento de `apps/telegram-channel/src/index.ts` sin cambiar comportamiento funcional, preparando el terreno para extender intents/facts en todos los comandos.

**Decisión técnica:** hacer primero una extracción mecánica y testeada. No mezclar refactor estructural con nuevos intents. El contrato público del paquete debe seguir exportando los mismos handlers, tipos y helpers que consumen `services/api`.

**Principio de seguridad:** refactor sin cambio funcional: las respuestas, estados persistidos, comandos, locale y telemetría deben permanecer byte-equivalentes salvo cambios inevitables documentados.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Separar flows Telegram por dominio: `resource`, `workcenter`, `sos`, `family`, `dispatch`, `incident-join`, `locale`, `telemetry`, `formatting`, `state`. | Exports actuales usados por B. | Cambiar UX, copy o contratos de estado durante el refactor. | Módulos pequeños con barrel público estable y tests verdes. |
| B | Validar que `services/api` sigue importando el paquete sin cambios de comportamiento. | Barrel/export map de A. | Mover reglas API o puertos D1 al paquete Telegram. | Confirmación de compatibilidad webhook/API. |
| C | No aplica directamente en esta slice. | N/A | N/A | N/A |

| Equipo | Checklist |
|---|---|
| A | 🟢 Crear estructura modular interna sin romper exports existentes. |
| A | 🟢 Extraer tipos de actualización, estados y ports compartidos. |
| A | 🟢 Extraer helpers transversales: locale, command parsing, incident selection, confirmation/cancel parsing, formatting. |
| A | 🟢 Extraer cada flow a su módulo propio con tests existentes apuntando al barrel público. |
| B | 🟢 Ejecutar tests API que cubren webhook y persistencia de conversación. |
| Todos | 🟢 Fresh review de diff mecánico antes de implementar intents nuevos. |

**Definition of Done**

- `apps/telegram-channel/src/index.ts` queda como barrel/entrypoint pequeño, no como implementación monolítica.
- Ningún texto de usuario ni estado persistido cambia por el refactor.
- `services/api` no necesita conocer la estructura interna de los flows.
- Tests existentes de Telegram/API pasan antes de iniciar Slice 14.

**Riesgos y límites**

- Alto riesgo de refactor ruidoso; debe hacerse con commits/slices pequeños.
- No añadir facts ni lógica nueva aquí. Si se cambia producto durante el refactor, se pierde la capacidad de revisar correctamente.

**Evidencia esperada de verificación**

- `pnpm --filter @zona-cero/telegram-channel test:strict`
- `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts`
- `pnpm --filter @zona-cero/api typecheck`
- `git diff --check`
- Fresh review confirmando equivalencia funcional.

**Cierre Slice 13**

- Equipo A convirtió `apps/telegram-channel/src/index.ts` en un barrel público pequeño y extrajo la implementación a módulos internos sin cambiar comportamiento funcional.
- La estructura modular separa tipos, estado, telemetría, locale, parsing, selección de incidentes, actualización Telegram, webhook/bot y flows por dominio: incident join, work center, resource, dispatch, SOS y family reunification.
- El contrato público del paquete se mantuvo estable: la revisión fresca verificó paridad de exports `62/62`, incluyendo `resolveTelegramLocale`.
- Equipo B confirmó que `services/api` sigue consumiendo solo `@zona-cero/telegram-channel` mediante el barrel público, sin conocer rutas internas de flows.
- No se movieron responsabilidades API/D1, lectura de entorno ni secretos al paquete Telegram.
- Se limpió el duplicado de `normalizeDispatchStatusText`: la implementación canónica queda en `apps/telegram-channel/src/dispatch-helpers.ts` y se eliminó la copia no usada de `apps/telegram-channel/src/parsing.ts`.
- Fresh review adversarial con dos jueces ciegos terminó `JUDGMENT: APPROVED` en ambos casos, sin CRITICAL ni WARNING real.

**Evidencia ejecutada**

- `pnpm --filter @zona-cero/telegram-channel test:strict` — ✅ 52 tests.
- `pnpm --filter @zona-cero/telegram-channel typecheck` — ✅.
- `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts` — ✅ 77 tests.
- `pnpm --filter @zona-cero/api typecheck` — ✅.
- `git diff --check` — ✅.

**Nota de revisión**

- Antes de commit, stagear `apps/telegram-channel/src/index.ts`, `apps/telegram-channel/src/parsing.ts` y todos los nuevos módulos extraídos bajo `apps/telegram-channel/src/*.ts`; los archivos nuevos quedan fuera de `git diff` hasta estar staged.

## Slice 14 - Telegram intent facts v3 contract + router context

**Objetivo:** generalizar lo aprendido en `/resource`: cada intent aceptado debe poder transportar facts tipados y seguros hacia su flow correspondiente, sin que el LLM ejecute decisiones de negocio.

**Decisión técnica:** ampliar contratos compartidos con schemas específicos por intent. `extractedFacts` no debe quedarse como JSON libre para los flows; el router API debe validar y convertir facts a un `TelegramFlowContext` tipado antes de llamar al flow.

**Principio de seguridad:** el LLM clasifica y extrae datos candidatos; backend/flow valida, normaliza, pide confirmación y aplica permisos. No se crean operaciones automáticamente por facts extraídos.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | Definir cómo los flows reciben contexto prefill/facts sin acoplarse al prompt del LLM. | Schemas de B. | Leer JSON libre del LLM directamente en los flows. | Tipos de contexto por flow y fallback seguro si faltan facts. |
| B | Contratos `Telegram*IntentFactsSchema`, prompt/schema del classifier, parser API y telemetría sin PII. | Necesidades UX de A y límites de C. | Persistir texto libre o facts sensibles en logs. | Router que valida facts y solo pasa datos seguros a flows. |
| C | Revisar compatibilidad de contratos si los facts se reutilizan para native/offline más adelante. | Schemas compartidos de B. | Implementar UX nativa en esta slice. | Confirmación de que los contratos no bloquean materialización futura. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Diseñar `TelegramFlowContext` común con `preferredLocale`, `sourceIntent`, `facts`, `prefill` y `confidence`. |
| A | 🟢 Adaptar handlers para aceptar contexto opcional sin romper llamadas por comando explícito. |
| B | 🟢 Añadir schemas tipados para `workcenter`, `sos`, `family_reunification`, `dispatch`, `incident_join` y mantener `resource`. |
| B | 🟢 Actualizar prompt del classifier para extraer facts por intent con ejemplos ES/EN. |
| B | 🟢 Añadir parsers seguros por intent y descartar facts inválidos sin caer a `unknown` si el intent es claro. |
| B | 🟢 Telemetría solo con intent/action/scope/confidence bucket; sin texto libre ni PII. |
| C | 🟢 Revisar que los schemas compartidos no introducen campos imposibles de materializar offline. |

**Definition of Done**

- Cada intent aceptado tiene schema de facts o declara explícitamente que no usa facts.
- `routeAcceptedTelegramIntent` no concatena contexto textual ad hoc; pasa contexto tipado al flow.
- Facts inválidos se ignoran de forma segura y el flow continúa con preguntas normales.
- Tests cubren intent claro con facts válidos, facts inválidos y fallback sin facts.

**Riesgos y límites**

- No intentar mejorar todos los flows en esta slice; esta slice crea la plataforma.
- Evitar que `extractedFacts` se convierta en un segundo modelo de dominio paralelo.

**Evidencia esperada de verificación**

- `pnpm --filter @zona-cero/contracts test:strict`
- `pnpm --filter @zona-cero/api exec vitest run src/telegram-intent-classifier.test.ts src/index.test.ts`
- `pnpm --filter @zona-cero/telegram-channel test:strict`
- Fresh review de privacidad/telemetría.

**Cierre Slice 14**

- Se añadieron schemas estrictos de facts tipados para los intents Telegram aceptados.
- La API valida `extractedFacts` crudos hacia contexto tipado y dejó de concatenar texto ad hoc para el router.
- `TelegramFlowContext` se exporta desde `telegram-channel` y se pasa de forma opcional a los flows.
- El preface seguro de `/resource` vive en el handling de flows de `telegram-channel`.
- Los flows no-resource aceptan contexto, pero todavía no consumen facts; las siguientes slices cubren el prefill UX.
- La revisión de telemetría/privacidad confirmó que no se emite texto crudo, facts extraídos ni PII en la telemetría estructurada del intent-router.
- La compatibilidad native/offline fue revisada y aprobada.

**Evidencia ejecutada**

- `pnpm --filter @zona-cero/contracts test:strict` — ✅ 26 tests.
- `pnpm --filter @zona-cero/api exec vitest run src/telegram-intent-classifier.test.ts src/index.test.ts` — ✅ 90 tests; queda el aviso existente de close-timeout después del éxito.
- `pnpm --filter @zona-cero/telegram-channel test:strict` — ✅ 52 tests.
- `pnpm --filter @zona-cero/api typecheck` — ✅.
- `pnpm --filter @zona-cero/telegram-channel typecheck` — ✅.
- `git diff --check` — ✅.

## Slice 15 - Telegram `/workcenter` natural-language prefill

**Objetivo:** permitir que mensajes como “hay un puesto médico en la escuela con prioridad alta y necesitan medicamentos” entren al flujo `/workcenter` con nombre, ubicación aproximada, prioridad y necesidad inicial pre-rellenables.

**Decisión técnica:** usar facts para acelerar el flujo, no para crear el centro automáticamente. El flow debe mostrar resumen y pedir confirmación/corrección antes de llamar a `createWorkCenter`.

**Principio de seguridad:** un work center reportado por Telegram mantiene el estado actual de corroboración; los facts no activan centros ni elevan confianza por sí solos.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | UX conversacional de prefill, corrección de campos faltantes y confirmación localizada. | Facts validados de B. | Crear work centers sin confirmación del usuario. | Flow que salta preguntas ya contestadas y pide solo lo que falte. |
| B | Schema `TelegramWorkCenterIntentFacts`, parser API y mapping a `WorkCenterConnectedCreateRequest`. | Necesidades de A. | Resolver geocoding/rutas en esta slice. | Facts normalizados: name/locationHint/priority/initialNeed/surplus. |
| C | Fresh compatibility review native/offline y E2E marker safety. | Contratos de B y flujo Telegram de A. | Cambiar UX nativa o reinterpretar `locationHint` como coordenadas. | Confirmación de que `work_center.create` sigue compatible offline y que facts Telegram no elevan estado/confianza. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Aceptar contexto prefill en `handleTelegramWorkCenterReportFlow`. |
| A | 🟢 Saltar `awaitingName` si hay nombre suficiente y pedir confirmación de resumen. |
| A | 🟢 Pedir campos faltantes con copy ES/EN y permitir corrección. |
| B | 🟢 Extraer `name`, `locationHint`, `priority`, `initialNeed`, `surplus` y `implicitQuestion`. |
| B | 🟢 Mantener permisos/auditoría existentes en `createConnectedWorkCenter`. |
| C | 🟢 Revisar compatibilidad mobile/offline: no hay nuevos required fields en `WorkCenterConnectedCreateRequest`; `locationHint` queda como `description`, no como `payload.location`. |
| Todos | 🟢 Añadir tests de mensaje natural ES/EN y fallback cuando facts incompletos. |

**Definition of Done**

- Mensajes naturales de work center enrutan a `/workcenter` y pre-rellenan campos seguros.
- El usuario ve un resumen antes de persistir.
- Si faltan datos, el flow pregunta solo lo necesario.
- No se activa ni corrobora un centro por decisión del LLM.

**Riesgos y límites**

- `locationHint` textual no equivale a coordenadas verificadas.
- Un catálogo de tipos de centros puede ser una slice posterior.

**Evidencia esperada de verificación**

- `pnpm --filter @zona-cero/telegram-channel test:strict`
- `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts src/telegram-intent-classifier.test.ts`
- Smoke local webhook con mensaje natural de work center.

**Cierre Slice 15**

- `/workcenter` acepta contexto natural de facts y conserva confirmación explícita antes de persistir.
- `WorkCenterConnectedCreateRequest` no añade campos obligatorios y mantiene el payload offline-compatible usado por mobile.
- `locationHint` se transforma solo en `payload.description` (`Location hint: ...`); no se genera `payload.location` ni coordenadas.
- Los facts Telegram se usan como prefill seguro, no como señal de corroboración: la creación sigue insertando solo `creator_report`, por lo que no activa/corrobora ni eleva confianza por sí sola.
- El E2E usa marcadores separados para command-flow y natural-flow; además comprueba que el marcador natural no sea visible antes de la confirmación cuando la ejecución real puede consultarlo.

**Evidencia ejecutada**

- `pnpm --filter @zona-cero/contracts test:strict` — ✅ 26 tests.
- `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts src/telegram-intent-classifier.test.ts` — ✅ 92 tests; Vitest reportó close-timeout/esbuild deadlock después del éxito, sin fallo de suite.
- `pnpm --filter @zona-cero/telegram-channel test:strict` — ✅ 55 tests.
- `pnpm e2e:telegram:typecheck` — ✅.
- `pnpm e2e:telegram:dry-run` con env dummy no secreto — ✅; el marcador natural fue `*-natural-wc`.
- `pnpm mobile:test:strict` — ✅ 20 suites / 112 tests.

## Slice 16 - Telegram `/sos` natural-language prefill

**Objetivo:** permitir que mensajes urgentes como “necesito ayuda médica urgente en el refugio norte” entren al flujo `/sos` con severidad, ubicación textual y contexto pre-rellenados, manteniendo confirmación fuerte.

**Decisión técnica:** el SOS puede acelerarse, pero no debilitarse. Facts ayudan a construir el resumen; la creación de alerta sigue requiriendo confirmación explícita según el flujo crítico actual.

**Principio de seguridad:** ningún SOS se crea solo por clasificación LLM. Si la intención es SOS pero faltan datos o confianza, el bot debe guiar con el flujo seguro y localizado.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | UX de resumen, confirmación fuerte y copy para emergencia en ES/EN. | Facts validados de B. | Rebajar confirmación crítica por comodidad. | Flow SOS más rápido pero igual de seguro. |
| B | Schema `TelegramSosIntentFacts`, parser y mapping a `SosConnectedCreateRequest` cuando sea seguro. | Reglas críticas de A/C. | Registrar texto libre sensible en logs. | Facts: severity/locationHint/medicalNeed/peopleCount/hazardHint. |
| C | Revisar consistencia con SOS nativo crítico/offline. | Contratos de B. | Cambiar UX nativa aquí. | Confirmación de que semántica SOS sigue alineada. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Aceptar contexto SOS natural en `handleTelegramSosFlow` sin persistir prefill en estado. |
| A | 🟢 Mostrar resumen localizado solo en la respuesta inicial y exigir confirmación fuerte `CONFIRM SOS`. |
| A | 🟢 Fallback seguro si el usuario cancela, responde confirmación débil o la intención/facts no son utilizables. |
| B | 🟢 Extraer severidad, ubicación textual, necesidad médica, personas afectadas y riesgo como facts tipados. |
| B | 🟢 No persistir facts sensibles, texto crudo ni `prefill` en estados SOS previos a confirmación. |
| C | 🟢 Comparar semántica con SOS mobile/offline para evitar divergencias. |

**Definition of Done**

- Un mensaje natural de emergencia abre SOS con resumen pre-rellenado.
- Confirmación fuerte sigue siendo obligatoria.
- Logs/telemetría no contienen texto libre ni detalles sensibles.
- Tests cubren confirmación, cancelación y facts inválidos.

**Riesgos y límites**

- Alto riesgo de seguridad/producto: no optimizar clicks sacrificando confirmación.
- Ubicación textual no debe tratarse como geolocalización fiable.

**Evidencia esperada de verificación**

- `pnpm --filter @zona-cero/telegram-channel test:strict`
- `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts src/telegram-intent-classifier.test.ts`
- Fresh review de seguridad SOS.

**Cierre Slice 16**

- `/sos` acepta contexto natural y muestra un resumen seguro solo en el primer mensaje del flow.
- `TelegramSosState` no conserva `prefill`, `locationHint`, `medicalNeed`, `peopleCount`, `hazardHint` ni texto crudo antes de `CONFIRM SOS`.
- La selección de incidente construye el request con `payload: { severity: 'critical', reportedAt }`; `locationHint` no se transforma en `payload.location` ni en coordenadas.
- La creación de alerta sigue bloqueada por confirmación exacta `CONFIRM SOS`; respuestas débiles como `confirm` no envían el SOS.
- Mobile/offline no cambia su contrato ni comportamiento crítico: `pnpm mobile:test:strict` sigue verde.

**Evidencia ejecutada**

- `pnpm --filter @zona-cero/contracts test:strict` — ✅ 26 tests.
- `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts src/telegram-intent-classifier.test.ts` — ✅ 95 tests; Vitest reportó close-timeout después del éxito, sin fallo de suite.
- `pnpm --filter @zona-cero/telegram-channel test:strict` — ✅ 59 tests.
- `pnpm e2e:telegram:typecheck` — ✅.
- `pnpm e2e:telegram:dry-run:natural-sos` — ✅; cubre ruta `/sos`, cancelación previa, frase natural, confirmación débil y `CONFIRM SOS`.
- `pnpm mobile:test:strict` — ✅ 20 suites / 112 tests.

## Slice 17 - Telegram `/reunificacion` natural-language assistant

**Objetivo:** mejorar la detección de mensajes de reunificación familiar como “estoy buscando a un niño con estas características” y llevar al usuario al flujo correcto sin exponer PII en Telegram ni logs.

**Decisión técnica:** Telegram no debe recolectar ni persistir datos sensibles de búsqueda directamente si el flujo seguro es web privado. El assistant debe clasificar intención, explicar el proceso y emitir un enlace privado cuando corresponda; los facts sensibles solo pueden usarse como contexto efímero/redactado o descartarse.

**Principio de seguridad:** PII de menores/personas desaparecidas no se registra en logs ni estados Telegram. La búsqueda detallada debe ocurrir en el canal privado diseñado para ello.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | UX conversacional: explicación, enlace privado, lenguaje sensible y localizado. | Política de privacidad/facts de B. | Pedir datos sensibles completos dentro del chat Telegram. | Flow que deriva a canal privado seguro. |
| B | Schema `TelegramFamilyReunificationIntentFacts` con redacción estricta, classifier y link issuance. | Necesidades UX de A y seguridad de C. | Guardar características personales en conversación Telegram. | Facts mínimos: action/search_or_report, relationshipHint opcional, urgencyHint; PII descartada/redactada. |
| C | Validar consistencia con flujos nativos/offline de reunificación. | Contratos/políticas de B. | Implementar pantalla nativa nueva aquí. | Confirmación de límites de PII y handoff. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Aceptar contexto de intención en `handleTelegramFamilyReunificationFlow`. |
| A | 🟢 Responder con explicación localizada y enlace privado cuando haya permisos/contexto. |
| A | 🟢 Evitar eco de datos sensibles que el usuario haya escrito. |
| B | 🟢 Clasificar search/report/info sin persistir descripciones personales. |
| B | 🟢 Redactar/descartar facts sensibles antes de estado/telemetría. |
| C | 🟢 Revisar política de datos con mobile/offline y web privado. |

**Definition of Done**

- Mensajes naturales de búsqueda/reunificación enrutan a `/reunificacion`.
- El bot no repite ni guarda características personales sensibles en Telegram.
- El usuario recibe el siguiente paso seguro, preferiblemente enlace privado de corto TTL.
- Tests cubren PII redaction, idioma, permisos y fallback.

**Riesgos y límites**

- Este flujo tiene riesgo alto de privacidad; mejor pedir menos datos en Telegram, NO más.
- No construir búsqueda completa en Telegram si el producto ya tiene canal privado.

**Evidencia esperada de verificación**

- `pnpm --filter @zona-cero/telegram-channel test:strict`
- `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts src/telegram-intent-classifier.test.ts`
- Fresh review de privacidad/PII.

**Cierre Slice 17**

- `/reunificacion` acepta contexto natural `family_reunification` en Telegram sin convertir el chat en canal de búsqueda sensible.
- `TelegramFamilyReunificationIntentFacts` queda limitado a facts mínimos no PII: `action`, `relationshipHint` y `urgencyHint`.
- El classifier descarta campos legacy/sensibles antes de crear la clasificación aceptada; nombres, edad, ropa, teléfono, ubicación precisa y texto crudo no se conservan como facts de reunificación.
- `handleTelegramFamilyReunificationFlow` usa `flowContext` solo para UX/localización y no persiste `flowContext`, `facts`, `prefill` ni facts mínimos en el estado Telegram.
- El bot explica el handoff seguro y deriva a enlace web privado; no repite datos sensibles escritos por el usuario.
- Mobile/offline no recibe nuevos campos de reunificación ni cambia su flujo nativo.
- E2E de staging cubre el flujo de comando y lenguaje natural de esta slice con frase natural sin PII real.

**Evidencia ejecutada**

- `pnpm --filter @zona-cero/contracts test:strict` — ✅ 26 tests.
- `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts src/telegram-intent-classifier.test.ts` — ✅; Vitest reportó el warning conocido de close-timeout después del éxito.
- `pnpm --filter @zona-cero/telegram-channel test:strict` — ✅ 61 tests.
- `pnpm --filter @zona-cero/mobile test:strict` — ✅.
- `pnpm e2e:telegram:typecheck` — ✅.
- `pnpm e2e:telegram:dry-run:family-reunification` — ✅.
- `pnpm api:deploy:staging` — ✅ Worker `zona-cero-api-staging`, version `24677b23-ede1-417f-9ea7-66bd8ed85a6e`.
- `pnpm e2e:staging:telegram --grep "family reunification"` — ✅ 1 test passed.
- `git diff --check` — ✅.

## Slice 18 - Telegram `/dispatch` natural-language assistant

**Objetivo:** permitir que mensajes como “llevar 10 cajas de medicamentos al centro médico” o “marcar entrega como completada” entren al flujo `/dispatch` con intención, tarea/categoría/cantidad/destino/estado pre-rellenables.

**Decisión técnica:** separar dos sub-intenciones: crear/coordinar despacho y actualizar estado de una tarea existente. El LLM puede extraer candidatos; el backend debe resolver tareas/destinos reales y pedir selección/confirmación.

**Principio de seguridad:** no se actualiza el estado de una dispatch task por inferencia LLM. Toda actualización requiere que el usuario seleccione una tarea real y confirme la acción.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | UX de selección de tarea/destino, resumen y confirmación localizada. | Matching/resolución de B. | Actualizar tareas sin confirmación. | Flow que reduce pasos pero mantiene control humano. |
| B | Schema `TelegramDispatchIntentFacts`, resolución contra `dispatch_tasks`, resource reports y work centers. | UX de A y contratos de C. | Crear un motor de rutas/logística en esta slice. | Facts: action/create_or_update, category, quantityApprox, destinationHint, statusCandidate, taskHint. |
| C | Revisar compatibilidad con dispatch/offline materializado. | Contratos de B. | Cambiar UX nativa aquí. | Confirmación de que estados siguen alineados. |

| Equipo | Checklist |
|---|---|
| A | 🟢 Aceptar contexto en `handleTelegramDispatchTaskFlow`. |
| A | 🟢 Mostrar tareas candidatas ordenadas cuando haya `taskHint` o `statusCandidate`. |
| A | 🟢 Confirmar antes de actualizar estado. |
| B | 🟢 Extraer acción, categoría, cantidad, destino y estado candidato. |
| B | 🟢 Resolver candidatos con datos persistidos, no con texto libre. |
| C | 🟢 Validar estados contra mobile/offline. |

**Definition of Done**

- Mensajes naturales de despacho enrutan a `/dispatch`.
- El usuario selecciona una tarea/destino real antes de mutar estado.
- No hay actualizaciones automáticas por LLM.
- Tests cubren creación/selección, actualización confirmada, cancelación y ambigüedad.

**Riesgos y límites**

- No resolver optimización de rutas ni asignación automática de conductores aquí.
- Ambigüedad alta: debe preferirse pedir selección antes que adivinar.

**Evidencia esperada de verificación**

- `pnpm --filter @zona-cero/telegram-channel test:strict`
- `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts src/telegram-intent-classifier.test.ts`
- Smoke local webhook con creación/actualización de dispatch.

**Cierre Slice 18**

- `/dispatch` acepta contexto natural `dispatch` en Telegram y conserva hints seguros entre selección de incidente y tarea.
- `TelegramDispatchIntentFacts` cubre candidatos de acción, categoría, cantidad, destino, tarea y estado sin convertirlos en mutaciones automáticas.
- El routing combina clasificación AI con heurística determinista conservadora para señales claras de despacho/logística/tarea/entrega, sin capturar recursos genéricos como “tengo agua”.
- Las tareas candidatas se ordenan por hints (`taskHint`, categoría, cantidad, destino y estado candidato) manteniendo orden estable para empates.
- Toda actualización sigue exigiendo selección de una dispatch task persistida y confirmación explícita; el LLM no actualiza estados.
- Mobile/offline mantiene el vocabulario canónico `pending`, `accepted`, `en_route`, `delivered`, `cancelled`; los candidate facts de Telegram no se materializan como datos offline.
- E2E de staging cubre flujo por comando y lenguaje natural aislado de esta slice, preparando su propia dispatch task de fixture antes del test.

**Evidencia ejecutada**

- `pnpm --filter @zona-cero/contracts test:strict` — ✅ 27 tests.
- `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts src/telegram-intent-classifier.test.ts` — ✅ 107 tests; Vitest reportó el warning conocido de close-timeout después del éxito.
- `pnpm --filter @zona-cero/telegram-channel test:strict` — ✅ 66 tests.
- `pnpm --filter @zona-cero/mobile test:strict` — ✅ 20 suites / 114 tests.
- `pnpm e2e:telegram:typecheck` — ✅.
- `pnpm e2e:telegram:dry-run:dispatch` — ✅.
- `pnpm api:deploy:staging` — ✅ Worker `zona-cero-api-staging`, version `8ba33340-c5c4-4860-9c93-0fc267c1bcfc`.
- `pnpm e2e:staging:telegram --grep "dispatch"` — ✅ 1 test passed.
- `git diff --check` — ✅.

## Slice 19 - Telegram `/start` + incident join natural-language onboarding

**Objetivo:** permitir que usuarios expresen en lenguaje natural que quieren empezar o unirse a un incidente, por ejemplo “quiero ayudar como voluntario” o “soy logística, quiero entrar al operativo”, y guiarlos al flujo de `/start`/incident join adecuado.

**Decisión técnica:** tratar onboarding/join como intención propia con facts mínimos: rol deseado, incidente mencionado y preferencia de idioma. La asignación de rol sigue pasando por permisos y validación del backend.

**Principio de seguridad:** el usuario no obtiene permisos elevados por decir “soy coordinador”. El rol solicitado es candidato, no autorización.

### Reparto de ownership

| Equipo | Owns | Consume de | No debe hacer | Handoff esperado |
|---|---|---|---|---|
| A | UX de bienvenida, selección de incidente/rol y corrección de idioma. | Roles/permisos de B. | Conceder roles por texto libre. | Onboarding natural, corto y localizado. |
| B | Schema `TelegramIncidentJoinIntentFacts`, parser, role candidate validation y persistencia segura. | UX de A. | Saltarse `joinIncident` ni auditoría. | Facts: desiredRole, incidentHint, displayNameHint, localeHint. |
| C | No aplica directamente. | N/A | N/A | N/A |

| Equipo | Checklist |
|---|---|
| A | ✅ Aceptar contexto en incident join/start flow. |
| A | ✅ Preseleccionar rol candidato si es válido, pero pedir confirmación. |
| A | ✅ Mantener detección/persistencia de idioma. |
| B | ✅ Extraer rol/incidente/idioma sin conceder permisos. |
| B | ✅ Reutilizar `joinIncident` y auditoría existentes. |
| Todos | ✅ Tests de “quiero ayudar”, “soy logística” y rol inválido/privilegiado. |

**Definition of Done**

- Mensajes naturales de onboarding enrutan a start/join.
- Roles válidos pueden preseleccionarse, pero se confirman.
- Roles no permitidos o ambiguos caen a selección segura.
- No hay bypass de permisos ni auditoría.

**Riesgos y límites**

- El texto del usuario puede expresar autoridad que el sistema no puede verificar.
- No resolver invitaciones privadas ni aprobación de coordinadores en esta slice.

**Evidencia esperada de verificación**

- `pnpm --filter @zona-cero/telegram-channel test:strict`
- `pnpm --filter @zona-cero/api exec vitest run src/index.test.ts src/telegram-intent-classifier.test.ts`
- Smoke local webhook con onboarding natural ES/EN.

**Cierre Slice 19**

- Equipo B migró los facts de `incident_join` a `desiredRole`, `incidentHint`, `displayNameHint` y `localeHint`, manteniendo el rol como candidato sin autorización automática.
- Equipo A consume `flowContext` en `/start`/incident join, sugiere incidente, pseudónimo, idioma y rol, y exige confirmación humana antes de `joinIncident`.
- Equipo C aprobó no-op mobile/offline: `IncidentJoinRequest.role` y permisos siguen viniendo de inputs confirmados y backend.
- E2E targeted añadido en `/e2e` para comando `/start` y onboarding natural con `pnpm e2e:telegram:dry-run:incident-join` y grep staging `incident join`.
- Evidencia ejecutada: `pnpm contracts:test:strict`, `pnpm --filter @zona-cero/api test -- src/index.test.ts src/telegram-intent-classifier.test.ts`, `pnpm --filter @zona-cero/telegram-channel test:strict`, `pnpm --filter @zona-cero/i18n test`, `pnpm e2e:telegram:typecheck`, `pnpm e2e:telegram:dry-run:incident-join`, `pnpm e2e:staging:telegram --grep "incident join"`, y Equipo C `pnpm mobile:test:strict`.

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
