# CHANGELOG

## Revisión del 2026-06-20 (continuación 2) — Inspector visual de burbujas

Los números de densidad que el usuario compartió (todos entre 0.00 y 0.10, sin ningún pico claro en ninguna variable, incluso en burbujas que debían estar claramente marcadas) apuntan a algo más profundo que la contaminación por el borde: el sistema probablemente no está midiendo donde realmente está la marca, sino papel en blanco cercano — lo más compatible con un desajuste de calibración/escala en la imagen de prueba (dibujada a mano en Paint, no escaneada ni impresa).

En vez de seguir diagnosticando a ciegas con números, se construyó la herramienta definitiva: un **Inspector de burbujas** que muestra, para cada opción de cada variable de un paciente, un recorte ampliado de la imagen real con un recuadro superpuesto mostrando exactamente qué región se midió (verde si se consideró marcada, rojo si no). Si ese recuadro cae sobre papel en blanco en vez de sobre el círculo real, el desajuste de calibración queda confirmado a simple vista, sin inferencias.

**Qué se hizo**:
- `detection.js`: `analyzeRegion()` ahora también devuelve `fullRectPx` (la burbuja completa en píxeles reales) y `sampledRectPx` (la región interior efectivamente analizada), y estos viajan en cada `detail` de los resultados.
- `service.js`: cada registro/paciente conserva sus imágenes originales (`record.sourceImages`) y cada resultado lleva su número de página (`result.page`), para poder construir los recortes en cualquier momento posterior al procesamiento.
- `view.js`: nuevo panel "🔍 Inspector de burbujas", accesible con un botón junto al nombre de cada paciente en la tabla de resultados. Dibuja, para cada opción, un recorte ampliado (con un margen de papel alrededor para dar contexto) y el recuadro de la región medida superpuesto.

**Cómo usarlo**: en la tabla de resultados, hacer clic en el ícono 🔍 junto al nombre de cualquier paciente ya procesado.

**Mejora adicional**: al cargar las imágenes (antes de procesar), se compara la proporción ancho/alto de cada imagen contra la de una hoja A4 (210×297mm). Si difiere más de un 12%, se avisa de inmediato — esto es exactamente el tipo de problema que el usuario sospechaba ("discordancia entre el fichero de metadatos y la imagen"): una imagen recortada/redimensionada no tiene la proporción de la hoja completa, lo que rompe el supuesto de la calibración de respaldo (cuando no se detectan las marcas de registro).

**Archivos**: `js/features/omr-reader/detection.js`, `js/features/omr-reader/service.js`, `js/features/omr-reader/view.js`, `js/features/omr-reader/controller.js`, `smoke-test-batch-ui.mjs`, `tests/batch-processing.test.js`.

**Limitación honesta**: el cálculo geométrico del recorte se verificó por revisión de código y mediante el script de humo (que confirma que el panel se abre/cierra correctamente y no lanza excepciones), pero el resultado VISUAL final (si el recuadro realmente cae sobre la burbuja o no) solo puede confirmarse en un navegador real con una imagen real — jsdom no implementa Canvas de verdad. Esta herramienta está pensada precisamente para que el usuario pueda confirmar esto por sí mismo, con sus propios ojos, en su propio navegador.

---

## Revisión del 2026-06-20 (continuación) — el borde de la burbuja contaminaba la medición

Después de la corrección anterior (texto separado de la burbuja), el usuario reportó que el problema seguía ocurriendo: la burbuja **sin marcar** (blanca) aparecía como la detectada, y la burbuja **marcada** (oscura) aparecía como no detectada — visible en los recuadros verde/rojo de la vista de depuración.

**Causa raíz encontrada**: el borde impreso de cualquier burbuja (un círculo negro de ~1.3pt de grosor) ocupa, por sí solo, **entre el 25% y el 30% del área total de la burbuja** — exactamente igual en una burbuja marcada que en una sin marcar, porque ambas tienen ese mismo borde impreso. `analyzeRegion()` media la densidad de tinta sobre el **área completa** de la burbuja (círculo + borde), así que esa "densidad base" del borde:

