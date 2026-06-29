# Checklist de slices por equipo - Zona Cero

Este documento sirve para controlar el avance de las slices entre los tres equipos de ingeniería:

- **Equipo A:** Telegram + Web UI.
- **Equipo B:** Backend + infraestructura Cloudflare.
- **Equipo C:** App nativa.

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
