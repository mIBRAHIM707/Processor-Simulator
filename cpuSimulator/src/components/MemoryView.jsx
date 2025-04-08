import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useCpuState } from '../context/CpuContext';

function MemoryView() {
  const { state } = useCpuState();
  // TODO: Implement rendering memory content (maybe paginated or scrollable)
  return (
    <Paper elevation={3} sx={{ p: 2, height: '100%', overflowY: 'auto' }}> {/* Ensure it fills height */}
      <Typography variant="h6" gutterBottom>Memory</Typography>
      <Box fontFamily="monospace" sx={{ maxHeight: '500px', overflowY: 'scroll' }}> {/* Example: Scrollable Box */}
         {/* Very basic display - enhance later */}
         {state.memory.slice(0, 50).map((value, index) => ( // Show first 50 words
            <div key={index}>
              {index.toString(16).padStart(3, '0').toUpperCase()}: {value.toString(16).padStart(4, '0').toUpperCase()}
            </div>
         ))}
       </Box>
    </Paper>
  );
}
export default MemoryView;