- Hace que una burbuja **sin marcar** ya tenga una densidad considerable (~0.25-0.30) solo por su borde, no por estar vacía.
- Si la marca a mano de la persona no es un relleno perfecto y sólido (un check, una X, un sombreado parcial, una marca con un lápiz claro), la densidad añadida por la marca real puede no superar con margen a esa densidad base del borde.
- Combinado con cualquier pequeño desajuste de calibración (la imagen de prueba no es un escaneo físico real), esto puede hacer que la burbuja **sin marcar** termine midiendo una densidad igual o mayor que la marcada, invirtiendo el resultado.

**Qué se hizo**: `analyzeRegion()` ya no mide el área completa de la burbuja — recorta un 16% hacia el interior desde cada lado antes de medir (`INK_SAMPLE_INSET_RATIO`), analizando casi exclusivamente el **interior** de la burbuja, donde el papel está blanco si no se marcó y oscuro si sí, sin la interferencia del borde impreso (que es idéntico en ambos casos y no aporta ninguna información útil para decidir cuál fue marcada).

**Mejora adicional de diagnóstico**: la tabla de resultados ahora muestra, **de forma siempre visible** (no solo al pasar el mouse — un screenshot no captura tooltips), la densidad de tinta medida en cada opción de cada variable, y si la calibración de esa página detectó las marcas de registro o usó una escala de respaldo. Esto permite diagnosticar cualquier lectura inesperada con números concretos en una futura captura de pantalla, en vez de tener que inferirlo de los colores verde/rojo.

**Verificación**: se agregó una prueba que confirma explícitamente que la región analizada por `analyzeRegion()` es más chica que la burbuja completa y queda centrada dentro de ella (`tests/omr-reader.test.js`). Las pruebas de integración existentes (que ya simulaban burbujas marcadas/sin marcar) se actualizaron para verificar coincidencia por centro del rectángulo consultado en vez de por esquina exacta, ya que ahora ese rectángulo es más chico que la burbuja nominal.

**Pendiente de confirmar con el usuario**: esta corrección aborda una causa raíz real y bien fundamentada (la contaminación del borde), pero no fue posible reproducir el escenario exacto del usuario con una imagen real escaneada — solo con datos sintéticos. Si el problema persiste, los nuevos números de densidad visibles en la tabla deberían permitir diagnosticar con precisión si la causa restante es una marca a mano muy tenue, un desajuste de calibración, o algo distinto.

**Archivos**: `js/features/omr-reader/detection.js`, `js/features/omr-reader/view.js`, `tests/omr-reader.test.js`, `tests/integration.test.js`.

---

## Revisión del 2026-06-19 / 2026-06-20 — bug crítico de detección + procesamiento por lotes

### 🔴 Bug crítico: el Lector OMR podía detectar la categoría "complementaria" a la marcada

**Reportado por el usuario**: en variables dicotómicas era muy visible — al marcar a mano una opción en el papel, el Lector terminaba señalando la otra. En el resto de variables (con más de 2 categorías) también había imprecisiones.

**Causa raíz**: en `core/render-page.js`, el nombre completo de cada categoría (p. ej. "Masculino") se imprimía **dentro de su propia burbuja**, que solo mide 5mm de diámetro. Como el texto es mucho más ancho que la burbuja, se desbordaba visualmente hacia la derecha — sobre la burbuja de la opción **vecina**. El Lector OMR mide qué tan oscura está cada burbuja para decidir cuál fue marcada; si el texto de "Masculino" se derramaba sobre el área de "Femenino", esa segunda burbuja medía más tinta de la que realmente tenía, y podía terminar "ganando" la comparación aunque nadie la hubiera marcado a mano.

