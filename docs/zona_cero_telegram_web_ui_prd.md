# PRD de canal - Telegram + Web UI

Este documento define Telegram + Web UI como canal complementario de Zona Cero. No sustituye a la app nativa: amplía adopción, coordinación ligera y acceso desde dispositivos donde instalar una app no sea viable durante una emergencia.

## Decisión de producto

Telegram + Web UI debe cubrir flujos que funcionan bien con conectividad y conversación guiada. La app nativa conserva las capacidades críticas de campo: operación offline, mapa offline, presencia probabilística robusta, outbox firmada local, SOS degradado, bajo consumo e integración Meshtastic.

## Usuarios objetivo

| Usuario | Uso esperado en Telegram + Web UI |
|---|---|
| Voluntario general | Alta rápida, selección de incidente, estado de disponibilidad, recomendaciones y reportes simples. |
| Logística / motorizados | Aceptar tareas, actualizar estados y reportar entrega/cancelación. |
| Coordinador local | Consultar resúmenes, validar reportes ligeros y abrir paneles web. |
| Familiar buscando menor | Acceder a flujo web privado desde enlace seguro. |
| Personal verificado | Revisar casos sensibles mediante web UI con permisos reforzados. |

## Alcance MVP del canal

| Capability | Telegram | Web UI enlazada | Fuera del canal |
|---|---|---|---|
| Onboarding | `/start`, idioma, incidente, seudónimo y rol. | Formularios largos si hacen falta. | Identidad local offline fuerte. |
| Incidentes | Listar/unirse a incidente activo. | Vista resumida de incidente/celda. | Crear paquetes offline. |
| Centros de trabajo | Crear reporte mínimo, actualizar estado simple, reportar falso/duplicado. | Mapa online, detalle de centro, edición estructurada. | Validación fuerte por presencia. |
| Voluntarios | Cambiar disponibilidad y recibir recomendaciones. | Panel de recomendaciones con explicación. | Tracking en background. |
| Recursos | Reportar faltantes/sobrantes y urgencia. | Formulario estructurado y detalle de matching. | Reporte offline local-first. |
| Tareas logísticas | Aceptar, marcar en camino, entregar o cancelar. | Vista de tarea y ruta online. | Routing offline avanzado. |
| SOS con red | Emitir SOS conectado y acusar recibo. | Detalle de SOS con datos permitidos. | SOS offline/degradado/Meshtastic directo. |
| Reunificación | Entrada conversacional mínima y enlaces privados. | Búsqueda privada, derivación y revisión verificada. | Entrega/autorización de menores. |

## Principios UX

- Telegram se usa para acciones rápidas, confirmaciones y notificaciones.
- Web UI se usa cuando Telegram no permite suficiente estructura visual, privacidad o densidad de información.
- Cada mensaje operativo debe indicar frescura, riesgo y estado cuando afecte decisiones de campo.
- Los enlaces web deben ser temporales, de alcance mínimo y revocables.
- Las acciones críticas deben pedir confirmación y quedar auditadas.

## Flujos principales

### Alta rápida

1. Usuario abre el bot con `/start`.
2. El bot muestra propósito, límites y política básica de seguridad.
3. Usuario selecciona incidente o introduce código de invitación.
4. Usuario define seudónimo por incidente.
5. Usuario selecciona rol.
6. Backend crea identidad de canal y permisos iniciales.

### Reporte de centro

1. Usuario elige `Reportar centro`.
2. Bot solicita ubicación aproximada o abre Web UI con mapa online.
3. Usuario añade tipo, prioridad y necesidad inicial mínima.
4. Backend registra operación como pendiente de corroboración.
5. Bot devuelve estado y próximos pasos.

### Reporte de recursos

1. Usuario elige `Faltante` o `Sobrante`.
2. Bot solicita centro, categoría, cantidad aproximada y urgencia.
3. Backend calcula frescura/confianza y matching simple.
4. Bot notifica posibles tareas logísticas.

### Reunificación familiar

1. Bot explica que Zona Cero no autoriza entrega de menores.
2. Usuario recibe enlace web privado de vida corta.
3. Web UI recoge datos que el familiar ya conoce.
4. Backend aplica límites anti-abuso y registra auditoría.
5. Si hay coincidencia, se muestra derivación limitada a punto verificado.

## Requisitos funcionales

- El canal debe soportar comandos y botones para acciones frecuentes.
- El canal debe generar enlaces web firmados para pantallas complejas.
- Los enlaces deben incluir alcance, expiración, incidente, rol y permisos mínimos.
- El canal debe mostrar estado de operación: recibida, pendiente, confirmada, rechazada o requiere revisión.
- El canal debe degradar con claridad cuando no haya datos frescos.
- El canal no debe exponer ubicación exacta de menores ni datos sensibles en mensajes de Telegram.
- El canal no debe tomar decisiones críticas que dependan de presencia fuerte.

## Requisitos no funcionales

| Área | Requisito |
|---|---|
| Seguridad | No enviar secretos, fotos sensibles ni datos privados completos por chat. |
| Privacidad | Minimizar datos en Telegram; trasladar flujos sensibles a Web UI protegida. |
| Resiliencia | Si Telegram no está disponible, no debe bloquear la app nativa ni backend. |
| Auditoría | Toda mutación relevante debe tener actor, canal, timestamp y resultado. |
| Observabilidad | Registrar errores por comando, webhook, enlace expirado y acción rechazada. |

## Fuera de alcance

- Operación offline local-first.
- Mapa offline por paquetes.
- Tracking de presencia en background.
- Firma local fuerte con material protegido por dispositivo.
- Integración directa con Meshtastic.
- Autorización de entrega de menores.

## Dependencias

- Contratos compartidos de dominio/API.
- Backend de permisos, auditoría, incidentes, centros, recursos, SOS y reunificación.
- Infraestructura Cloudflare para webhooks, colas, rate limits, enlaces firmados y almacenamiento.
- App nativa para capacidades críticas de campo.
