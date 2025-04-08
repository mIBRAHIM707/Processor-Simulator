import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useCpuState } from '../context/CpuContext'; // Import hook
import Chip from '@mui/material/Chip'; // Use Chips for flags
import Stack from '@mui/material/Stack';

function FlagDisplay() {
  const { state } = useCpuState();
  const { flags } = state;

  const renderFlag = (name, value) => (
    <Chip
      key={name}
      label={`${name}: ${value}`}
      size="small"
      variant={value ? "filled" : "outlined"} // Filled if set, outlined if not
      color={value ? "primary" : "default"} // Use primary color if set
      sx={{ fontFamily: 'monospace' }}
    />
  );

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom color="text.primary">Flags</Typography>
      <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap"> {/* Center flags */}
        {renderFlag("Z", flags.Z)}
        {renderFlag("C", flags.C)}
        {renderFlag("N", flags.N)}
        {renderFlag("V", flags.V)}
      </Stack>
    </Paper>
  );
}
export default FlagDisplay;