# Matriz de cobertura: Telegram + Web UI vs App nativa

Este documento evalúa si las funcionalidades del PRD funcional de Zona Cero pueden cubrirse con una solución basada en Telegram como interfaz principal, complementada con pantallas web servidas desde el backend mediante enlaces seguros, o si requieren una app nativa.

**Conclusión ejecutiva:** Telegram + Web UI puede cubrir bien la coordinación conversacional, formularios, recomendaciones, tareas logísticas y flujos administrativos. Sin embargo, no cubre de forma suficiente el núcleo diferencial del PRD: operación local-first, mapa offline robusto, presencia probabilística fiable, outbox firmada local, bajo consumo, SOS degradado e integración Meshtastic realista.

## Leyenda

| Símbolo | Significado |
|---|---|
| ✅ | Cubre bien con Telegram + Web UI |
| ⚠️ | Cobertura parcial o con riesgo operativo |
| ❌ | No cubre bien; requiere otra capacidad |

## Matriz de features

| Feature PRD | Telegram + Web UI | ¿Requiere app nativa? | Motivo |
|---|---:|---:|---|
| Crear/unirse a incidente | ✅ | No | Un bot puede guiar el alta y el backend gestionar incidentes. |
| Identidad seudónima por incidente | ⚠️ | Recomendable | Telegram introduce identidad/plataforma externa; se puede ocultar al resto, pero no es anonimato local puro. |
| Clave local por dispositivo y operaciones firmadas | ⚠️ | Sí | WebCrypto ayuda, pero secure storage, persistencia fiable y operación offline son mucho más sólidos en nativo. |
| Selección de roles | ✅ | No | Bot o web form funcionan bien. |
| Validación de roles sensibles | ✅ | No | Puede ser backend/admin web. |
| Incidentes y celdas operativas | ✅ | No | Es lógica de backend + UX de selección. |
| Sync prioritaria por celda | ⚠️ | Sí para MVP fuerte | Telegram depende de red; web puede cachear algo, pero no local-first operativo completo. |
| Mapa operativo online | ✅ | No | Web con MapLibre funciona. |
| Mapa offline por paquetes | ⚠️/❌ | Sí | Offline tiles, almacenamiento grande y fiabilidad en campo favorecen nativo claramente. |
| Map-first UX con panel progresivo | ✅ | No | Se puede hacer con web UI abierta desde Telegram. |
| Filtros de mapa: estado, rol, SOS, frescura | ✅ | No | Web UI suficiente. |
| Crear centro desde el mapa | ✅ | No | Web con geolocalización puede hacerlo. |
| Creación rápida tipo check-in de campo | ⚠️ | Recomendable | En Telegram sería torpe; web puede hacerlo, pero nativo da mejor UX en estrés. |
| Ciclo `pending -> observing -> active -> resolved` | ✅ | No | Es lógica de dominio/backend. |
| Validación por presencia acumulada | ⚠️ | Sí | GPS web existe, pero permanencia, sensores, background, batería y señales del dispositivo son limitados. |
| Detección de GPS falso/anomalías | ⚠️ | Sí | En web es mucho más débil. |
| Score de presencia probabilística | ⚠️ | Sí | El cálculo puede vivir en backend, pero las señales buenas requieren nativo. |
| Estados `available`, `occupied`, `resting`, `off-duty` | ✅ | No | Bot o web lo cubren. |
| Tracking activo/degradado/pausado | ⚠️ | Sí | El estado se muestra fácil; medirlo bien en background es lo difícil. |
| Pausar presencia / check-out | ✅ | No | Bot/web suficiente. |
| Bajo consumo y muestreo adaptativo | ❌ | Sí | Esto requiere control nativo de sensores, background y batería. |
| Recomendaciones de centros con déficit | ✅ | No | Backend + bot/web. |
| Redirección desde centros saturados | ✅ | No | Bot puede enviar recomendaciones explicables. |
| Reportar faltantes/sobrantes | ✅ | No | Telegram es adecuado para captura rápida. |
| Categorías configurables de recursos | ✅ | No | Backend/admin. |
| Matching faltante/sobrante | ✅ | No | Backend. |
| Tareas de traslado | ✅ | No | Bot flow funciona bien: aceptar, en camino, entregado, cancelar. |
| SOS rápido | ⚠️ | Sí si es crítico | Bot puede tener comando/botón, pero acceso rápido, offline, notificaciones locales y sensores favorecen nativo. |
| SOS con última ubicación/batería | ⚠️ | Sí | Ubicación web sí; batería y última ubicación fiable/offline, limitado. |
| Propagación SOS por backend | ✅ | No | Telegram/backend lo cubren si hay red. |
| Propagación SOS offline / local sync / usuarios cercanos | ❌ | Sí | Telegram no sirve sin red. |
| Cola crítica Meshtastic | ❌/⚠️ | Sí | Integración real con gateway/dispositivo requiere capa nativa o hardware/gateway externo dedicado. |
| Acuse de recibo SOS | ✅ | No | Bot lo cubre. |
| Reunificación familiar: capa pública mínima | ✅ | No | Web privada enlazada desde Telegram puede funcionar. |
| No publicar foto/ubicación exacta de menores | ✅ | No | Es política de backend/UX. |
| Capa privada cifrada con control de acceso | ⚠️ | Recomendable | Web puede hacerlo, pero nativo mejora almacenamiento seguro y control de sesión. |
| Búsqueda privada por familiares | ✅ | No | Web UI encaja bien. |
| Límites anti-abuso y auditoría | ✅ | No | Backend. |
| PFIF/RFL interoperabilidad | ✅ | No | Backend/integraciones. |
| Outbox local de operaciones firmadas | ⚠️/❌ | Sí | Telegram no tiene outbox local de dominio; web offline es frágil comparado con SQLite/RxDB nativo. |
| Trabajar offline y sincronizar después | ❌ | Sí | Es una feature central del PRD; Telegram falla aquí. |
| Resolución de conflictos | ✅ | No | Backend/dominio, aunque la cola local necesita nativo. |
| Estado de sync visible | ⚠️ | Sí para robustez | Web puede mostrar estados; nativo los mantiene mejor offline. |
| Accesibilidad en estrés alto | ⚠️ | Recomendable | Telegram limita layout; web/nativo mejora objetivos táctiles, persistencia y acciones críticas. |
| Iconos + texto, no solo color | ✅ | No | Telegram/web lo permite. |
| Auditoría mínima de operaciones | ✅ | No | Backend + firmas. |
| Protección de material criptográfico | ⚠️ | Sí | Secure enclave, Keychain o Keystore requieren app nativa. |
| TTL de datos sensibles | ✅ | No | Backend. |
| Anti-Sybil/spam/falsos centros | ⚠️ | Recomendable | Backend ayuda, pero señales del dispositivo/presencia son mejores en nativo. |
| Métricas MVP/producto | ✅ | No | Backend analytics. |

