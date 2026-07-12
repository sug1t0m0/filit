import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import { BundleApp } from './BundleApp.js';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const bundleMatch = window.location.pathname.match(/^\/bundle\/([\w-]+)$/);

createRoot(container).render(
  <StrictMode>{bundleMatch?.[1] ? <BundleApp id={bundleMatch[1]} /> : <App />}</StrictMode>,
);
