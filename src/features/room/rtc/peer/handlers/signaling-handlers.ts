// Gestionnaires pour les messages de signalisation

import { SignalingService } from '../../signaling';

export async function handleOffer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit, signaling: SignalingService, roomId: string) {
    if (pc.signalingState !== 'stable') {
        console.log('[WebRTC] Signaling state is not stable, ignoring offer');
        return;
    }

    try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('[WebRTC] Set remote description (offer)');

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WebRTC] Created and set local description (answer)');

        signaling.sendMessage({
            type: 'answer',
            roomId: roomId,
            content: pc.localDescription as RTCSessionDescriptionInit
        });
    } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
    }
}

export async function handleAnswer(pc: RTCPeerConnection, answer: RTCSessionDescriptionInit) {
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('[WebRTC] Set remote description (answer)');
    } catch (err) {
        console.error('[WebRTC] Error handling answer:', err);
    }
}

export async function handleIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit) {
    try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[WebRTC] Added ICE candidate');
    } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
    }
}

export async function createOffer(pc: RTCPeerConnection, signaling: SignalingService, roomId: string) {
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('[WebRTC] Created and set local description (offer)');

        signaling.sendMessage({
            type: 'offer',
            roomId: roomId,
            content: pc.localDescription as RTCSessionDescriptionInit
        });
    } catch (err) {
        console.error('[WebRTC] Error creating offer:', err);
    }
}