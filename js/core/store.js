// js/core/store.js
// Estado global + persistencia

const Store = (() => {
  const STORAGE_KEY = 'clinical_omr_suite_v1';

  let state = {
    project: { name: '', specialty: '', date: '' },
    variables: [],
    compiledForm: {
      blocks: [],
      pages: 1,
      totalHeight: 0
    },
    currentStep: 'import'
  };

  const load = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.project && parsed.variables) {
          state = { ...state, ...parsed };
        }
      }
    } catch (e) {}
  };

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  };

  return {
    getState: () => state,
    setState: (newState) => {
      state = { ...state, ...newState };
      save();
    },
    updateProject: (field, value) => {
      state.project[field] = value;
      save();
    },
    setVariables: (vars) => {
      state.variables = vars;
      save();
    },

    // Limpia el estado compilado (usado al cargar un nuevo archivo)
    clearCompiledState: () => {
      state.compiledForm = {
        blocks: [],
        pages: 1,
        totalHeight: 0,
        id: null,
        version: 1,
        compiledAt: null
      };
      save();
    },
    setCompiledForm: (compiled) => {
      // Validación de integridad referencial
      if (compiled.blocks && state.variables.length !== compiled.blocks.length) {
        console.warn(
          `[Store] ADVERTENCIA: Desincronización detectada. ` +
          `Variables: ${state.variables.length}, Bloques: ${compiled.blocks.length}`
        );
      }
      state.compiledForm = compiled;
      save();
    },
    setCurrentStep: (step) => {
      state.currentStep = step;
      save();
    },
    reset: () => {
      state = {
        project: { name: '', specialty: '', date: '' },
        variables: [],
        compiledForm: { blocks: [], pages: 1, totalHeight: 0 },
        currentStep: 'import'
      };
      localStorage.removeItem(STORAGE_KEY);
    },
    init: () => load()
  };
})();

export default Store;