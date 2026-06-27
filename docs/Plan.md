# Plan de Producto - "Zona Cero"

### App de coordinación ciudadana en respuesta a catástrofes

Fecha: 27.06.2026 · Versión: v0.2 (incorpora el Módulo D de reunificación familiar)

Cambios v0.2: El antiguo "Registro de desaparecidos" se reescribe como Módulo D - Reunificación familiar (niños separados), con su propia sección de diseño y salvaguardas (§6). Se actualizan las secciones de reutilización (§7), fases (§9) y riesgos (§10) en consecuencia.

## 1. Resumen ejecutivo

La idea, destilada de tus notas de voz, es una plataforma móvil que coordina a la sociedad civil que acude a una zona de catástrofe (terremoto, inundación, colapso, conflicto), para resolver un problema central: hoy la ayuda se distribuye a ciegas. Hay 40 personas en un punto y 5 en otro, suministros sobrando en un sitio y agua faltando en el de al lado, y la única comunicación -redes sociales- es demasiado lenta. La propuesta de valor en una frase: un mapa vivo, validado por la propia gente en terreno, *que dirige voluntarios, suministros y rescate a donde de verdad hacen falta.* El concepto se sostiene sobre cinco módulos:

1. Distribución de voluntarios - registro con seudónimo (sin datos personales) y mapa

que muestra dónde sobra y dónde falta gente.

2. Centros de trabajo - puntos creados por la propia gente y validados por consenso de

presencia (estilo Pokémon Go / Waze), con estados pendiente → observación → activo.

3. SOS de rescatista atrapado - alarma con ubicación cuando un voluntario queda bajo

escombros.

4. Reunificación familiar (niños separados) - emparejar de forma privada a quien busca

con quien encontró, sin exponer la identidad del menor.

5. Logística de suministros - emparejar puntos sobreabastecidos con puntos en falta,

despachando a motorizados (modelo Glovo/Deliveroo). Hay dos restricciones críticas que condicionan el diseño y que se tratan en secciones

-----

propias: la conectividad en zona cero (§5) y la seguridad del niño en la reunificación familiar (§6). Ambas son donde es más fácil equivocarse.

## 2. Usuarios y problema que resuelve cada uno

| Usuario | Hoy sufre… | La app le da… |
|---|---|---|
| Voluntario general | No sabe a dónde ir; se colapsa un solo punto | Mapa de dónde falta gente |
| Rescatista / minería de escombros | Trabaja aislado; corre peligro él mismo | SOS y coordinación de relevos |
| Personal médico | No sabe qué centros tienen cobertura sanitaria | Conteo por rol en cada centro |
| Logística / motorizados | Mueve material sin saber el destino correcto | Despacho automático sobrante → faltante |
| Familiar buscando a un niño | Busca en mil grupos; riesgo de que un extraño reclame al niño | Coincidencia privada y reunificación verificada |
| Coordinador / autoridad | No tiene foto en tiempo real del terreno | Datos agregados y vivos |

## 3. Funcionalidades derivadas de los audios → módulos

### Módulo A - Registro y distribución de voluntarios

1. Alta con seudónimo, sin teléfono ni datos personales (clave en contextos de

inestabilidad política, como mencionaste de Venezuela).

2. Registro de rol: rescate, médico, logística, voluntario general.
3. Mapa de calor en vivo: dónde hay saturación y dónde hay déficit.

### Módulo B - Centros de trabajo (el corazón del MVP)

La máquina de estados que describiste, formalizada:

1. Pendiente - un usuario crea el centro al llegar a un punto (edificio, escombros). Queda

-----

latente.

2. Observación - cuando ≥10 personas están físicamente en el punto y registradas.
3. Activo - cuando ≥10 personas llevan ≥1 hora trabajando ahí. El sistema registra

automáticamente a quienes están en el punto y muestra el desglose por rol. El umbral de tiempo y presencia es, además de una señal de actividad real, tu mecanismo anti-sabotaje: nadie crea un centro fantasma con un toque.

### Módulo C - SOS de rescatista atrapado

1. Botón de alarma que difunde ubicación al resto de la red.
2. Nota técnica (§5.3): la "profundidad" bajo escombros no es medible de forma fiable con

*un teléfono. Se reencuadra como "última ubicación + baliza de rescate".*

### Módulo D - Reunificación familiar (niños separados)

1. Un familiar registra que busca, con la identidad completa del niño guardada solo en el

sistema.

2. Quien encuentra a un niño publica únicamente un identificador parcial (nombre +

iniciales de los apellidos, p. ej. "Victoria LL"), sin foto ni ubicación exacta.

3. La coincidencia ocurre cuando el familiar demuestra que ya conoce la identidad

completa.

4. Diseño completo y salvaguardas en §6. Es el módulo más delicado del proyecto.

### Módulo E - Logística de suministros

1. Un usuario con tiempo trabajando en un punto reporta faltantes (material ligero:

guantes, picos, palas; pesado: maquinaria; agua; alimentos).

