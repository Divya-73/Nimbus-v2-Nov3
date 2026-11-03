import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, getStoredTheme } from '../utils/theme';
import '../styles/index.css';

applyTheme(getStoredTheme());

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(<App />);
