const DEFAULT_DURATION = 4200;
const STACK_ID = 'app-toast-stack';

function ensureStack() {
    let el = document.getElementById(STACK_ID);
    if (!el) {
        el = document.createElement('div');
        el.id = STACK_ID;
        el.className = 'app-toast-stack';
        el.setAttribute('aria-live', 'polite');
        document.body.appendChild(el);
    }
    return el;
}

/**
 * @param {string} message
 * @param {{ variant?: 'info'|'success'|'error'; duration?: number }} [opts]
 */
export function showToast(message, opts = {}) {
    const variant = opts.variant || 'info';
    const duration = typeof opts.duration === 'number' ? opts.duration : DEFAULT_DURATION;
    const stack = ensureStack();

    const row = document.createElement('div');
    row.className = `app-toast app-toast--${variant}`;
    row.setAttribute('role', 'status');
    row.textContent = message;
    stack.appendChild(row);

    requestAnimationFrame(() => row.classList.add('app-toast--visible'));

    const remove = () => {
        row.classList.remove('app-toast--visible');
        setTimeout(() => row.remove(), 280);
    };

    const t = setTimeout(remove, duration);
    row.addEventListener('click', () => {
        clearTimeout(t);
        remove();
    });
}
