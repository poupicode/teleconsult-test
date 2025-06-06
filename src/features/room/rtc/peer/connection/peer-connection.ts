// Main class for WebRTC connection management

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

// WebRTC interfaces for statistics
interface RTCStatsReport {
    forEach(callbackfn: (value: RTCStats) => void): void;
}

interface RTCStats {
    id: string;
    timestamp: number;
    type: string;
    [key: string]: any;
}

// Specific interface for ICE candidate statistics
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

// Specific interface for ICE candidate pair statistics
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

// Interface for ICE candidate analysis
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

    // Exported constants for compatibility
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

        // Check if TURN servers are properly configured
        this.checkTurnConfiguration(iceConfig);

        // Initialize signaling
        this.signaling = new SignalingService(roomId, clientId, role);

        // Initialize WebRTC peer connection with the ICE configuration
        this.pc = new RTCPeerConnection(iceConfig);

        // Initialize DataChannel manager with a function that always returns the current peer connection
        this.dataChannelManager = new DataChannelManager(
            () => this.pc,  // This function will always provide the current peer connection
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

    // Check if TURN configuration is valid
    private checkTurnConfiguration(iceConfig: RTCConfiguration) {
        if (!iceConfig.iceServers || iceConfig.iceServers.length === 0) {
            console.error('[WebRTC] No ICE servers configured!');
            return;
        }

        // Search for TURN servers
        let hasTurnServer = false;
        for (const server of iceConfig.iceServers) {
            if (!server.urls) continue;

            const urls = Array.isArray(server.urls) ? server.urls : [server.urls];

            for (const url of urls) {
                if (typeof url === 'string' && url.startsWith('turn:')) {
                    hasTurnServer = true;
                    // Check TURN credentials
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

    // Setup advanced ICE debugging
    private setupIceDebugging() {
        // Clean up existing timers
        if (this.iceConnectionTimeout) {
            clearTimeout(this.iceConnectionTimeout);
            this.iceConnectionTimeout = null;
        }

        // Reset ICE debugging variables
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

        // Monitor ICE connection state changes
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

                    // Analyze detailed statistics after connection
                    setTimeout(() => this.getDetailedConnectionStats(), 1000);
                    break;

                case 'failed':
                    console.error('[WebRTC-ICE] ❌ Connection failed. This is likely due to a TURN server issue or network restriction.');
                    this.logIceStats();

                    // Try Perfect Negotiation automatic reconnection if both peers are still present
                    if (this.signaling.hasPatientAndPractitioner()) {
                        console.log('[WebRTC-ICE] 🔄 Both peers present, attempting Perfect Negotiation reconnection...');
                        setTimeout(() => {
                            this.perfectNegotiation.attemptReconnection();
                        }, 1000); // Small delay to let logs complete
                    } else {
                        console.log('[WebRTC-ICE] 👤 Peer absent, not attempting reconnection');
                    }
                    break;

                case 'disconnected':
                    console.warn('[WebRTC-ICE] 🔌 Connection disconnected, monitoring for recovery...');

                    // Smart reconnection strategy: Short timeout for teleconsultation
                    setTimeout(() => {
                        if (this.pc.iceConnectionState === 'disconnected' &&
                            this.signaling.hasPatientAndPractitioner()) {
                            console.log('[WebRTC-ICE] 🔄 Still disconnected after 2s, attempting reconnection...');
                            this.perfectNegotiation.attemptReconnection();
                        }
                    }, 2000); // Short timeout: optimal for teleconsultation UX
                    break;
            }
        };
    }




    // Analyze connection statistics to understand issues
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

                // Find the selected candidate pair
                if (report.type === 'candidate-pair' && report.selected === true) {
                    selectedPair = report as RTCIceCandidatePairStats;
                    console.log('[WebRTC-ICE] Selected candidate pair:', report);
                }

                // Store candidate information
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

            // Analyze the selected pair
            if (selectedPair && localCandidate && remoteCandidate) {
                console.log('[WebRTC-ICE] Connection established using:');
                console.log(`[WebRTC-ICE] Local: ${(localCandidate as RTCIceCandidateStats).candidateType} (${(localCandidate as RTCIceCandidateStats).protocol}) - ${(localCandidate as RTCIceCandidateStats).ip}:${(localCandidate as RTCIceCandidateStats).port}`);
                console.log(`[WebRTC-ICE] Remote: ${(remoteCandidate as RTCIceCandidateStats).candidateType} (${(remoteCandidate as RTCIceCandidateStats).protocol}) - ${(remoteCandidate as RTCIceCandidateStats).ip}:${(remoteCandidate as RTCIceCandidateStats).port}`);

                if ((localCandidate as RTCIceCandidateStats).candidateType === 'relay' || (remoteCandidate as RTCIceCandidateStats).candidateType === 'relay') {
                    console.log('[WebRTC-ICE] Connection using TURN relay');
                    // Identify which TURN server is being used
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

    // Log ICE statistics for debugging
    private logIceStats() {
        console.log('[WebRTC-ICE] === ICE Connection Diagnostics ===');
        console.log(`[WebRTC-ICE] Connection state: ${this.pc.iceConnectionState}`);
        console.log(`[WebRTC-ICE] Gathering state: ${this.pc.iceGatheringState}`);
        console.log(`[WebRTC-ICE] Signaling state: ${this.pc.signalingState}`);
        console.log(`[WebRTC-ICE] Local candidates: ${this.iceCandidates.local.length}`);
        console.log(`[WebRTC-ICE] Remote candidates: ${this.iceCandidates.remote.length}`);

        // Local candidate types
        const localTypes: CandidateTypeCount = this.iceCandidates.local.reduce((acc: CandidateTypeCount, candidate) => {
            const match = candidate.candidate.match(/ typ ([a-z]+) /);
            if (match) {
                const type = match[1];
                acc[type] = (acc[type] || 0) + 1;
            }
            return acc;
        }, {});
        console.log('[WebRTC-ICE] Local candidate types:', localTypes);

        // Remote candidate types
        if (this.iceCandidates.remote.length > 0) {
            console.log('[WebRTC-ICE] Remote candidates details:');
            this.iceCandidates.remote.forEach((candidate, index) => {
                console.log(`[WebRTC-ICE] Remote candidate ${index}:`, candidate);
            });
        } else {
            console.warn('[WebRTC-ICE] No remote candidates received - this is the main reason for connection failure');
        }

        // Check common failure factors
        if (!this.hasRelay) {
            console.warn('[WebRTC-ICE] No TURN relay candidates found - this often causes connection failures in restrictive networks');
        }

        if (this.pc.iceConnectionState === 'failed') {
            console.warn('[WebRTC-ICE] Connection failure may be due to:');
            console.warn('- TURN server inaccessible or misconfigured');
            console.warn('- Invalid or expired TURN credentials');
            console.warn('- Ports blocked by firewall');
            console.warn('- Too restrictive network restrictions');
        }

        // Display ICE configuration
        const iceConfig = store.getState().iceConfig.config;
        console.log('[WebRTC-ICE] Current ICE configuration:', JSON.stringify(iceConfig));
    }


    // Method to configure all listeners
    private setupListeners() {
        // Setup listeners for the PeerConnection
        setupPeerConnectionListeners(this, this.pc);

        // Setup listeners for chat messages from DataChannelManager
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

        // Listen for presence changes in the room
        this.signaling.onPresenceChange((presences: UserPresence[]) => {
            console.log('[WebRTC] Room presence changed:', presences);
            // Check if a patient and practitioner are present
            const hasPatientAndPractitioner = this.signaling.hasPatientAndPractitioner();
            console.log(`[WebRTC] Room has patient and practitioner: ${hasPatientAndPractitioner}`);

            // Smart timeout: check if a reset was planned and evaluate connection state
            if (hasPatientAndPractitioner && this.presenceResetTimeout) {
                clearTimeout(this.presenceResetTimeout);
                this.presenceResetTimeout = null;
                console.log('[WebRTC] Participant reconnected before timeout — evaluating connection for recovery');

                // Check the health of the existing connection with ULTRA-TOLERANT criteria
                const isConnectionHealthy = this.isConnectionHealthy();

                if (isConnectionHealthy) {
                    console.log('[WebRTC] ✅ Connection is healthy/recoverable — preserving existing connection');
                    return; // Healthy connection, continue with existing one
                } else {
                    console.log('[WebRTC] ⚠️ Connection appears degraded — applying simple reset');
                    // Simple reset without complex grace period logic
                    this.resetPeerConnection();
                    return;
                }
            }

            // If status has changed, update and notify
            if (this.readyToNegotiate !== hasPatientAndPractitioner) {
                const wasReady = this.readyToNegotiate;
                this.readyToNegotiate = hasPatientAndPractitioner;

                // If the room was ready before but isn't now, it means
                // a participant has disconnected
                if (wasReady && !hasPatientAndPractitioner) {
                    console.log('[WebRTC] 👋 A participant disconnected, applying smart reconnection strategy...');

                    // Smart reconnection strategy: Short timeout for teleconsultation
                    if (this.presenceResetTimeout) {
                        clearTimeout(this.presenceResetTimeout);
                    }

                    this.presenceResetTimeout = setTimeout(() => {
                        const stillMissing = !this.signaling.hasPatientAndPractitioner();

                        if (stillMissing) {
                            console.warn('[WebRTC] ⏰ Participant still absent after 3s. Resetting connection...');
                            this.resetPeerConnection();
                        } else {
                            console.log('[WebRTC] ✅ Participant returned! No reset needed.');
                        }

                        this.presenceResetTimeout = null;
                    }, 3000); // 3s timeout: optimal for teleconsultation UX

                    return;
                }

                // Notify that the room is ready for connection
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

        // Reset state before connecting
        this.readyToNegotiate = false;
        this.iceCandidates = { local: [], remote: [] };
        this.hasRelay = false;

        // Connect to signaling service
        await this.signaling.connect();

        // Setup signaling listeners
        await this.setupSignalingListeners();

        console.log('[WebRTC] Connected to signaling service and setup completed');
    }

    // Create an offer to establish connection
    async createOffer() {
        console.log('[WebRTC] Note: Perfect Negotiation handles all offer creation automatically');
        console.log('[WebRTC] This method is kept for compatibility but offer creation is managed by Perfect Negotiation');
        // Perfect Negotiation handles all offer creation via negotiationneeded events
        // No manual intervention needed - the pattern will handle everything automatically
    }

    // Configure events for the dataChannel
    setupDataChannel(channel: RTCDataChannel) {
        this.dataChannelManager.setupDataChannel(channel);
    }

    // Send a chat message
    sendChatMessage(content: string): boolean {
        return this.dataChannelManager.sendChatMessage(content);
    }

    // Subscribe to chat messages
    onChatMessage(callback: (message: ChatMessage) => void) {
        this.onChatMessageCallback = callback;
    }

    // Check if the dataChannel is available
    isDataChannelAvailable(): boolean {
        return this.dataChannelManager.isDataChannelAvailable();
    }

    // Check if the room is ready for connection (patient + practitioner present)
    isRoomReady(): boolean {
        return this.readyToNegotiate;
    }

    // Callback for room state changes
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
            // Clean up timers
            if (this.iceConnectionTimeout) {
                clearTimeout(this.iceConnectionTimeout);
                this.iceConnectionTimeout = null;
            }

            // Clean up presence reset timeout
            if (this.presenceResetTimeout) {
                clearTimeout(this.presenceResetTimeout);
                this.presenceResetTimeout = null;
            }

            // Close the data channel
            this.dataChannelManager.closeDataChannel();

            // Clean up Perfect Negotiation
            this.perfectNegotiation.destroy();

            // Disable all peer connection event handlers
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

            // Reset state and collections
            this.readyToNegotiate = false;

            // Ensure ICE candidates are properly cleaned up
            this.iceCandidates = { local: [], remote: [] };
            this.hasRelay = false;


            // Force a state update for components observing
            // dataChannel status changes
            store.dispatch({
                type: 'webrtc/connectionStatusChanged', payload: {
                    status: 'disconnected',
                    roomId: this.roomId
                }
            });

            // Force an explicit dispatch when leaving a room to avoid
            // any residual behavior
            store.dispatch({ type: 'webrtc/dataChannelStatusChanged' });

            // Clean up any reference to this room in Redux state
            store.dispatch(cleanupRoomState({ roomId: this.roomId }));

            console.log('[WebRTC] Disconnection complete from room:', this.roomId);
        } catch (error) {
            console.error('[WebRTC] Error during disconnect:', error);

            // Even in case of error, force disconnection notifications
            // to prevent the interface from remaining stuck in an inconsistent state
            store.dispatch({
                type: 'webrtc/connectionStatusChanged', payload: {
                    status: 'disconnected',
                    roomId: this.roomId
                }
            });
            store.dispatch({ type: 'webrtc/dataChannelStatusChanged' });
        }
    }

    // Reset the RTC peer connection
    private resetPeerConnection() {
        console.log('[WebRTC] Resetting peer connection for room:', this.roomId);

        // Close the data channel
        this.dataChannelManager.closeDataChannel();

        // Clean up old Perfect Negotiation instance
        this.perfectNegotiation.destroy();

        // Clean up existing timers
        if (this.iceConnectionTimeout) {
            clearTimeout(this.iceConnectionTimeout);
            this.iceConnectionTimeout = null;
        }

        // Clean up presence reset timeout
        if (this.presenceResetTimeout) {
            clearTimeout(this.presenceResetTimeout);
            this.presenceResetTimeout = null;
        }

        // Disable all peer connection event handlers
        // Note: Perfect Negotiation already cleaned its handlers, but we ensure cleanup
        this.pc.onicecandidate = null;
        this.pc.onconnectionstatechange = null;
        this.pc.oniceconnectionstatechange = null;
        this.pc.onsignalingstatechange = null;
        this.pc.onnegotiationneeded = null;
        this.pc.ondatachannel = null;

        // Close the old peer connection
        this.pc.close();

        // Get current ICE configuration
        const iceConfig = store.getState().iceConfig.config;

        // Recreate a new peer connection with the same configuration
        this.pc = new RTCPeerConnection(iceConfig);

        // Reset ICE candidate collections
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

        // NOTE: Do not reset this.readyToNegotiate here as this state must be managed
        // by presence logic. If we reset it to false, it prevents immediate reconnection
        // when both participants are present.

        // Reconfigure all basic event listeners
        this.setupListeners();

        // Reconfigure ICE debugging (crucial for sending ICE candidates)
        this.setupIceDebugging();

        // Check if the room is ready for negotiation after reset
        // Perfect Negotiation P2P: Let arrival order determine who initiates, not business role
        const hasPatientAndPractitioner = this.signaling.hasPatientAndPractitioner();
        debugLog(`[WebRTC] After reset, room has patient and practitioner: ${hasPatientAndPractitioner}`);

        // Perfect Negotiation will handle all reconnection and data channel creation automatically
        if (hasPatientAndPractitioner) {
            const roleInfo = this.perfectNegotiation.getRoleInfo();
            debugLog('[WebRTC] Room ready after reset, Perfect Negotiation will handle connection initiation');
            debugLog('[WebRTC] P2P role info:', roleInfo);
        }

        // Explicitly notify connection state change, as the new
        // PeerConnection instance doesn't automatically trigger the event
        if (this.onConnectionStateChangeCallback) {
            console.log('[WebRTC] Explicitly updating connection state to "disconnected"');
            this.onConnectionStateChangeCallback('disconnected');
        }

        // Force a state update for components observing
        // dataChannel and connection status changes
        store.dispatch({ type: 'webrtc/dataChannelStatusChanged' });
        store.dispatch({
            type: 'webrtc/connectionStatusChanged', payload: {
                status: 'reset',
                roomId: this.roomId
            }
        });

        console.log('[WebRTC] Peer connection has been reset for room:', this.roomId);
    }

    /**
     * Check the health of the current WebRTC connection
     * Used by smart timeout to decide between recovery or reset
     * VERY tolerant criteria to maximize natural WebRTC recovery
     */
    private isConnectionHealthy(): boolean {
        // Check peer connection state
        const pc = this.getPeerConnection();
        if (!pc) {
            console.log('[WebRTC] No peer connection available');
            return false;
        }

        const connectionState = pc.connectionState;
        const iceState = pc.iceConnectionState;
        const signalingState = pc.signalingState;

        // VERY TOLERANT Criteria - Massively favor recovery:

        // 1. Connection: Only definitively broken states are rejected
        const isConnectionBroken = connectionState === 'failed' || connectionState === 'closed';

        // 2. ICE: Same logic, only definitive failures
        const isIceBroken = iceState === 'failed' || iceState === 'closed';

        // 3. Signaling: Accept ALL states except 'closed' (even transition states)
        const isSignalingBroken = signalingState === 'closed';

        // 4. DataChannel: NEVER be a health criterion - it can be recreated
        // const dataChannelState = this.dataChannelManager?.isHealthy() ?? false;

        console.log(`[WebRTC] Connection health check (ULTRA-TOLERANT): connection=${connectionState}(broken=${isConnectionBroken}), ice=${iceState}(broken=${isIceBroken}), signaling=${signalingState}(broken=${isSignalingBroken})`);

        // Connection considered healthy if NO state is definitively broken
        const isHealthy = !isConnectionBroken && !isIceBroken && !isSignalingBroken;

        if (isHealthy) {
            console.log('[WebRTC] ✅ Connection is healthy/recoverable, preserving existing connection');
        } else {
            console.log('[WebRTC] ❌ Connection is definitively broken, reset justified');
        }

        return isHealthy;
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
        console.log('[WebRTC] 🏗️ Perfect Negotiation triggering DataChannel creation');
        this.dataChannelManager.createDataChannel();
    }

    /**
     * Force reconnection - useful for UI "Reconnect" buttons or manual recovery
     * This resets the connection and lets Perfect Negotiation handle the reconnection
     */
    async forceReconnection(): Promise<void> {
        console.log('[WebRTC] 🔄 Force reconnection requested');

        try {
            // Reset Perfect Negotiation state
            this.perfectNegotiation.resetNegotiationState();

            // Trigger reconnection via Perfect Negotiation
            await this.perfectNegotiation.attemptReconnection();

            console.log('[WebRTC] ✅ Force reconnection initiated successfully');
        } catch (error) {
            console.error('[WebRTC] ❌ Force reconnection failed:', error);
            throw error;
        }
    }

    /**
     * Get current connection diagnostics for debugging
     */
    getConnectionDiagnostics() {
        return {
            connectionState: this.pc.connectionState,
            iceConnectionState: this.pc.iceConnectionState,
            signalingState: this.pc.signalingState,
            perfectNegotiation: this.perfectNegotiation.getDetailedNegotiationState(),
            roomReady: this.readyToNegotiate,
            participants: this.signaling.getValidParticipants()
        };
    }

    getDataChannelManager(): DataChannelManager {  //bluetooth
        return this.dataChannelManager;
    }

}