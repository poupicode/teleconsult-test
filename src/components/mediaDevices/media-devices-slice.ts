import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type MediaDevices = MediaDeviceInfo[];

const initialState : MediaDevices = Array<MediaDeviceInfo>();

export const mediaDevicesSlice = createSlice({
    name: 'mediaDevices',
    initialState,
    reducers: {
        mediaDevicesListUpdated: (state, action: PayloadAction<MediaDevices>) => {
            state = action.payload;
        }
    }
});

export const { mediaDevicesListUpdated } = mediaDevicesSlice.actions;

export default mediaDevicesSlice.reducer;