import { configureStore } from '@reduxjs/toolkit';
import sessionReducer from '../features/auth/session/session-slice';
import userReducer from '../features/auth/user/user-slice';

export const store = configureStore({
    reducer: {
        session: sessionReducer,
        user: userReducer,
    },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;