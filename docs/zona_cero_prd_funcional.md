# PRD funcional - Zona Cero

**Producto:** Zona Cero  
**Tipo:** Aplicación móvil de coordinación ciudadana ante catástrofes  
**Fecha:** 2026-06-27  
**Estado:** Borrador funcional v0.1  
**Fuentes:** `docs/Plan.md` y `docs/research/zona_cero_benchmark_tecnico_2026-06-27.md`

Zona Cero coordina voluntarios, centros de trabajo, recursos críticos, alertas SOS y reunificación familiar durante catástrofes. El producto no debe diseñarse como una app CRUD con mapa, sino como una red local-first por incidente, capaz de operar con conectividad degradada, presencia probabilística y operaciones firmadas.

## 1. Tesis del producto

En una catástrofe, la ayuda suele llegar desordenada: muchos voluntarios se concentran en un punto, otros puntos quedan abandonados, faltan recursos donde más se necesitan y la información circula tarde por redes sociales.

Zona Cero resuelve una pregunta operativa:

> ¿A dónde debe ir el siguiente recurso —persona, agua, herramienta, vehículo o equipo especializado— para producir el mayor impacto seguro?

El producto convierte señales de campo en decisiones accionables: dónde falta gente, qué centro está activo, qué recurso escasea, qué alerta requiere respuesta y qué casos deben derivarse a organismos verificados.

## 2. Objetivos

### Objetivos funcionales

- Coordinar voluntarios por incidente y zona geográfica.
- Crear y validar centros de trabajo mediante presencia probabilística, no solo GPS.
- Mostrar un mapa offline/online con centros, saturación, necesidades y alertas.
- Provide a map-first operational flow with progressive center details, role counts, needs, surplus resources, freshness, and risk labels.
- Registrar faltantes y sobrantes de suministros para facilitar logística.
- Emitir SOS de rescatista con última ubicación conocida y señales de rescate disponibles.
- Permitir registro seguro de niños separados sin exponer identidad completa, foto pública ni ubicación exacta.
- Interoperar con PFIF/RFL para reunificación familiar, sin reemplazar la verificación oficial.
- Funcionar con conectividad intermitente mediante operaciones locales firmadas y sincronización posterior.
- Incluir desde el MVP una ruta de comunicación mesh realista mediante gateway Meshtastic para mensajes críticos.

### No objetivos

- No autorizar la entrega de menores desde la app.
- No prometer prueba absoluta de presencia física.
- No dirigir civiles no entrenados a zonas inseguras.
- No depender de login tradicional para voluntarios anónimos.
- No depender de conectividad 4G/5G estable.
- No construir un sistema paralelo que compita con Protección Civil, Cruz Roja, bomberos u organismos equivalentes.
- No monetized marketplace is evidenced for the current product direction; logistics means humanitarian dispatch, not commercial exchange.

## 3. Usuarios principales

| Usuario | Necesidad | Resultado esperado |
|---|---|---|
| Voluntario general | Saber dónde ayudar sin saturar un punto | Recibe recomendaciones de centros con déficit |
| Rescatista | Coordinar trabajo y pedir ayuda si queda atrapado | Puede hacer check-in, ver relevos y emitir SOS |
| Personal médico | Saber qué centros requieren cobertura sanitaria | Ve centros con déficit médico y reporta capacidad |
| Logística / motorizados | Transportar recursos a donde faltan | Recibe tareas de traslado priorizadas |
| Coordinador local | Entender el estado del incidente | Ve datos agregados, auditoría y alertas |
| Familiar buscando menor | Encontrar una pista sin exponer al niño | Puede buscar de forma privada y derivar a verificación |
| Personal verificado | Validar casos sensibles y coordinar respuesta | Accede a datos restringidos según rol |

## 4. Principios funcionales

