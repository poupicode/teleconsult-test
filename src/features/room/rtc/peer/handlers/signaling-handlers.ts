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
        if (!candidate) {
            console.warn('[WebRTC] Received null ICE candidate, ignoring');
            return;
        }

        // Vérifier que c'est un candidat valide avant de tenter de l'ajouter
        if (typeof candidate.candidate === 'string' && candidate.candidate !== '') {
            // Vérifier l'état de la connexion avant d'ajouter le candidat
            if (pc.signalingState === 'closed') {
                console.warn('[WebRTC-ICE] Cannot add ICE candidate: peer connection is closed');
                return;
            }

            // Ajouter le candidat ICE
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('[WebRTC-ICE] ICE candidate added successfully');

            // Log additionnel pour les candidats TURN
            if (candidate.candidate.includes(' typ relay ')) {
                console.log('[WebRTC-ICE] Added TURN relay candidate successfully');
            }
        } else {
            // Fin de la collecte des candidats
            console.log('[WebRTC-ICE] End of candidates marker received');
        }
    } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
        console.error('[WebRTC] Failed candidate:', candidate);

        // Log détaillé de l'erreur pour diagnostic
        if (err instanceof Error) {
            console.error('[WebRTC] Error details:', err.message);
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