2. El sistema empareja con puntos sobreabastecidos.
3. Despacho automático a motorizados de logística, estilo reparto (Glovo/Deliveroo).

## 4. Principio de diseño rector

Toda la app gira en torno a una pregunta: ¿a dónde debe ir el siguiente recurso (persona, *agua, máquina) para que sirva más? Cada módulo es una variante del mismo problema de* emparejamiento entre oferta y demanda. Mantener ese hilo conductor evita que el producto se disperse en cinco apps inconexas.

-----

## 5. Restricción crítica I: conectividad en zona cero

En una catástrofe real, la red celular cae o se satura justo cuando más se necesita. Un diseño que asuma 4G/5G estable fallará en el peor momento.

### 5.1 Implicación arquitectónica

La app debe ser offline-first / tolerante a retardo: funciona sin red, guarda local y sincroniza cuando aparezca conectividad. Es el requisito 0.

### 5.2 Opciones de transporte (de menor a mayor resiliencia)

1. Offline-first con sincronización - base local en el móvil + sync al recuperar señal.

Cubre la conectividad intermitente (lo más común).

2. Malla Bluetooth (BLE mesh) - los teléfonos se relevan mensajes entre sí. Existe SDK

(Bridgefy). Límite: ~100 m por salto y mucho consumo de batería.

3. LoRa / Meshtastic - radio de largo alcance (kilómetros) con hardware dedicado; útil

como "columna vertebral" entre coordinadores.

4. SMS / USSD de respaldo - para alertas mínimas cuando solo queda 2G.
5. Satélite - para nodos coordinadores, no para el voluntario medio. Realismo: alcance, batería y velocidad - elige dos. La malla solo funciona con densidad de dispositivos. Por eso el MVP funciona primero en offline-first sencillo, y la malla entra como capa posterior.

### 5.3 Sobre la "profundidad" del rescatista atrapado

1. El GPS no funciona bajo escombros.
2. El barómetro da altitud relativa y poco fiable bajo estructura.
3. Lo factible: última coordenada GPS + delta barométrico + baliza BLE que equipos de

rescate con receptor triangulen por intensidad de señal (RSSI). Eso es "proximidad", no "profundidad exacta". Véndelo como tal.

### 5.4 Presupuesto de batería

Cargar el teléfono en catástrofe es un lujo. GPS y Bluetooth permanentes vacían la batería: muestreo adaptativo, malla solo cuando se necesita, modo de bajo consumo.

-----

6. Restricción crítica II: reunificación de niños separados - diseño y salvaguardas

Este es el módulo más delicado del proyecto. En una catástrofe se separan muchos niños, y ese caos es exactamente el que aprovechan las redes de trata. El diseño debe partir de esa amenaza, no añadirla después.

### 6.1 El principio que lo gobierna todo

La app genera una pista, nunca autoriza la entrega del niño. El "nombre completo + fecha de nacimiento" sirve para encontrar un candidato, pero no es prueba de parentesco: es conocimiento compartido (quien conocía a la familia, o quien se llevó al niño, también puede tenerlo). Por tanto el flujo nunca termina en un encuentro civila-civil. Cierra así:

1. Coincidencia (la app detecta el match).
2. Aviso al familiar que busca.
3. Reunificación presencial verificada - identidad y tutela legal comprobadas por

protección de menores / Cruz Roja, idealmente en un espacio seguro para niños. La app es la puerta de entrada rápida y offline al proceso oficial de reunificación, no un sistema que entrega niños.

### 6.2 Precedente que valida el enfoque

El sistema de referencia mundial es Restoring Family Links (RFL) de la Cruz Roja (Agencia Central de Búsquedas, recogida en los Convenios de Ginebra; presente en +150 países, incluida Venezuela). Dato clave que confirma tu intuición: RFL no publica fotos de menores de 15 años (y de 18 en algunos países) en su buscador público; solo su personal accede a esa galería, y de forma presencial. Tu identificador parcial "Victoria LL", sin foto, es el mismo principio de minimización.

### 6.3 Modelo de datos en dos capas

Capa pública (lista de la app):

1. Solo nombre + iniciales de ambos apellidos ("Victoria LL").
2. Sin foto, sin ubicación exacta, sin identidad de quien lo registró. Capa privada (sistema, cifrada y con control de acceso):

-----

1. Apellidos completos, fecha de nacimiento, descripción física, ubicación precisa,

identidad del registrante.

2. Accesible solo para el motor de coincidencia y para personal verificado.

### 6.4 Mecanismo de coincidencia (estilo commit-reveal / búsqueda ciega)

1. El familiar demuestra conocimiento previo introduciendo la identidad completa

(nombre + apellidos + fecha de nacimiento).

2. Si coincide con un registro de la capa privada, el sistema revela solo a esa persona: el

estado "registrado como encontrado", una ubicación aproximada y el canal de reunificación verificada.

