// js/features/preview/controller.js

import Store from '../../core/store.js';
import { renderPreview } from './view.js';

let previewContainer = null;

export function initPreview() {
  previewContainer = document.getElementById('step-preview');
  if (!previewContainer) return;

  // Render inicial si ya hay datos
  const state = Store.getState();
  if (state.variables.length > 0) {
    renderPreview(previewContainer, state.project, state.variables);
  }

  // Escuchar cambios en el store (simple observer)
  // Por ahora se renderiza manualmente desde el importer
}

export function showPreview() {
  const state = Store.getState();
  if (!previewContainer) return;

  renderPreview(previewContainer, state.project, state.variables);
  addNavigationButtons();
}

// Botón de navegación para ir al Form Compiler
export function addNavigationButtons() {
  if (!previewContainer) return;

  // Eliminar navegación anterior si existe
  const existingNav = previewContainer.querySelector('.navigation-buttons');
  if (existingNav) existingNav.remove();

  const nav = document.createElement('div');
  nav.className = 'navigation-buttons';
  nav.style.marginTop = '32px';
  nav.style.display = 'flex';
  nav.style.justifyContent = 'space-between';
  nav.style.alignItems = 'center';

  // Botón Volver
  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-secondary';
  backBtn.textContent = '← Volver a Importar';
  backBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('omr:go-to-step', { 
      detail: { step: 'import' } 
    }));
  };

  // Botón Siguiente
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-primary';
  nextBtn.textContent = 'Compilar Formulario →';
  nextBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('omr:go-to-step', { 
      detail: { step: 'adjust' } 
    }));
  };

  nav.appendChild(backBtn);
  nav.appendChild(nextBtn);
  previewContainer.appendChild(nav);
}