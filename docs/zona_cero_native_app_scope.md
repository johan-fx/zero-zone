# Scope de App nativa - Zona Cero

Este documento delimita qué debe seguir perteneciendo a la app nativa aunque exista Telegram + Web UI como canal complementario.

## Decisión

La app nativa es el cliente de campo crítico. Su misión no es replicar todos los flujos conversacionales de Telegram, sino garantizar operación local-first cuando la conectividad, la batería, la seguridad y el estrés operativo degradan el entorno.

## Estado actual del repo

La implementación actual ya apunta en esta dirección:

- Expo Router en `apps/mobile/src/app/`.
- Tamagui y sistema visual en `apps/mobile/src/shared/ui/` y `apps/mobile/src/shared/theme/`.
- Pantallas operativas en `apps/mobile/src/features/operations/`.
- Local DB y materialización en `apps/mobile/src/infrastructure/local-db/` y `apps/mobile/src/infrastructure/oplog/`.
- Tipos de operaciones firmadas en `apps/mobile/src/infrastructure/security/operation-signer.ts`.
- MapLibre/offline map packs en `apps/mobile/src/infrastructure/maps/`.
- Tests Jest y rutas de visual audit/operational E2E.

## Capacidades exclusivas o prioritarias de la app nativa

| Capability | Por qué pertenece a nativo |
|---|---|
| Mapa offline | Necesita almacenamiento local robusto, rendimiento y control de paquetes. |
| Operación local-first | Debe funcionar sin red y sincronizar después. |
| Outbox firmada local | Requiere persistencia fiable y material criptográfico local. |
| Presencia probabilística fuerte | Usa señales del dispositivo, permanencia, sensores, batería y background. |
| Bajo consumo | Necesita control de muestreo, tracking y degradación. |
| SOS crítico | Debe funcionar con mínima fricción, cola local y transporte degradado. |
| Meshtastic | Integración realista con hardware/gateway y mensajes críticos. |
| UX de campo | Targets grandes, estado offline visible y decisiones bajo estrés. |

## Features que puede compartir con Telegram/Web

| Feature | App nativa | Telegram/Web |
|---|---|---|
| Unirse a incidente | Sí, con caché/offline si ya existe. | Sí, conectado. |
| Crear centro | Desde mapa/offline. | Con bot/web online. |
| Reportar recursos | Offline desde centro. | Online conversacional. |
| Tareas logísticas | Disponible offline cuando asignada. | Online para aceptación/estado rápido. |
| SOS | Crítico/offline/degradado. | Conectado/acuses. |
| Reunificación | No prioritario en MVP nativo. | Mejor encaje en Web UI privada. |

## Límites de la app nativa

- No debe contener reglas de negocio divergentes del backend.
- No debe exponer datos sensibles de menores salvo alcance explícito y cifrado.
- No debe intentar reemplazar paneles administrativos complejos.
- No debe bloquear operación local por fallos de Telegram/Web.
- No debe asumir conectividad estable.

## Responsabilidad del Equipo C

| Área | Entregable |
|---|---|
| Mobile shell | Mantener Expo Router, Tamagui, navegación y estados globales mínimos. |
| Local persistence | RxDB/SQLite, outbox, materialized views y migraciones locales. |
| Maps | MapLibre, paquetes offline, estados de frescura y fallback visual. |
| Presence | Check-in/out, tracking adaptativo, estados y explicación de confianza. |
| Sync | Push/pull por incidente/celda, conflictos y reintentos. |
| SOS | Acción rápida, cola local, acuses y transporte crítico. |
| Tests | Unit, integration, visual audit, Maestro y pruebas offline. |

## Integración con backend

La app debe tratar al backend como fuente de coordinación compartida, pero no como dependencia para operar localmente.

| Momento | Comportamiento esperado |
|---|---|
| Sin red | Registrar operaciones localmente y actualizar vistas locales. |
| Red intermitente | Empujar outbox, tirar cambios por cursor y mostrar estado. |
| Conflicto | Conservar historial, mostrar estado y aplicar resolución de dominio. |
| Datos stale | Degradar visualmente confianza, recomendaciones y matching. |

## Backlog nativo posterior

- Optimización avanzada de batería con perfiles por rol/incidente.
- Integración Meshtastic real con hardware recomendado.
- Pruebas de campo con mapas offline reales.
- Soporte avanzado de rutas offline o semi-offline.
- Hardening criptográfico con Keychain/Keystore/Secure Enclave cuando aplique.
