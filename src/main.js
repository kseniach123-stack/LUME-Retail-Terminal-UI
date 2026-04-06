import '../main.css';
import '../mobile.css';

import { registerSW } from 'virtual:pwa-register';
import { LumeTerminal, initApp } from './app.js';
import './ui.js';
import './actions.js';

registerSW({ immediate: true });

window.LumeTerminal = LumeTerminal;

document.addEventListener('DOMContentLoaded', initApp);