**Qué se hizo**: se separó completamente la burbuja (un círculo limpio, sin texto dentro) del texto legible de la categoría (que ahora vive en su propio recuadro, `labelBox`, calculado por `core/layout-engine.js` para que nunca se superponga con ninguna burbuja de la misma variable, sin importar qué tan largo sea el nombre de la categoría). Las burbujas de **dígitos** (variables cuantitativas) no se tocaron — un solo carácter ("0"–"9") no genera este problema.

**Verificación**: se agregaron pruebas geométricas que comprueban que ningún `labelBox` se superpone con ninguna burbuja vecina (`tests/layout-engine.test.js`), y una prueba de integración de extremo a extremo que compila un formulario real, simula una imagen donde **solo** una burbuja específica está oscura, y confirma que el detector identifica exactamente esa opción — nunca la complementaria (`tests/integration.test.js`).

**Archivos**: `js/core/layout-engine.js`, `js/core/render-page.js`.

---

### 🟠 Bug adicional encontrado durante la auditoría final: desalineación de densidades si una opción no tiene coordenadas

En `omr-reader/detection.js`, si una opción de una variable no tenía `boundingBox` (un `.omr` corrupto o de una versión futura incompleta), el código anterior saltaba esa opción al construir el array de densidades, pero luego volvía a indexar ese array con la posición ORIGINAL del array de opciones — desalineando todas las densidades posteriores a la opción faltante, atribuyendo la densidad de una burbuja a la opción equivocada. Se corrigió ligando cada densidad directamente a su propia opción (sin indexación posicional). Ver `tests/omr-reader.test.js`.

---

### 🟠 Salvaguarda adicional: una sola variable categórica no puede desbordar el borde inferior de la página

Encontrado también en la auditoría final: si una variable categórica tiene una cantidad extrema de categorías (40-60+), el bloque que genera puede necesitar más altura que la disponible en **cualquier** página, sin que nada lo detectara — se desbordaba por el borde inferior. Ahora `computeLayout` rechaza explícitamente ese caso con un mensaje claro. Ver `tests/layout-engine.test.js`.

---

### ✨ Nuevo: procesamiento por lotes (múltiples pacientes en una sola sesión)

A pedido del usuario, el Lector OMR ahora soporta procesar varios pacientes de una sola vez, donde **cada paciente se convierte en una fila** al exportar:

- Si se sube exactamente la cantidad de imágenes que la plantilla espera por paciente (lo de siempre), se obtiene 1 registro — **sin cambios de comportamiento** para el caso de un solo paciente.
- Si se sube un **múltiplo exacto** de esa cantidad, las imágenes se agrupan en pacientes consecutivos (ordenadas por nombre de archivo, con orden natural: "img2" antes que "img10") y cada grupo se procesa de forma independiente.
- Si la cantidad subida no es un múltiplo exacto, se rechaza con un mensaje claro en vez de emparejar páginas a ciegas.
- Cada clic en "Procesar" **agrega** pacientes nuevos a los ya procesados (no los reemplaza) — se puede seguir cargando y procesando más pacientes más tarde en la misma sesión. "Reiniciar todo" sí limpia todo.
- Se agregó un botón "📁 Cargar carpeta" (usa el atributo `webkitdirectory`, soportado en Chrome/Edge; en navegadores sin soporte simplemente no aparecen archivos y se puede seguir usando el selector múltiple de siempre, que no se quitó).
- CSV/JSON exportan ahora con una fila por paciente.

**Alcance honesto**: el orden de los pacientes/páginas se basa en el nombre de archivo, no en el contenido de la imagen — no hay ningún mecanismo (OCR, código de barras) que confirme automáticamente que la página N realmente corresponde al paciente que se cree. Esto se documenta explícitamente en la interfaz.

**Archivos**: `js/features/omr-reader/service.js`, `tests/batch-processing.test.js`.

---

### ✨ Nuevo: corrección manual desde la propia interfaz (revisión manual real, no solo un aviso)

Antes, una celda marcada como "necesita revisión" solo mostraba una advertencia de texto — no había ninguna forma de corregirla sin editar el CSV/JSON exportado a mano. Ahora:

