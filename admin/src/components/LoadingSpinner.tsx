import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  fullHeight?: boolean;
}

export default function LoadingSpinner({ message, fullHeight = true }: LoadingSpinnerProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      gap={2}
      minHeight={fullHeight ? '60vh' : 'auto'}
      p={4}
    >
      <CircularProgress size={48} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
}
