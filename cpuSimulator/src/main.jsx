// src/main.jsx (or index.jsx)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { CpuStateProvider } from './context/CpuContext.jsx'; // Import the provider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CpuStateProvider> {/* Wrap App with the provider */}
      <App />
    </CpuStateProvider>
  </React.StrictMode>,
);