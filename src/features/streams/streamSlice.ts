// DUCKS pattern

import { createSlice, PayloadAction } from '@reduxjs/toolkit';


// TODO: Remove StreamDetails, replace with a simple streamId string
export interface StreamDetails {
//    stream?: MediaStream;
    streamId?: string;
    //originator: string;
}

export interface StreamsByDevice {
    camera?: StreamDetails,
    instrument?: StreamDetails,
    screen?: StreamDetails,
}

export interface StreamsState {
    local: StreamsByDevice,
    remote: StreamsByDevice,
    peerConnection : StreamsByDevice,
}

const initialState: StreamsState = {
    local: {},
    remote: {},
    // peerConnection are the streams that are being sent to the remote peer
    peerConnection: {},
};

export const streamsSlice = createSlice({
    name: 'streams',
    initialState,
    reducers: {
        streamUpdated: (state, action: PayloadAction<{origin: keyof StreamsState, deviceType: keyof StreamsByDevice, streamDetails: StreamDetails}>) => {
            // Timestamp provided by store
            state[action.payload.origin][action.payload.deviceType] = action.payload.streamDetails;
        }
    }
});

export const { streamUpdated } = streamsSlice.actions;

export default streamsSlice.reducer;
