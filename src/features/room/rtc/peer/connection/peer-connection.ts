// Classe principale pour la gestion de la connexion WebRTC

import { SignalingService, SignalingMessage, UserPresence } from '../../signaling';
import { store } from '@/app/store';
import { getLatestIceConfig } from '../../ice/ice-config-slice';
import { Role, ChatMessage } from '../models/types';
import { DataChannelManager } from '../data-channel/data-channel-manager';
import { setupPeerConnectionListeners, IPeerConnection } from '../handlers/connection-handlers';
import { handleOffer, handleAnswer, handleIceCandidate, createOffer } from '../handlers/signaling-handlers';

// Interfaces pour les statistiques WebRTC
interface RTCStatsReport {
    forEach(callbackfn: (value: RTCStats) => void): void;
}

interface RTCStats {
    id: string;
    timestamp: number;
    type: string;
    [key: string]: any;
}

// Interface spécifique pour les statistiques de candidat ICE
interface RTCIceCandidateStats {
    id: string;
    timestamp: number;
    type: string;
    candidateType: string;
    ip: string;
    port: number;
    protocol: string;
    relayProtocol?: string;
    [key: string]: any;
}

// Interface spécifique pour les statistiques de paire de candidats ICE
interface RTCIceCandidatePairStats {
    id: string;
    timestamp: number;
    type: string;
    localCandidateId: string;
    remoteCandidateId: string;
    nominated: boolean;
    selected: boolean;
    state: string;
    priority: number;
    transportId: string;
    relayProtocol?: string;
    [key: string]: any;
}

// Interface pour l'analyse des candidats ICE
interface CandidateTypeCount {
    [key: string]: number;
}

export class PeerConnection implements IPeerConnection {
    private pc: RTCPeerConnection;
    private signaling: SignalingService;
    private dataChannelManager: DataChannelManager;
    private role: Role;
    private roomId: string;
    private clientId: string;
    private readyToNegotiate: boolean = false;

    // ICE debugging
    private iceConnectionTimeout: NodeJS.Timeout | null = null;
    private iceStartTime: number = 0;
    private iceCandidates: { local: RTCIceCandidate[], remote: RTCIceCandidate[] } = { local: [], remote: [] };
    private hasRelay: boolean = false;

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
        console.log('[WebRTC] Using ICE configuration:', JSON.stringify(iceConfig));

        // Vérifier si les serveurs TURN sont bien configurés
        this.checkTurnConfiguration(iceConfig);

        // TEST: Vérifier explicitement l'accessibilité du serveur TURN
        this.testTurnServer('turn:turn.ekami.ch:3478', 'wei', 'toto1234');

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

