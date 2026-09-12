import { useState } from 'react';
import { Box, Card, CardContent, Typography, Button, TextField, InputAdornment, Alert, Divider, Stack } from '@mui/material';
import { Email, Lock, Visibility, VisibilityOff } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { loginAsync } from '@store/slices/authSlice';
import { useSnackbar } from 'notistack';

interface LoginForm {
  email: string;
  password: string;
}

const schema = yup.object({
  email: yup.string().email('Enter a valid email').required('Email is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const [showPassword, setShowPassword] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: yupResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      await dispatch(loginAsync({ email: data.email, password: data.password })).unwrap();
      enqueueSnackbar('Login successful', { variant: 'success' });
      navigate(from, { replace: true });
    } catch (err: any) {
      enqueueSnackbar(err.message || 'Login failed', { variant: 'error' });
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #008751 0%, #006B40 50%, #0A2A1A 100%)',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 440, width: '100%', boxShadow: 24, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #008751, #FCD116)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: 'white',
                fontSize: 22,
                mb: 2,
              }}
            >
              9T
            </Box>
            <Typography variant="h5" fontWeight={800}>
              9jaTruth Admin
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to manage the civic platform
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2}>
              <TextField
                {...register('email')}
                label="Email Address"
                type="email"
                fullWidth
                error={!!errors.email}
                helperText={errors.email?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                {...register('password')}
                label="Password"
                type={showPassword ? 'text' : 'password'}
                fullWidth
                error={!!errors.password}
                helperText={errors.password?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button onClick={() => setShowPassword(!showPassword)} size="small">
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </Button>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={isLoading}
                sx={{ mt: 2 }}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </Stack>
          </form>

          <Divider sx={{ my: 3 }} />
          <Typography variant="caption" color="text.secondary" align="center" display="block">
            Demo credentials: admin@9jatruth.ng / admin123
          </Typography>
          <Typography variant="caption" color="text.secondary" align="center" display="block" mt={1}>
            © 2024 9jaTruth. All rights reserved.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
