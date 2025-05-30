// Gestionnaires d'événements liés à la connexion WebRTC

import { Role } from '../models/types';

// Type de la classe PeerConnection sans créer de dépendance circulaire
export interface IPeerConnection {
    getRoomId: () => string;
    getRole: () => Role;
    getSignaling: () => any;
    isRoomReady: () => boolean;
    createOffer: () => Promise<void>;
    setDataChannel: (channel: RTCDataChannel) => void;
    setupDataChannel: (channel: RTCDataChannel) => void;
    getOnConnectionStateChangeCallback: () => ((state: RTCPeerConnectionState) => void) | null;
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

    // Debug ice connection state changes
    pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE connection state: ${pc.iceConnectionState}`);
    };

    // Debug signaling state changes
    pc.onsignalingstatechange = () => {
        console.log(`[WebRTC] Signaling state: ${pc.signalingState}`);
    };

    // Handle negotiation needed
    pc.onnegotiationneeded = async () => {
        try {
            console.log(`[WebRTC] Negotiation needed, role: ${peerConnection.getRole()}`);

            // Vérifier si on est prêt pour la négociation (patient et praticien présents)
            if (peerConnection.isRoomReady() && peerConnection.getRole() === Role.PRACTITIONER) {
                await peerConnection.createOffer();
            } else {
                console.log('[WebRTC] Not ready to negotiate yet or not a practitioner');
            }
        } catch (err) {
            console.error('[WebRTC] Error during negotiation:', err);
        }
    };

    // Écouter les data channels entrants (pour le patient)
    pc.ondatachannel = (event) => {
        console.log(`[WebRTC] Received data channel: ${event.channel.label}`);

        if (event.channel.label === 'data-channel') {
            peerConnection.setDataChannel(event.channel);
            peerConnection.setupDataChannel(event.channel);
        }
    };
}