        // Setup custom ICE debugging
        this.setupIceDebugging();
    }

    // Vérifier si la configuration TURN est valide
    private checkTurnConfiguration(iceConfig: RTCConfiguration) {
        if (!iceConfig.iceServers || iceConfig.iceServers.length === 0) {
            console.error('[WebRTC] No ICE servers configured!');
            return;
        }

        // Recherche des serveurs TURN
        let hasTurnServer = false;
        for (const server of iceConfig.iceServers) {
            if (!server.urls) continue;

            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];

            for (const url of urls) {
                if (typeof url === 'string' && url.startsWith('turn:')) {
                    hasTurnServer = true;
                    // Vérifier les identifiants TURN
                    if (!server.username || !server.credential) {
                        console.warn(`[WebRTC] TURN server ${url} missing credentials!`);
                    } else {
                        console.log(`[WebRTC] Found TURN server: ${url}`);
                    }
                }
            }
        }

        if (!hasTurnServer) {
            console.warn('[WebRTC] No TURN servers found in configuration! This will cause connection issues in restrictive networks.');
        }
    }

    // Configuration du débogage ICE avancé
    private setupIceDebugging() {
        this.iceStartTime = Date.now();
        this.iceCandidates = { local: [], remote: [] };
        this.hasRelay = false;

        // Surveiller les candidats ICE locaux
        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.iceCandidates.local.push(event.candidate);
                console.log(`[WebRTC-ICE] Local candidate: ${event.candidate.candidate}`);

                // Analyser le candidat
                this.analyzeIceCandidate(event.candidate, true);
                
                // Envoyer les candidats ICE à l'autre pair via le service de signalisation
                this.signaling.sendMessage({
                    type: 'ice-candidate',
                    roomId: this.roomId,
                    content: event.candidate
                });

                // Définir un timeout si c'est le premier candidat
                if (this.iceCandidates.local.length === 1 && !this.iceConnectionTimeout) {
                    this.iceConnectionTimeout = setTimeout(() => {
                        if (this.pc.iceConnectionState !== 'connected' && this.pc.iceConnectionState !== 'completed') {
                            console.warn('[WebRTC-ICE] Connection timeout after 15s. Current state:', this.pc.iceConnectionState);
                            this.logIceStats();
                        }
                    }, 15000);
                }
            } else {
                console.log('[WebRTC-ICE] Local candidates gathering complete');
            }
        };

        // Surveiller les changements d'état de connexion ICE
        this.pc.oniceconnectionstatechange = () => {
            const state = this.pc.iceConnectionState;
            console.log(`[WebRTC-ICE] Connection state changed: ${state}`);

            switch (state) {
                case 'checking':
                    console.log(`[WebRTC-ICE] Started checking candidates. Time elapsed: ${Date.now() - this.iceStartTime}ms`);
                    break;

                case 'connected':
                case 'completed':
                    if (this.iceConnectionTimeout) {
                        clearTimeout(this.iceConnectionTimeout);
                        this.iceConnectionTimeout = null;
                    }
                    console.log(`[WebRTC-ICE] Connection established in ${Date.now() - this.iceStartTime}ms`);
                    console.log(`[WebRTC-ICE] Using TURN relay: ${this.hasRelay ? 'Yes' : 'No/Unknown'}`);

                    // Analyser les statistiques détaillées après connexion
                    setTimeout(() => this.getDetailedConnectionStats(), 1000);
                    break;

                case 'failed':
                    console.error('[WebRTC-ICE] Connection failed. This is likely due to a TURN server issue or network restriction.');
                    this.logIceStats();
                    break;
            }
        };
    }

    // Analyse un candidat ICE pour déterminer son type
    private analyzeIceCandidate(candidate: RTCIceCandidate, isLocal: boolean) {
        const candidateStr = candidate.candidate;
        if (!candidateStr) return;

        try {
            // Vérifier si c'est un candidat relay (TURN)
            if (candidateStr.includes(' typ relay ')) {
                this.hasRelay = true;
                console.log(`[WebRTC-ICE] ${isLocal ? 'Local' : 'Remote'} TURN relay candidate found: ${candidateStr}`);
            }

            // Extraire le type de candidat
            const match = candidateStr.match(/ typ ([a-z]+) /);
            if (match) {
                const type = match[1]; // host, srflx, prflx ou relay
                console.log(`[WebRTC-ICE] ${isLocal ? 'Local' : 'Remote'} candidate type: ${type}`);
            }
        } catch (err) {
            console.error('[WebRTC-ICE] Error analyzing candidate:', err);
        }
    }

    // Analyse les statistiques de connexion pour comprendre les problèmes
    private async getDetailedConnectionStats() {
        try {
            if (!this.pc.getStats) {
                console.log('[WebRTC-ICE] getStats API not available');
                return;
            }

            const stats = await this.pc.getStats();
            let selectedPair: RTCIceCandidatePairStats | null = null;
            let localCandidate: RTCIceCandidateStats | null = null;
            let remoteCandidate: RTCIceCandidateStats | null = null;

            stats.forEach((report: RTCStats) => {
                if (report.type === 'transport') {
                    console.log('[WebRTC-ICE] Transport:', report);
                }

                // Trouver la paire de candidats sélectionnée
                if (report.type === 'candidate-pair' && report.selected === true) {
                    selectedPair = report as RTCIceCandidatePairStats;
                    console.log('[WebRTC-ICE] Selected candidate pair:', report);
                }

                // Stocker les informations sur les candidats
                if (report.type === 'local-candidate') {
                    if (selectedPair && report.id === selectedPair.localCandidateId) {
                        localCandidate = report as RTCIceCandidateStats;
                    }
                }

                if (report.type === 'remote-candidate') {
                    if (selectedPair && report.id === selectedPair.remoteCandidateId) {
                        remoteCandidate = report as RTCIceCandidateStats;
                    }
                }
            });

            // Analyser la paire sélectionnée
            if (selectedPair && localCandidate && remoteCandidate) {
                console.log('[WebRTC-ICE] Connection established using:');
                console.log(`[WebRTC-ICE] Local: ${(localCandidate as RTCIceCandidateStats).candidateType} (${(localCandidate as RTCIceCandidateStats).protocol}) - ${(localCandidate as RTCIceCandidateStats).ip}:${(localCandidate as RTCIceCandidateStats).port}`);
                console.log(`[WebRTC-ICE] Remote: ${(remoteCandidate as RTCIceCandidateStats).candidateType} (${(remoteCandidate as RTCIceCandidateStats).protocol}) - ${(remoteCandidate as RTCIceCandidateStats).ip}:${(remoteCandidate as RTCIceCandidateStats).port}`);

                if ((localCandidate as RTCIceCandidateStats).candidateType === 'relay' || (remoteCandidate as RTCIceCandidateStats).candidateType === 'relay') {
                    console.log('[WebRTC-ICE] Connection using TURN relay');
                    // Identifier quel serveur TURN est utilisé
                    if ((localCandidate as RTCIceCandidateStats).relayProtocol || (remoteCandidate as RTCIceCandidateStats).relayProtocol) {
                        console.log(`[WebRTC-ICE] Relay protocol: ${(localCandidate as RTCIceCandidateStats).relayProtocol || (remoteCandidate as RTCIceCandidateStats).relayProtocol}`);
                    }
                } else {
                    console.log('[WebRTC-ICE] Direct connection (no TURN relay)');
                }
            }

        } catch (err) {
            console.error('[WebRTC-ICE] Error getting connection stats:', err);
        }
    }

    // Journalise les statistiques ICE pour le débogage
    private logIceStats() {
        console.log('[WebRTC-ICE] === ICE Connection Diagnostics ===');
        console.log(`[WebRTC-ICE] Connection state: ${this.pc.iceConnectionState}`);
        console.log(`[WebRTC-ICE] Gathering state: ${this.pc.iceGatheringState}`);
        console.log(`[WebRTC-ICE] Signaling state: ${this.pc.signalingState}`);
        console.log(`[WebRTC-ICE] Local candidates: ${this.iceCandidates.local.length}`);
        console.log(`[WebRTC-ICE] Remote candidates: ${this.iceCandidates.remote.length}`);

        // Types de candidats locaux
        const localTypes: CandidateTypeCount = this.iceCandidates.local.reduce((acc: CandidateTypeCount, candidate) => {
            const match = candidate.candidate.match(/ typ ([a-z]+) /);
            if (match) {
                const type = match[1];
                acc[type] = (acc[type] || 0) + 1;
            }
            return acc;
        }, {});
        console.log('[WebRTC-ICE] Local candidate types:', localTypes);
        
        // Types de candidats distants
        if (this.iceCandidates.remote.length > 0) {
            console.log('[WebRTC-ICE] Remote candidates details:');
            this.iceCandidates.remote.forEach((candidate, index) => {
                console.log(`[WebRTC-ICE] Remote candidate ${index}:`, candidate);
            });
        } else {
            console.warn('[WebRTC-ICE] No remote candidates received - this is the main reason for connection failure');
        }

        // Vérifier les facteurs courants de défaillance
        if (!this.hasRelay) {
            console.warn('[WebRTC-ICE] No TURN relay candidates found - this often causes connection failures in restrictive networks');
        }

        if (this.pc.iceConnectionState === 'failed') {
            console.warn('[WebRTC-ICE] Connection failure may be due to:');
            console.warn('- TURN server inaccessible ou mal configuré');
            console.warn('- Identifiants TURN invalides ou expirés');
            console.warn('- Ports bloqués par pare-feu');
            console.warn('- Restrictions de réseau trop strictes');
        }

        // Afficher la configuration ICE
        const iceConfig = store.getState().iceConfig.config;
        console.log('[WebRTC-ICE] Current ICE configuration:', JSON.stringify(iceConfig));
    }

    // Test explicite d'accessibilité au serveur TURN
    private testTurnServer(url: string, username: string, credential: string) {
        console.log(`[TURN-TEST] Testing TURN server: ${url}`);

        // Créer une configuration ICE spécifique pour ce test
        const testConfig = {
            iceServers: [{
                urls: [url],
                username: username,
                credential: credential
            }],
            iceTransportPolicy: 'relay' as RTCIceTransportPolicy // Force l'utilisation des serveurs TURN uniquement
        };

        // Créer une connexion peer temporaire pour tester
        const pc1 = new RTCPeerConnection(testConfig);
        const pc2 = new RTCPeerConnection(testConfig);

        // Suivre si des candidats relay sont générés
        let relayFound = false;

        // Gérer les candidats ICE générés par pc1
        pc1.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`[TURN-TEST] Candidate: ${event.candidate.candidate}`);

                // Vérifier si c'est un candidat relay (TURN)
                if (event.candidate.candidate.includes(' typ relay ')) {
                    relayFound = true;
                    console.log('[TURN-TEST] SUCCESS: TURN server is accessible and credentials are valid!');
                }
            } else {
                // Fin de la collecte des candidats
                if (!relayFound) {
                    console.error('[TURN-TEST] FAILURE: No relay candidates found. TURN server is not accessible or credentials are invalid.');
                    console.log('[TURN-TEST] Common issues:');
                    console.log('- TURN server could be down or unreachable');
                    console.log('- Credentials may have expired');
                    console.log('- Network might be blocking UDP/TCP ports');
                    console.log('- TURN server might have reached its connection limit');
                }

                // Nettoyer
                setTimeout(() => {
                    pc1.close();
                    pc2.close();
                }, 5000);
            }
        };

        // Configurer le test en créant un canal de données
        const dc = pc1.createDataChannel('turnTest');

        pc1.createOffer().then((offer) => {
            return pc1.setLocalDescription(offer);
        }).then(() => {
            // L'offre a été créée, la collecte des candidats ICE va commencer
            console.log('[TURN-TEST] Offer created, ICE gathering starting...');
        }).catch((err) => {
            console.error('[TURN-TEST] Error testing TURN server:', err);
        });

        // Définir un timeout pour le test au cas où aucun candidat n'est généré
        setTimeout(() => {
            if (!relayFound) {
                console.error('[TURN-TEST] TIMEOUT: No relay candidates received within 5 seconds');
            }
        }, 5000);
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
                    console.log('[WebRTC] Processing ICE candidate:', JSON.stringify(message.content));
                    // Stocker le candidat distant pour débogage
                    if (message.content) {
                        this.iceCandidates.remote.push(message.content as RTCIceCandidate);
                        this.analyzeIceCandidate(message.content as RTCIceCandidate, false);
                        
                        // Log le nombre de candidats distants pour débogage
                        console.log(`[WebRTC-ICE] Remote candidates count: ${this.iceCandidates.remote.length}`);
                    }
                    // Vérifier que le type est bien un candidat ICE et utiliser un cast de type sécurisé
                    await handleIceCandidate(this.pc, message.content as RTCIceCandidateInit);
                    console.log('[WebRTC-ICE] ICE candidate added successfully');
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