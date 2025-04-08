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
import FlagDisplay from './components/FlagDisplay';
import MemoryView from './components/MemoryView';
import ControlPanel from './components/ControlPanel';
import CodeEditor from './components/CodeEditor';
import OutputLog from './components/OutputLog';

function App() {
  return (
    <>
      {/* ... (AppBar) ... */}
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>

          {/* --- Left Column --- */}
          <Grid item xs={12} md={5}>
            <Box sx={{ mb: 2 }}>
              <CodeEditor /> {/* Use actual component */}
            </Box>
            <Box>
              <ControlPanel /> {/* Use actual component */}
            </Box>
          </Grid>

          {/* --- Middle Column --- */}
          <Grid item xs={12} md={4}>
            <Box sx={{ mb: 2 }}>
              <RegisterDisplay />
            </Box>
            <Box>
              <FlagDisplay /> {/* Use actual component */}
            </Box>
          </Grid>

          {/* --- Right Column --- */}
          <Grid item xs={12} md={3}>
            <Box sx={{ height: 'calc(100vh - 200px)', mb: 2 }}> {/* Adjusted height calc */}
               <MemoryView /> {/* Use actual component */}
             </Box>
            <Box sx={{ height: '150px' }}> {/* Give Log fixed height */}
               <OutputLog /> {/* Use actual component */}
             </Box>
          </Grid>

        </Grid>
      </Container>
    </>
  );
}

export default App;