- Cada celda de la tabla de resultados tiene un botón ✎ que la convierte en un campo de texto editable (Enter o perder el foco guarda; Escape cancela).
- Una corrección manual queda marcada como "✎ manual" y tiene prioridad sobre el valor detectado automáticamente, tanto en la tabla como en la exportación JSON/CSV. El JSON exportado indica explícitamente, por cada campo, si el valor es `"source": "manual"` o `"source": "auto"`.
- Un botón ↩ permite deshacer una corrección y volver al valor detectado automáticamente.
- Un resumen agregado ("⚠ N celdas pendientes de revisión de M en total") permite ver de un vistazo cuánto trabajo de revisión queda, a través de todos los pacientes procesados en la sesión.

**Archivos**: `js/features/omr-reader/service.js`, `js/features/omr-reader/view.js`, `js/features/omr-reader/controller.js`, `js/features/omr-reader/validation.js`.

---

### Verificación de esta revisión

Se agregaron 4 archivos de prueba nuevos/reescritos (`tests/integration.test.js`, `tests/batch-processing.test.js`, y ampliaciones a `tests/layout-engine.test.js`/`tests/omr-reader.test.js`), más dos scripts de humo manuales sobre DOM real con jsdom: `smoke-test.mjs` (flujo de un solo paciente, incluida la verificación visual de que el texto de categoría ya no está dentro de la burbuja) y `smoke-test-batch-ui.mjs` (flujo completo de lote: procesar, editar una celda con clics y teclado reales, deshacer, agregar un segundo lote, reiniciar). Total: 61 pruebas automatizadas + 2 scripts de humo, todos en verde.

---

## Revisión del 2026-06-19

Esta revisión partió de una auditoría crítica del código (no solo de la documentación, que en varios puntos afirmaba cosas que el código no hacía). A continuación, cada hallazgo con su severidad, qué se hizo, y en qué archivo(s).

Severidad: 🔴 Crítico · 🟠 Alto · 🟡 Medio · 🔵 Bajo/mejora

---

## 🔴 Problema central: tres fuentes independientes de geometría

**Antes**: `form-compiler/view.js`, `printer/service.js` y `omr-exporter/service.js` calculaban, cada uno por su cuenta, la posición de cada burbuja — con constantes distintas (`BUBBLE_GAP_MM * 9`, `* 3`, `* 2`, `* 1.8` en el exportador; alturas estimadas en píxeles en el compilador; flexbox del navegador en la impresión). Nada garantizaba que esos tres cálculos coincidieran.

**Consecuencia demostrable**: una variable Politómica/Ordinal con 7 o más categorías generaba coordenadas en el `.omr` que caían fuera del borde físico de una hoja A4 (212mm en una hoja de 210mm de ancho).

**Qué se hizo**:
- Se creó `js/core/layout-engine.js` como única fuente de verdad: calcula, para cada variable, su bloque (altura, página) y cada una de sus burbujas (bounding box en mm), incluyendo el ajuste de filas para categorías que no entran en una sola línea.
- Se creó `js/core/render-page.js`, un renderizador único que tanto `form-compiler/view.js` (pantalla) como `printer/service.js` (impresión) consumen, usando posicionamiento absoluto en milímetros (`position:absolute; left:Xmm; top:Ymm`) en vez de depender del flujo de flexbox del navegador.
- `omr-exporter/service.js` ya no calcula nada: serializa directamente las cajas que ya calculó el layout-engine para el mismo `compiledForm`.
- Se eliminó la rama de código duplicada/inalcanzable que existía en el antiguo `omr-exporter/service.js` (un segundo `else if (block.type.includes('Cuantitativa'))` que nunca se ejecutaba).

**Verificación**: `tests/layout-engine.test.js` y `tests/omr-exporter.test.js` ahora afirman explícitamente que ninguna burbuja cae fuera de los límites de la página, y que las coordenadas exportadas son idénticas a las del layout-engine. `smoke-test.mjs` reproduce el caso de 9 categorías de punta a punta.

