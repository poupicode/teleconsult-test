// src/lib/peerInstance.ts
import { PeerConnection, Role } from '@/features/room/rtc/peer/connection/peer-connection';

const clientId = crypto.randomUUID(); // ou vrai ID utilisateur
const roomId = 'room-demo'; // à remplacer selon contexte

export const peer = new PeerConnection(roomId, clientId, Role.PRACTITIONER); // ou Role.PATIENT
