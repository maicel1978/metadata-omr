// js/features/form-compiler/controller.js

import Store from '../../core/store.js';
import { compileForm } from './service.js';
import { renderCompiledForm } from './view.js';
import { prepareOMRRegions } from '../omr-reader/controller.js';

let container = null;

export function initFormCompiler() {
  container = document.getElementById('step-adjust');
  if (!container) return;

  // Render inicial si hay datos
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

  // Compilar el formulario (con validación integrada)
  let compiled;
  try {
    compiled = compileForm(currentState.variables);
  } catch (error) {
    showErrorMessage(error.message);
    return;
  }
  
  // Guardar en el store
  Store.setCompiledForm(compiled);

  // === Integración OMR: Preparar regiones automáticamente ===
  const omrRegions = prepareOMRRegions();
  compiled.omrRegions = omrRegions;
  Store.setCompiledForm(compiled); // Actualizar con regiones OMR

  // Renderizar
  renderCompiledForm(container, compiled, currentState.project);

  // Añadir botón de navegación
  addPrintNavigation();

  // Mostrar mensaje de éxito
  showSuccessMessage(`Formulario compilado correctamente (${compiled.pages} página${compiled.pages > 1 ? 's' : ''}).`);

  // Advertencia visual si supera las 3 páginas
  if (compiled.pages > 3) {
    showPageWarning(compiled.pages);
  }
}

function addPrintNavigation() {
  // Eliminar navegación anterior si existe
  const existingNav = container.querySelector('.navigation-buttons');
  if (existingNav) existingNav.remove();

  const nav = document.createElement('div');
  nav.className = 'navigation-buttons';
  nav.style.marginTop = '40px';
  nav.style.display = 'flex';
  nav.style.justifyContent = 'space-between';
  nav.style.alignItems = 'center';

  // Botón Volver
  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-secondary';
  backBtn.textContent = '← Volver a Vista Previa';
  backBtn.onclick = () => {
    window.dispatchEvent(new CustomEvent('omr:go-to-step', { 
      detail: { step: 'preview' } 
    }));
  };

  // Botón Siguiente
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

// Función para navegar desde preview
export function compileAndShow() {
  const state = Store.getState();
  renderCompiler(state);
}

// Funciones auxiliares de feedback
function showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.style.cssText = 'background:#dcfce7; color:#166534; padding:12px 16px; border-radius:8px; margin:16px 0; font-size:13px;';
  successDiv.innerHTML = `✅ ${message}`;

  if (container) {
    container.insertBefore(successDiv, container.firstChild);
    setTimeout(() => {
      if (successDiv.parentNode) successDiv.parentNode.removeChild(successDiv);
    }, 3500);
  }
}

function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'background:#fee2e2; color:#b91c1c; padding:12px 16px; border-radius:8px; margin:16px 0; font-size:13px;';
  errorDiv.innerHTML = `⚠️ ${message}`;

  if (container) {
    container.insertBefore(errorDiv, container.firstChild);
    setTimeout(() => {
      if (errorDiv.parentNode) errorDiv.parentNode.removeChild(errorDiv);
    }, 5000);
  } else {
    alert(message);
  }
}

// Advertencia visual cuando el formulario tiene muchas páginas
function showPageWarning(pages) {
  const warningDiv = document.createElement('div');
  warningDiv.style.cssText = `
    background: #fefce8; 
    color: #854d0e; 
    border: 1px solid #fde047;
    padding: 14px 16px; 
    border-radius: 8px; 
    margin: 16px 0; 
    font-size: 13px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  `;
  
  warningDiv.innerHTML = `
    <div style="font-size:18px; line-height:1;">⚠️</div>
    <div>
      <strong>Atención:</strong> Este formulario tiene <strong>${pages} páginas</strong>.<br>
      Se recomienda un máximo de <strong>3 páginas</strong> para facilitar el escaneo y la lectura OMR.
      <div style="margin-top:6px; font-size:12px; color:#713f12;">
        Considera reducir el número de variables o dividir el formulario.
      </div>
    </div>
  `;

  if (container) {
    // Insertar después del mensaje de éxito (si existe)
    const successMsg = container.querySelector('div[style*="dcfce7"]');
    if (successMsg) {
      successMsg.after(warningDiv);
    } else {
      container.insertBefore(warningDiv, container.firstChild);
    }
  }
}