**Archivos**: `js/core/layout-engine.js` (nuevo), `js/core/render-page.js` (nuevo), `js/features/form-compiler/service.js`, `js/features/form-compiler/view.js`, `js/features/printer/service.js`, `js/features/omr-exporter/service.js`.

---

## 🔴 Límite de dígitos/decimales silencioso

**Antes**: `form-compiler/view.js` y `printer/service.js` calculaban `digits = maxValue > 99 ? 3 : 2` de forma independiente, truncando en silencio cualquier rango mayor a 999, y tratando las variables `Cuantitativa Continua` exactamente igual que las discretas (`parseInt` descartaba cualquier decimal).

**Qué se hizo**: `layout-engine.js` define `MAX_INT_DIGITS = 4` y `MAX_DEC_DIGITS = 2` como techos explícitos. Si un rango los excede, `computeLayout` devuelve un error legible y `compileForm` lanza una excepción con el nombre de la variable y el motivo, en vez de truncar. Las variables Continua ahora reservan un decimal por defecto (configurable con el nuevo campo opcional `metadata.decimals`, documentado en `docs/CLINICAL-FORMAT.md`).

**Archivos**: `js/core/layout-engine.js`, `js/features/importer/validator.js` (rechaza en el import el mismo caso), `tests/layout-engine.test.js`.

---

## 🔴 `sanitize.js` escrito pero nunca usado (XSS en 4 vistas)

**Antes**: `js/core/sanitize.js` tenía `escapeHTML()`/`sanitizeObject()` bien implementados, pero ninguna otra parte del código los importaba. `preview/view.js`, `form-compiler/view.js`, `printer/service.js` y `omr-reader/view.js` interpolaban directamente texto del `.clinical` (nombre de proyecto, pregunta, etiqueta de categoría, unidad) en `innerHTML`/`document.write` sin escapar.

**Qué se hizo**: se importó `escapeHTML` en las 4 vistas y en el nuevo `render-page.js`, envolviendo cada interpolación de datos provenientes del archivo importado.

**Adicional**: `printer/service.js` abría ventanas con `window.open` sin aislar `opener` — se corrigió anulando `printWindow.opener` después de abrir la ventana (no se usó el flag `noopener` de `window.open` porque, por especificación, eso hace que la función devuelva `null`, y entonces no se podría escribir el HTML dentro).

**Archivos**: `js/core/notifications.js` (también escapa el mensaje mostrado), `js/features/preview/view.js`, `js/features/form-compiler/view.js`, `js/features/printer/service.js`, `js/features/omr-reader/view.js`.

---

## 🔴 Fuga de event listeners en el OMR Reader

**Antes**: `omr-reader/controller.js` agregaba un listener delegado (`this.container.addEventListener('click', ...)`) cada vez que se llamaba `bindEvents()` — y eso ocurría en cada visita al paso "Lector OMR" y en cada `resetAll()`. Como el contenedor nunca se recreaba, los listeners se acumulaban: visitar el paso 3 veces hacía que un clic en "Exportar JSON" descargara el archivo 3 veces.

**Qué se hizo**: se separó `bindContainerEventsOnce()` (se ejecuta una sola vez por instancia del controlador) de `bindFormEvents()` (se reasigna en cada render, de forma segura, porque apunta a elementos recién creados).

**Archivos**: `js/features/omr-reader/controller.js`.

---

## 🟠 `pxPerMm` fijo (solo válido a 96dpi exactos)

**Antes**: `omr-reader/detection.js` convertía mm→px con una constante fija `3.78`, correcta únicamente si la imagen subida era exactamente una página A4 a 96dpi sin recorte. Cualquier escaneo a 200/300/600dpi (lo habitual) rompía la correspondencia entre las coordenadas del `.omr` y la imagen real.

