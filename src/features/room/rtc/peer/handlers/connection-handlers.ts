// WebRTC connection event handlers

import { Role } from '../models/types';

// Type of the PeerConnection class without creating circular dependency
export interface IPeerConnection {
    getRoomId: () => string;
    getRole: () => Role;
    getSignaling: () => any;
    isRoomReady: () => boolean;
    createOffer: () => Promise<void>;
    setDataChannel: (channel: RTCDataChannel) => void;
    getOnConnectionStateChangeCallback: () => ((state: RTCPeerConnectionState) => void) | null;
    getDataChannelManager: () => any; // Added missing method
}

export function setupPeerConnectionListeners(peerConnection: IPeerConnection, pc: RTCPeerConnection) {
    // Note: ICE candidate handling is now managed in setupIceDebugging() to avoid conflicts
    // This ensures proper debugging and consistent candidate tracking

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state changed: ${pc.connectionState}`);
        if (peerConnection.getOnConnectionStateChangeCallback()) {
            const callback = peerConnection.getOnConnectionStateChangeCallback();
            if (callback) {
                callback(pc.connectionState);
            }
        }
    };

    // Note: ICE connection state changes are handled in setupIceDebugging()
    // This avoids conflicts with the intelligent reconnection logic

    // Debug signaling state changes
    pc.onsignalingstatechange = () => {
        console.log(`[WebRTC] Signaling state: ${pc.signalingState}`);
    };

    // Note: negotiationneeded handler is managed by Perfect Negotiation
    // Perfect Negotiation handles all offer/answer logic to prevent race conditions .

    // Listen for incoming data channels (for the patient)
    pc.ondatachannel = (event) => {
        console.log(`[WebRTC] 📥 Received data channel: ${event.channel.label}`);

        if (event.channel.label === 'data-channel') {
            peerConnection.setDataChannel(event.channel);
            // Configure the data channel via the manager
            const dataChannelManager = peerConnection.getDataChannelManager();
            if (dataChannelManager && dataChannelManager.setupDataChannel) {
                dataChannelManager.setupDataChannel(event.channel);
            }
        }
    };
}