1. **Local-first por defecto:** toda acción crítica debe poder registrarse sin conexión.
2. **Operaciones firmadas:** cada cambio relevante se registra como operación firmada, auditable e idempotente.
3. **Sincronización por incidente/celda:** la app sincroniza solo lo necesario para la zona operativa del usuario.
4. **Presencia probabilística:** GPS, permanencia, señales del dispositivo, reputación y corroboración cruzada producen evidencia; ninguna señal aislada prueba presencia.
5. **Minimización de datos:** solo se recoge lo imprescindible, especialmente en menores y contextos políticamente sensibles.
6. **Seguridad antes que eficiencia:** el sistema coordina ayuda, pero no debe empujar a personas no capacitadas hacia peligro.
7. **Interoperabilidad humanitaria:** reunificación familiar debe alinearse con PFIF/RFL y organismos verificados.
8. **Mesh pragmático:** Meshtastic funciona como gateway para mensajes críticos; BLE mesh móvil generalizado no es base confiable del MVP.

## 5. Alcance del MVP

El MVP debe validar el diferenciador del producto: coordinación local-first de centros de trabajo con presencia probabilística y mapa operativo offline.

### Incluido en MVP

- Creación de incidente local o unión a incidente existente.
- Identidad seudónima con clave local por dispositivo.
- Mapa MapLibre con paquetes offline por zona.
- Map-first UX with a selected-center side/bottom panel for progressive disclosure.
- Creación de centros de trabajo.
- Check-in/check-out de voluntarios.
- Estado de centro: `pending -> observing -> active -> resolved/archived`.
- Score de presencia probabilística.
- Conteo agregado por rol.
- Active volunteer mode with availability states, visible tracking status, pause, and checkout controls.
- Basic need/surplus reporting using simple configurable categories: roles, water, food, light tools, heavy machinery, vehicles, and medical support.
- Outbox local de operaciones firmadas.
- Sync push/pull por incidente y celda cuando haya conectividad.
- Cola de mensajes críticos compatible con gateway Meshtastic: SOS, centro activo, faltante crítico y acuse de recibo.
- Auditoría mínima de operaciones.

### Fuera del MVP inicial

- Optimización avanzada de rutas multi-parada.
- App completa para autoridades.
- Reunificación familiar en producción sin acuerdos operativos con organismos competentes.
- BLE mesh teléfono-a-teléfono como dependencia central.
- Prueba criptográfica fuerte de presencia física.

## 6. Módulos funcionales

## 6.1 Módulo A - Identidad seudónima y roles

### Descripción

El usuario entra con una identidad local seudónima. No necesita email, teléfono ni OAuth para operar como voluntario civil. La app genera una clave local y firma las operaciones.

### Requisitos funcionales

- La app debe crear una identidad local al primer uso.
- El usuario debe elegir un seudónimo visible dentro del incidente.
- El seudónimo debe poder ser específico por incidente para reducir riesgo político.
- El usuario debe seleccionar uno o varios roles:
  - voluntario general,
  - rescate,
  - médico,
  - logística,
  - coordinación,
  - personal verificado.
- Los roles sensibles deben requerir validación por una organización o coordinador autorizado.
- La app debe firmar cada operación crítica con la clave local.
- Si el dispositivo cambia o se pierde, la identidad local no debe asumirse recuperable salvo que exista un mecanismo explícito de respaldo seguro.

### Criterios de aceptación

- Un usuario puede registrarse sin conexión.
- Un usuario puede operar con seudónimo sin entregar teléfono o email.
- Una operación creada offline queda firmada y pendiente de sincronización.
- Un rol verificado no puede autodeclararse como válido sin aprobación.

## 6.2 Módulo B - Incidentes y celdas operativas

### Descripción

Un incidente representa una catástrofe concreta. La operación se divide en celdas geográficas para limitar datos, consumo, sincronización y riesgo.

### Requisitos funcionales

- La app debe permitir crear o unirse a un incidente.
- Cada incidente debe tener nombre, zona aproximada, fecha, estado y paquetes de mapa asociados.
- La app debe dividir el incidente en celdas geográficas.
- El usuario debe sincronizar prioritariamente la celda actual y celdas cercanas.
- La app debe permitir cambiar de celda cuando el usuario se desplaza.
- Los datos de otras celdas deben resumirse, no descargarse completos por defecto.

### Criterios de aceptación

