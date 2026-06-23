# Clinical OMR Suite

**Compilador determinista de formularios clínicos imprimibles y escaneables**

Aplicación web 100% Vanilla JavaScript para generar formularios clínicos a partir de archivos `.clinical` (generados por VarOps) y leerlos mediante escaneo OMR.

---

## 📖 Documentación Principal

| Documento | Propósito |
|-----------|---------|
| [`AGENT-GUIDE.md`](AGENT-GUIDE.md) | **Guía obligatoria** para cualquier agente que tome el proyecto |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura, capas y reglas de extensibilidad |
| [`docs/OMR-ROADMAP.md`](docs/OMR-ROADMAP.md) | Mejoras futuras del Lector OMR |
| [`docs/CURRENT-STATUS.md`](docs/CURRENT-STATUS.md) | Estado actual del proyecto |

---

## 🚀 Inicio Rápido

1. Abre la carpeta en **Visual Studio Code**
2. Instala la extensión **Live Server**
3. Clic derecho en `index.html` → **Open with Live Server**

---

## ✨ Características Principales

- Importación y validación de archivos `.clinical`
- Form Compiler con paginación automática A4
- Soporte de variables cuantitativas hasta 3 dígitos (burbujas)
- Impresión en formato A4 real con registration marks
- Exportación de plantilla `.omr`
- Lector OMR MVP con detección por densidad de píxeles + umbral adaptativo
- Navegación guiada entre pasos
- Arquitectura modular y escalable

---

## 🛠️ Stack Técnico

- **Frontend**: Vanilla JavaScript (ES Modules)
- **Estilos**: CSS puro + variables de diseño
- **Sin dependencias externas**
- **Offline first**

---

## 📌 Estado del Proyecto

El proyecto se encuentra en un estado **estable, funcional y mantenible**. Está preparado para ser continuado por cualquier agente o desarrollador siguiendo la guía `AGENT-GUIDE.md`.

---

**Proyecto listo para producción y escalabilidad.**

---

## 🚀 Cómo ejecutar la aplicación (Recomendado)

### Opción 1: Visual Studio Code + Live Server (Más fácil)

1. **Abre la carpeta del proyecto** en Visual Studio Code.
2. Instala la extensión **Live Server** (si no la tienes):
   - Ve a la pestaña de Extensiones (`Ctrl+Shift+X`)
   - Busca **"Live Server"** (autor: Ritwick Dey)
   - Haz clic en **Install**
3. Abre el archivo `index.html`
4. Haz **clic derecho** sobre el archivo `index.html`
5. Selecciona **"Open with Live Server"**

La aplicación se abrirá automáticamente en tu navegador en `http://localhost:5500`

---

### Opción 2: Usando la terminal

Abre la terminal en la carpeta del proyecto y ejecuta uno de los siguientes comandos:

```bash
# Si tienes Node.js instalado
npx serve .

# Si tienes Python instalado
python -m http.server 8080
```

Luego abre en tu navegador:
```
http://localhost:8080
```

---

## ⚠️ Importante

**No abras el archivo `index.html` directamente con doble clic.**  
Esto causará errores de CORS porque el proyecto usa **ES Modules** (`import`/`export`).

Siempre usa **Live Server** o un servidor local.

---

## 📁 Estructura del proyecto

```
clinical-omr-suite/
├── index.html
├── css/
│   ├── variables.css
│   └── main.css
├── js/
│   ├── main.js
│   ├── core/
│   │   ├── dom.js
│   │   └── store.js
│   └── features/
│       ├── importer/
│       ├── preview/
│       ├── form-compiler/
│       ├── printer/
│       └── omr-reader/
├── README.md
└── data/ (opcional)
```

---

## ✨ Funcionalidades actuales

- Importación de archivos `.clinical` (compatible con VarOps)
- Vista previa lineal del formulario
- **Form Compiler** con paginación automática A4
- Exportación a HTML imprimible (formato A4 real)
- Preparación de regiones para lector OMR (estructura base)
- Validación de variables antes de compilar
- Versionado automático del formulario

---

## 📋 Flujo de uso

1. Importar archivo `.clinical`
2. Ver vista previa de variables
3. Compilar formulario (genera paginación A4)
4. Exportar / Imprimir (Ctrl + P)
5. (Futuro) Leer escaneos con OMR

---

## 🛠️ Requisitos

- Navegador moderno (Chrome, Edge, Firefox)
- Visual Studio Code (recomendado)
- Extensión Live Server

---

## 📝 Notas técnicas

- 100% Vanilla JavaScript (sin frameworks)
- Arquitectura modular (service / view / controller)
- Diseño orientado a investigación clínica
- Preparado para compatibilidad con sistemas OMR

---

**Desarrollado siguiendo principios de robustez clínica y compatibilidad futura con OMR.**

---

¿Ya tienes Visual Studio Code abierto? Si quieres, puedo darte los pasos exactos uno por uno para que lo ejecutes ahora mismo.