// src/components/ControlPanel.jsx
import React from 'react';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useCpuState } from '../context/CpuContext';

function ControlPanel() {
  const { dispatch } = useCpuState();

  const handleReset = () => {
    dispatch({ type: 'RESET' });
  };

  const handleStep = () => {
    dispatch({ type: 'STEP' });
  };

  // Removed dummy handleLoad

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Stack direction="row" spacing={2}>
        {/* Removed Load button, it's now in CodeEditor */}
        <Button variant="contained" onClick={handleStep}>Step</Button>
        <Button variant="contained" disabled>Run</Button>
        <Button variant="contained" color="error" onClick={handleReset}>Reset</Button>
      </Stack>
    </Paper>
  );
}
export default ControlPanel;