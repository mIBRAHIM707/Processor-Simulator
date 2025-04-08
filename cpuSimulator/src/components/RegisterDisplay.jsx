// src/components/RegisterDisplay.jsx
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import { useCpuState } from '../context/CpuContext'; // Import the custom hook

// Helper function to format numbers as hex (adjust padding as needed)
const formatHex = (value, bits = 16) => {
    // Handle potential undefined/null values safely
    const numValue = Number(value) || 0;
    const hexValue = numValue.toString(16).toUpperCase();
    const padding = Math.ceil(bits / 4); // 4 bits per hex digit
    return '0x' + hexValue.padStart(padding, '0');
};

function RegisterDisplay() { // No props needed anymore
    const { state } = useCpuState(); // Get state from context
    const { registers } = state; // Destructure registers from state

    return (
        <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
                Registers
            </Typography>
            <Grid container spacing={1}>
                <Grid item xs={6}><Typography variant="body2">PC:</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(registers.pc, 9)}</Typography></Grid>

                <Grid item xs={6}><Typography variant="body2">AR:</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(registers.ar, 9)}</Typography></Grid>

                <Grid item xs={6}><Typography variant="body2">ACC:</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(registers.acc, 16)}</Typography></Grid>

                <Grid item xs={6}><Typography variant="body2">DR:</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(registers.dr, 16)}</Typography></Grid>

                <Grid item xs={6}><Typography variant="body2">TR:</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(registers.tr, 16)}</Typography></Grid>

                <Grid item xs={6}><Typography variant="body2">PR:</Typography></Grid>
                <Grid item xs={6}><Typography variant="body2" fontFamily="monospace">{formatHex(registers.pr, 8)}</Typography></Grid>
            </Grid>
        </Paper>
    );
}

export default RegisterDisplay;