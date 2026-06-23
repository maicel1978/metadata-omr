// js/features/printer/service.js
// Generador de HTML imprimible A4 — ahora delega toda la geometría y el
// HTML de cada página a core/render-page.js, el mismo renderizador que usa
// la vista en pantalla del Form Compiler. Antes este archivo tenía su
// propia tercera reimplementación de la matriz de burbujas (con tamaños y
// constantes distintos a los otros dos), que es exactamente lo que rompía
// la correspondencia con el archivo .omr exportado.

import Store from '../../core/store.js';
import { escapeHTML } from '../../core/sanitize.js';
import { renderPageHTML, OMR_PAGE_CSS } from '../../core/render-page.js';
import { notify } from '../../core/notifications.js';

export function generatePrintableHTML() {
  const state = Store.getState();
  const { project, compiledForm } = state;

  if (!compiledForm || !compiledForm.blocks || compiledForm.blocks.length === 0) {
    return null;
  }

  const formMeta = {
    id: compiledForm.id || 'unknown',
    version: compiledForm.version || 1,
    dateLabel: compiledForm.compiledAt
      ? new Date(compiledForm.compiledAt).toLocaleDateString('es-ES')
      : new Date().toLocaleDateString('es-ES'),
    totalPages: compiledForm.pages
  };

  let pagesHTML = '';
  for (let page = 1; page <= compiledForm.pages; page++) {
    const blocksOnPage = compiledForm.blocks.filter(b => b.page === page);
    pagesHTML += renderPageHTML(page, blocksOnPage, project, formMeta);
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${escapeHTML(project.name || 'Formulario Clínico')} - OMR Suite</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #ffffff; font-family: Georgia, 'Times New Roman', serif; }
  ${OMR_PAGE_CSS}
  @page { size: A4; margin: 0; }
</style>
</head>
<body>
${pagesHTML}
</body>
</html>`;
}

// Abre una ventana nueva sin conservar `window.opener` accesible desde ella
// (defensa en profundidad). No se usa el flag `noopener` de `window.open`
// porque, por especificación, eso hace que `window.open` devuelva `null`
// — y entonces no podríamos escribir el HTML dentro de la ventana. En vez
// de eso, se anula `opener` ya abierta la ventana.
function openIsolatedWindow(features) {
  const win = window.open('', '_blank', features);
  if (win) {
    try { win.opener = null; } catch (e) { /* algunos navegadores lo bloquean; no es crítico */ }
  }
  return win;
}

export function printDocument() {
  const html = generatePrintableHTML();
  if (!html) {
    notify.error('No hay formulario compilado para imprimir.');
    return;
  }

  const printWindow = openIsolatedWindow('width=900,height=700');
  if (!printWindow) {
    notify.error('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 400);
}

export function showPrintPreview(htmlContent) {
  const previewWindow = openIsolatedWindow('width=960,height=720');
  if (!previewWindow) {
    notify.error('El navegador bloqueó la ventana de vista previa. Habilita las ventanas emergentes para este sitio.');
    return;
  }
  previewWindow.document.write(htmlContent);
  previewWindow.document.close();
}
