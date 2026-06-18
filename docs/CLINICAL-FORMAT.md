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

#### `range`

```json
{
  "min": "0",
  "max": "120"
}
```

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

## Política de Compatibilidad

- **Cualquier cambio** en este formato debe documentarse aquí.
- El validador en `js/features/importer/validator.js` **debe actualizarse** si se modifica este contrato.
- Se recomienda **versionar** este documento si hay cambios importantes (`CLINICAL-FORMAT-v2.md`).

---

**Este documento es la fuente de verdad para compatibilidad con VarOps.**