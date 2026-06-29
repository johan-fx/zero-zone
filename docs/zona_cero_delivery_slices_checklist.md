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
| 1 | Contratos compartidos | ⬜ | ⬜ | ⬜ | No iniciado |
| 2 | Incidentes + identidad básica | ⬜ | ⬜ | ⬜ | No iniciado |
| 3 | Centros de trabajo | ⬜ | ⬜ | ⬜ | No iniciado |
| 4 | Recursos + logística | ⬜ | ⬜ | ⬜ | No iniciado |
| 5 | SOS conectado + nativo crítico | ⬜ | ⬜ | ⬜ | No iniciado |
| 6 | Reunificación familiar web | ⬜ | ⬜ | ⬜ | No iniciado |
| 7 | Sync/offline hardening | ⬜ | ⬜ | ⬜ | No iniciado |
| 8 | Observabilidad + seguridad | ⬜ | ⬜ | ⬜ | No iniciado |

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
| A | ⬜ Revisar contratos necesarios para bot flows y web links. |
| B | ⬜ Crear `packages/contracts` con operation types, errores y schemas iniciales. |
| B | ⬜ Crear fixtures de operaciones firmadas. |
| C | ⬜ Migrar o adaptar tipos actuales de operaciones firmadas. |
| C | ⬜ Confirmar que tests de outbox/materializer siguen pasando. |
| Todos | ⬜ Aprobar política de cambios breaking. |

**Definition of Done**

- Contratos consumibles por mobile, backend y Telegram/Web.
- Tests contractuales mínimos.
- Errores estables documentados.

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
| A | ⬜ Implementar `/start`, selección de incidente, seudónimo y rol. |
| A | ⬜ Crear pantalla web de selección si el flow conversacional se queda corto. |
| B | ⬜ Implementar incident list/join y channel identity. |
| B | ⬜ Persistir roles, permisos y auditoría mínima. |
| C | ⬜ Mantener onboarding nativo con identidad local. |
| C | ⬜ Preparar consumo de incident config desde backend cuando haya red. |

**Definition of Done**

- Usuario entra por Telegram y queda vinculado a incidente.
- Usuario entra por mobile sin depender de Telegram.
- Backend distingue canal, actor y permisos.

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
| A | ⬜ Flow Telegram para reportar centro mínimo. |
| A | ⬜ Web UI con mapa online/detalle de centro. |
| B | ⬜ Endpoint/operation `work_center.create`. |
| B | ⬜ Estado derivado y auditoría de centro. |
| C | ⬜ Crear centro desde mapa/offline usando outbox local. |
| C | ⬜ Mostrar frescura/confianza/riesgo en UI nativa. |

**Definition of Done**

- Un centro creado por Telegram aparece en backend/web/mobile cuando hay sync.
- Un centro creado offline en mobile se materializa localmente y se sincroniza después.
- El centro no pasa a `active` por una sola señal.

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
| A | ⬜ Bot flow para faltante/sobrante. |
| A | ⬜ Bot flow para aceptar/actualizar tarea logística. |
| B | ⬜ Modelo de resource report con frescura/confianza. |
| B | ⬜ Matching simple y dispatch tasks. |
| C | ⬜ Reporte offline desde centro activo. |
| C | ⬜ Vista nativa de necesidades/sobrantes por centro. |

**Definition of Done**

- Reportes tienen categoría, cantidad aproximada, urgencia y restricciones.
- Matching simple genera o sugiere tarea.
- Tareas tienen estados: pendiente, aceptada, en camino, entregada, cancelada.

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
| A | ⬜ Comando/botón SOS conectado con confirmación. |
| A | ⬜ Acuse de recibo desde Telegram. |
| B | ⬜ Cola crítica, estado SOS y auditoría. |
| B | ⬜ Notificaciones/fan-out con prioridad. |
| C | ⬜ SOS nativo de acceso rápido. |
| C | ⬜ Cola local y comportamiento sin red. |
| C | ⬜ Spike/adapter Meshtastic según fase. |

**Definition of Done**

- SOS con red se propaga y recibe acuse.
- SOS nativo queda en cola si no hay red.
- La UI nunca promete profundidad exacta ni precisión falsa.

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
| A | ⬜ Bot explica límites y deriva a enlace web seguro. |
| A | ⬜ Web UI de búsqueda privada y derivación. |
| B | ⬜ Link tokens con scope, expiración y auditoría. |
| B | ⬜ Límites anti-abuso, TTL y access control. |
| C | ⬜ Confirmar que mobile no bloquea ni duplica el flujo en MVP. |

**Definition of Done**

- No se publican fotos, ubicación exacta ni identidad completa de menores.
- Todo intento queda auditado.
- El sistema deriva a verificación presencial.

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
| A | ⬜ Mostrar limitaciones del canal cuando no hay datos frescos. |
| B | ⬜ `sync/push` y `sync/pull` por incidente/celda/cursor. |
| B | ⬜ Deduplicación e idempotencia de operaciones. |
| C | ⬜ RxDB/SQLite real según diseño vigente. |
| C | ⬜ Reintentos, conflictos y estados visibles de outbox. |
| C | ⬜ Map packs offline operativos. |

**Definition of Done**

- Acción offline aparece localmente de inmediato.
- Acción sincroniza después sin duplicarse.
- Datos stale se degradan visual y operativamente.

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
| A | ⬜ Métricas de comandos, abandonos y enlaces expirados. |
| B | ⬜ Logs, métricas, rate limits, Turnstile y alertas. |
| B | ⬜ Auditoría central por operación/canal/actor. |
| C | ⬜ Métricas de batería, sync, offline maps y outbox. |
| Todos | ⬜ Threat model actualizado para Telegram/Web + backend. |

**Definition of Done**

- Se puede investigar quién hizo qué, desde qué canal y con qué resultado.
- Hay límites anti-abuso para flujos sensibles.
- Las métricas distinguen errores de canal, dominio e infraestructura.

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
