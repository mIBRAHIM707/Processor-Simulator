// src/components/CodeEditor.jsx
import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField'; // Ensure this is imported
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { useCpuState } from '../context/CpuContext';
import { assemble } from '../logic/assembler';

function CodeEditor() {
  const [assemblyCode, setAssemblyCode] = useState('');
  const { dispatch } = useCpuState();

  const handleAssembleLoad = () => {
    try {
      const machineCode = assemble(assemblyCode);
      dispatch({ type: 'LOAD_CODE', payload: machineCode });
      dispatch({ type: 'UPDATE_LOG', payload: `Assembly successful. ${machineCode.length} words loaded.` });
    } catch (error) {
      console.error("Assembly Error:", error);
      let errorMessage = `Assembly Error: ${error.message}`;
      // Add line number if available from our custom error
      if (error.lineNumber) {
         errorMessage = `Assembly Error (Line ${error.lineNumber}): ${error.message.replace(` (Line ${error.lineNumber})`, '')}`; // Avoid duplicate line info
      }
      dispatch({ type: 'UPDATE_LOG', payload: errorMessage });
    }
  };

  return (
    // Make Paper fill height if needed within its parent Box
    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography variant="h6" gutterBottom color="text.primary">Assembly Code</Typography>
      <TextField
        id="assembly-code-editor"
        label="Enter code"
        multiline
        // Let TextField grow and shrink, manage height via parent Box
        fullWidth
        variant="outlined" // Using theme defaults now
        value={assemblyCode}
        onChange={(e) => setAssemblyCode(e.target.value)}
        placeholder={`Example:\nLDA 0x10\n(CS) ADD 0x11\nSTA 0x12`} // Use newline character directly in template literal
        InputProps={{ sx: {
             fontFamily: 'monospace',
             flexGrow: 1, // Allow input area to grow
             overflow: 'auto' // Ensure scrollbar within input
           } }}
        sx={{ mb: 1, flexGrow: 1, '& .MuiInputBase-root': { height: '100%' } }} // Make TextField take available space
      />
      <Box sx={{ pt: 1, flexShrink: 0 }}> {/* Prevent button from shrinking */}
        <Button
            variant="contained"
            color="primary" // Use primary color
            onClick={handleAssembleLoad}>
          Assemble & Load
        </Button>
      </Box>
    </Paper>
  );
}
export default CodeEditor;