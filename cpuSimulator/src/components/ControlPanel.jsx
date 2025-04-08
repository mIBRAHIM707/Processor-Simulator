import React from 'react';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useCpuState } from '../context/CpuContext'; // Import hook

function ControlPanel() {
  const { dispatch } = useCpuState(); // Get dispatch function

  const handleReset = () => {
    dispatch({ type: 'RESET' }); // Dispatch RESET action
  };

  const handleStep = () => {
     dispatch({ type: 'STEP' }); // Dispatch STEP action
   };

   const handleLoad = () => {
      // Dummy machine code for testing LOAD_CODE
      const dummyCode = [0x000A, 0x000B, 0x1001]; // Example instructions
      dispatch({ type: 'LOAD_CODE', payload: dummyCode });
   }

  // Add Run, Stop later

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Stack direction="row" spacing={2}> {/* Arrange buttons */}
        <Button variant="contained" color="secondary" onClick={handleLoad}>Load</Button>
        <Button variant="contained" onClick={handleStep}>Step</Button>
        <Button variant="contained" disabled>Run</Button> {/* Disabled for now */}
        <Button variant="contained" color="error" onClick={handleReset}>Reset</Button>
      </Stack>
    </Paper>
  );
}
export default ControlPanel;