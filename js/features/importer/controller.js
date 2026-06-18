// js/features/importer/controller.js

import Store from '../../core/store.js';
import { parseClinicalFile } from './service.js';
import { renderImporter } from './view.js';

export function initImporter() {
  const container = document.getElementById('step-import');
  if (!container) return;

  renderImporter(container);

  // Configurar eventos
  const dropzone = container.querySelector('.dropzone');
  const fileInput = container.querySelector('#file-input');
  const selectBtn = container.querySelector('#select-btn');

  // Click en botón
  selectBtn.onclick = () => fileInput.click();

  // Selección de archivo
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  // Drag & Drop
  dropzone.ondragover = (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  };

  dropzone.ondragleave = () => {
    dropzone.classList.remove('dragover');
  };

  dropzone.ondrop = (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  dropzone.onclick = (e) => {
    if (e.target.id !== 'select-btn') {
      fileInput.click();
    }
  };
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const parsed = parseClinicalFile(content);

    if (parsed) {
      // Limpiar estado anterior antes de cargar nuevo archivo
      Store.clearCompiledState();

      // Guardar en el store
      Store.setState({
        project: parsed.project,
        variables: parsed.variables,
        currentStep: 'preview'
      });

      // Navegar al paso de preview
      window.dispatchEvent(new CustomEvent('omr:go-to-step', { 
        detail: { step: 'preview' } 
      }));

      // Mostrar mensaje de éxito temporal
      showSuccessMessage(`Archivo importado correctamente. ${parsed.variables.length} variables cargadas.`);

    } else {
      showErrorMessage('Archivo .clinical no válido o corrupto.');
    }
  };
  reader.readAsText(file);
}

// Función auxiliar para mostrar mensajes de éxito
function showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.style.cssText = 'background:#dcfce7; color:#166534; padding:12px 16px; border-radius:8px; margin-top:12px; font-size:13px;';
  successDiv.textContent = '✅ ' + message;

  const dropzone = document.querySelector('.dropzone');
  if (dropzone) {
    dropzone.appendChild(successDiv);
    setTimeout(() => {
      if (successDiv.parentNode) successDiv.parentNode.removeChild(successDiv);
    }, 4000);
  }
}

// Función auxiliar para mostrar mensajes de error
function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'background:#fee2e2; color:#b91c1c; padding:12px 16px; border-radius:8px; margin-top:12px; font-size:13px;';
  errorDiv.textContent = '❌ ' + message;
  
  const dropzone = document.querySelector('.dropzone');
  if (dropzone) {
    dropzone.appendChild(errorDiv);
    setTimeout(() => {
      if (errorDiv.parentNode) errorDiv.parentNode.removeChild(errorDiv);
    }, 4000);
  } else {
    alert(message); // Fallback
  }
}