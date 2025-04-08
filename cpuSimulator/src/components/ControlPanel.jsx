// src/components/ControlPanel.jsx
import React from 'react';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useCpuState } from '../context/CpuContext';
import ReplayIcon from '@mui/icons-material/Replay'; // Icon for Reset
import SkipNextIcon from '@mui/icons-material/SkipNext'; // Icon for Step
import PlayArrowIcon from '@mui/icons-material/PlayArrow'; // <-- ADDED Import
import StopIcon from '@mui/icons-material/Stop';           // <-- ADDED Import

function ControlPanel() {
  // Destructure state and dispatch
  const { state, dispatch } = useCpuState();
  const { isRunning } = state; // <-- ADDED Destructure isRunning

  const handleReset = () => {
    dispatch({ type: 'RESET' });
  };

  const handleStep = () => {
    dispatch({ type: 'STEP' });
  };

  // --- ADDED handleRun and handleStop ---
  const handleRun = () => {
    // Need to implement the actual run loop logic, likely in App.jsx using useEffect
    // For now, just dispatch the action to update the state
    dispatch({ type: 'START_RUN' });
    dispatch({ type: 'UPDATE_LOG', payload: "Run requested (loop logic TBD)..." }); // Log feedback
  };

  const handleStop = () => {
    dispatch({ type: 'STOP_RUN' });
    dispatch({ type: 'UPDATE_LOG', payload: "Stop requested." }); // Log feedback
  };
  // --------------------------------------

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} justifyContent="space-around"> {/* Distribute buttons */}
        <Button
          variant="outlined"
          onClick={handleStep}
          disabled={isRunning} // Now uses state.isRunning
          startIcon={<SkipNextIcon />}
          color="secondary"
        >
          Step
        </Button>
        {!isRunning ? ( // Now uses state.isRunning
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={handleRun} // Now calls defined function
          >
            Run
          </Button>
        ) : (
          <Button
            variant="contained"
            color="error" // Often Stop is styled as error/warning
            startIcon={<StopIcon />}
            onClick={handleStop} // Now calls defined function
          >
            Stop
          </Button>
        )}
        <Button
          variant="outlined"
          color="error"
          onClick={handleReset}
          disabled={isRunning} // Now uses state.isRunning
          startIcon={<ReplayIcon />}
        >
          Reset
        </Button>
      </Stack>
    </Paper>
  );
}
export default ControlPanel;