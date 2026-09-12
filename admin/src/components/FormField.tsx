import { FormControl, FormHelperText, InputLabel, Select, MenuItem, TextField, Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { Control, Controller, FieldError } from 'react-hook-form';

interface FormFieldProps {
  name: string;
  label: string;
  control: Control<any>;
  error?: FieldError;
  type?: 'text' | 'email' | 'password' | 'number' | 'date';
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  fullWidth?: boolean;
  select?: boolean;
  options?: { value: string | number; label: string }[];
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function FormField({
  name,
  label,
  control,
  error,
  type = 'text',
  multiline = false,
  rows = 3,
  required = false,
  fullWidth = true,
  select = false,
  options = [],
  helperText,
  placeholder,
  disabled = false,
}: FormFieldProps) {
  const errorMsg = error?.message || helperText;

  if (select) {
    return (
      <FormControl fullWidth={fullWidth} error={!!error} disabled={disabled} margin="normal">
        <InputLabel>{label}{required && ' *'}</InputLabel>
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <Select {...field} label={label} required={required}>
              {options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          )}
        />
        {errorMsg && <FormHelperText>{errorMsg}</FormHelperText>}
      </FormControl>
    );
  }

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextField
          {...field}
          label={label}
          type={type}
          multiline={multiline}
          rows={multiline ? rows : undefined}
          required={required}
          fullWidth={fullWidth}
          error={!!error}
          helperText={errorMsg}
          placeholder={placeholder}
          disabled={disabled}
          margin="normal"
        />
      )}
    />
  );
}
