// Classe principale pour la gestion de la connexion WebRTC

import { SignalingService, SignalingMessage, UserPresence } from '../../signaling';
import { store } from '@/app/store';
import { getLatestIceConfig } from '../../ice/ice-config-slice';
import { Role, ChatMessage } from '../models/types';
import { DataChannelManager } from '../data-channel/data-channel-manager';
import { setupPeerConnectionListeners, IPeerConnection } from '../handlers/connection-handlers';
import { handleOffer, handleAnswer, handleIceCandidate, createOffer } from '../handlers/signaling-handlers';

export class PeerConnection implements IPeerConnection {
    private pc: RTCPeerConnection;
    private signaling: SignalingService;
    private dataChannelManager: DataChannelManager;
    private role: Role;
    private roomId: string;
    private clientId: string;
    private readyToNegotiate: boolean = false;

    // Callbacks
    private onConnectionStateChangeCallback: ((state: RTCPeerConnectionState) => void) | null = null;
    private onRoomReadyCallback: ((isReady: boolean) => void) | null = null;
    private onChatMessageCallback: ((message: ChatMessage) => void) | null = null;

    // Constantes exportées pour compatibilité
    public readonly ROLE = Role;

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

        // Initialize DataChannel manager with a function that toujours returns the current peer connection
        this.dataChannelManager = new DataChannelManager(
            () => this.pc,  // Cette fonction fournira toujours la connexion peer actuelle
            this.roomId,
            this.clientId,
            this.role
        );

        // Setup peer connection listeners
        this.setupListeners();
    }

    // Méthode pour configurer tous les listeners
    private setupListeners() {
        // Setup listeners pour la PeerConnection
        setupPeerConnectionListeners(this, this.pc);

        // Setup listeners pour les messages de chat du DataChannelManager
        this.dataChannelManager.onChatMessage((message) => {
            if (this.onChatMessageCallback) {
                this.onChatMessageCallback(message);
            }
        });
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
                    await handleOffer(this.pc, message.content as RTCSessionDescriptionInit, this.signaling, this.roomId);
                }
                else if (message.type === 'answer') {
                    console.log('[WebRTC] Processing answer');
                    // Vérifier que le type est bien une réponse et utiliser un cast de type sécurisé
                    await handleAnswer(this.pc, message.content as RTCSessionDescriptionInit);
                }
                else if (message.type === 'ice-candidate') {
                    console.log('[WebRTC] Processing ICE candidate');
                    // Vérifier que le type est bien un candidat ICE et utiliser un cast de type sécurisé
                    await handleIceCandidate(this.pc, message.content as RTCIceCandidateInit);
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
                const wasReady = this.readyToNegotiate;
                this.readyToNegotiate = hasPatientAndPractitioner;

                // Si la salle était prête avant mais ne l'est plus maintenant, cela signifie
                // qu'un participant s'est déconnecté
                if (wasReady && !hasPatientAndPractitioner) {
                    console.log('[WebRTC] A participant disconnected, resetting peer connection');

                    // Pour le praticien, réinitialiser complètement la connexion
                    if (this.role === Role.PRACTITIONER &&
                        (this.pc.connectionState === 'connected' ||
                            this.pc.connectionState === 'connecting')) {
                        this.resetPeerConnection();
                    }

                    // Pour le patient, réinitialiser également la connexion si le praticien se déconnecte
                    if (this.role === Role.PATIENT &&
                        (this.pc.connectionState === 'connected' ||
                            this.pc.connectionState === 'connecting')) {
                        console.log('[WebRTC] Practitioner disconnected, resetting patient peer connection');
                        this.resetPeerConnection();
                    }
                }

                // Notifier que la salle est prête pour la connexion
                if (this.onRoomReadyCallback) {
                    this.onRoomReadyCallback(this.readyToNegotiate);
                }

                // Si la salle est prête et qu'on est le praticien, initialiser la connexion
                // mais seulement après un court délai pour s'assurer que la réinitialisation est complète
                if (this.readyToNegotiate && this.role === Role.PRACTITIONER) {
                    console.log('[WebRTC] Room is ready and we are the practitioner, waiting to initiate connection...');

                    // Utiliser setTimeout pour retarder la création du canal de données
                    // Cela donne le temps à la réinitialisation d'être complètement terminée
                    setTimeout(() => {
                        // Vérifier que la connexion est toujours valide et que la salle est toujours prête
                        if (this.readyToNegotiate &&
                            this.pc.connectionState !== 'closed' &&
                            this.pc.signalingState !== 'closed') {

                            console.log('[WebRTC] Creating data channel after delay');
                            this.dataChannelManager.createDataChannel();
                        } else {
                            console.log('[WebRTC] Connection or room state changed, not creating data channel');
                        }
                    }, 500); // Délai plus long pour s'assurer que tout est prêt
                }
            }
        });
    }

    // Connect to signaling service and set up listeners
    async connect() {
        console.log('[WebRTC] Connecting to signaling service');
        await this.signaling.connect();
        this.setupSignalingListeners();
    }

    // Créer une offre pour établir la connexion
    async createOffer() {
        await createOffer(this.pc, this.signaling, this.roomId);
    }

    // Configure les événements pour le dataChannel
    setupDataChannel(channel: RTCDataChannel) {
        this.dataChannelManager.setupDataChannel(channel);
    }

    // Envoyer un message de chat
    sendChatMessage(content: string): boolean {
        return this.dataChannelManager.sendChatMessage(content);
    }

    // S'abonner aux messages de chat
    onChatMessage(callback: (message: ChatMessage) => void) {
        this.onChatMessageCallback = callback;
    }

    // Vérifier si le dataChannel est disponible
    isDataChannelAvailable(): boolean {
        return this.dataChannelManager.isDataChannelAvailable();
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
            // Fermer le canal de données
            this.dataChannelManager.closeDataChannel();

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

        // Fermer le canal de données
        this.dataChannelManager.closeDataChannel();

        // Fermer l'ancienne connexion peer
        this.pc.close();

        // Récupérer la configuration ICE actuelle
        const iceConfig = store.getState().iceConfig.config;

        // Recréer une nouvelle connexion peer avec la même configuration
        this.pc = new RTCPeerConnection(iceConfig);

        // Reconfigurer tous les écouteurs d'événements
        this.setupListeners();

        // Notifier explicitement le changement d'état de connexion, car la nouvelle
        // instance de PeerConnection ne déclenche pas automatiquement l'événement
        if (this.onConnectionStateChangeCallback) {
            console.log('[WebRTC] Explicitly updating connection state to "disconnected"');
            this.onConnectionStateChangeCallback('disconnected');
        }

        console.log('[WebRTC] Peer connection has been reset');
    }

    // Getters pour permettre l'accès aux handlers
    getPeerConnection(): RTCPeerConnection {
        return this.pc;
    }

    getSignaling(): SignalingService {
        return this.signaling;
    }

    getRoomId(): string {
        return this.roomId;
    }

    getRole(): Role {
        return this.role;
    }

    getOnConnectionStateChangeCallback(): ((state: RTCPeerConnectionState) => void) | null {
        return this.onConnectionStateChangeCallback;
    }

    // Setter pour le DataChannel
    setDataChannel(channel: RTCDataChannel) {
        this.dataChannelManager.setDataChannel(channel);
    }
}