**Qué se hizo**: se creó `js/features/omr-reader/calibration.js`, que busca el centroide de las 4 marcas de registro impresas en cada página y deriva de ahí la escala y el desplazamiento reales de esa imagen específica. Si no se detectan con confianza suficiente, se usa una escala de respaldo basada en el tamaño de la imagen y el resultado se marca para revisión manual (`validation.js` añade una advertencia visible).

**Alcance honesto**: esto corrige diferencias de DPI y pequeños desplazamientos de recorte, **no** corrige inclinación/rotación del escaneo — eso sigue pendiente (ver `docs/OMR-ROADMAP.md`).

**Archivos**: `js/features/omr-reader/calibration.js` (nuevo), `js/features/omr-reader/detection.js`, `js/features/omr-reader/service.js`, `js/features/omr-reader/validation.js`.

---

## 🟠 La vista de depuración del OMR Reader nunca dibujaba nada

**Antes**: `detection.js` nunca incluía el `boundingBox` de cada opción en los resultados (`results.push({ label, density, isSelected })`), así que `view.js → drawBoundingBoxes()` siempre encontraba `bbox` indefinido y no dibujaba ningún recuadro — pese a estar documentada como funcionalidad disponible ("verde = detectado, rojo = no detectado").

**Qué se hizo**: cada resultado ahora incluye su propio `boundingBox`, y `drawBoundingBoxes` recibe la calibración real de la imagen para dibujar en el lugar correcto.

**Archivos**: `js/features/omr-reader/detection.js`, `js/features/omr-reader/view.js`, `js/features/omr-reader/controller.js`.

---

## 🟠 El botón "Volver a Impresión" del Lector OMR nunca funcionaba

**Antes**: `printer/view.js` intentaba conectar `#omr-back-btn` con `document.getElementById(...)` en el momento en que el paso de impresión se inicializa — pero ese botón vive dentro de la vista del OMR Reader, que `main.js` inicializa **después** del Printer en el arranque de la app. El elemento no existía todavía, así que la condición `if (omrBackBtn)` se saltaba en silencio.

**Qué se hizo**: se eliminó esa búsqueda cruzada entre features y se conectó el botón directamente en `omr-reader/controller.js`, donde el elemento realmente vive y se recrea en cada render.

**Archivos**: `js/features/printer/view.js`, `js/features/omr-reader/controller.js`.

---

## 🟠 Normalización de nombres eliminaba tildes/ñ en vez de transliterarlas

**Antes**: `importer/service.js` usaba `.replace(/[^a-z0-9_]/g, '')`, que **elimina** cualquier carácter no ASCII. "tensión" se convertía en "tensin"; "niño" en "nio".

**Qué se hizo**: se normaliza con Unicode NFD y se eliminan solo las marcas diacríticas, conservando la letra base (`"tensión".normalize('NFD').replace(/[\u0300-\u036f]/g, '')` → `"tension"`).

**Archivos**: `js/features/importer/service.js`.

---

## 🟠 Nombres de variable duplicados (incluso creados por la propia normalización)

**Antes**: no había ninguna verificación de unicidad. Dos variables con el mismo nombre — o que terminaban siendo iguales después de normalizar tildes/mayúsculas (p. ej. "edad" y "Édad") — pisaban silenciosamente los datos de la primera en cualquier estructura indexada por nombre.

**Qué se hizo**: `validator.js` rechaza nombres duplicados en el archivo original; `importer/service.js` además detecta colisiones creadas por la propia normalización y las rechaza con un mensaje específico.

**Archivos**: `js/features/importer/validator.js`, `js/features/importer/service.js`.

---

## 🟠 `parseClinicalFile` descartaba los errores detallados

**Antes**: devolvía `null` ante cualquier fallo, sin exponer los errores que el validador ya había calculado. El usuario solo veía "archivo inválido o corrupto" sin ninguna pista.

**Qué se hizo**: ahora devuelve `{ data, errors }`; el controlador muestra hasta 4 errores concretos (con un contador si hay más).

**Archivos**: `js/features/importer/service.js`, `js/features/importer/controller.js`.

---

## 🟡 Rangos con notación científica o texto generaban formularios imposibles