## Lectura por módulos del PRD

| Módulo | Encaje Telegram + Web UI | Evaluación |
|---|---|---|
| A - Identidad seudónima y roles | Alta para alta, selección de roles y validación administrativa; limitada para claves locales fuertes y privacidad frente a plataforma. | ⚠️ Parcial |
| B - Incidentes y celdas operativas | Alta para navegación conversacional y selección de incidente/celda; limitada para sync local-first real. | ⚠️ Parcial |
| C - Mapa operativo offline | Alta si el mapa es online/web; baja si debe funcionar con paquetes offline robustos. | ⚠️/❌ Parcial fuerte |
| D - Centros de trabajo | Alta para crear, actualizar y auditar centros; media para check-in de campo y validación por señales. | ⚠️ Parcial |
| E - Presencia probabilística | Baja para señales robustas; Telegram/Web no controla bien sensores, background, batería ni anomalías. | ❌ Requiere nativo |
| F - Distribución de voluntarios | Alta; recomendaciones, estados y redirección pueden vivir en backend + bot/web. | ✅ Encaja |
| G - Logística de suministros | Alta; reportes, matching y tareas de traslado son buenos candidatos para bot flows. | ✅ Encaja |
| H - SOS de rescatista | Parcial; sirve con red, pero falla para SOS offline/degradado, sensores e integración local. | ⚠️/❌ Parcial fuerte |
| I - Reunificación familiar | Alta si los datos sensibles se gestionan por web privada y backend con control de acceso. | ✅ Encaja con cautelas |
| J - Sincronización y conflictos | Backend puede resolver conflictos, pero el outbox local y la operación offline requieren app nativa. | ⚠️ Parcial |
| Accesibilidad y estrés alto | Media; Telegram ayuda por familiaridad, pero limita layout, prominencia de acciones críticas y control offline. | ⚠️ Parcial |
| Seguridad y privacidad | Backend cubre TTL, auditoría y minimización; nativo mejora material criptográfico y señales de dispositivo. | ⚠️ Parcial |
| Resiliencia operativa | Baja si la promesa incluye trabajar sin red, mapas locales y mensajes críticos degradados. | ❌ Requiere nativo |

## Recomendación arquitectónica

No conviene plantearlo como una sustitución binaria de app nativa por Telegram. La arquitectura más fuerte sería híbrida:

- **App nativa:** operadores de campo, rescatistas, mapa offline, presencia, outbox firmada, SOS crítico, bajo consumo e integración Meshtastic.
- **Telegram + Web UI:** onboarding, coordinación ligera, recomendaciones, reportes de recursos, tareas logísticas, acuses, comunicación con voluntarios y flujos familiares sensibles mediante web privada.

Esta separación mantiene el diferencial local-first del producto sin renunciar a la velocidad de adopción que ofrece Telegram.