- El usuario puede abrir un incidente sin red si ya tiene datos locales.
- El mapa muestra la celda actual y su estado de sincronización.
- La app no necesita descargar todo el incidente para operar en una zona concreta.

## 6.3 Módulo C - Mapa operativo offline

### Descripción

El mapa es la interfaz principal para entender dónde hay centros, voluntarios, recursos, alertas y rutas posibles. Debe funcionar sin conexión.

### Requisitos funcionales

- La app debe mostrar centros de trabajo, alertas, recursos y zonas saturadas.
- El usuario debe poder descargar paquetes de mapa por incidente o región.
- El mapa debe indicar si está usando datos offline, online o parcialmente sincronizados.
- Los centros deben agruparse visualmente cuando haya alta densidad.
- The map must be the primary operational surface: users start from nearby centers, alerts, routes, and resource gaps instead of a form-first or CRUD-first flow.
- Selecting a center must open a progressive side/bottom panel with role counts, current needs, surplus resources, last update time, freshness state, and risk labels.
- Center and resource status must use icons plus text labels; color may reinforce meaning but must never be the only signal.
- The map must provide large touch targets suitable for stressed field use and must keep offline/freshness indicators visible.
- El mapa debe mostrar filtros por:
  - estado del centro,
  - necesidad crítica,
  - rol requerido,
  - disponibilidad de suministros,
  - alertas SOS,
  - antigüedad de datos.
- La app debe degradar con claridad cuando la información esté desactualizada.

### Criterios de aceptación

- El usuario puede consultar el mapa sin conexión.
- La app muestra cuándo fue la última sincronización de la zona.
- Los datos antiguos se distinguen visualmente de los recientes.

## 6.4 Módulo D - Centros de trabajo

### Descripción

Un centro de trabajo es un punto operativo en el terreno: edificio colapsado, zona de reparto, puesto médico, punto de rescate, almacén temporal o área de coordinación.

### Estados

| Estado | Significado | Entrada | Salida |
|---|---|---|---|
| `pending` | Punto creado pero no corroborado | Un usuario lo crea | Suficiente evidencia de presencia |
| `observing` | Hay actividad probable | Presencia mínima y señales coherentes | Permanencia suficiente o rechazo |
| `active` | Centro operativo confirmado probabilísticamente | Permanencia + consenso | Resolución, cierre o pérdida de señal |
| `resolved` | Trabajo terminado | Coordinador o consenso lo marca | Archivo |
| `archived` | Ya no aparece por defecto | TTL o cierre | Consulta histórica |

### Requisitos funcionales

- Un usuario debe poder crear un centro desde el mapa.
- Center creation must feel like a field check-in from the map, with minimal required input first and optional details later.
- El centro debe incluir tipo, descripción breve, ubicación aproximada, prioridad y necesidades iniciales.
- La app debe mostrar el estado del centro y la confianza de validación.
- La transición de estado debe depender de evidencia acumulada:
  - número de dispositivos distintos,
  - permanencia mínima,
  - precisión de ubicación,
  - movimiento plausible,
  - señales del dispositivo,
  - reputación contextual,
  - corroboración de otros usuarios.
- Validation thresholds must be configurable by incident and may include seed examples such as multiple co-present devices, minimum dwell time, peer corroboration, and suspicious-signal penalties; exact numbers must be validated per incident instead of hard-coded globally.
- La app debe permitir reportar que un centro es falso, duplicado, peligroso o resuelto.
- La app debe evitar mostrar identidad personal de voluntarios; debe mostrar conteos agregados por rol.
- The selected-center panel must show aggregate counts by role, missing roles/resources, surplus resources, freshness, confidence, and risk labels without exposing individual volunteers.

### Criterios de aceptación

- Un centro no pasa a activo solo porque una persona toque un botón.
- GPS por sí solo no activa un centro.
- Un centro activo muestra conteos agregados por rol y necesidades.
- El historial de cambios del centro puede auditarse.

## 6.5 Módulo E - Presencia probabilística

### Descripción

