// src/App.jsx
import React, { useEffect, useRef } from 'react';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid'; // Assuming stable v5 Grid import
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// Import components
import RegisterDisplay from './components/RegisterDisplay';
// Import other components we will create
import FlagDisplay from './components/FlagDisplay';
import MemoryView from './components/MemoryView';
import ControlPanel from './components/ControlPanel';
import CodeEditor from './components/CodeEditor';
import OutputLog from './components/OutputLog';

function App() {
    // ... (useEffect logic for run loop) ...
  
    return (
      // Removed Fragment, CssBaseline - ThemeProvider/CssBaseline are in main.jsx
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}> {/* Ensure main Box takes full height and uses theme background */}
        <AppBar position="static" /* Removed elevation={0} as it's default now */ >
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}> {/* Bolder title */}
              CE222 CPU Simulator
            </Typography>
          </Toolbar>
        </AppBar>
  
        <Container maxWidth="xl" sx={{ mt: 3, mb: 3, flexGrow: 1 }}> {/* Reduced margins slightly, allow container to grow */}
          <Grid container spacing={2}> {/* Reduced spacing slightly */}
  
            {/* --- Left Column --- */}
            <Grid xs={12} md={5}>
              <Box sx={{ mb: 2 }}>
                <CodeEditor />
              </Box>
              <Box>
                <ControlPanel />
              </Box>
            </Grid>
  
            {/* --- Middle Column --- */}
            <Grid xs={12} md={4}>
              <Box sx={{ mb: 2 }}>
                <RegisterDisplay />
              </Box>
              <Box>
                <FlagDisplay />
              </Box>
            </Grid>
  
            {/* --- Right Column --- */}
            <Grid xs={12} md={3} sx={{ display: 'flex', flexDirection: 'column' }}> {/* Make grid item flex container */}
               {/* Memory View taking most space */}
               <Box sx={{ flexGrow: 1, overflow: 'hidden', mb: 2 }}> {/* Allow MemoryView Box to grow and handle overflow */}
                  <MemoryView />
               </Box>
               {/* Output Log fixed height at bottom */}
               <Box sx={{ height: '150px', flexShrink: 0 }}> {/* Prevent Log from shrinking */}
                  <OutputLog />
               </Box>
            </Grid>
  
          </Grid>
        </Container>
      </Box>
    );
  }
  
  export default App;