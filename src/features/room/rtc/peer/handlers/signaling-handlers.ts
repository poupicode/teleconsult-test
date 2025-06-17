// Signaling message handlers

import { SignalingService } from '../../signaling';

export async function handleOffer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit, signaling: SignalingService, roomId: string) {
    if (pc.signalingState !== 'stable') {
        console.log('[WebRTC] Signaling state is not stable, ignoring offer');
        return;
    }

    try {
        // W3C Compliant: setRemoteDescription accepts RTCSessionDescriptionInit directly
        await pc.setRemoteDescription(offer);
        console.log('[WebRTC] Set remote description (offer)');

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WebRTC] Created and set local description (answer)');

        signaling.sendMessage({
            type: 'answer',
            roomId: roomId,
            content: pc.localDescription as RTCSessionDescriptionInit
        });
    } catch (error) {
        // W3C Compliant error handling with specific error types
        if (error instanceof DOMException) {
            console.error(`[WebRTC] DOM Exception handling offer: ${error.name} - ${error.message}`);
        } else {
            console.error('[WebRTC] Error handling offer:', error);
        }
    }
}

export async function handleAnswer(pc: RTCPeerConnection, answer: RTCSessionDescriptionInit) {
    try {
        // W3C Compliant: setRemoteDescription accepts RTCSessionDescriptionInit directly
        await pc.setRemoteDescription(answer);
        console.log('[WebRTC] Set remote description (answer)');
    } catch (error) {
        // W3C Compliant error handling with specific error types
        if (error instanceof DOMException) {
            console.error(`[WebRTC] DOM Exception handling answer: ${error.name} - ${error.message}`);
        } else {
            console.error('[WebRTC] Error handling answer:', error);
        }
    }
}

export async function handleIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit) {
    try {
        if (!candidate) {
            console.warn('[WebRTC] Received null ICE candidate, ignoring');
            return;
        }

        // Check that it's a valid candidate before attempting to add it
        if (typeof candidate.candidate === 'string' && candidate.candidate !== '') {
            // Check connection state before adding the candidate
            if (pc.signalingState === 'closed') {
                console.warn('[WebRTC-ICE] ⚠️ Cannot add ICE candidate: peer connection is closed');
                return;
            }

            // W3C Compliant: addIceCandidate accepts RTCIceCandidateInit directly
            await pc.addIceCandidate(candidate);
            console.log('[WebRTC-ICE] ✅ ICE candidate added successfully');

            // Additional log for TURN candidates
            if (candidate.candidate.includes(' typ relay ')) {
                console.log('[WebRTC-ICE] 🔄 Added TURN relay candidate successfully');
            }
        } else {
            // End of candidate collection
            console.log('[WebRTC-ICE] 🏁 End of candidates marker received');
        }
    } catch (error) {
        // W3C Compliant error handling with specific error types
        if (error instanceof DOMException) {
            console.error(`[WebRTC] DOM Exception adding ICE candidate: ${error.name} - ${error.message}`);
            console.error('[WebRTC] 🔍 Failed candidate:', candidate);
        } else {
            console.error('[WebRTC] ❌ Error adding ICE candidate:', error);
            console.error('[WebRTC] 🔍 Failed candidate:', candidate);
        }
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