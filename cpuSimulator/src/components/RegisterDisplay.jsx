// src/components/RegisterDisplay.jsx
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid'; // Use Grid for internal layout

// Helper function to format numbers as hex (adjust padding as needed)
const formatHex = (value, bits = 16) => {
  const hexValue = (value || 0).toString(16).toUpperCase();
  const padding = Math.ceil(bits / 4); // 4 bits per hex digit
  return '0x' + hexValue.padStart(padding, '0');
};

function RegisterDisplay(props) {
  // Destructure props later (e.g., const { acc, pc, ar, dr, tr, flags, pr } = props;)
  // For now, use dummy data or passed-in props
  const {
    acc = 0, pc = 0, ar = 0, dr = 0, tr = 0, pr = 0, // Add flags later
  } = props;

  return (
    <Paper elevation={3} sx={{ p: 2 }}> {/* Outer container with padding */}
      <Typography variant="h6" gutterBottom>
        Registers
      </Typography>
      <Grid container spacing={1}> {/* Grid to arrange registers */}
        {/* Use Grid items for each register pair */}
        <Grid item xs={6}><Typography variant="body2">PC:</Typography></Grid>
        <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(pc, 9)}</Typography></Grid>

        <Grid item xs={6}><Typography variant="body2">AR:</Typography></Grid>
        <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(ar, 9)}</Typography></Grid>

        <Grid item xs={6}><Typography variant="body2">ACC:</Typography></Grid>
        <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(acc, 16)}</Typography></Grid>

        <Grid item xs={6}><Typography variant="body2">DR:</Typography></Grid>
        <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(dr, 16)}</Typography></Grid>

        <Grid item xs={6}><Typography variant="body2">TR:</Typography></Grid>
        <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(tr, 16)}</Typography></Grid>

        <Grid item xs={6}><Typography variant="body2">PR:</Typography></Grid>
        <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(pr, 8)}</Typography></Grid>

        {/* Add Flags display here later */}

      </Grid>
    </Paper>
  );
}

export default RegisterDisplay;