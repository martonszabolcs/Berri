import { configureStore } from '@reduxjs/toolkit';
import appReducer from './appSlice';
import settingsReducer from './settingsSlice';
import uploadReducer from './uploadSlice';

// Console logger middleware for Chrome DevTools
const consoleLoggerMiddleware = (store: any) => (next: any) => (action: any) => {
  if (__DEV__) {
    console.group(`🔄 Redux Action: ${action.type}`);
    console.log('📊 Previous State:', store.getState());
    console.log('⚡ Action:', action);
  }
  
  const result = next(action);
  
  if (__DEV__) {
    console.log('📈 Next State:', store.getState());
    console.groupEnd();
  }
  
  return result;
};

export const store = configureStore({
  reducer: {
    app: appReducer,
    settings: settingsReducer,
    upload: uploadReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(__DEV__ ? [consoleLoggerMiddleware] : []),
  // Enhanced DevTools for Chrome
  devTools: __DEV__,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;