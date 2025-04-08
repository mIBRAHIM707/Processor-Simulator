// src/App.jsx
import React, { useState } from 'react'; // Import useState
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box'; // Use Box for spacing/wrapping if needed
import CssBaseline from '@mui/material/CssBaseline'; // Normalizes styles

// Import our custom component
import RegisterDisplay from './components/RegisterDisplay';

function App() {
  // --- State for CPU Registers (Dummy Initial Values) ---
  // We'll replace this with useReducer/Context later
  const [registers, setRegisters] = useState({
    acc: 0xABCD,
    pc: 0x01A,
    ar: 0x0FE,
    dr: 0x1234,
    tr: 0xFFFF,
    pr: 0b10100101, // Example Predicate Register value
    // flags: { Z: 0, C: 1, N: 0, V: 0 } // Add flags state later
  });
  // -------------------------------------------------------

  return (
    <>
      <CssBaseline /> {/* Apply baseline styles */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CE222 CPU Simulator
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}> {/* Main content container with margins */}
        <Grid container spacing={3}> {/* Main layout grid */}

          {/* --- Left Column (Example: Code Editor + Controls) --- */}
          <Grid item xs={12} md={6}> {/* Takes full width on small, half on medium+ */}
            <Box sx={{ border: '1px dashed grey', minHeight: '200px', p: 1 }}>
              <Typography>Code Editor / Controls Area (Placeholder)</Typography>
            </Box>
          </Grid>

          {/* --- Right Column (Example: CPU State) --- */}
          <Grid item xs={12} md={6}>
             {/* Use the RegisterDisplay component and pass state */}
             <RegisterDisplay
               acc={registers.acc}
               pc={registers.pc}
               ar={registers.ar}
               dr={registers.dr}
               tr={registers.tr}
               pr={registers.pr}
             />

             {/* Add other state displays (Flags, PR, Memory) here later */}
             <Box sx={{ border: '1px dashed grey', minHeight: '100px', p: 1, mt: 2 }}>
               <Typography>Flags / Memory Area (Placeholders)</Typography>
             </Box>
          </Grid>

          {/* --- Bottom Row (Example: Output Log) --- */}
          <Grid item xs={12}>
             <Box sx={{ border: '1px dashed grey', minHeight: '100px', p: 1 }}>
               <Typography>Output Log Area (Placeholder)</Typography>
             </Box>
          </Grid>

        </Grid>
      </Container>
    </>
  );
}

export default App;