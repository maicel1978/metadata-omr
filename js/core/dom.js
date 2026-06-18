// js/core/dom.js
// Utilidades DOM puras

export const createElement = (tag, className = '', attributes = {}) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value;
    else el.setAttribute(key, value);
  });
  
  return el;
};

export const appendChildren = (parent, ...children) => {
  children.forEach(child => {
    if (child) parent.appendChild(child);
  });
  return parent;
};

export const clearElement = (el) => {
  while (el.firstChild) el.removeChild(el.firstChild);
};

export const show = (el) => el.classList.add('active');
export const hide = (el) => el.classList.remove('active');