3. No se exponen los datos crudos ni la identidad de quien encontró al niño. Límites conocidos (por eso el paso 3 del §6.1 es presencial):
1. Nombres comunes → falsos positivos.
2. Conocimiento compartido → no equivale a tutela.

### 6.5 Salvaguardas adicionales

1. Caducidad automática de los registros (como RFL y el estándar PFIF), por privacidad

del menor.

2. Registro de auditoría: quién creó y quién intentó reclamar cada ficha.
3. Límite de intentos de reclamación, para detectar a quien "pesca" niños probando

nombres.

4. Fotos como RFL: nunca públicas para menores; solo accesibles a personal verificado.
5. Origen de confianza: priorizar que los niños encontrados se registren desde un puesto

médico o espacio seguro, no como hallazgo suelto.

6. Para niños que hablan: que un adulto de confianza registre el nombre y el de sus

padres según el propio niño. Para preverbales: campos de descripción física en la capa privada.

## 7. No reinventar la rueda: reutilizar lo que ya existe

Reutilizar piezas abiertas ahorra meses y, sobre todo, da interoperabilidad con la respuesta oficial:

-----

1. Reunificación de niños → Cruz Roja RFL / Trace the Face, con el estándar PFIF para

intercambiar registros. La app actúa como front-end rápido y offline que alimenta el pipeline oficial (con su capacidad real de verificación y reunificación), en lugar de operar como sistema paralelo no verificado. Esta es la pieza con mayor carga legal y de *seguridad; ver §6.*

2. Personas desaparecidas en general (adultos) → Google Person Finder / PFIF

(código abierto, +40 idiomas, API pensada para que distintos registros se hablen entre sí).

3. Malla offline → SDK de Bridgefy o referencias de Meshtastic, en vez de implementar

un protocolo de malla seguro desde cero.

4. Mapas → OpenStreetMap con tiles cacheados para uso offline. Regla: construye solo tu diferenciador (centros de trabajo validados por presencia, logística de emparejamiento y el front-end de coincidencia privada). Lo demás, ensámblalo.

## 8. Arquitectura propuesta (alto nivel)

1. App móvil multiplataforma con almacenamiento local (offline-first). Candidatos: Flutter

o React Native (acceso nativo a BLE/GPS).

2. Backend ligero (encaja con tu experiencia en Flask): FastAPI o Flask + PostgreSQL con

PostGIS para lo geoespacial.

3. Motor de estados de centros de trabajo - valida presencia (geocerca) × tiempo.
4. Capa de sincronización - resuelve conflictos en ediciones offline (last-write-wins o

CRDT según criticidad).

5. Módulo de reunificación con cifrado y control de acceso para la capa privada, e

integración PFIF/RFL.

## 9. Fases y MVP

1. MVP (Fase 1) - el diferenciador puro. Check-in con seudónimo + creación y

validación de centros de trabajo + mapa vivo de dónde falta gente. Prototipo HTML ya *entregado.*

2. Fase 2 - Logística de suministros. Emparejamiento sobrante → faltante y despacho a

motorizados.

-----

3. Fase 3 - Resiliencia. Malla BLE / offline robusto + SOS de rescatista.
4. Fase 4 - Reunificación familiar. No es una simple "integración de PFIF": requiere el

flujo de verificación presencial (§6) y un acuerdo con Cruz Roja / protección de menores antes de operar. Trátese como un proyecto con su propia gobernanza, no como una pantalla más.

## 10. Riesgos y decisiones críticas

1. Conectividad (§5) - la decisión técnica más determinante.
2. Seguridad del niño en la reunificación (§6) - riesgo de trata si el diseño permite

reclamar a un menor sin verificación. Mitigación: la app es pista, no entrega; cierre presencial verificado; alineación con RFL.

3. Seguridad de los voluntarios. Los datos de ubicación pueden ser peligrosos en

contextos políticamente inestables. Seudónimo y minimización de datos van en la dirección correcta.

4. Anti-sabotaje con seudonimato. Umbrales de presencia ayudan; pensar resistencia a

ataques tipo Sybil.

5. Responsabilidad / seguridad física. Dirigir civiles no entrenados a escombros es

peligroso. El diseño coordina y alimenta a las estructuras oficiales de rescate, no empuja a gente no capacitada a edificios inestables.

6. Complementar, no competir con Protección Civil / Cruz Roja / bomberos. La app gana

si los datos fluyen hacia (y desde) la respuesta oficial.

## 11. Próximos entregables posibles

1. Prototipar las pantallas del Módulo D (lista pública "Victoria LL" + búsqueda que revela

solo al familiar + pantalla de "reunificación verificada").

2. Diseñar el modelo de datos y la lógica de sincronización offline que hay detrás del

MVP.

3. Bocetar el SOS de rescatista (Módulo C).
4. Diseñar la logística de suministros (Módulo E).

-----

```text

```