La presencia física se trata como evidencia probabilística, no como verdad absoluta. Esta es una decisión central de producto: en móviles de consumo no existe prueba perfecta de presencia.

### Señales de presencia

| Señal | Uso | Límite |
|---|---|---|
| GPS/geofence | Ubicación aproximada | Puede fallar o falsificarse |
| Permanencia | Reduce check-ins oportunistas | Consume batería si se mide mal |
| Dispositivos distintos | Aporta consenso | Riesgo Sybil |
| Precisión y deriva | Detecta señales sospechosas | Puede penalizar dispositivos malos |
| Movimiento plausible | Detecta saltos imposibles | No prueba intención |
| Sensores | Ayudan a detectar coherencia | No son prueba fuerte |
| Reputación contextual | Pondera historial útil | Debe evitar sesgos injustos |
| Atestaciones cruzadas | Refuerza presencia | Puede coordinarse maliciosamente |

### Requisitos funcionales

- La app debe calcular un score de presencia por sesión.
- La app debe explicar el estado en lenguaje operativo: baja, media o alta confianza.
- La app debe registrar evidencia suficiente para auditoría sin exponer datos sensibles innecesarios.
- La app debe detectar señales anómalas:
  - ubicación simulada,
  - precisión sospechosa,
  - saltos imposibles,
  - muchas identidades desde el mismo patrón de dispositivo,
  - check-ins masivos coordinados.
- La app debe usar muestreo adaptativo para proteger batería.
- The app must expose active volunteer mode with states: `available`, `occupied`, `resting`, and `off-duty`.
- The app must clearly show when presence tracking is active, degraded, paused, or stopped.
- The user must be able to pause tracking, check out from a center, or go off-duty without losing already signed audit history.
- Battery-aware behavior must reduce heartbeat frequency, warn about high drain, and degrade to explicit check-ins when continuous tracking is not safe or available.
- El usuario debe poder pausar presencia cuando abandona la zona.

### Criterios de aceptación

- La presencia se muestra como confianza, no como certeza.
- El sistema puede mantener centros en observación cuando la evidencia es insuficiente.
- El usuario entiende por qué un centro aún no está activo.

## 6.6 Módulo F - Distribución de voluntarios

### Descripción

El producto recomienda dónde ir según déficit de roles, criticidad, distancia, seguridad y frescura de datos.

### Requisitos funcionales

- La app debe mostrar centros cercanos con déficit de voluntarios.
- La app debe diferenciar déficit por rol.
- La app debe evitar recomendar zonas marcadas como peligrosas para voluntarios no capacitados.
- La app debe permitir al usuario declararse disponible, ocupado, en descanso o fuera de servicio.
- La app debe priorizar centros con datos recientes y confianza suficiente.
- The app must show recommendations as decision support, not mandatory orders.
- The app must explicitly redirect volunteers away from saturated centers toward deficit centers when data freshness and safety constraints support it.
- Recommendations for the MVP must be deterministic and explainable; AI-based assignment remains validation/backlog until audited field data exists.

### Criterios de aceptación

- Un voluntario general no recibe como recomendación principal entrar a una zona de rescate especializada.
- Un médico puede filtrar centros con déficit médico.
- Las recomendaciones cambian cuando un centro se satura.

## 6.7 Módulo G - Logística de suministros

### Descripción

El módulo conecta puntos con faltantes y puntos con sobrantes para mover recursos críticos.

### Requisitos funcionales

- Un usuario activo en un centro debe poder reportar faltantes.
- Un usuario activo en un centro debe poder reportar sobrantes.
- Each report must include type, approximate quantity, urgency, freshness, confidence, and restrictions.
- Resource categories must be incident-configurable and start simple in the MVP: roles/people, water, food, light tools, heavy machinery, vehicles, and medical support.
- La app debe emparejar faltantes y sobrantes por prioridad, distancia, seguridad y frescura de datos.
- La app debe permitir crear tareas de traslado para logística/motorizados.
- El sistema debe soportar despacho manual asistido en MVP.
- Logistics flows must model humanitarian dispatch from surplus to deficit points; they must not imply monetized marketplace mechanics without new evidence and validation.
- En fases posteriores debe integrarse optimización de rutas con VROOM/OR-Tools y OSRM/Valhalla.

