// src/theme.js
import { createTheme } from '@mui/material/styles';

// Spotify Color Palette (Approximate)
const spotifyBlack = '#121212'; // Main background
const spotifyDarkGrey = '#181818'; // Surface, Paper background
const spotifyGrey = '#282828'; // Cards, elevation shade
const spotifyLightGrey = '#B3B3B3'; // Secondary text
const spotifyWhite = '#FFFFFF'; // Primary text
const spotifyGreen = '#1DB954'; // Accent color

const theme = createTheme({
  palette: {
    mode: 'dark', // Enable dark mode
    primary: {
      main: spotifyGreen, // Spotify Green for primary actions
      contrastText: spotifyWhite,
    },
    secondary: { // Can define a secondary color if needed
      main: spotifyLightGrey,
      contrastText: spotifyBlack,
    },
    background: {
      default: spotifyBlack, // Main background
      paper: spotifyDarkGrey, // Background for Paper components
    },
    text: {
      primary: spotifyWhite, // Main text color
      secondary: spotifyLightGrey, // Secondary text color (less emphasis)
    },
    divider: spotifyGrey, // Color for dividers
    action: {
      active: spotifyGreen, // Color for active icons/controls
      hover: 'rgba(29, 185, 84, 0.08)', // Hover effect using primary color
      selected: 'rgba(29, 185, 84, 0.16)',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif', // A slightly more modern font stack
    h6: {
      fontWeight: 600, // Make headings slightly bolder
    },
    body2: {
      color: spotifyLightGrey, // Default body2 to secondary text color
    },
    // Define monospace font family for specific components later via sx prop
  },
  shape: {
    borderRadius: 8, // Slightly more rounded corners
  },
  components: {
    // Default overrides for components
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Ensure no gradient backgrounds on paper
          // Use outlined variant by default? Or low elevation?
        },
      },
      defaultProps: {
         elevation: 1, // Use lower elevation by default for subtle depth
         // variant: 'outlined' // Alternative: use outlined style often
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true, // Flatter buttons often look more modern
      },
      styleOverrides: {
        root: {
          textTransform: 'none', // Keep button text case as defined
          fontWeight: 600,
        },
        containedPrimary: { // Style for primary contained buttons
           // Add specific styles if needed
        },
        containedError: { // Style for error contained buttons
           // Add specific styles if needed
        }
      }
    },
    MuiAppBar: {
       styleOverrides: {
          root: {
             backgroundColor: spotifyGrey, // Darker grey for AppBar
             backgroundImage: 'none',
             boxShadow: 'none', // Remove default shadow
             borderBottom: `1px solid ${spotifyGrey}`, // Subtle border instead
          }
       }
    },
    MuiTextField: {
       styleOverrides: {
          root: {
             '& .MuiOutlinedInput-root': {
               '& fieldset': {
                 borderColor: spotifyGrey, // Border color
               },
               '&:hover fieldset': {
                 borderColor: spotifyLightGrey, // Border on hover
               },
               '&.Mui-focused fieldset': {
                 borderColor: spotifyGreen, // Border when focused (primary color)
               },
             },
             '& label.Mui-focused': {
               color: spotifyGreen, // Label color when focused
             },
          }
       }
    }
  },
});

export default theme;