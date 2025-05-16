// Simplified WebRTC peer connection implementation for basic connectivity

import { SignalingService, SignalingMessage, UserPresence } from './signaling';
import { store } from '@/app/store';
import { DEFAULT_ICE_CONFIG, getLatestIceConfig } from './ice/ice-config-slice';
import { messageReceived } from '@/features/chat/chatSlice';

export enum Role {
    PATIENT = 'patient',
    PRACTITIONER = 'practitioner'
}

// Interface pour les messages de DataChannel
export interface DataChannelMessage {
    type: string;
    payload: any;
    sender: string;
    senderRole: Role;
    timestamp: number;
}

// Interface spécifique pour les messages de chat
export interface ChatMessage {
    sender: string;
    senderRole: Role;
    content: string;
    timestamp: number;
}

// Amélioration du typage des messages de signalisation
interface OfferMessage {
    type: 'offer';
    content: RTCSessionDescriptionInit;
}

interface AnswerMessage {
    type: 'answer';
    content: RTCSessionDescriptionInit;
}

interface IceCandidateMessage {
    type: 'ice-candidate';
    content: RTCIceCandidateInit;
}

type TypedSignalingMessage = OfferMessage | AnswerMessage | IceCandidateMessage;

export class PeerConnection {
    private pc: RTCPeerConnection;
    private signaling: SignalingService;
    private role: Role;
    private roomId: string;
    private clientId: string;
    private dataChannel: RTCDataChannel | null = null;
    private readyToNegotiate: boolean = false;

    // Simple connection state callback
    private onConnectionStateChangeCallback: ((state: RTCPeerConnectionState) => void) | null = null;
    private onRoomReadyCallback: ((isReady: boolean) => void) | null = null;
    private onChatMessageCallback: ((message: ChatMessage) => void) | null = null;

    constructor(roomId: string, clientId: string, role: Role) {
        console.log(`[WebRTC] Creating PeerConnection with role: ${role}, roomId: ${roomId}, clientId: ${clientId}`);
        this.roomId = roomId;
        this.clientId = clientId;
        this.role = role;

        // Dispatch action to ensure the latest ICE configuration
        store.dispatch(getLatestIceConfig());

        // Get the ICE configuration from the store
        const iceConfig = store.getState().iceConfig.config;

        console.log('[WebRTC] Using ICE configuration:', iceConfig);

        // Initialize signaling
        this.signaling = new SignalingService(roomId, clientId, role);

        // Initialize WebRTC peer connection with the ICE configuration
        this.pc = new RTCPeerConnection(iceConfig);

        // Setup peer connection listeners
        this.setupPeerConnectionListeners();
    }

