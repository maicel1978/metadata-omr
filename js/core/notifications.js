// js/core/notifications.js
// Sistema centralizado de notificaciones (sin dependencias)
//
// Antes de esta corrección, este módulo nunca llegaba a usarse: ningún
// controller lo importaba, y la única referencia (`window.showNotification`)
// jamás se asignaba en ningún archivo. Ahora se importa directamente
// (`import { notify } from '.../core/notifications.js'`) desde cada
// controller, y es el único lugar donde se construyen mensajes flotantes.

import { escapeHTML } from './sanitize.js';

/**
 * Muestra un mensaje temporal en la parte superior del contenedor.
 * @param {string} message - Texto del mensaje
 * @param {'success' | 'error' | 'warning'} type - Tipo de mensaje
 * @param {number} duration - Duración en milisegundos (default: 4000)
 */
export function showNotification(message, type = 'success', duration = 4000) {
  // Buscar o crear contenedor de notificaciones
  let container = document.getElementById('notification-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    `;
    document.body.appendChild(container);
  }

  const colors = {
    success: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    error:   { bg: '#fee2e2', color: '#b91c1c', border: '#f87171' },
    warning: { bg: '#fefce8', color: '#854d0e', border: '#fde047' }
  };

  const style = colors[type] || colors.success;

  const notification = document.createElement('div');
  notification.style.cssText = `
    background: ${style.bg};
    color: ${style.color};
    border: 1px solid ${style.border};
    padding: 14px 18px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    max-width: 380px;
    animation: slideIn 0.3s ease-out;
  `;

  const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : '⚡';

  notification.innerHTML = `
    <div style="font-size: 18px; line-height: 1; margin-top: 1px;">${icon}</div>
    <div style="flex: 1; line-height: 1.4;">${escapeHTML(String(message))}</div>
  `;

  container.appendChild(notification);

  // Auto-eliminar después del tiempo especificado
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.transition = 'all 0.3s ease-out';
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
      }, 300);
    }
  }, duration);

  return notification;
}

// Atajos de conveniencia
export const notify = {
  success: (msg, duration) => showNotification(msg, 'success', duration),
  error:   (msg, duration) => showNotification(msg, 'error', duration),
  warning: (msg, duration) => showNotification(msg, 'warning', duration)
};