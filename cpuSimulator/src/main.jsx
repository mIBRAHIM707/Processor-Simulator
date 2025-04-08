// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { CpuStateProvider } from './context/CpuContext.jsx';
import { ThemeProvider } from '@mui/material/styles'; // Import ThemeProvider
import CssBaseline from '@mui/material/CssBaseline';   // Import CssBaseline
import theme from './theme';                          // Import your custom theme

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}> {/* Apply the theme */}
      <CssBaseline /> {/* Apply baseline styles AFTER theme */}
      <CpuStateProvider>
        <App />
      </CpuStateProvider>
    </ThemeProvider>
  </React.StrictMode>,
);