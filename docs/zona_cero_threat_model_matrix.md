# Matriz de threat modeling - Zona Cero

**Producto:** Zona Cero  
**Tipo:** Aplicación móvil local-first para coordinación ciudadana ante catástrofes  
**Fecha:** 2026-06-28  
**Estado:** Borrador de seguridad v0.1  
**Fuentes:** [`zona_cero_prd_funcional.md`](./zona_cero_prd_funcional.md) y [`zona_cero_technical_design.md`](./zona_cero_technical_design.md)

Este documento resume los principales riesgos de threat modeling de Zona Cero y las mitigaciones esperadas para guiar decisiones de producto, arquitectura, implementación y revisión de seguridad durante el desarrollo.

## Resumen ejecutivo

Zona Cero opera en un contexto de alto riesgo: catástrofes, conectividad degradada, voluntarios seudónimos, datos de ubicación, posibles menores separados, recomendaciones operativas y mensajes críticos. Por eso, los riesgos principales no son solo técnicos; también pueden causar daño físico, exposición de personas vulnerables o desinformación operativa.

Las decisiones de seguridad más importantes son:

- Tratar la presencia y la verificación social como **probabilísticas**, nunca como prueba absoluta.
- Mantener identidad civil seudónima separada de identidad `org_verified`.
- No desbloquear permisos críticos, credenciales, safeguarding, entrega de menores ni datos sensibles mediante atestación social.
- No publicar ubicación exacta de menores, terceros o personas vulnerables.
- Priorizar firmas, idempotencia, auditoría, rate limits, deduplicación y disputas para todas las operaciones críticas.
- Mantener reunificación real de menores, multimedia, alertas oficiales automáticas, adultos desaparecidos e IA detrás de feature flags, acuerdos operativos y revisión específica.

## Alcance

### Incluido

- Identidad seudónima y roles.
- Incidentes, celdas operativas y centros de trabajo.
- Presencia probabilística.
- Mapa offline y sincronización local-first.
- Outbox de operaciones firmadas.
- Recomendaciones determinísticas de coordinación.
- Logística de recursos.
- SOS civil y de rescatista con cola crítica compatible con gateway Meshtastic.
- Arquitectura preparada para reunificación familiar.
- Funcionalidades futuras de alto riesgo marcadas como backlog o feature flag.

### Fuera de alcance de este documento

- Pentest técnico de implementación.
- Revisión de código fuente.
- Modelo legal por país.
- Políticas finales de organismos verificadores.
- Umbrales definitivos de presencia o TTL por incidente.

## Activos protegidos

| Activo | Riesgo principal |
|---|---|
| Personas voluntarias | Doxxing, persecución, exposición de ubicación, recomendaciones inseguras. |
| Menores y personas vulnerables | Reclamación falsa, exposición de identidad, ubicación o foto. |
| Participantes civiles y rescatistas en peligro | SOS falso, repetido, bloqueado, abusivo o con precisión engañosa. |
| Centros de trabajo | Activación falsa, duplicados, sabotaje o datos obsoletos. |
| Recursos críticos | Manipulación de faltantes/sobrantes y desvío logístico. |
| Operaciones firmadas | Replay, manipulación, duplicación o conflictos mal resueltos. |
| Datos offline | Exposición por pérdida o robo de dispositivo. |
| Confianza operativa | Incidentes falsos, roles falsos, alertas erróneas o recomendaciones peligrosas. |

## Actores de amenaza

| Actor | Motivación posible |
|---|---|
| Usuario oportunista | Crear ruido, ganar reputación o manipular recomendaciones. |
| Actor malicioso coordinado | Sabotear centros, generar pánico, desviar recursos o perseguir personas. |
| Falso familiar o depredador | Obtener información sobre menores o personas vulnerables. |
| Voluntario bienintencionado pero incorrecto | Reportar datos falsos, obsoletos o peligrosos sin mala fe. |
| Dispositivo comprometido o perdido | Exponer datos locales o claves. |
| Fuente externa no confiable | Inyectar alertas, rutas o información crítica incorrecta. |

## Fronteras de confianza

