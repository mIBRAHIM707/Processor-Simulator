// src/App.jsx
import React from 'react'; // No longer need useState here
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';

// Import components
import RegisterDisplay from './components/RegisterDisplay';
// Import other components we will create
// import FlagDisplay from './components/FlagDisplay';
// import MemoryView from './components/MemoryView';
// import ControlPanel from './components/ControlPanel';
// import CodeEditor from './components/CodeEditor';
// import OutputLog from './components/OutputLog';

function App() {
  // No more useState for registers here! State is managed by context.

  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CE222 CPU Simulator
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}> {/* Use xl for more space */}
        <Grid container spacing={3}>

          {/* --- Left Column --- */}
          <Grid item xs={12} md={5}> {/* Adjust column width */}
            <Box sx={{ mb: 2 }}> {/* Add margin bottom */}
               {/* <CodeEditor /> Placeholder */}
               <Paper sx={{ p: 2, border: '1px dashed grey', minHeight: '200px' }}> Code Editor Placeholder</Paper>
             </Box>
            <Box>
               {/* <ControlPanel /> Placeholder */}
               <Paper sx={{ p: 2, border: '1px dashed grey' }}> Control Panel Placeholder (Reset Button Here)</Paper>
             </Box>
          </Grid>

          {/* --- Middle Column --- */}
          <Grid item xs={12} md={4}> {/* Adjust column width */}
            <Box sx={{ mb: 2 }}>
              <RegisterDisplay /> {/* It gets state from context */}
            </Box>
            <Box>
               {/* <FlagDisplay /> Placeholder */}
               <Paper sx={{ p: 2, border: '1px dashed grey' }}> Flags Placeholder</Paper>
             </Box>
          </Grid>

          {/* --- Right Column --- */}
           <Grid item xs={12} md={3}> {/* Adjust column width */}
             <Box sx={{ height: 'calc(100vh - 150px)', overflowY: 'auto', mb: 2 }}> {/* Make memory scrollable */}
               {/* <MemoryView /> Placeholder */}
               <Paper sx={{ p: 2, border: '1px dashed grey', minHeight: '400px' }}> Memory View Placeholder </Paper>
             </Box>
             <Box>
               {/* <OutputLog /> Placeholder */}
                <Paper sx={{ p: 2, border: '1px dashed grey', minHeight: '100px' }}> Output Log Placeholder</Paper>
             </Box>
          </Grid>

        </Grid>
      </Container>
    </>
  );
}

export default App;