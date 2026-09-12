import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '@api/authApi';
import type { User } from '@api/types';

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const token = localStorage.getItem('token');
const refreshToken = localStorage.getItem('refreshToken');
const storedUser = localStorage.getItem('user');

const initialState: AuthState = {
  user: storedUser ? (JSON.parse(storedUser) as User) : null,
  token: token ?? null,
  refreshToken: refreshToken ?? null,
  isAuthenticated: !!token,
  isLoading: false,
  error: null,
};

export const loginAsync = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.login(email, password);
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.user));
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message ?? 'Login failed');
    }
  }
);

export const logoutAsync = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await authApi.logout();
  } catch {
    // ignore errors on logout
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }
});

export const getMeAsync = createAsyncThunk('auth/getMe', async (_, { rejectWithValue }) => {
  try {
    const user = await authApi.getMe();
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch (error: any) {
    return rejectWithValue(error.message ?? 'Failed to get user');
  }
});

export const refreshTokenAsync = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.refreshToken();
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message ?? 'Token refresh failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ token: string; refreshToken: string; user: User }>
    ) => {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      state.isAuthenticated = true;
    },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    updateProfile: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      .addCase(logoutAsync.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      })
      .addCase(getMeAsync.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(getMeAsync.rejected, (state) => {
        state.isAuthenticated = false;
        state.token = null;
        state.refreshToken = null;
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      })
      .addCase(refreshTokenAsync.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(refreshTokenAsync.rejected, (state) => {
        state.isAuthenticated = false;
        state.token = null;
        state.refreshToken = null;
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      });
  },
});

export const { setCredentials, clearAuth, updateProfile } = authSlice.actions;
export default authSlice.reducer;
