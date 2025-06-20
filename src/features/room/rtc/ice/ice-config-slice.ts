/**
 * ICE Config Slice
 * 
 * This file defines the Redux slice for managing WebRTC ICE server configurations.
 * ICE (Interactive Connectivity Establishment) servers facilitate establishing peer connections
 * through NAT traversal, firewalls, and other network obstacles.
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Default ICE server configuration
 * Includes TURN servers to facilitate connections when direct peer-to-peer fails
 */
export const DEFAULT_ICE_CONFIG: RTCConfiguration = {
    "iceServers": [
        {
            "urls": [
                "turn:turn.ekami.ch:3478?transport=tcp",
                "turn:turn.ekami.ch:3478?transport=udp"
            ],
            "username": "wei",
            "credential": "toto1234"
        }
    ],
    iceCandidatePoolSize: 20,
    iceTransportPolicy: "all", // Use all available ICE transports
    bundlePolicy: "balanced", // Use balanced bundle policy
    rtcpMuxPolicy: "require", // Require RTCP multiplexing
};

/**
 * Interface defining the ICE configuration state
 */
interface IceConfigState {
    config: RTCConfiguration;
}

/**
 * Initial state with default ICE configuration
 */
const initialState: IceConfigState = {
    config: DEFAULT_ICE_CONFIG
};

/**
 * ICE config slice containing reducers to manage ICE server configuration
 */
const iceConfigSlice = createSlice({
    name: 'iceConfig',
    initialState,
    reducers: {
        /**
         * Updates the ICE server configuration
         */
        iceConfigUpdated(state, action: PayloadAction<RTCConfiguration>) {
            state.config = action.payload;
        },
    },
});

export const { iceConfigUpdated } = iceConfigSlice.actions;

/**
 * Thunk to retrieve and manage ICE configuration
 * Fetches from localStorage if available or uses default configuration
 */
export const getLatestIceConfig = () => {
    // Thunk Function
    return async (
        dispatch: (arg0: { type: string; payload: any }) => void,
        getState: any
    ) => {
        // Fetch the iceConfig from the localStorage if it exists
        const iceConfigFromLocalStorage = localStorage.getItem("iceConfig");

        let iceConfig = {};

        // Apply the default iceConfig if none was stored in localStorage
        if (iceConfigFromLocalStorage) {
            iceConfig = JSON.parse(iceConfigFromLocalStorage);
        } else {
            iceConfig = DEFAULT_ICE_CONFIG;
            // Store the default iceConfig in localStorage
            localStorage.setItem("iceConfig", JSON.stringify(DEFAULT_ICE_CONFIG));
        }

        // Dispatch the iceConfig to the store
        dispatch(iceConfigUpdated(iceConfig));
    };
};

export default iceConfigSlice.reducer;