**Antes**: un valor como `"1e10"` pasaba `parseFloat()` sin ser `NaN`, y terminaba generando miles de columnas de dígitos.

**Qué se hizo**: el validador exige notación decimal simple (`^-?\d+(\.\d+)?$`) en `range.min`/`range.max`.

**Archivos**: `js/features/importer/validator.js`.

---

## 🟡 Sistema centralizado de notificaciones, nunca conectado

**Antes**: `core/notifications.js` exportaba `showNotification`/`notify`, pero ningún archivo los importaba; la única referencia (`window.showNotification` en el importador) nunca se asignaba en ningún lado, así que esa condición siempre era falsa. Cada feature mostraba sus propios avisos ad-hoc, y había 6 usos de `alert()`/`confirm()`-style nativo repartidos en `importer`, `printer` (×3) y `omr-reader` (×2), contradiciendo la regla explícita de `AGENT-GUIDE.md`.

**Qué se hizo**: se importa `notify` directamente en cada controller/service que necesita avisar algo; se eliminaron todos los `alert()`.

**Archivos**: `js/core/notifications.js`, `js/features/importer/controller.js`, `js/features/form-compiler/controller.js`, `js/features/printer/controller.js`, `js/features/printer/service.js`, `js/features/omr-exporter/service.js`, `js/features/omr-reader/controller.js`.

---

## 🟡 UI del OMR Exporter, nunca montada (y potencialmente conflictiva)

**Antes**: `omr-exporter/controller.js`/`view.js` exportaban `initOMRExporter()`/`showOMRExporter()`, pensados para un paso propio del wizard que `main.js` nunca llegó a registrar. Si alguna vez se hubiera llamado, además, habría sobrescrito `#step-omr` — el mismo contenedor que usa el OMR Reader.

**Qué se hizo**: se eliminaron esos dos archivos. `omr-exporter/` ahora solo tiene `service.js`, reutilizado desde el botón "Exportar Plantilla .omr" del paso de impresión (que es como ya se usaba en la práctica).

**Archivos eliminados**: `js/features/omr-exporter/controller.js`, `js/features/omr-exporter/view.js`.

---

## 🟡 Altura de bloque "Ordinal" no escalaba con la cantidad de categorías

**Antes**: el código viejo daba a "Nominal Politómica" una altura proporcional a su número de categorías, pero "Ordinal" (estructuralmente la misma clase de control) se quedaba con una altura fija — riesgo de desborde con escalas Likert largas.

**Qué se hizo**: como ambos tipos pasan por la misma función `layoutCategorical()` del layout-engine, este problema queda resuelto estructuralmente — ya no hay un camino de código separado para Ordinal.

**Archivos**: `js/core/layout-engine.js`. Cubierto explícitamente por un test (`tests/layout-engine.test.js`, "lo mismo debe cumplirse con un Ordinal...").

---

## 🟡 CSV exportado sin escapar comas/comillas

**Antes**: tanto el CSV original de VarOps como el de `omr-reader/service.js → exportToCSV()` construían el archivo con `join(',')` directo, sin comillas — un valor con coma desalineaba las columnas.

**Qué se hizo**: se añadió escape RFC-4180 básico (comillas dobles cuando el valor contiene coma, comilla o salto de línea) y un BOM UTF-8 para que Excel detecte tildes/ñ correctamente.

**Archivos**: `js/features/omr-reader/service.js`.

---

## 🟡 Nombres de archivo de descarga sin sanitizar

**Antes**: `OMR_${project.name}.csv` podía incluir caracteres no válidos en algunos sistemas de archivos.

**Qué se hizo**: se creó `js/core/filename.js` (`safeFileName`) y se aplicó en todas las descargas (`.omr`, `.json`, `.csv`).

**Archivos**: `js/core/filename.js` (nuevo), `js/features/omr-exporter/service.js`, `js/features/omr-reader/service.js`.

---

## 🟡 Falso positivo en preguntas sin marcar