    private setupPeerConnectionListeners() {
        // Handle ICE candidates
        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`[WebRTC] New ICE candidate: ${JSON.stringify(event.candidate)}`);
                this.signaling.sendMessage({
                    type: 'ice-candidate',
                    roomId: this.roomId,
                    content: event.candidate
                });
            }
        };

        // Handle connection state changes
        this.pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state changed: ${this.pc.connectionState}`);
            if (this.onConnectionStateChangeCallback) {
                this.onConnectionStateChangeCallback(this.pc.connectionState);
            }
        };

        // Debug ice connection state changes
        this.pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE connection state: ${this.pc.iceConnectionState}`);
        };

        // Debug signaling state changes
        this.pc.onsignalingstatechange = () => {
            console.log(`[WebRTC] Signaling state: ${this.pc.signalingState}`);
        };

        // Handle negotiation needed
        this.pc.onnegotiationneeded = async () => {
            try {
                console.log(`[WebRTC] Negotiation needed, role: ${this.role}`);

                // Vérifier si on est prêt pour la négociation (patient et praticien présents)
                if (this.readyToNegotiate && this.role === Role.PRACTITIONER) {
                    await this.createOffer();
                } else {
                    console.log('[WebRTC] Not ready to negotiate yet or not a practitioner');
                }
            } catch (err) {
                console.error('[WebRTC] Error during negotiation:', err);
            }
        };

        // Écouter les data channels entrants (pour le patient)
        this.pc.ondatachannel = (event) => {
            console.log(`[WebRTC] Received data channel: ${event.channel.label}`);

            if (event.channel.label === 'data-channel') {
                this.dataChannel = event.channel;
                this.setupDataChannel(this.dataChannel);
            }
        };
    }

    // Setup signaling listening
    private async setupSignalingListeners() {
        console.log('[WebRTC] Setting up signaling listeners');

        // Écouter les messages de signalisation
        this.signaling.onMessage(async (message: SignalingMessage) => {
            console.log(`[WebRTC] Received signaling message type: ${message.type}`, message);

            try {
                if (message.sender === this.clientId) {
                    console.log('[WebRTC] Ignoring message from self');
                    return; // Ignore messages from self
                }

                if (message.type === 'offer') {
                    console.log('[WebRTC] Processing offer');
                    // Vérifier que le type est bien une offre et utiliser un cast de type sécurisé
                    await this.handleOffer(message.content as RTCSessionDescriptionInit);
                }
                else if (message.type === 'answer') {
                    console.log('[WebRTC] Processing answer');
                    // Vérifier que le type est bien une réponse et utiliser un cast de type sécurisé
                    await this.handleAnswer(message.content as RTCSessionDescriptionInit);
                }
                else if (message.type === 'ice-candidate') {
                    console.log('[WebRTC] Processing ICE candidate');
                    // Vérifier que le type est bien un candidat ICE et utiliser un cast de type sécurisé
                    await this.handleIceCandidate(message.content as RTCIceCandidateInit);
                }
            } catch (err) {
                console.error('[WebRTC] Error handling signaling message:', err);
            }
        });

        // Écouter les changements de présence dans la salle
        this.signaling.onPresenceChange((presences: UserPresence[]) => {
            console.log('[WebRTC] Room presence changed:', presences);

            // Vérifier si un patient et un praticien sont présents
            const hasPatientAndPractitioner = this.signaling.hasPatientAndPractitioner();
            console.log(`[WebRTC] Room has patient and practitioner: ${hasPatientAndPractitioner}`);

            // Si le statut a changé, mettre à jour et notifier
            if (this.readyToNegotiate !== hasPatientAndPractitioner) {
                this.readyToNegotiate = hasPatientAndPractitioner;

                // Notifier que la salle est prête pour la connexion
                if (this.onRoomReadyCallback) {
                    this.onRoomReadyCallback(this.readyToNegotiate);
                }

                // Si la salle est prête et qu'on est le praticien, initialiser la connexion
                if (this.readyToNegotiate && this.role === Role.PRACTITIONER) {
                    console.log('[WebRTC] Room is ready and we are the practitioner, initiating connection');

                    // Vérifier si la connexion PeerConnection est en bon état 
                    // Si elle est failed ou disconnected, on la réinitialise
                    if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'disconnected') {
                        console.log('[WebRTC] Connection is in bad state, resetting peer connection');
                        this.resetPeerConnection();
                    }

                    this.createDataChannel();
                }
            }
        });
    }

    private async handleOffer(offer: RTCSessionDescriptionInit) {
        if (this.pc.signalingState !== 'stable') {
            console.log('[WebRTC] Signaling state is not stable, ignoring offer');
            return;
        }

        try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
            console.log('[WebRTC] Set remote description (offer)');

            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            console.log('[WebRTC] Created and set local description (answer)');

            this.signaling.sendMessage({
                type: 'answer',
                roomId: this.roomId,
                content: this.pc.localDescription as RTCSessionDescriptionInit
            });
        } catch (err) {
            console.error('[WebRTC] Error handling offer:', err);
        }
    }

    private async handleAnswer(answer: RTCSessionDescriptionInit) {
        try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('[WebRTC] Set remote description (answer)');
        } catch (err) {
            console.error('[WebRTC] Error handling answer:', err);
        }
    }

    private async handleIceCandidate(candidate: RTCIceCandidateInit) {
        try {
            await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('[WebRTC] Added ICE candidate');
        } catch (err) {
            console.error('[WebRTC] Error adding ICE candidate:', err);
        }
    }

    private async createOffer() {
        try {
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);
            console.log('[WebRTC] Created and set local description (offer)');

            this.signaling.sendMessage({
                type: 'offer',
                roomId: this.roomId,
                content: this.pc.localDescription as RTCSessionDescriptionInit
            });
        } catch (err) {
            console.error('[WebRTC] Error creating offer:', err);
        }
    }

    // Connect to signaling service and set up listeners
    async connect() {
        console.log('[WebRTC] Connecting to signaling service');
        await this.signaling.connect();
        this.setupSignalingListeners();

        // La négociation sera déclenchée automatiquement quand les deux participants
        // seront présents et que le praticien créera un canal de données
    }

    // Create a data channel for all communications
    private createDataChannel() {
        try {
            if (this.dataChannel) {
                console.log('[WebRTC] Data channel already exists');
                return this.dataChannel;
            }

            // Créer un canal de données général pour toutes les communications
            this.dataChannel = this.pc.createDataChannel('data-channel');
            console.log('[WebRTC] Created data channel for all communications');

            this.setupDataChannel(this.dataChannel);

            return this.dataChannel;
        } catch (err) {
            console.error('[WebRTC] Error creating data channel:', err);
            return null;
        }
    }

    // Configure les événements pour le dataChannel
    private setupDataChannel(channel: RTCDataChannel) {
        channel.onopen = () => {
            console.log('[WebRTC] Data channel opened');
            // Forcer une mise à jour de l'interface en utilisant un dispatch vide
            // Cela permettra aux composants qui observent l'état de se re-rendre
            store.dispatch({ type: 'webrtc/dataChannelStatusChanged' });
        };

        channel.onclose = () => {
            console.log('[WebRTC] Data channel closed');
            this.dataChannel = null;
            // Forcer une mise à jour de l'interface
            store.dispatch({ type: 'webrtc/dataChannelStatusChanged' });
        };

        channel.onerror = (error) => {
            console.error('[WebRTC] Data channel error:', error);
            // Forcer une mise à jour de l'interface
            store.dispatch({ type: 'webrtc/dataChannelStatusChanged' });
        };

        channel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data) as DataChannelMessage;
                console.log(`[WebRTC] Received message of type: ${message.type}`, message);

                // Traiter les différents types de messages
                switch (message.type) {
                    case 'chat':
                        const chatMessage: ChatMessage = {
                            sender: message.sender,
                            senderRole: message.senderRole,
                            content: message.payload,
                            timestamp: message.timestamp
                        };

                        // Dispatch le message au store
                        store.dispatch(messageReceived({
                            roomId: this.roomId,
                            message: chatMessage
                        }));

                        // Appeler le callback s'il existe
                        if (this.onChatMessageCallback) {
                            this.onChatMessageCallback(chatMessage);
                        }
                        break;

                    // Ajouter d'autres types de messages ici
                    default:
                        console.log(`[WebRTC] Unhandled message type: ${message.type}`);
                }
            } catch (err) {
                console.error('[WebRTC] Error parsing message:', err);
            }
        };
    }

    // Envoyer un message via le dataChannel
    private sendDataChannelMessage(type: string, payload: any): boolean {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            console.error('[WebRTC] Cannot send message, data channel not ready');
            return false;
        }

        try {
            const message: DataChannelMessage = {
                type,
                payload,
                sender: this.clientId,
                senderRole: this.role,
                timestamp: Date.now()
            };

            this.dataChannel.send(JSON.stringify(message));
            console.log(`[WebRTC] Sent message of type: ${type}`, message);

            return true;
        } catch (err) {
            console.error('[WebRTC] Error sending message:', err);
            return false;
        }
    }

    // Envoyer un message de chat
    sendChatMessage(content: string): boolean {
        const success = this.sendDataChannelMessage('chat', content);

        if (success) {
            // Ajouter le message au store local aussi
            const chatMessage: ChatMessage = {
                sender: this.clientId,
                senderRole: this.role,
                content,
                timestamp: Date.now()
            };

            store.dispatch(messageReceived({
                roomId: this.roomId,
                message: chatMessage
            }));
        }

        return success;
    }

    // S'abonner aux messages de chat
    onChatMessage(callback: (message: ChatMessage) => void) {
        this.onChatMessageCallback = callback;
    }

    // Vérifier si le dataChannel est disponible
    isDataChannelAvailable(): boolean {
        return this.dataChannel !== null && this.dataChannel.readyState === 'open';
    }

    // Vérifier si la salle est prête pour la connexion (patient + praticien présents)
    isRoomReady(): boolean {
        return this.readyToNegotiate;
    }

    // Callback pour les changements d'état de la salle
    onRoomReady(callback: (isReady: boolean) => void) {
        this.onRoomReadyCallback = callback;
    }

    // Handle connection state changes
    onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void) {
        this.onConnectionStateChangeCallback = callback;
    }

    // Check if connected
    isConnected(): boolean {
        return this.pc.connectionState === 'connected';
    }

    // Close the connection
    async disconnect() {
        console.log('[WebRTC] Disconnecting');

        try {
            if (this.dataChannel) {
                // Désactiver les gestionnaires d'événements avant de fermer pour éviter les erreurs
                this.dataChannel.onopen = null;
                this.dataChannel.onclose = null;
                this.dataChannel.onerror = null;
                this.dataChannel.onmessage = null;

                console.log('[WebRTC] Closing data channel');
                this.dataChannel.close();
                this.dataChannel = null;
            }

            // Désactiver tous les gestionnaires d'événements de la connexion peer
            this.pc.onicecandidate = null;
            this.pc.onconnectionstatechange = null;
            this.pc.oniceconnectionstatechange = null;
            this.pc.onsignalingstatechange = null;
            this.pc.onnegotiationneeded = null;
            this.pc.ondatachannel = null;

            console.log('[WebRTC] Closing peer connection');
            this.pc.close();

            console.log('[WebRTC] Disconnecting signaling service');
            await this.signaling.disconnect();

            // Réinitialiser l'état de prêt pour la négociation
            this.readyToNegotiate = false;

            console.log('[WebRTC] Disconnection complete');
        } catch (error) {
            console.error('[WebRTC] Error during disconnect:', error);
        }
    }

    // Réinitialiser la connexion RTC peer
    private resetPeerConnection() {
        console.log('[WebRTC] Resetting peer connection');

        // Fermer l'ancienne connexion et canal de données
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }

        // Fermer l'ancienne connexion peer
        this.pc.close();

        // Récupérer la configuration ICE actuelle
        const iceConfig = store.getState().iceConfig.config;

        // Recréer une nouvelle connexion peer avec la même configuration
        this.pc = new RTCPeerConnection(iceConfig);

        // Reconfigurer tous les écouteurs d'événements
        this.setupPeerConnectionListeners();

        console.log('[WebRTC] Peer connection has been reset');
    }
}