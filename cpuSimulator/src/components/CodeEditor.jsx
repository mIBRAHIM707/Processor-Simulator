import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

function CodeEditor() {
  const [assemblyCode, setAssemblyCode] = useState(''); // Local state for editor content

  // TODO: Connect this to an assembler function and LOAD_CODE dispatch

  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Assembly Code</Typography>
       <TextField
         multiline
         rows={10} // Adjust height as needed
         fullWidth
         variant="outlined"
         value={assemblyCode}
         onChange={(e) => setAssemblyCode(e.target.value)}
         placeholder="Enter assembly code here..."
         InputProps={{ sx: { fontFamily: 'monospace' } }} // Monospace font
       />
       {/* Add Assemble button here later */}
    </Paper>
  );
}
export default CodeEditor;