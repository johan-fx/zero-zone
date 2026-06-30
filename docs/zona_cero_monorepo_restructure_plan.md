# Plan de reestructuración a monorepo - Zona Cero

Este documento propone cómo evolucionar el repo actual hacia un monorepo que permita trabajar en paralelo a tres equipos: Telegram + Web UI, Backend + Cloudflare y App nativa.

## Estado actual tras Fase 1

El repo ya funciona como monorepo pnpm. La app Expo vive en `apps/mobile` y la raíz queda como orquestador de scripts.

Estructura actual relevante:

```text
/
  package.json              # Orquestación root mediante pnpm --filter
  pnpm-workspace.yaml       # Declara apps/*, services/* y packages/*
  apps/
    mobile/
      package.json          # Expo app + scripts mobile reales
      app.json              # Expo config
      src/
        app/                # Expo Router
        features/           # Features mobile actuales
        infrastructure/     # local-db, maps, oplog, security
        shared/             # theme/ui compartido dentro de mobile
    web-ui/                 # Placeholder Equipo A
    telegram-channel/       # Placeholder Equipo A
  services/api/             # Placeholder Equipo B
  packages/                 # Placeholders compartidos
  docs/
  scripts/
```

## Estructura objetivo propuesta

```text
/
  apps/
    mobile/                 # Expo React Native app actual
    web-ui/                 # Web UI para enlaces seguros y paneles ligeros
    telegram-channel/       # Flujos, renderers y adaptadores de Telegram
  services/
    api/                    # Cloudflare Workers API + Telegram webhook
  packages/
    domain/                 # Entidades, policies y reglas puras compartidas
    contracts/              # Tipos API, schemas, fixtures y errores estables
    crypto/                 # Canonical payload, signing interfaces, helpers seguros
    ui/                     # Componentes compartidos si web-ui y mobile convergen
    config/                 # TSConfig, eslint/prettier si se añaden, test presets
    testing/                # Fixtures, builders y helpers contractuales
  docs/
  scripts/
  pnpm-workspace.yaml
  package.json              # Orquestación root
```

## Ownership por equipo

| Ruta | Owner principal | Colaboradores |
|---|---|---|
| `apps/telegram-channel/` | Equipo A | Equipo B para contratos/webhooks. |
| `apps/web-ui/` | Equipo A | Equipo B para auth/enlaces; Equipo C si se comparte UI. |
| `services/api/` | Equipo B | Equipo A/C como consumidores. |
| `apps/mobile/` | Equipo C | Equipo B para sync/contracts. |
| `packages/domain/` | Equipo B | A/C revisan impacto de UX/canal. |
| `packages/contracts/` | Equipo B | A/C deben aprobar cambios breaking. |
| `packages/ui/` | Equipo C o compartido | A si Web UI reutiliza componentes. |
| `packages/testing/` | Compartido | Todos. |

## Migración por fases

### Fase 0 - Preparar workspaces sin mover código

- Actualizar `pnpm-workspace.yaml` para declarar `apps/*`, `services/*`, `packages/*`.
- Mantener scripts actuales funcionando desde la raíz.
- Crear carpetas vacías con README y ownership.
- Documentar aliases y naming.

### Fase 1 - Mover app actual a `apps/mobile`

- Mover `src/`, `app.json`, `expo-env.d.ts`, `tamagui.config.ts` y configs Expo relacionadas.
- Ajustar scripts root para llamar `pnpm --filter @zona-cero/mobile ...`.
- Mantener tests móviles verdes.
- Confirmar que Maestro/visual audit encuentra rutas nuevas.

### Fase 2 - Extraer contratos compartidos

- Mover tipos de operación desde `apps/mobile/src/infrastructure/security/operation-signer.ts` hacia `packages/contracts` o `packages/domain` según pureza.
- Crear fixtures compartidas de operaciones.
- Hacer que mobile consuma contratos por workspace dependency.
- Añadir tests contractuales.

### Fase 3 - Crear backend Cloudflare

- Crear `services/api` con Worker mínimo.
- Implementar healthcheck, incident config y endpoints de operación mínimos.
- Añadir D1/Queues/Durable Objects según necesidad de slice.
- Definir deploy/staging separado.

