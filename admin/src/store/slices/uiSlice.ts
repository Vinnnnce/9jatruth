import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
  sidebarOpen: boolean;
  darkMode: boolean;
  loading: boolean;
  loadingMessage: string | null;
}

const storedDarkMode = localStorage.getItem('darkMode') === 'true';

const initialState: UIState = {
  sidebarOpen: true,
  darkMode: storedDarkMode,
  loading: false,
  loadingMessage: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    toggleDarkMode: (state) => {
      state.darkMode = !state.darkMode;
      localStorage.setItem('darkMode', String(state.darkMode));
    },
    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.darkMode = action.payload;
      localStorage.setItem('darkMode', String(action.payload));
    },
    setLoading: (state, action: PayloadAction<{ loading: boolean; message?: string }>) => {
      state.loading = action.payload.loading;
      state.loadingMessage = action.payload.message ?? null;
    },
  },
});

export const { toggleSidebar, setSidebarOpen, toggleDarkMode, setDarkMode, setLoading } =
  uiSlice.actions;

export default uiSlice.reducer;
