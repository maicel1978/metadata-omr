// js/core/sanitize.js
// Utilidades básicas de sanitización (sin dependencias externas)

/**
 * Escapa caracteres HTML peligrosos.
 * Uso: Antes de insertar texto en el DOM con innerHTML.
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitiza un objeto completo (útil para project y variables).
 * Solo escapa strings. Mantiene números, booleanos y arrays.
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    const value = obj[key];

    if (typeof value === 'string') {
      sanitized[key] = escapeHTML(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Valida que un string no contenga caracteres peligrosos.
 */
export function isSafeString(str) {
  if (typeof str !== 'string') return false;
  return !/<[^>]*>|javascript:|on\w+\s*=/i.test(str);
}