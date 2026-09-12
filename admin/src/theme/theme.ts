import { createTheme, Theme, ThemeOptions, responsiveFontSizes } from '@mui/material/styles';

const NIGERIAN_GREEN = '#008751';
const NIGERIAN_GREEN_DARK = '#006B40';
const NIGERIAN_YELLOW = '#FCD116';
const NIGERIAN_YELLOW_DARK = '#E6BD00';

const getDesignTokens = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: NIGERIAN_GREEN,
      light: '#00A862',
      dark: NIGERIAN_GREEN_DARK,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: NIGERIAN_YELLOW,
      light: '#FFD633',
      dark: NIGERIAN_YELLOW_DARK,
      contrastText: '#000000',
    },
    error: {
      main: '#D32F2F',
      light: '#EF5350',
      dark: '#C62828',
    },
    warning: {
      main: '#ED6C02',
      light: '#FF9800',
      dark: '#E65100',
    },
    success: {
      main: '#2E7D32',
      light: '#4CAF50',
      dark: '#1B5E20',
    },
    info: {
      main: '#0288D1',
      light: '#03A9F4',
      dark: '#01579B',
    },
    background: {
      default: mode === 'light' ? '#F5F7FA' : '#0A0F0D',
      paper: mode === 'light' ? '#FFFFFF' : '#13201A',
    },
    text: {
      primary: mode === 'light' ? '#1A1A1A' : '#E0E0E0',
      secondary: mode === 'light' ? '#666666' : '#A0A0A0',
    },
    divider: mode === 'light' ? '#E0E0E0' : '#2A3A32',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '2.5rem' },
    h2: { fontWeight: 700, fontSize: '2rem' },
    h3: { fontWeight: 600, fontSize: '1.75rem' },
    h4: { fontWeight: 600, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1.1rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#13201A',
          color: mode === 'light' ? '#1A1A1A' : '#E0E0E0',
          borderBottom: `1px solid ${mode === 'light' ? '#E0E0E0' : '#2A3A32'}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: mode === 'light' ? '#FFFFFF' : '#0A0F0D',
          borderRight: `1px solid ${mode === 'light' ? '#E0E0E0' : '#2A3A32'}`,
          width: 260,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: mode === 'light'
            ? '0 1px 3px rgba(0,0,0,0.08)'
            : '0 1px 3px rgba(0,0,0,0.3)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
        containedPrimary: {
          backgroundColor: NIGERIAN_GREEN,
          '&:hover': { backgroundColor: NIGERIAN_GREEN_DARK },
        },
        containedSecondary: {
          backgroundColor: NIGERIAN_YELLOW,
          color: '#000000',
          '&:hover': { backgroundColor: NIGERIAN_YELLOW_DARK },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: mode === 'light' ? '#F5F7FA' : '#1A2A22',
        },
      },
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: 'none',
          borderRadius: 12,
          overflow: 'hidden',
        },
      },
    },
  },
});

export function getTheme(mode: 'light' | 'dark'): Theme {
  return responsiveFontSizes(createTheme(getDesignTokens(mode)));
}

export const lightTheme = getTheme('light');
export const darkTheme = getTheme('dark');