| Frontera | Riesgo |
|---|---|
| App móvil local ↔ almacenamiento seguro del dispositivo | Robo de claves, datos offline o sesiones activas. |
| App móvil ↔ outbox local | Operaciones manipuladas antes de sincronizar. |
| App móvil ↔ backend sync | Replay, duplicados, firmas inválidas o conflictos. |
| Cliente civil ↔ capacidades verificadas | Escalada de permisos por roles falsos o atestación social. |
| Datos públicos ↔ datos privados de reunificación | Exposición de menores o personas vulnerables. |
| Sync normal ↔ cola crítica Meshtastic | Mensajes SOS falsos, repetidos o sin ACK. |
| Fuentes oficiales futuras ↔ alertas internas | Alertas falsas, duplicadas o con severidad incorrecta. |
| Motor de recomendaciones ↔ decisión humana | Sesgo de autoridad y dirección insegura de voluntarios. |

## Matriz de amenazas y mitigaciones

| ID | Componente / frontera | Amenaza | Impacto | Probabilidad | Decisión de riesgo | Mitigación / control | Verificación |
|---|---|---|---|---|---|---|---|
| TM-001 | Presencia / GPS | GPS spoofing activa centros falsos. | Alto | Alta | Mitigar | Scoring probabilístico con permanencia, múltiples dispositivos, movimiento plausible, precisión, señales anti-spoofing y reportes negativos. | Tests donde GPS por sí solo nunca activa un centro. |
| TM-002 | Identidad civil | Ataque Sybil crea muchos voluntarios falsos. | Alto | Alta | Mitigar | Rate limits por actor, dispositivo y celda; coste temporal para ganar peso; reputación contextual; diversidad de señales. | Tests de creación masiva, check-ins coordinados y bajo peso de identidades nuevas. |
| TM-003 | Incidentes | Incidentes falsos o duplicados confunden la operación. | Alto | Media | Mitigar | Estado inicial `unverified`, detección de duplicados por proximidad/tiempo/nombre/tipo, fusión sin borrar historial y etiquetas de confianza. | Tests de duplicado y visibilidad diferenciada por estado de confianza. |
| TM-004 | Roles sensibles | Autodeclaración o atestación social concede permisos críticos. | Crítico | Media | Mitigar | Separar `self_declared`, `field_attested`, `trusted_by_context` y `org_verified`; solo `org_verified` otorga permisos críticos o acceso restringido. | Tests de matriz de permisos y bloqueo de capacidades críticas sin `org_verified`. |
| TM-005 | Ubicación de voluntarios | Doxxing, persecución o exposición política. | Alto | Media | Mitigar | Ubicación aproximada por defecto, opt-in reversible solo para ubicación exacta propia, TTL, minimización y seudónimos por incidente. | Tests de privacidad por entidad y revisión de datos sincronizados. |
| TM-006 | Menores / reunificación | Reclamación falsa o exposición de un menor. | Crítico | Media | Evitar en MVP público | Flujo real deshabilitado sin organismo verificador; no publicar fotos, ubicación exacta ni identidad completa; capa privada cifrada; derivación presencial obligatoria. | Tests anti-abuso, auditoría de intentos y verificación de que no existe entrega desde la app. |
| TM-007 | Outbox / sync | Replay, duplicación o manipulación de operaciones offline. | Alto | Media | Mitigar | Operaciones firmadas Ed25519, `op_id` único, idempotencia, validación backend, append-only log y rechazo de firmas inválidas. | Tests de firma inválida, replay, duplicados y payload manipulado. |
| TM-008 | Dispositivo perdido | Exposición de datos offline, claves o registros sensibles. | Alto | Media | Mitigar | Secure Store/Keychain/Keystore para claves, datos mínimos por celda, TTL agresivo y cifrado de datos privados. | Revisión de almacenamiento local, expiración y extracción básica. |
| TM-009 | SOS / Meshtastic | Mensajes críticos falsos, repetidos o sin trazabilidad. | Alto | Media | Mitigar | Creación abierta a participantes civiles con confirmación fuerte, mensajes compactos firmados o con resumen verificable, ACK, deduplicación, prioridad auditada, rate limits y confianza contextual visible. | Tests de SOS falso, repetición, ACK, deduplicación, rate limit y ausencia de promesa de rescate. |
| TM-010 | Recomendaciones | La app dirige civiles hacia zonas inseguras. | Alto | Media | Aceptar con mitigaciones | Motor determinístico explicable, etiquetas de riesgo, confirmación explícita antes de zona peligrosa, restricciones por rol y auditoría de recomendaciones aceptadas. | Tests donde voluntarios generales no reciben como recomendación principal zonas especializadas o peligrosas. |
| TM-011 | Datos obsoletos | Información stale provoca decisiones operativas incorrectas. | Alto | Alta | Mitigar | Freshness visible, TTL por tipo de dato, degradación visual y pérdida de peso en matching, conteos y recomendaciones. | Tests de expiración para necesidades, sobrantes, presencia, roles y recomendaciones. |
| TM-012 | Recursos / logística | Reportes falsos manipulan faltantes, sobrantes o tareas de traslado. | Alto | Media | Mitigar | Creación civil abierta con confianza por reportero/presencia, corroboración, frescura, restricciones, auditoría, rate limits y resolución de disputas. | Tests de matching con baja confianza, datos obsoletos y reportes contradictorios. |
| TM-013 | Conflictos offline | Estados críticos se sobrescriben incorrectamente al reconectar. | Alto | Media | Mitigar | No usar last-write-wins global; eventos append-only; estados derivados recalculables; conflictos sensibles o de safeguarding requieren revisión verificada. | Tests de operaciones concurrentes y materialización desde historial. |
| TM-014 | Multimedia futura | Fotos/videos filtran víctimas, menores, ubicaciones o saturan sincronización. | Alto | Media | Diferir / feature flag | Redacción, TTL, cuotas offline, moderación, metadatos firmados, consentimiento y política de acceso antes de habilitar. | Tests de feature flag, cuotas, visibilidad, borrado y moderación. |
| TM-015 | Alertas confiables futuras | Fuente no confiable o severidad errónea genera pánico o rutas inseguras. | Crítico | Baja/Media | Diferir / feature flag | Solo proveedores oficiales o explícitamente confiables; procedencia/firma cuando exista; deduplicación; TTL; override humano; auditoría. | Tests de fuente no confiable, duplicados, severidad y bloqueo de push crítico. |
| TM-016 | IA futura | Recomendaciones de IA generan sesgo de autoridad o decisiones inseguras. | Alto | Media | Diferir | MVP con reglas determinísticas; IA solo tras datos de campo, observabilidad, revisión de sesgo/seguridad y override humano. | Revisión de modelo, trazabilidad, comparación con reglas y pruebas de seguridad antes de activar. |
| TM-017 | Adultos desaparecidos futuro | Datos de último avistamiento facilitan acoso, persecución o exposición sensible. | Alto | Media | Diferir / feature flag | Contexto delimitado separado, split público/privado, TTL, rate limits, controles de acceso y logs de auditoría. | Tests de acceso, búsqueda abusiva, TTL y revelado limitado. |
| TM-018 | Logs y auditoría | Logs exponen secretos, ubicaciones exactas o datos privados. | Alto | Media | Mitigar | Auditoría de operaciones críticas sin secretos; minimización de logs; redacción de datos sensibles; revisión de logs. | Revisión de logging y tests de ausencia de secretos/PII sensible. |
| TM-019 | Configuración por incidente | Umbrales o TTL mal configurados crean falsos positivos o decisiones inseguras. | Alto | Media | Mitigar | Configuración regional por incidente, valores seed solo para pruebas de campo, revisión operativa y trazabilidad de cambios. | Tests de configuración, límites mínimos/máximos y cambios auditados. |
| TM-020 | Mapas offline | Mapas o capas desactualizadas inducen rutas peligrosas o mala ubicación. | Medio/Alto | Media | Mitigar | Indicadores visibles de offline/frescura, paquetes por región/incidente, degradación clara y evitar falsa precisión. | Tests de paquetes offline, frescura visible y estado parcialmente sincronizado. |