### Criterios de aceptación

- Un centro puede pedir agua, herramientas, comida o apoyo médico.
- Otro centro puede marcar excedente compatible.
- Un usuario de logística puede aceptar una tarea de traslado.
- La tarea mantiene estados: pendiente, aceptada, en camino, entregada, cancelada.

## 6.8 Módulo H - SOS de rescatista

### Descripción

Un rescatista puede emitir una alerta crítica si queda atrapado o en peligro. La app no promete profundidad exacta bajo escombros; entrega última ubicación conocida y señales útiles.

### Requisitos funcionales

- La app debe ofrecer un botón SOS de acceso rápido para roles autorizados o usuarios en centro activo.
- El SOS debe incluir última ubicación conocida, hora, centro asociado y estado de batería si está disponible.
- El SOS debe intentar propagarse por:
  - red local/app sync,
  - backend cuando haya conexión,
  - cola de mensajes críticos para gateway Meshtastic,
  - notificaciones locales a usuarios cercanos cuando sea posible.
- La app debe permitir acuse de recibo.
- La app debe registrar actualizaciones de estado: emitido, recibido, en respuesta, resuelto, falso positivo.
- La app debe dejar claro que barómetro/BLE/RSSI son señales de proximidad, no profundidad exacta.
- SOS location may show last known coordinates, timestamp, accuracy radius, and optional sensor notes, but never exact rubble depth or false altitude precision.

### Criterios de aceptación

- Un SOS creado sin conexión queda en cola y se difunde en cuanto exista transporte disponible.
- Usuarios cercanos ven la alerta con prioridad máxima.
- El sistema no muestra “profundidad exacta”.

## 6.9 Módulo I - Reunificación familiar

### Descripción

Este módulo ayuda a encontrar pistas sobre niños separados, pero nunca autoriza la entrega de un menor. La reunificación debe cerrarse mediante verificación presencial por organismos competentes.

### Requisitos funcionales

- La app debe permitir registrar un menor encontrado con capa pública mínima:
  - nombre si se conoce,
  - iniciales de apellidos si se conocen,
  - edad aproximada,
  - estado general no sensible,
  - referencia de punto seguro aproximado.
- La app no debe publicar foto, ubicación exacta ni identidad completa del menor.
- The app must not publish full names, public photos, or exact locations for vulnerable people.
- La capa privada debe guardar datos completos cifrados y con control de acceso.
- Un familiar debe buscar introduciendo datos que ya conoce: nombre completo, fecha de nacimiento u otros campos privados definidos.
- Si hay coincidencia, la app debe revelar solo información limitada y derivar a verificación presencial.
- La app debe registrar intentos de búsqueda y aplicar límites anti-abuso.
- Los registros deben tener caducidad/TTL.
- El módulo debe ser compatible con PFIF/RFL para intercambio con sistemas humanitarios.
- El módulo no debe operar en producción sin protocolo con Cruz Roja, protección de menores u organismo equivalente.
- Missing-adult support, last-seen notifications, deceased-person records, and external registry integration must remain validation/backlog items with separate privacy review, TTL, audit logs, abuse limits, and access controls.

### Criterios de aceptación

- Una persona no puede reclamar ni recibir un menor solo por acertar datos en la app.
- La app muestra instrucciones claras de derivación a un punto seguro/verificado.
- Fotos de menores no aparecen en listados públicos.
- Todo intento de reclamación queda auditado.

## 6.10 Módulo J - Sincronización y conflictos

### Descripción

El sistema registra cambios como operaciones locales firmadas. Cuando hay conectividad, sincroniza por incidente y celda.

### Requisitos funcionales

- Toda mutación crítica debe crear una operación en la outbox local.
- La operación debe ser idempotente y estar firmada.
- La app debe mostrar estado de sincronización:
  - local pendiente,
  - enviado,
  - confirmado,
  - conflicto,
  - rechazado.
