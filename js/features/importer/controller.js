// js/features/importer/controller.js

import Store from '../../core/store.js';
import { parseClinicalFile } from './service.js';
import { renderImporter } from './view.js';
import { notify } from '../../core/notifications.js';

export function initImporter() {
  const container = document.getElementById('step-import');
  if (!container) return;

  renderImporter(container);

  const dropzone = container.querySelector('.dropzone');
  const fileInput = container.querySelector('#file-input');
  const selectBtn = container.querySelector('#select-btn');

  selectBtn.onclick = () => fileInput.click();

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

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
    const { data, errors } = parseClinicalFile(content);

    if (data) {
      Store.clearCompiledState();

      Store.setState({
        project: data.project,
        variables: data.variables,
        currentStep: 'preview'
      });

      window.dispatchEvent(new CustomEvent('omr:go-to-step', {
        detail: { step: 'preview' }
      }));

      notify.success(`Archivo importado correctamente. ${data.variables.length} variables cargadas.`);
    } else {
      // Antes: un único mensaje genérico ("Archivo .clinical no válido o
      // corrupto.") que descartaba los errores detallados ya calculados
      // por el validador. Ahora se muestran (hasta 4, para no saturar).
      const detail = errors.slice(0, 4).join(' · ');
      const more = errors.length > 4 ? ` (y ${errors.length - 4} más)` : '';
      notify.error(`Archivo .clinical no válido: ${detail}${more}`, 7000);
    }
  };
  reader.readAsText(file);
}