## Riesgos residuales aceptados o diferidos

| Riesgo | Estado | Racional | Revisión requerida |
|---|---|---|---|
| Recomendaciones hacia zonas peligrosas con advertencias. | Aceptado con preocupación | El producto necesita coordinación operativa, pero los warnings no sustituyen controles duros. | Revisar tras pruebas de campo; considerar bloqueo por rol/riesgo si hay señales de daño. |
| Atestación social manipulable. | Aceptado parcialmente | Aporta señal de campo y prioridad contextual, pero no debe otorgar permisos críticos, credenciales, safeguarding, entrega de menores ni acceso sensible. | Revisar umbrales, rate limits, disputas y detección Sybil. |
| Reunificación real de menores. | Evitado en MVP público | El daño potencial es crítico sin organismo verificador. | Activar solo con protocolo formal, acceso restringido y revisión legal/operativa. |
| Multimedia como evidencia. | Diferido | Eleva privacidad, moderación, coste y sincronización. | Activar solo con feature flag, redacción, cuotas, TTL y moderación. |
| Alertas oficiales automáticas. | Diferido | Una alerta errónea puede causar pánico o rutas inseguras. | Activar solo con fuentes confiables, procedencia, deduplicación y override humano. |
| IA para recomendaciones. | Diferido | Riesgo de sesgo de autoridad sin datos de campo y trazabilidad suficiente. | Requiere observabilidad, evaluación de seguridad y override humano. |