- La sincronización debe operar por incidente, celda y cursor temporal lógico.
- El usuario debe poder seguir trabajando aunque existan operaciones pendientes.
- Los conflictos deben resolverse según tipo de entidad:
  - eventos append-only: conservar historial,
  - estados derivados: recalcular desde operaciones,
  - campos administrativos: requerir moderación si hay disputa.

### Criterios de aceptación

- Una acción offline aparece inmediatamente en la app local.
- La acción se sincroniza después sin duplicarse.
- Si hay conflicto, el usuario ve estado claro y el sistema conserva auditoría.

## 6.11 Accesibilidad y usabilidad en estrés alto

### Descripción

La interfaz debe seguir siendo usable por usuarios estresados, cansados y no técnicos en condiciones degradadas. El producto puede usar como referencia una interacción de mapa simple, similar a apps de navegación masivas, pero no debe depender de ningún patrón propietario específico.

### Requisitos funcionales

- El estado operativo debe expresarse con iconos y texto, no solo con color.
- Los objetivos táctiles de acciones primarias deben ser suficientemente grandes para uso con guantes, humedad o pulso inestable.
- Las tarjetas de centro deben mostrar frescura, estado offline/sincronización, confianza y etiquetas de riesgo en lenguaje operativo claro.
- Acciones críticas como SOS, salida/check-out, pausa de seguimiento y navegación hacia zona peligrosa deben ser visualmente prominentes y confirmables.
- La información densa debe usar divulgación progresiva: primero mapa, luego panel resumen y solo después historial detallado bajo demanda.

### Criterios de aceptación

- Un usuario puede entender si un centro está fresco, obsoleto, solo offline, en riesgo, saturado o con déficit de recursos sin depender solo del color.
- Un usuario puede pausar o hacer check-out y ver que el seguimiento se detuvo o degradó.
- Un lector de pantalla o interpretación solo-texto puede distinguir necesidad, sobrante, riesgo y frescura de recursos.

## 7. Requisitos de seguridad y privacidad

- Minimizar datos personales desde el diseño.
- Separar identidad civil seudónima de personal verificado.
- Firmar operaciones para trazabilidad sin exigir identidad legal al voluntario.
- Proteger material criptográfico en almacenamiento seguro del dispositivo.
- Cifrar datos privados de reunificación familiar.
- No publicar ubicaciones exactas de menores ni de personas vulnerables.
- Aplicar TTL a datos sensibles.
- Permitir auditoría de operaciones críticas.
- Reducir riesgo de doxxing o persecución política mediante seudónimos por incidente.
- Diseñar con abuso esperado: sabotaje, Sybil, spam, falsos centros, pesca de menores y GPS spoofing.
- Social attestation can increase confidence but must never grant critical permissions, professional credentials, minor handoff, or access to sensitive records by itself.
- Optional media evidence must remain backlog/feature-flagged until redaction, retention, moderation, signed metadata, consent, and abuse controls are defined.

## 8. Requisitos de resiliencia operativa

- La app debe funcionar sin conexión para acciones principales.
- La app debe conservar mapa y datos críticos localmente.
- La app debe priorizar bajo consumo de batería.
- La app debe degradar funcionalidades sin bloquear operación básica.
- La app debe soportar mensajes críticos por gateway Meshtastic desde el MVP.
- La app debe mostrar frescura de datos para evitar decisiones con información caducada.

## 9. Métricas de éxito

### MVP

- Tiempo medio para crear un centro de trabajo.
- Porcentaje de centros con estado validado correctamente.
- Tiempo desde creación de centro hasta visibilidad en otros dispositivos.
- Porcentaje de acciones realizadas offline que sincronizan sin conflicto.
- Reducción de saturación en centros con exceso de voluntarios.
- Consumo medio de batería durante una sesión de campo.
- Porcentaje de mapas consultables sin conexión.

### Producto

- Tiempo medio para cubrir déficit crítico de roles.
- Tiempo medio para emparejar faltante con sobrante.
- Tasa de falsos centros detectados.
- Tasa de alertas SOS con acuse de recibo.
- Tasa de intentos abusivos bloqueados en reunificación familiar.
- Número de derivaciones exitosas a organismos verificados.

