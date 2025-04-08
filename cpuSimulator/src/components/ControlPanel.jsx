// src/components/ControlPanel.jsx
import React from 'react';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useCpuState } from '../context/CpuContext';
import ReplayIcon from '@mui/icons-material/Replay'; // Icon for Reset
import SkipNextIcon from '@mui/icons-material/SkipNext'; // Icon for Step

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
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} justifyContent="space-around"> {/* Distribute buttons */}
        <Button
          variant="outlined" // Outlined might look better than contained for secondary actions
          onClick={handleStep}
          disabled={isRunning}
          startIcon={<SkipNextIcon />}
          color="secondary" // Use secondary color
        >
          Step
        </Button>
        {!isRunning ? (
          <Button
            variant="contained" // Primary action
            color="primary" // Uses theme primary (Spotify Green)
            startIcon={<PlayArrowIcon />}
            onClick={handleRun}
          >
            Run
          </Button>
        ) : (
          <Button
            variant="contained" // Primary action while running
            color="primary"
            startIcon={<StopIcon />}
            onClick={handleStop}
          >
            Stop
          </Button>
        )}
        <Button
          variant="outlined" // Outlined for reset
          color="error"
          onClick={handleReset}
          disabled={isRunning}
          startIcon={<ReplayIcon />}
        >
          Reset
        </Button>
      </Stack>
    </Paper>
  );
}
export default ControlPanel;