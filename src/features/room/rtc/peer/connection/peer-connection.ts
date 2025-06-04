// Classe principale pour la gestion de la connexion WebRTC

import { SignalingService, SignalingMessage, UserPresence } from '../../signaling';
import { store } from '@/app/store';
import { getLatestIceConfig } from '../../ice/ice-config-slice';
import { cleanupRoomState, resetParticipantsConnection } from '../../../roomSlice';
import { Role, ChatMessage } from '../models/types';
import { DataChannelManager } from '../data-channel/data-channel-manager';
import { setupPeerConnectionListeners, IPeerConnection } from '../handlers/connection-handlers';
import { PerfectNegotiation } from '../negotiation/perfect-negotiation';

// Debug logging control - set to false in production
const DEBUG_LOGS = import.meta.env.DEV || false;

// Conditional logging functions
const debugLog = (message: string, ...args: any[]) => {
    if (DEBUG_LOGS) console.log(message, ...args);
};

const debugWarn = (message: string, ...args: any[]) => {
    if (DEBUG_LOGS) console.warn(message, ...args);
};

const debugError = (message: string, ...args: any[]) => {
    console.error(message, ...args); // Always log errors
};

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
    private perfectNegotiation: PerfectNegotiation;
    private role: Role;
    private roomId: string;
    private clientId: string;
    private readyToNegotiate: boolean = false;
    private presenceResetTimeout: ReturnType<typeof setTimeout> | null = null;

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
        debugLog(`[WebRTC] Creating PeerConnection with role: ${role}, roomId: ${roomId}, clientId: ${clientId}`);
        this.roomId = roomId;
        this.clientId = clientId;
        this.role = role;

        // Dispatch action to ensure the latest ICE configuration
        store.dispatch(getLatestIceConfig());

        // Get the ICE configuration from the store
        const iceConfig = store.getState().iceConfig.config;
        debugLog('[WebRTC] Using ICE configuration:', JSON.stringify(iceConfig));

        // Vérifier si les serveurs TURN sont bien configurés
        this.checkTurnConfiguration(iceConfig);

        // Note: Test TURN désactivé temporairement car il interfère avec la connexion principale
        // this.testTurnServer('turn:turn.ekami.ch:3478', 'wei', 'toto1234');

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

        // Initialize Perfect Negotiation with reference to this PeerConnection instance
        this.perfectNegotiation = new PerfectNegotiation(
            this.pc,
            this.signaling,
            this.roomId,
            this.clientId,
            this.role,
            this // Pass reference to PeerConnection for DataChannel triggering
        );

        // Register callback for connection state changes
        this.perfectNegotiation.onConnectionStateChanged((state) => {
            if (this.onConnectionStateChangeCallback) {
                this.onConnectionStateChangeCallback(state);
            }
        });

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
        // Nettoyer les timers existants
        if (this.iceConnectionTimeout) {
            clearTimeout(this.iceConnectionTimeout);
            this.iceConnectionTimeout = null;
        }

        // Réinitialiser les variables de débogage ICE
        this.iceStartTime = Date.now();
        this.iceCandidates = { local: [], remote: [] };
        this.hasRelay = false;

        console.log('[WebRTC-ICE] Setting up ICE debugging and candidate handling');

        // ====== ICE DEBUGGING ET MONITORING ======
        // Note: ICE candidate handling is now managed by Perfect Negotiation
        // This section only handles debugging and monitoring
        console.log('[WebRTC-ICE] Setting up ICE debugging and monitoring');

        // Let Perfect Negotiation handle ICE candidates, we just monitor
        // No pc.onicecandidate here to avoid conflicts with Perfect Negotiation

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

                    // Try Perfect Negotiation automatic reconnection if both peers are still present
                    if (this.signaling.hasPatientAndPractitioner()) {
                        console.log('[WebRTC-ICE] Both peers present, attempting Perfect Negotiation reconnection...');
                        setTimeout(() => {
                            this.perfectNegotiation.attemptReconnection();
                        }, 1000); // Small delay to let logs complete
                    } else {
                        console.log('[WebRTC-ICE] Peer absent, not attempting reconnection');
                    }
                    break;

                case 'disconnected':
                    console.warn('[WebRTC-ICE] Connection disconnected, monitoring for recovery...');

                    // Give Perfect Negotiation time to handle reconnection automatically
                    setTimeout(() => {
                        if (this.pc.iceConnectionState === 'disconnected' &&
                            this.signaling.hasPatientAndPractitioner()) {
                            console.log('[WebRTC-ICE] Still disconnected with both peers present, attempting Perfect Negotiation reconnection...');
                            this.perfectNegotiation.attemptReconnection();
                        }
                    }, 5000); // Wait longer for natural recovery
                    break;
            }
        };
    }

    // Méthode pour réessayer d'ajouter tous les candidats ICE en cas d'échec de connexion
    private async retryAddingIceCandidates() {
        console.log('[WebRTC-ICE] Retrying to add all accumulated ICE candidates...');

        // Réessayer d'ajouter tous les candidats distants accumulés
        for (const candidate of this.iceCandidates.remote) {
            try {
                await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('[WebRTC-ICE] Re-added remote ICE candidate:', candidate.candidate);
            } catch (err) {
                console.error('[WebRTC-ICE] Failed to re-add remote ICE candidate:', err);
            }
        }

        console.log(`[WebRTC-ICE] Retry complete. ${this.iceCandidates.remote.length} remote candidates re-processed.`);
    }

    // Analyse un candidat ICE pour déterminer son type et détecter les problèmes potentiels
    private analyzeIceCandidate(candidate: RTCIceCandidate, isLocal: boolean) {
        const candidateStr = candidate.candidate;
        if (!candidateStr) return;

        try {
            // Vérifier si c'est un candidat relay (TURN)
            if (candidateStr.includes(' typ relay ')) {
                this.hasRelay = true;
                console.log(`[WebRTC-ICE] ${isLocal ? 'Local' : 'Remote'} TURN relay candidate found: ${candidateStr}`);

                // Extraire l'adresse IP du serveur TURN utilisé
                const ipMatch = candidateStr.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
                if (ipMatch) {
                    console.log(`[WebRTC-ICE] TURN server IP: ${ipMatch[1]}`);
                }

                // Vérifier le protocole utilisé (UDP/TCP)
                if (candidateStr.includes('udp')) {
                    console.log('[WebRTC-ICE] Using UDP protocol for TURN');
                } else if (candidateStr.includes('tcp')) {
                    console.log('[WebRTC-ICE] Using TCP protocol for TURN');
                }
            }

            // Extraire le type de candidat
            const match = candidateStr.match(/ typ ([a-z]+) /);
            if (match) {
                const type = match[1]; // host, srflx, prflx ou relay
                console.log(`[WebRTC-ICE] ${isLocal ? 'Local' : 'Remote'} candidate type: ${type}`);

                // Si on reçoit un candidat distant, c'est un bon signe que la communication fonctionne
                if (!isLocal) {
                    console.log('[WebRTC-ICE] Successfully received remote candidate - signaling is working');
                }
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

        // Note: Signaling message handling is now managed by Perfect Negotiation
        // The PerfectNegotiation class handles all offer/answer/ice-candidate messages
        // This eliminates race conditions and implements proper collision detection

        // Écouter les changements de présence dans la salle
        this.signaling.onPresenceChange((presences: UserPresence[]) => {
            console.log('[WebRTC] Room presence changed:', presences);

            // Vérifier si un patient et un praticien sont présents
            const hasPatientAndPractitioner = this.signaling.hasPatientAndPractitioner();
            console.log(`[WebRTC] Room has patient and practitioner: ${hasPatientAndPractitioner}`);

            // Si un reset était prévu mais que les deux sont à nouveau présents, l'annuler
            if (hasPatientAndPractitioner && this.presenceResetTimeout) {
                clearTimeout(this.presenceResetTimeout);
                this.presenceResetTimeout = null;
                console.log('[WebRTC] Participant reconnected before timeout — reset cancelled');
                console.log('[WebRTC] Resuming existing connection, no need to reinitialize');
                return; // Sortir immédiatement car on récupère la connexion existante
            }

            // Si le statut a changé, mettre à jour et notifier
            if (this.readyToNegotiate !== hasPatientAndPractitioner) {
                const wasReady = this.readyToNegotiate;
                this.readyToNegotiate = hasPatientAndPractitioner;

                // Si la salle était prête avant mais ne l'est plus maintenant, cela signifie
                // qu'un participant s'est déconnecté
                if (wasReady && !hasPatientAndPractitioner) {
                    console.log('[WebRTC] A participant disconnected, resetting peer connection');

                    // Perfect Negotiation compatible timeout logic for practitioner  
                    // Only reset if connection is truly failed and patient is still absent
                    if (this.role === Role.PRACTITIONER) {
                        // Check if connection failed while patient is absent
                        const connectionFailed = this.pc.connectionState === 'failed' ||
                            (this.pc.connectionState === 'disconnected' &&
                                this.pc.iceConnectionState === 'failed');

                        const patientAbsent = !this.signaling.hasPatientAndPractitioner();

                        if (connectionFailed && patientAbsent) {
                            console.warn('[WebRTC] Connection failed and patient absent. Resetting immediately...');
                            this.resetPeerConnection();
                            return;
                        }

                        if (patientAbsent &&
                            (this.pc.connectionState === 'connected' || this.pc.connectionState === 'connecting')) {
                            console.warn('[WebRTC] Patient absent but connection still active. Waiting before reset...');

                            if (this.presenceResetTimeout) {
                                clearTimeout(this.presenceResetTimeout);
                            }

                            this.presenceResetTimeout = setTimeout(() => {
                                const stillMissing = !this.signaling.hasPatientAndPractitioner();

                                if (stillMissing) {
                                    console.warn('[WebRTC] Patient still absent after timeout. Resetting...');
                                    this.resetPeerConnection();
                                } else {
                                    console.log('[WebRTC] Patient returned. No reset needed.');
                                }

                                this.presenceResetTimeout = null;
                            }, 3000); // Longer timeout to allow for Perfect Negotiation recovery

                            return;
                        }
                    }

                    // Perfect Negotiation compatible timeout logic for patient
                    // Only reset if connection is truly failed and practitioner is still absent
                    if (this.role === Role.PATIENT) {
                        // Check if connection failed while practitioner is absent
                        const connectionFailed = this.pc.connectionState === 'failed' ||
                            (this.pc.connectionState === 'disconnected' &&
                                this.pc.iceConnectionState === 'failed');

                        const practitionerAbsent = !this.signaling.hasPatientAndPractitioner();

                        if (connectionFailed && practitionerAbsent) {
                            console.warn('[WebRTC] Connection failed and practitioner absent. Resetting immediately...');
                            this.resetPeerConnection();
                            return;
                        }

                        if (practitionerAbsent &&
                            (this.pc.connectionState === 'connected' || this.pc.connectionState === 'connecting')) {
                            console.warn('[WebRTC] Practitioner absent but connection still active. Waiting before reset...');

                            if (this.presenceResetTimeout) {
                                clearTimeout(this.presenceResetTimeout);
                            }

                            this.presenceResetTimeout = setTimeout(() => {
                                const stillMissing = !this.signaling.hasPatientAndPractitioner();

                                if (stillMissing) {
                                    console.warn('[WebRTC] Practitioner still absent after timeout. Resetting...');
                                    this.resetPeerConnection();
                                } else {
                                    console.log('[WebRTC] Practitioner returned. No reset needed.');
                                }

                                this.presenceResetTimeout = null;
                            }, 5000); // Longer timeout to allow for Perfect Negotiation recovery

                            return;
                        }
                    }
                }

                // Notifier que la salle est prête pour la connexion
                if (this.onRoomReadyCallback) {
                    this.onRoomReadyCallback(this.readyToNegotiate);
                }

                // Perfect Negotiation P2P: Let the first to arrive initiate, regardless of business role
                // The negotiation is now handled entirely by Perfect Negotiation based on arrival order
                if (this.readyToNegotiate) {
                    const roleInfo = this.perfectNegotiation.getRoleInfo();
                    debugLog(`[WebRTC] Room ready for P2P connection. Role info:`, roleInfo);

                    // Perfect Negotiation will handle all connection initiation automatically
                    debugLog(`[WebRTC] Perfect Negotiation enabled - role: ${roleInfo.isPolite ? 'polite' : 'impolite'}`);
                    debugLog('[WebRTC] DataChannel creation will be handled by Perfect Negotiation via negotiationneeded events');

                    // Notify Perfect Negotiation that room is ready
                    this.perfectNegotiation.onRoomReady();
                }
            }
        });
    }

    // Connect to signaling service and set up listeners
    async connect() {
        console.log('[WebRTC] Connecting to signaling service');

        // Réinitialiser l'état avant de se connecter
        this.readyToNegotiate = false;
        this.iceCandidates = { local: [], remote: [] };
        this.hasRelay = false;

        // Se connecter au service de signalisation
        await this.signaling.connect();

        // Configurer les écouteurs de signalisation
        await this.setupSignalingListeners();

        console.log('[WebRTC] Connected to signaling service and setup completed');
    }

    // Créer une offre pour établir la connexion
    async createOffer() {
        console.log('[WebRTC] Note: Perfect Negotiation handles all offer creation automatically');
        console.log('[WebRTC] This method is kept for compatibility but offer creation is managed by Perfect Negotiation');
        // Perfect Negotiation handles all offer creation via negotiationneeded events
        // No manual intervention needed - the pattern will handle everything automatically
    }

    // Configure les événements pour le dataChannel
    setupDataChannel(channel: RTCDataChannel) {
  this.dataChannelManager.setupDataChannel(channel);

  // 👉 Ici tu peux connecter le callback de mesure si nécessaire
  this.dataChannelManager.onMeasurement((data) => {
    console.log('[WebRTC] onMeasurement déclenché avec :', data);
    // Appelle ton hook ou fonction ici
  });
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
        console.log('[WebRTC] Disconnecting from room:', this.roomId);

        try {
            // Nettoyer les timers
            if (this.iceConnectionTimeout) {
                clearTimeout(this.iceConnectionTimeout);
                this.iceConnectionTimeout = null;
            }

            // Nettoyer le timeout de reset de présence
            if (this.presenceResetTimeout) {
                clearTimeout(this.presenceResetTimeout);
                this.presenceResetTimeout = null;
            }

            // Fermer le canal de données
            this.dataChannelManager.closeDataChannel();

            // Clean up Perfect Negotiation
            this.perfectNegotiation.destroy();

            // Désactiver tous les gestionnaires d'événements de la connexion peer
            // Note: Perfect Negotiation already cleaned its handlers, but we ensure cleanup
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

            // Réinitialiser l'état et les collections
            this.readyToNegotiate = false;

            // S'assurer que les candidats ICE sont correctement nettoyés
            this.iceCandidates = { local: [], remote: [] };
            this.hasRelay = false;


            // Forcer une mise à jour de l'état pour les composants qui observent
            // les changements de statut du dataChannel
            store.dispatch({
                type: 'webrtc/connectionStatusChanged', payload: {
                    status: 'disconnected',
                    roomId: this.roomId
                }
            });

            // Forcer un dispatch explicite quand on quitte une room pour éviter
            // tout comportement résiduel
            store.dispatch({ type: 'webrtc/dataChannelStatusChanged' });

            // Nettoyer toute référence à cette salle dans le state Redux
            store.dispatch(cleanupRoomState({ roomId: this.roomId }));

            console.log('[WebRTC] Disconnection complete from room:', this.roomId);
        } catch (error) {
            console.error('[WebRTC] Error during disconnect:', error);

            // Même en cas d'erreur, forcer les notifications de déconnexion
            // pour éviter que l'interface reste bloquée dans un état incohérent
            store.dispatch({
                type: 'webrtc/connectionStatusChanged', payload: {
                    status: 'disconnected',
                    roomId: this.roomId
                }
            });
            store.dispatch({ type: 'webrtc/dataChannelStatusChanged' });
        }
    }

    // Réinitialiser la connexion RTC peer
    private resetPeerConnection() {
        console.log('[WebRTC] Resetting peer connection for room:', this.roomId);

        // Fermer le canal de données
        this.dataChannelManager.closeDataChannel();

        // Clean up old Perfect Negotiation instance
        this.perfectNegotiation.destroy();

        // Nettoyer les timers existants
        if (this.iceConnectionTimeout) {
            clearTimeout(this.iceConnectionTimeout);
            this.iceConnectionTimeout = null;
        }

        // Nettoyer le timeout de reset de présence
        if (this.presenceResetTimeout) {
            clearTimeout(this.presenceResetTimeout);
            this.presenceResetTimeout = null;
        }

        // Désactiver tous les gestionnaires d'événements de la connexion peer
        // Note: Perfect Negotiation already cleaned its handlers, but we ensure cleanup
        this.pc.onicecandidate = null;
        this.pc.onconnectionstatechange = null;
        this.pc.oniceconnectionstatechange = null;
        this.pc.onsignalingstatechange = null;
        this.pc.onnegotiationneeded = null;
        this.pc.ondatachannel = null;

        // Fermer l'ancienne connexion peer
        this.pc.close();

        // Récupérer la configuration ICE actuelle
        const iceConfig = store.getState().iceConfig.config;

        // Recréer une nouvelle connexion peer avec la même configuration
        this.pc = new RTCPeerConnection(iceConfig);

        // Réinitialiser les collections de candidats ICE
        this.iceCandidates = { local: [], remote: [] };
        this.hasRelay = false;

        // Reinitialize Perfect Negotiation with the new peer connection
        this.perfectNegotiation = new PerfectNegotiation(
            this.pc,
            this.signaling,
            this.roomId,
            this.clientId,
            this.role,
            this // Pass reference to PeerConnection for DataChannel triggering
        );

        // Register callback for connection state changes
        this.perfectNegotiation.onConnectionStateChanged((state) => {
            if (this.onConnectionStateChangeCallback) {
                this.onConnectionStateChangeCallback(state);
            }
        });

        // Update data channel manager with new peer connection
        this.dataChannelManager = new DataChannelManager(
            () => this.pc,
            this.roomId,
            this.clientId,
            this.role
        );

        // NOTE: Ne pas réinitialiser this.readyToNegotiate ici car cet état doit être géré
        // par la logique de présence. Si on le remet à false, cela empêche la reconnexion
        // immédiate quand les deux participants sont présents.

        // Reconfigurer tous les écouteurs d'événements de base
        this.setupListeners();

        // Reconfigurer le débogage ICE (crucial pour l'envoi des candidats ICE)
        this.setupIceDebugging();

        // Vérifier si la salle est prête pour la négociation après la réinitialisation
        // Perfect Negotiation P2P: Let arrival order determine who initiates, not business role
        const hasPatientAndPractitioner = this.signaling.hasPatientAndPractitioner();
        debugLog(`[WebRTC] After reset, room has patient and practitioner: ${hasPatientAndPractitioner}`);

        // Perfect Negotiation will handle all reconnection and data channel creation automatically
        if (hasPatientAndPractitioner) {
            const roleInfo = this.perfectNegotiation.getRoleInfo();
            debugLog('[WebRTC] Room ready after reset, Perfect Negotiation will handle connection initiation');
            debugLog('[WebRTC] P2P role info:', roleInfo);
        }

        // Notifier explicitement le changement d'état de connexion, car la nouvelle
        // instance de PeerConnection ne déclenche pas automatiquement l'événement
        if (this.onConnectionStateChangeCallback) {
            console.log('[WebRTC] Explicitly updating connection state to "disconnected"');
            this.onConnectionStateChangeCallback('disconnected');
        }

        // Forcer une mise à jour de l'état pour les composants qui observent
        // les changements de statut du dataChannel et de la connexion
        store.dispatch({ type: 'webrtc/dataChannelStatusChanged' });
        store.dispatch({
            type: 'webrtc/connectionStatusChanged', payload: {
                status: 'reset',
                roomId: this.roomId
            }
        });

        console.log('[WebRTC] Peer connection has been reset for room:', this.roomId);
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

    // Perfect Negotiation debugging and monitoring
    getPerfectNegotiationState() {
        return this.perfectNegotiation.getNegotiationState();
    }

    isAttemptingReconnection(): boolean {
        return this.perfectNegotiation.isAttemptingReconnection();
    }

    // Public method for Perfect Negotiation to trigger DataChannel creation
    // This is the ONLY way DataChannel should be created - through Perfect Negotiation
    triggerDataChannelCreation(): void {
        console.log('[WebRTC] Perfect Negotiation triggering DataChannel creation');
        this.dataChannelManager.createDataChannel();
    }
    getDataChannelManager(): DataChannelManager {  //bluetooth
  return this.dataChannelManager;
}

}