**Antes**: el umbral adaptativo siempre forzaba una separación entre las densidades observadas, incluso cuando todas eran ruido bajo (pregunta en blanco), pudiendo marcar como "seleccionada" la opción con más ruido relativo.

**Qué se hizo**: se añadió un piso absoluto de densidad de tinta (`MIN_INK_DENSITY = 0.08`) independiente del umbral relativo — una burbuja solo puede marcarse seleccionada si supera ambos.

**Archivos**: `js/features/omr-reader/detection.js`. Cubierto por test (`tests/omr-reader.test.js`).

---

## 🔵 Sin validación de orden/cantidad de páginas escaneadas

**Antes**: las imágenes subidas se asignaban a páginas por orden de subida, sin ninguna verificación.

**Qué se hizo**: se compara la cantidad de imágenes subidas contra la cantidad de páginas que espera la plantilla `.omr`, y se avisa si no coinciden (no bloquea el procesamiento, porque el orden real no se puede verificar automáticamente sin OCR — ver `docs/OMR-ROADMAP.md`).

**Archivos**: `js/features/omr-reader/controller.js`.

---

## 🔵 Etiquetas de navegación en inglés/mal capitalizadas

**Antes**: `main.js` generaba la etiqueta de cada paso capitalizando el slug interno (`"omr"` → `"Omr"`, `"adjust"` → `"Adjust"`).

**Qué se hizo**: se añadió un diccionario `STEP_LABELS` con los nombres correctos en español.

**Archivos**: `js/main.js`.

---

## 🔵 `new OMRDetector(0.12)` no hacía nada

**Antes**: el constructor solo reconoce `'adaptive'`/`'fixed'` o instancias de estrategia; pasar un número se ignoraba silenciosamente y siempre se usaba la estrategia adaptativa.

**Qué se hizo**: se corrigió la llamada a `new OMRDetector('adaptive')`, y se documentó/probó explícitamente el comportamiento de fallback para que sea intencional, no accidental.

**Archivos**: `js/features/omr-reader/service.js`, `tests/omr-reader.test.js`.

---

## 🔵 `getFriendlySummary` calculado pero nunca mostrado

**Antes**: `validation.js` exportaba un resumen amigable que ningún controller llamaba.

**Qué se hizo**: se usa en `omr-reader/controller.js` para mostrar un mensaje de éxito/advertencia agregado tras procesar el formulario.

**Archivos**: `js/features/omr-reader/controller.js`.

---

## Pruebas

- **Antes**: 19 tests, mayormente *smoke tests* ("¿la función existe?", "¿no lanza una excepción?"). Ninguno verificaba coordenadas reales, por lo que el bug central de esta revisión nunca fue detectado.
- **Ahora**: 39 tests. Los nuevos (`tests/layout-engine.test.js`, reescritura de `tests/omr-exporter.test.js` y `tests/omr-reader.test.js`) afirman explícitamente propiedades geométricas concretas: ninguna burbuja fuera de los límites de la página, las coordenadas exportadas coinciden exactamente con las del layout-engine, los rangos irrepresentables se rechazan, etc.
- Además, se incluye `smoke-test.mjs` (no forma parte de `npm test`/Vitest) como prueba de extremo a extremo manual sobre un DOM simulado con jsdom: importar → compilar → imprimir → exportar `.omr`, incluyendo los casos de tildes/ñ y de una variable con 9 categorías.

---

## Lo que NO se tocó (alcance honesto)

- No se implementó corrección de inclinación/rotación del escaneo (deskew real). La calibración nueva corrige escala y desplazamiento, no rotación. Ver `docs/OMR-ROADMAP.md`.
- No se añadió backend, cifrado de datos en reposo, ni auditoría/trazabilidad clínica.
- No se validó el Lector OMR contra escaneos físicos reales (este entorno de desarrollo no lo permite); las correcciones de calibración están razonadas y probadas con datos sintéticos, pero deberían validarse contra papel real antes de cualquier uso clínico.
