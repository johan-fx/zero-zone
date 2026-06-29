# Contratos de API y dominio - Zona Cero

Este documento define los contratos compartidos mínimos para que Telegram + Web UI, backend y app nativa trabajen sin duplicar reglas ni divergir semánticamente.

## Objetivo

Alinear a los tres equipos alrededor de vocabulario, comandos, eventos, errores y responsabilidades comunes.

## Convenciones generales

| Convención | Regla |
|---|---|
| Versionado | Todo contrato público debe incluir versión o estar bajo namespace versionado. |
| Idempotencia | Toda mutación crítica debe aceptar `idempotencyKey` u operación firmada con `opId`. |
| Canal | Toda mutación debe registrar `channel`: `mobile`, `telegram`, `web-ui`, `system`. |
| Incidente | Toda operación operativa debe estar vinculada a `incidentId`. |
| Celda | Operaciones de campo deben incluir `cellId` cuando aplique. |
| Tiempo | Usar timestamps ISO 8601 y cursor lógico para sync. |
| Errores | Errores estables, legibles y accionables. |

## Operation families actuales

La app ya modela familias de operación firmada. Estos nombres deben ser la base de los contratos compartidos.

| Operation type | Familia | Canales esperados |
|---|---|---|
| `incident.create` | `incident` | Mobile, backend/admin. |
| `work_center.create` | `work_center` | Mobile, Telegram/Web. |
| `presence.check_in` | `presence` | Mobile principalmente. |
| `presence.pause` | `presence` | Mobile, Telegram como intención débil. |
| `presence.check_out` | `presence` | Mobile, Telegram como intención explícita. |
| `resource_report.create` | `resource_report` | Mobile, Telegram/Web. |
| `dispatch_event.create` | `dispatch_event` | Backend, Telegram/Web, mobile. |
| `dispatch_event.update` | `dispatch_event` | Backend, Telegram/Web, mobile. |
| `sos.create` | `sos` | Mobile crítico, Telegram conectado. |
| `sos.cancel` | `sos` | Mobile, Telegram/Web con permisos. |

## Modelo lógico de operación

```ts
type OperationEnvelope = {
  version: 1;
  opId: string;
  opType: OperationType;
  actorId: string;
  actorKeyId?: string;
  deviceId?: string;
  channel: 'mobile' | 'telegram' | 'web-ui' | 'system';
  incidentId: string;
  cellId?: string;
  entityId: string;
  payload: unknown;
  hlc?: string;
  createdAt: string;
  signature?: string;
  idempotencyKey?: string;
};
```

## Contratos por capability

### Incidentes

| Acción | Request mínimo | Response mínimo |
|---|---|---|
| Listar incidentes | `region?`, `status?` | `incidentId`, `name`, `status`, `approxRegion`, `freshness`. |
| Unirse a incidente | `incidentId`, `channelIdentityId`, `pseudonym`, `roles` | `membershipId`, `permissions`, `cellHints`. |
| Configuración | `incidentId` | categorías, thresholds, flags, paquetes disponibles. |

### Centros de trabajo

| Acción | Request mínimo | Response mínimo |
|---|---|---|
| Crear centro | `incidentId`, `cellId`, `approxLocation`, `type`, `priority`, `initialNeeds` | `centerId`, `state`, `confidence`, `auditId`. |
| Listar centros | `incidentId`, `cellId?`, `filters?` | resumen, frescura, riesgo, necesidades, contadores por rol. |
| Reportar problema | `centerId`, `reason`, `note?` | estado recibido/requiere revisión. |

### Recursos y logística

| Acción | Request mínimo | Response mínimo |
|---|---|---|
| Reportar recurso | `centerId`, `kind`, `category`, `quantityApprox`, `urgency`, `restrictions` | `reportId`, `freshness`, `confidence`. |
| Crear tarea | `fromCenterId`, `toCenterId`, `resource`, `priority` | `taskId`, `state`, `assignedTo?`. |
| Actualizar tarea | `taskId`, `state`, `note?` | `taskId`, `state`, `updatedAt`. |

### SOS

| Acción | Request mínimo | Response mínimo |
|---|---|---|
| Emitir SOS | `incidentId`, `centerId?`, `lastKnownLocation?`, `battery?`, `note?` | `sosId`, `state`, `priority`, `createdAt`. |
| Acusar recibo | `sosId`, `responderId`, `channel` | `ackId`, `state`. |
| Resolver/cancelar | `sosId`, `state`, `reason` | `sosId`, `state`, `auditId`. |

### Enlaces Web UI

| Campo | Regla |
|---|---|
| `token` | Opaco, firmado o referenciado server-side. |
| `scope` | Mínimo: pantalla, incidente, entidad y acción permitida. |
| `expiresAt` | Obligatorio y corto. |
| `singleUse` | Sí para flujos sensibles. |
| `channelIdentityId` | Vincula el enlace al actor/canal. |
| `auditContext` | Guarda origen: comando, mensaje, entidad y propósito. |

## Errores estables

| Código | Uso |
|---|---|
| `unauthorized` | Actor no autenticado o sesión inválida. |
| `forbidden_role` | Rol insuficiente. |
| `requires_verified_role` | Acción requiere validación. |
| `incident_closed` | Incidente no acepta nuevas operaciones. |
| `stale_data` | La acción depende de datos demasiado antiguos. |
| `unsafe_for_role` | Recomendación o acción no segura para el rol. |
| `duplicate_operation` | Operación ya procesada. |
| `conflict_requires_review` | Conflicto administrativo o sensible. |
| `link_expired` | Enlace web caducado. |
| `rate_limited` | Protección anti-abuso. |

## Tests contractuales recomendados

- Fixtures compartidas para operaciones firmadas.
- Tests de serialización/deserialización por canal.
- Tests de idempotencia por `opId` e `idempotencyKey`.
- Tests de permisos por rol y canal.
- Tests de errores estables.
- Tests de sync push/pull para app nativa.
