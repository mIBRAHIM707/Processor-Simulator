import React, { useEffect, useRef } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useCpuState } from '../context/CpuContext';

function OutputLog() {
  const { state } = useCpuState();
  const logEndRef = useRef(null); // Ref to scroll to bottom

  // Scroll to bottom when log updates
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.outputLog]);

  return (
    <Paper elevation={3} sx={{ p: 2, height: '150px', overflowY: 'auto' }}> {/* Fixed height, scrollable */}
      <Typography variant="h6" gutterBottom>Log</Typography>
      <Box fontFamily="monospace" fontSize="0.8rem">
        {state.outputLog.map((msg, index) => (
          <div key={index}>{msg}</div>
        ))}
        <div ref={logEndRef} /> {/* Invisible element to scroll to */}
      </Box>
    </Paper>
  );
}
export default OutputLog;