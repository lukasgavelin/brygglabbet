/**
 * Toast notifications and string escaping utility.
 */

import { escHtml } from './utils.js';
export { escHtml };


/**
 * Shows a toast notification message.
 * @param {string} message - Notification text
 * @param {'info'|'success'|'error'} type - Notification type
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
