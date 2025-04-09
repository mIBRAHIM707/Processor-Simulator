// src/components/CodeEditor.jsx
import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { useCpuState } from '../context/CpuContext';
import { assemble } from '../logic/assembler'; // Ensure assemble is imported

function CodeEditor() {
  const [assemblyCode, setAssemblyCode] = useState('');
  const { dispatch } = useCpuState();

  const handleAssembleLoad = () => {
    try {
      // Assemble returns a Map now
      const memoryMap = assemble(assemblyCode); // Changed variable name for clarity
      dispatch({ type: 'LOAD_CODE', payload: memoryMap }); // Pass the Map

      // *** FIX HERE: Use memoryMap.size instead of machineCode.length ***
      const wordCount = memoryMap.size; // Get the number of entries in the Map
      dispatch({ type: 'UPDATE_LOG', payload: `Assembly successful. ${wordCount} words mapped.` }); // Update log message

    } catch (error) {
      console.error("Assembly Error:", error);
      let errorMessage = `Assembly Error: ${error.message}`;
      if (error.lineNumber) {
         errorMessage = `Assembly Error (Line ${error.lineNumber}): ${error.message.replace(` (Line ${error.lineNumber})`, '')}`;
      }
      dispatch({ type: 'UPDATE_LOG', payload: errorMessage });
    }
  };

  return (
    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
       <Typography variant="h6" gutterBottom color="text.primary">Assembly Code</Typography>
       <TextField
        id="assembly-code-editor"
        label="Enter code"
        multiline
        fullWidth
        variant="outlined"
        value={assemblyCode}
        onChange={(e) => setAssemblyCode(e.target.value)}
        placeholder={`.ORG 0x00\nLDA 0x10\nHALT\n\n.ORG 0x10\n.WORD 0xABCD`}
        InputProps={{ sx: {
             fontFamily: 'monospace',
             flexGrow: 1,
             overflow: 'auto'
           } }}
        sx={{ mb: 1, flexGrow: 1, '& .MuiInputBase-root': { height: '100%' } }}
      />
      <Box sx={{ pt: 1, flexShrink: 0 }}>
        <Button
            variant="contained"
            color="primary"
            onClick={handleAssembleLoad}>
          Assemble & Load
        </Button>
      </Box>
    </Paper>
  );
}
export default CodeEditor;