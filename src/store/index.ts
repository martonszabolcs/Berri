import { configureStore } from '@reduxjs/toolkit';
import appReducer from './appSlice';
import settingsReducer from './settingsSlice';
import uploadReducer from './uploadSlice';
import { setStore } from './storeRef';

export const store = configureStore({
  reducer: {
    app: appReducer,
    settings: settingsReducer,
    upload: uploadReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
  devTools: __DEV__,
});

// Register store reference for API files (breaks circular dependency)
setStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;