## Backlog de seguridad recomendado

| Prioridad | Acción | Evidencia esperada |
|---|---|---|
| P0 | Definir matriz de permisos por rol y estado de incidente. | Tests que demuestren bloqueo de capacidades críticas sin `org_verified`. |
| P0 | Implementar pruebas de firma, replay, duplicados e idempotencia de outbox. | Suite de sync con operaciones válidas, manipuladas y repetidas. |
| P0 | Definir política mínima de datos sensibles y TTL por entidad. | Tests de expiración y revisión de almacenamiento local/remoto. |
| P0 | Probar reglas de activación de centro con presencia probabilística. | Casos donde GPS solo, identidad nueva o señales sospechosas no activan centros. |
| P1 | Diseñar detección y penalización Sybil por celda/incidente. | Tests de check-ins masivos y atestaciones coordinadas. |
| P1 | Documentar política de riesgo para recomendaciones. | Casos de prueba por rol, zona peligrosa, frescura y confirmación explícita. |
| P1 | Diseñar verificación y deduplicación de mensajes críticos Meshtastic. | Tests de SOS falso, repetido, ACK y prioridad. |
| P2 | Preparar checklist de activación para multimedia, alertas oficiales, IA y adultos desaparecidos. | Feature flags cerrados por defecto y criterios de activación revisables. |

## Preguntas abiertas de seguridad

- ¿Qué organismo o rol operativo podrá otorgar `org_verified` en el primer piloto?
- ¿Qué TTL inicial se aplicará a ubicación, presencia, necesidades, sobrantes, SOS y datos privados?
- ¿Qué umbrales mínimos y máximos por incidente impedirán configuraciones peligrosas?
- ¿Qué condiciones hacen que una zona sea bloqueada para voluntarios generales en vez de solo advertida?
- ¿Qué evidencia se conservará para auditoría sin aumentar riesgo de doxxing o persecución?
- ¿Qué hardware y formato de verificación se usará cuando Meshtastic deje de ser simulado?

## Checklist de revisión antes del MVP

- [ ] GPS por sí solo no activa centros ni presencia de alta confianza.
- [ ] Identidades nuevas y masivas tienen peso operativo limitado.
- [ ] Roles autodeclarados o atestados socialmente no desbloquean permisos críticos, credenciales, safeguarding, entrega de menores ni datos sensibles.
- [ ] No se publica ubicación exacta de menores, terceros o personas vulnerables.
- [ ] Todas las operaciones críticas están firmadas, son idempotentes y auditables.
- [ ] Los datos obsoletos pierden peso y se muestran degradados visualmente.
- [ ] SOS incluye última ubicación conocida, timestamp y radio de precisión, sin falsa profundidad o falsa altitud.
- [ ] Reunificación real de menores permanece deshabilitada sin organismo verificador.
- [ ] Multimedia, alertas oficiales automáticas, IA y adultos desaparecidos permanecen detrás de feature flags.
- [ ] Logs y auditoría no exponen secretos, claves ni datos sensibles innecesarios.


## Delta técnico Slice 8 — observabilidad y controles anti-abuso backend

- Se añadió una taxonomía compartida mínima para eventos operacionales (`operation.processed`, `private_link.attempted`, `rate_limit.checked`, `turnstile.checked`, `security.challenge.required`) con contratos estrictos y sin campos para tokens, fingerprints brutos, payloads, texto libre o coordenadas.
- El backend centraliza auditoría operacional mínima en D1 para seguridad/rate-limit, usando hashes de referencias y metadatos permitidos de baja cardinalidad; no se usa como almacén analítico de payloads.
- Los private links de reunificación mantienen auditoría de intentos minimizada y ahora diferencian `rate_limited` como error estable.
- Turnstile server-side queda preparado para flujos sensibles con rollout seguro: `off`/sin secret degrada sin bloquear local/test, `observe` no rompe el flujo, y `enforce` bloquea cuando falta o falla el challenge.
- Sync push/pull scoped añade rate-limit reutilizable de alta tolerancia por incidente/celda/caller minimizado para reducir abuso sin romper operación normal.
