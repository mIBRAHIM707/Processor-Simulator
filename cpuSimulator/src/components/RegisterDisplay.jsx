// src/components/RegisterDisplay.jsx
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid'; // Use the stable v5 Grid location
import { useCpuState } from '../context/CpuContext'; // Import the custom hook

// Helper function to format numbers as hex (adjust padding as needed)
const formatHex = (value, bits = 16) => {
    // Handle potential undefined/null values safely
    const numValue = Number(value) || 0;
    const hexValue = numValue.toString(16).toUpperCase();
    const padding = Math.ceil(bits / 4); // 4 bits per hex digit
    return '0x' + hexValue.padStart(padding, '0');
};

function RegisterDisplay() {
    const { state } = useCpuState();
    const { registers } = state;

    const renderRegister = (name, value, bits) => (
        // Use fragments to avoid unnecessary Grid items if needed, or keep Grid
        <React.Fragment key={name}>
            <Grid xs={5} sx={{ textAlign: 'right', pr: 1 }}> {/* Align label right */}
                <Typography variant="body2" color="text.secondary">{name}:</Typography>
            </Grid>
            <Grid xs={7}>
                <Typography variant="body2" fontFamily="monospace" color="text.primary">{formatHex(value, bits)}</Typography>
            </Grid>
        </React.Fragment>
    );

    return (
        <Paper sx={{ p: 2, height: '100%' }}> {/* Allow paper to fill height if needed */}
            <Typography variant="h6" gutterBottom color="text.primary">
                Registers
            </Typography>
            <Grid container spacing={0.5} alignItems="center"> {/* Reduced spacing */}
                {renderRegister("PC", registers.pc, 9)}
                {renderRegister("AR", registers.ar, 9)}
                {renderRegister("ACC", registers.acc, 16)}
                {renderRegister("DR", registers.dr, 16)}
                {renderRegister("TR", registers.tr, 16)}
                {renderRegister("PR", registers.pr, 8)}
            </Grid>
        </Paper>
    );
}

export default RegisterDisplay;