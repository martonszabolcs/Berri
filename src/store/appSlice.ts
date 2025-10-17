import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  currentScreen: string;
  isLoading: boolean;
  user: {
    id: string | null;
    name: string | null;
    email: string | null;
  };
}

const initialState: AppState = {
  currentScreen: 'Home',
  isLoading: false,
  user: {
    id: null,
    name: null,
    email: null,
  },
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setCurrentScreen: (state, action: PayloadAction<string>) => {
      state.currentScreen = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setUser: (state, action: PayloadAction<{ id: string; name: string; email: string }>) => {
      state.user = action.payload;
    },
    clearUser: (state) => {
      state.user = {
        id: null,
        name: null,
        email: null,
      };
    },
  },
});

export const { setCurrentScreen, setLoading, setUser, clearUser } = appSlice.actions;
export default appSlice.reducer;