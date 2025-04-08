import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useCpuState } from '../context/CpuContext'; // Import hook

function FlagDisplay() {
  const { state } = useCpuState(); // Access state later
  // Example: const { Z, C, N, V } = state.flags;
  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Flags</Typography>
      {/* Display flags here (e.g., using Chips or simple text) */}
      <Typography variant="body2" fontFamily="monospace">
        Z: {state.flags.Z} C: {state.flags.C} N: {state.flags.N} V: {state.flags.V}
      </Typography>
    </Paper>
  );
}
export default FlagDisplay;