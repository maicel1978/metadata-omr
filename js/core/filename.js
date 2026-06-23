// js/core/filename.js
// Genera nombres de archivo seguros para descargas (sin tildes, sin
// caracteres que rompan el sistema de archivos en algún SO).

export function safeFileName(name, fallback = 'archivo') {
  const cleaned = String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes, conserva la letra base
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return cleaned || fallback;
}
