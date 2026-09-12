import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material/Chip';

interface StatusBadgeProps {
  label: string;
  color?: ChipProps['color'];
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
}

export default function StatusBadge({
  label,
  color = 'default',
  size = 'small',
  variant = 'filled',
}: StatusBadgeProps) {
  return <Chip label={label} color={color} size={size} variant={variant} />;
}
