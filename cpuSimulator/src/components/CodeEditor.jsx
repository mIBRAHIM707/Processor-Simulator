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
    <Paper elevation={3} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Assembly Code</Typography>
      <TextField
        id="assembly-code-editor" // Add an ID for potential debugging/styling
        label="Enter code" // Add a label for better UX/accessibility
        multiline // *** THIS IS THE KEY PROP ***
        rows={10} // Suggests minimum height (can grow if needed)
        fullWidth // Takes full width of its container
        variant="outlined" // Or "filled" or "standard"
        value={assemblyCode}
        onChange={(e) => setAssemblyCode(e.target.value)}
        placeholder="Example:
LDA 0x10
(CS) ADD 0x11 ; Add if carry set
STA 0x12" // Use 
 for newline in placeholder
        InputProps={{ sx: { fontFamily: 'monospace', // Monospace for code
                            // Optional: Define specific height if rows isn't working
                            // height: '250px',
                            // overflow: 'auto' // Ensure scrollbar appears if content exceeds height
                         } }}
        sx={{ mb: 1 }} // Add margin below the text field
      />
      <Box> {/* Keep button below */}
        <Button variant="contained" onClick={handleAssembleLoad}>
          Assemble & Load
        </Button>
      </Box>
    </Paper>
  );
}
export default CodeEditor;