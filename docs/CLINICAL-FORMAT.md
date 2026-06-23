# Formato de Archivo .clinical (Contrato de Compatibilidad)

Este documento define el **esquema oficial** que debe cumplir cualquier archivo `.clinical` para ser compatible con **Clinical OMR Suite**.

**Importante**: Este formato está basado en la aplicación **VarOps** y debe mantenerse compatible.

---

## Estructura General

```json
{
  "project": { ... },
  "variables": [ ... ]
}
```

---

## Campo `project`

| Campo       | Tipo     | Obligatorio | Descripción |
|-------------|----------|-------------|-------------|
| `name`      | string   | Sí          | Nombre del proyecto |
| `specialty` | string   | No          | Especialidad médica |
| `date`      | string   | No          | Fecha en formato YYYY-MM-DD |

---

## Campo `variables`

Array de objetos con la siguiente estructura:

### Campos obligatorios por variable

| Campo       | Tipo     | Obligatorio | Descripción |
|-------------|----------|-------------|-------------|
| `name`      | string   | Sí          | Nombre de la variable (snake_case recomendado) |
| `type`      | string   | Sí          | Ver tipos permitidos abajo |
| `description` | string | No        | Descripción de la variable |
| `metadata`  | object   | Sí          | Metadatos de la variable |

### Tipos de variables permitidos

- `"Nominal Dicotómica"`
- `"Nominal Politómica"`
- `"Ordinal"`
- `"Cuantitativa Discreta"`
- `"Cuantitativa Continua"`

---

## Campo `metadata`

### Para variables **Cuantitativas**

| Campo     | Tipo   | Obligatorio | Descripción |
|-----------|--------|-------------|-------------|
| `question` | string | Sí          | Pregunta que se mostrará |
| `unit`     | string | No          | Unidad de medida (ej: "años", "mmHg") |
| `range`    | object | Sí          | Rango de valores |
| `decimals` | number | No          | **(Nuevo)** Cantidad de decimales a representar en la hoja OMR. Solo se usa si `type` es `"Cuantitativa Continua"`. Por defecto: `1`. Máximo admitido: `2`. Ver "Restricciones físicas" abajo. |

#### `range`

```json
{
  "min": "0",
  "max": "120"
}
```

`min`/`max` deben ser números simples en formato decimal estándar (`"120"`, `"36.5"`). **No se admite notación científica** (`"1e10"`) ni texto: un archivo con esos valores será rechazado por el validador, porque antes generaba formularios imposibles de imprimir en silencio.

### Para variables **Cualitativas** (Dicotómica, Politómica, Ordinal)

| Campo        | Tipo   | Obligatorio | Descripción |
|--------------|--------|-------------|-------------|
| `question`   | string | Sí          | Pregunta que se mostrará |
| `categories` | array  | Sí          | Lista de categorías |

#### Estructura de `categories`

```json
{
  "label": "Masculino",
  "synonyms": ["m", "1"]
}
```

---

## Ejemplo de Archivo Válido

```json
{
  "project": {
    "name": "operacionalizacion",
    "specialty": "pediatria",
    "date": "2026-06-06"
  },
  "variables": [
    {
      "name": "sexo",
      "type": "Nominal Dicotómica",
      "description": "Sexo biológico del paciente",
      "metadata": {
        "question": "¿Cuál es el sexo biológico?",
        "categories": [
          { "label": "Masculino", "synonyms": ["m", "1"] },
          { "label": "Femenino", "synonyms": ["f", "2"] }
        ]
      }
    },
    {
      "name": "presion_sistolica",
      "type": "Cuantitativa Discreta",
      "metadata": {
        "question": "Presión arterial sistólica",
        "unit": "mmHg",
        "range": { "min": "60", "max": "250" }
      }
    }
  ]
}
```

---

## Restricciones físicas de representación (añadidas en esta revisión)

Antes de esta revisión, una variable cuantitativa con un rango muy amplio (p. ej. `max: "500000"`) o con muchas categorías (7 o más) generaba un formulario que se veía bien en pantalla pero cuyas burbujas reales quedaban **fuera del borde físico de la hoja A4** al imprimir/exportar. Esto se detectaba tarde (o nunca) porque no había ninguna validación que lo impidiera.

Ahora el validador y el compilador rechazan, con un mensaje explícito, los archivos que no se puedan representar físicamente:

- **Dígitos enteros**: el rango (`range.max`) no puede requerir más de **4 dígitos enteros** (es decir, `max` no puede superar 9999 en valor absoluto truncado). Ver `MAX_INT_DIGITS` en `js/core/layout-engine.js`.
- **Decimales**: como máximo **2** decimales (`decimals` en metadata), y solo para `"Cuantitativa Continua"`.
- **Nombres de variable únicos**: dos variables no pueden tener el mismo `name` (comparando sin tildes ni mayúsculas) — ni en el archivo original, ni después de que el importador normalice el nombre.

Si tu protocolo necesita un rango más amplio que el permitido, divide la variable en dos (por ejemplo, "miles" y "unidades" por separado) en vez de forzar un único campo de 5+ dígitos.

---

## Política de Compatibilidad

- **Cualquier cambio** en este formato debe documentarse aquí.
- El validador en `js/features/importer/validator.js` **debe actualizarse** si se modifica este contrato.
- Se recomienda **versionar** este documento si hay cambios importantes (`CLINICAL-FORMAT-v2.md`).

---

**Este documento es la fuente de verdad para compatibilidad con VarOps.**