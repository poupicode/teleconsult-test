// DUCKS pattern

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const initialState = {
    streamId: "",
};

export const selectedStreamSlice = createSlice({
    name: 'selectedStream',
    initialState,
    reducers: {
        selectedStreamUpdated: (state, action: PayloadAction<string>) => {
            state.streamId = action.payload;
        }
    }
});

export const { selectedStreamUpdated } = selectedStreamSlice.actions;

export default selectedStreamSlice.reducer;

// Path: src/features/chat/chat.tsx