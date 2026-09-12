import { Box, Typography, Button } from '@mui/material';
import type { ReactNode } from 'react';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({
  title = 'No Data Found',
  message = 'There are no items to display at this time.',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      gap={2}
      py={8}
      px={4}
      textAlign="center"
    >
      {icon || <InboxOutlinedIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
      <Typography variant="h6" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" maxWidth={400}>
        {message}
      </Typography>
      {action}
    </Box>
  );
}
