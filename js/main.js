// js/main.js
// Punto de entrada + routing simple del wizard

import Store from './core/store.js';
import { createElement, appendChildren } from './core/dom.js';

// Features
import { initImporter } from './features/importer/controller.js';
import { initPreview, showPreview } from './features/preview/controller.js';
import { initFormCompiler, compileAndShow } from './features/form-compiler/controller.js';
import { initPrinter, showPrintStep, showPrintPreviewMode } from './features/printer/controller.js';
import { initOMRReader, showOMRReader } from './features/omr-reader/controller.js';

const steps = ['import', 'preview', 'adjust', 'print', 'omr'];

// Antes, la etiqueta de cada paso se generaba capitalizando el slug interno
// ("omr" -> "Omr", "adjust" -> "Adjust"), lo que dejaba textos sin sentido
// o en inglés en una interfaz que por lo demás es 100% en español.
const STEP_LABELS = {
  import: 'Importar',
  preview: 'Vista previa',
  adjust: 'Compilar',
  print: 'Imprimir',
  omr: 'Lector OMR'
};

let currentStepIndex = 0;

function updateWizardUI() {
  // Actualizar navegación
  document.querySelectorAll('.wizard-step').forEach((stepEl, index) => {
    stepEl.classList.remove('active', 'completed');
    
    if (index < currentStepIndex) {
      stepEl.classList.add('completed');
    } else if (index === currentStepIndex) {
      stepEl.classList.add('active');
    }
  });

  // Mostrar contenido del paso
  document.querySelectorAll('.step-content').forEach((content, index) => {
    if (index === currentStepIndex) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
}

function goToStep(stepName) {
  const index = steps.indexOf(stepName);
  if (index === -1) return;

  currentStepIndex = index;
  Store.setCurrentStep(stepName);
  updateWizardUI();

  // Disparar inicialización del paso si es necesario
  if (stepName === 'import') {
    // Ya inicializado
  }
}

function initWizard() {
  const nav = document.getElementById('wizard-nav');
  
  steps.forEach((step, index) => {
    const stepEl = createElement('div', 'wizard-step', {
      text: STEP_LABELS[step] || step
    });
    
    stepEl.onclick = () => goToStep(step);
    nav.appendChild(stepEl);
  });

  // Inicializar primer paso
  updateWizardUI();
}

// Inicialización principal
function initApp() {
  Store.init();

  // Renderizar estructura base del wizard
  const app = document.getElementById('app');
  
  // Header
  const header = createElement('div', 'header');
  appendChildren(header,
    createElement('h1', '', { text: 'Clinical OMR Suite' }),
    createElement('div', '', { text: 'v1.0 • Deterministic Form Compiler' })
  );

  // Navegación del wizard
  const wizardNav = createElement('div', 'wizard-nav', { id: 'wizard-nav' });

  // Contenedores de pasos
  const stepContents = steps.map(step => 
    createElement('div', `step-content`, { id: `step-${step}` })
  );

  appendChildren(app, header, wizardNav, ...stepContents);

  initWizard();
  initImporter();
  initPreview();
  initFormCompiler();
  initPrinter();
  initOMRReader();

  // Navegación global vía evento
  window.addEventListener('omr:go-to-step', (e) => {
    goToStep(e.detail.step);
    if (e.detail.step === 'preview') showPreview();
    if (e.detail.step === 'adjust') compileAndShow();
    if (e.detail.step === 'print') showPrintStep();
    if (e.detail.step === 'omr') showOMRReader();
  });

  // Eventos de impresión
  window.addEventListener('omr:print-preview', () => {
    showPrintPreviewMode();
  });

  // Estado inicial
  const state = Store.getState();
  if (state.currentStep !== 'import') {
    goToStep(state.currentStep);
    if (state.currentStep === 'preview') showPreview();
    if (state.currentStep === 'adjust') compileAndShow();
    if (state.currentStep === 'print') showPrintStep();
  }
}

document.addEventListener('DOMContentLoaded', initApp);