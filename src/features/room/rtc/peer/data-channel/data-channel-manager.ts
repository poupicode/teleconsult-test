// Gestionnaire des canaux de données

import { store } from '@/app/store';
import { messageReceived } from '@/features/chat/chatSlice';
import { Role, DataChannelMessage, ChatMessage } from '../models/types';

export class DataChannelManager {
    private getPeerConnection: () => RTCPeerConnection; // Fonction pour récupérer la connexion actuelle
    private dataChannel: RTCDataChannel | null = null;
    private roomId: string;
    private clientId: string;
    private role: Role;
    private onChatMessageCallback: ((message: ChatMessage) => void) | null = null;

    constructor(peerConnectionProvider: () => RTCPeerConnection, roomId: string, clientId: string, role: Role) {
        this.getPeerConnection = peerConnectionProvider;
        this.roomId = roomId;
        this.clientId = clientId;
        this.role = role;
    }

    // Créer un canal de données pour toutes les communications
    createDataChannel(): RTCDataChannel | null {
        try {
            if (this.dataChannel) {
                console.log('[WebRTC] Data channel already exists');
                return this.dataChannel;
            }

            // Récupérer la connexion actuelle au moment de créer le canal
            const pc = this.getPeerConnection();

            // Vérifier que la connexion peer est dans un état valide avant de créer le canal
            if (pc.connectionState === 'closed' || pc.signalingState === 'closed') {
                console.error('[WebRTC] Cannot create data channel - peer connection is closed');
                return null;
            }

            // Créer un canal de données général pour toutes les communications
            this.dataChannel = pc.createDataChannel('data-channel');
            console.log('[WebRTC] Created data channel for all communications');

            this.setupDataChannel(this.dataChannel);

            return this.dataChannel;
        } catch (err) {
            console.error('[WebRTC] Error creating data channel:', err);
            return null;
        }
    }

    // Configure les événements pour le dataChannel
    setupDataChannel(channel: RTCDataChannel) {
        console.log(`[WebRTC] Setting up data channel events. Initial state: ${channel.readyState}`);
        
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
        
        // Si le canal est déjà ouvert, déclencher immédiatement l'événement onopen
        if (channel.readyState === 'open') {
            console.log('[WebRTC] Data channel was already open, dispatching open event');
            store.dispatch({ type: 'webrtc/dataChannelStatusChanged' });
        }
    }

    // Envoyer un message via le dataChannel
    sendDataChannelMessage(type: string, payload: any): boolean {
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
        const isAvailable = this.dataChannel !== null && this.dataChannel.readyState === 'open';
        console.log(`[WebRTC] DataChannel availability check: ${isAvailable} (channel: ${this.dataChannel ? 'exists' : 'null'}, state: ${this.dataChannel?.readyState || 'n/a'})`);
        return isAvailable;
    }

    // Obtenir le canal de données
    getDataChannel(): RTCDataChannel | null {
        return this.dataChannel;
    }

    // Définir le canal de données
    setDataChannel(channel: RTCDataChannel) {
        console.log('[WebRTC] Setting data channel from external source');
        this.dataChannel = channel;
        // Configurer immédiatement les événements pour le canal reçu
        this.setupDataChannel(channel);
    }

    // Fermer le canal de données
    closeDataChannel() {
        if (this.dataChannel) {
            // Désactiver les gestionnaires d'événements avant de fermer pour éviter les erreurs
            this.dataChannel.onopen = null;
            this.dataChannel.onclose = null;
            this.dataChannel.onerror = null;
            this.dataChannel.onmessage = null;

            console.log(`[WebRTC] Closing data channel for room: ${this.roomId}`);
            
            try {
                // Check the state before closing to avoid errors
                if (this.dataChannel.readyState !== 'closed') {
                    this.dataChannel.close();
                    console.log('[WebRTC] Data channel closed successfully');
                } else {
                    console.log('[WebRTC] Data channel was already closed');
                }
            } catch (err) {
                console.error('[WebRTC] Error while closing data channel:', err);
            } finally {
                this.dataChannel = null;
                
                // Forcer une mise à jour de l'interface pour notifier les composants
                // que le canal n'est plus disponible
                store.dispatch({ type: 'webrtc/dataChannelStatusChanged' });
                console.log('[WebRTC] DataChannel reference cleared');
            }
        }
    }
}