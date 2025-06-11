import { configureStore } from '@reduxjs/toolkit';
import sessionReducer from '../features/auth/session/session-slice';
import userReducer from '../features/auth/user/user-slice';
import roomReducer from '../features/room/roomSlice';
import iceConfigReducer from '../features/room/rtc/ice/ice-config-slice';
import chatReducer from '../features/chat/chatSlice';
import selectedStreamReducer from '@/features/streams/selected-stream-slice';
import streamReducer from '@/features/streams/streamSlice';

export const store = configureStore({
    reducer: {
        session: sessionReducer,
        user: userReducer,
        room: roomReducer,
        iceConfig: iceConfigReducer,
        chat: chatReducer,
        selectedStream: selectedStreamReducer,
        streams: streamReducer,
    },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;