**Avance Fase 3**

- `services/api` ya contiene Worker Hono con healthcheck, sync push/pull, webhook Telegram y endpoints mínimos de incidentes para Slice 2.
- D1 queda como fuente inicial para `incidents`, `channel_identities`, `incident_memberships` y `audit_events`.
- Durable Objects se mantienen como stub/coordinación futura, no como fuente de verdad de incidentes.
- Pendiente antes de producción: endurecer deploy/staging, reemplazar estado conversacional Telegram in-memory por storage durable y definir procedimiento operativo de migraciones/seed.

### Fase 4 - Crear Telegram + Web UI

- Crear `apps/telegram-channel` con handlers puros y tests sin depender de Cloudflare runtime.
- Conectar webhook desde `services/api`.
- Crear `apps/web-ui` para enlaces seguros y formularios.
- Validar primer slice end-to-end: alta + reporte de centro.

### Fase 5 - Endurecer integración multi-cliente

- Añadir contract tests por consumidor.
- Añadir compatibilidad de versiones.
- Añadir observabilidad por canal.
- Documentar procedimiento para cambios breaking.

## Reglas de oro

- No mover código y cambiar arquitectura funcional en el mismo PR grande.
- Primero estructura, luego extracción, luego nuevas capacidades.
- Todo contrato compartido debe tener tests y fixtures.
- Ningún cliente debe inventar reglas críticas fuera del dominio/backend.
- La app nativa no debe perder capacidad offline durante la migración.


## Decisiones de Slice 0

- Los nombres de workspace quedan fijados como `apps/mobile`, `apps/web-ui`, `apps/telegram-channel`, `services/api` y `packages/*`.
- `apps/mobile` dejó de ser placeholder en Fase 1: contiene la app Expo actual; la raíz solo orquesta scripts.
- `apps/web-ui` arranca como una UI React + TypeScript edge/static-friendly para enlaces seguros y paneles ligeros; no debe asumir un servidor Node persistente en el MVP.
- `apps/telegram-channel` contiene flujos y renderers de Telegram; el webhook/runtime vive en `services/api`.
- `services/api` es el backend Cloudflare Workers y owner de identidad, permisos, auditoría, sync y webhook.
- Paquetes mínimos reservados con manifiesto de workspace: `packages/domain`, `packages/contracts`, `packages/crypto`, `packages/ui`, `packages/config` y `packages/testing`.
- Los scripts raíz delegan a `@zona-cero/mobile` con `pnpm --filter`; los aliases `mobile:*` son la frontera explícita para Equipo C.

## Scripts root esperados

| Script | Intención |
|---|---|
| `pnpm mobile:start` | Iniciar Expo mobile. |
| `pnpm mobile:test` | Tests de app nativa. |
| `pnpm web:dev` | Iniciar Web UI. |
| `pnpm telegram:test` | Tests de flujos Telegram. |
| `pnpm api:dev` | Worker local. |
| `pnpm contracts:test` | Tests contractuales compartidos. |
| `pnpm test:strict` | Typecheck + tests críticos de todo el monorepo. |

## Riesgos de migración

| Riesgo | Mitigación |
|---|---|
| Romper Expo al mover raíz | Hacer Fase 1 aislada y verificar scripts mobile antes de seguir. |
| Aliases `@/*` dejan de resolver | Reconfigurar TSConfig por app y evitar aliases globales ambiguos. |
| Tamagui se complica en monorepo | Mantener config junto a mobile hasta que haya necesidad real de compartir UI. |
| Tests visuales pierden paths | Actualizar scripts Python y Maestro en el mismo PR de movimiento. |
| Contratos se acoplan a runtime mobile | Extraer solo tipos/policies puras, no adaptadores React Native. |

## Nota de avance - Fase 1

Fase 1 completada: la app Expo existente se migró a `apps/mobile`, el paquete `@zona-cero/mobile` contiene las dependencias/scripts reales de mobile y los scripts raíz pasan a orquestar la app mediante `pnpm --filter @zona-cero/mobile ...`. Los comandos Maestro y visual audit permanecen ejecutables desde la raíz.
