import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { readDarkMode } from './core/preferences';
import '../app/globals.css';
document.documentElement.classList.toggle('dark', readDarkMode());
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
