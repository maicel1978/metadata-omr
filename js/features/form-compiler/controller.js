// js/features/form-compiler/controller.js

import Store from '../../core/store.js';
import { compileForm } from './service.js';
import { renderCompiledForm } from './view.js';
import { notify } from '../../core/notifications.js';

let container = null;

export function initFormCompiler() {
  container = document.getElementById('step-adjust');
  if (!container) return;

  const state = Store.getState();
  if (state.variables.length > 0) {
    renderCompiler(state);
  }
}

export function renderCompiler(state = null) {
  if (!container) return;

  const currentState = state || Store.getState();

  if (currentState.variables.length === 0) {
    container.innerHTML = `<p style="color:#64748b;">No hay variables importadas.</p>`;
    return;
  }

  // Compilar el formulario (con validación integrada). La geometría y las
  // posiciones OMR ya vienen calculadas dentro de `compiled` — ya no hace
  // falta (ni existe) un segundo paso de "preparar regiones OMR" aparte.
  let compiled;
  try {
    compiled = compileForm(currentState.variables);
  } catch (error) {
    notify.error(error.message, 7000);
    return;
  }

  Store.setCompiledForm(compiled);

  renderCompiledForm(container, compiled, currentState.project);
  addPrintNavigation();

  notify.success(`Formulario compilado correctamente (${compiled.pages} página${compiled.pages > 1 ? 's' : ''}).`);

  if (compiled.pages > 3) {
    notify.warning(
      `Este formulario tiene ${compiled.pages} páginas. Se recomienda un máximo de 3 para facilitar el escaneo OMR. Considera reducir el número de variables o dividir el formulario.`,
      7000
    );
  }
}

function addPrintNavigation() {
  const existingNav = container.querySelector('.navigation-buttons');
  if (existingNav) existingNav.remove();

  const nav = document.createElement('div');
  nav.className = 'navigation-buttons';
  nav.style.marginTop = '40px';
  nav.style.display = 'flex';
  nav.style.justifyContent = 'space-between';
  nav.style.alignItems = 'center';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-secondary';
  backBtn.textContent = '← Volver a Vista Previa';
  backBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('omr:go-to-step', {
      detail: { step: 'preview' }
    }));
  };

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-primary';
  nextBtn.textContent = 'Ir a Impresión →';
  nextBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('omr:go-to-step', {
      detail: { step: 'print' }
    }));
  };

  nav.appendChild(backBtn);
  nav.appendChild(nextBtn);
  container.appendChild(nav);
}

export function compileAndShow() {
  const state = Store.getState();
  renderCompiler(state);
}