## 10. Roadmap funcional

| Fase | Objetivo | Entregables |
|---|---|---|
| Fase 0 - Spike técnico | Probar viabilidad local-first | RxDB + SQLite, outbox firmada, MapLibre offline, sync mínimo, mensaje crítico Meshtastic simulado |
| Fase 1 - MVP | Coordinar centros y voluntarios | Identidad seudónima, centros, presencia probabilística, mapa offline, sync por celda, mensajes críticos gateway-ready |
| Fase 2 - Logística | Mover recursos | Faltantes/sobrantes, matching simple, tareas de traslado, despacho manual asistido |
| Fase 3 - Resiliencia | Operar en red degradada | Gateway Meshtastic real, SOS robusto, bajo consumo, pruebas de campo |
| Fase 4 - Reunificación | Interoperar con respuesta oficial | Flujo PFIF/RFL, capa privada cifrada, límites anti-abuso, acuerdos con organismos |
| Fase 5 - Optimización | Escalar coordinación | Rutas multi-parada, VROOM/OR-Tools, panel avanzado, analítica operativa |
| Backlog validation | Validate high-risk extensions | Media evidence, trusted alert feeds, AI recommendations, missing-adult support, external missing-person registries, voice distress recognition |

## 11. Reglas de negocio críticas

- Un centro no se activa por una única señal.
- Un usuario no puede validar ilimitados centros en poco tiempo.
- Una identidad nueva tiene menor peso que una identidad con historial contextual útil.
- Los reportes antiguos pierden peso operativo.
- Stale needs, surplus reports, role counts, and recommendations must be visually degraded and lose matching weight.
- Las recomendaciones deben considerar seguridad, no solo distancia.
- Recommendations must expose their main reason, such as role deficit, resource shortage, freshness, distance, saturation, or risk.
- Un menor encontrado nunca se entrega por decisión de la app.
- La ubicación exacta de un menor no se publica.
- Las operaciones offline no se descartan por falta de red.
- Los mensajes críticos tienen prioridad sobre sincronización normal.
- Las autoridades/personas verificadas tienen más capacidades, pero sus acciones también deben auditarse.

## 12. Preguntas abiertas

- ¿Qué umbrales iniciales de presencia se usarán por tipo de incidente?
- ¿Qué organismo validará roles sensibles en el primer piloto?
- ¿Qué país o región será el primer escenario operativo?
- ¿Qué protocolo exacto se usará para integrar PFIF/RFL?
- ¿Qué hardware Meshtastic será el estándar recomendado para coordinadores?
- ¿Qué datos deben caducar automáticamente y en qué plazo?
- ¿Qué nivel de anonimato es aceptable para voluntarios frente a auditoría operativa?
- ¿Qué criterios definen que una zona es demasiado peligrosa para voluntarios generales?
- What evidence and governance are required before enabling media evidence, trusted alert feeds, AI recommendations, missing-adult support, external registry sync, or voice distress recognition?

## 13. Dependencias funcionales externas

- OpenStreetMap / MapLibre para mapa base.
- Paquetes offline de mapas por región.
- PFIF/RFL o equivalente para interoperabilidad de reunificación.
- Organismos verificados para menores y roles sensibles.
- Gateway Meshtastic para mensajes críticos en red degradada.
- Servicios de routing/optimización en fases posteriores.

## 14. Definición de listo para el MVP

El MVP estará funcionalmente listo cuando un grupo de usuarios pueda, en una prueba de campo controlada:

1. Unirse a un incidente sin registro personal tradicional.
2. Descargar o usar un mapa offline de la zona.
3. Crear centros de trabajo desde el terreno.
4. Validar centros mediante presencia probabilística.
5. Ver déficit/saturación de voluntarios por rol.
6. Reportar necesidades básicas de recursos.
7. Operar durante un corte de red y sincronizar después.
8. Emitir un mensaje crítico compatible con gateway Meshtastic.
9. Auditar operaciones principales sin exponer datos personales innecesarios.
10. Demostrar que GPS solo no basta para activar estados críticos.
