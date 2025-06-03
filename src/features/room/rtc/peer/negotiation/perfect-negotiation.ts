/**
 * Perfect Negotiation Implementation
 * 
 * This implements the WebRTC Perfect Negotiation pattern as described in:
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
 * 
 * Perfect negotiation eliminates the complexity of managing offer/answer collisions
 * by assigning asymmetric roles to peers that are independent of business logic.
 */

import { SignalingService, SignalingMessage, RoleCoordinationContent } from '../../signaling';
import { Role, NegotiationRole, NegotiationState, RoleCoordinationState } from '../models/types';

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

export class PerfectNegotiation {
    private pc: RTCPeerConnection;
    private signaling: SignalingService;
    private roomId: string;
    private clientId: string;
    private role: Role;

    // Perfect negotiation specific state
    private negotiationRole: NegotiationRole;
    private negotiationState: NegotiationState;
    private roleCoordination: RoleCoordinationState;
    private hasTriggeredInitialConnection: boolean = false; // Prevent double triggering

    // Callbacks
    private onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
    private peerConnection?: any; // Reference to PeerConnection instance for DataChannel triggering

    constructor(
        pc: RTCPeerConnection,
        signaling: SignalingService,
        roomId: string,
        clientId: string,
        role: Role,
        peerConnection?: any // Optional PeerConnection reference
    ) {
        this.pc = pc;
        this.signaling = signaling;
        this.roomId = roomId;
        this.clientId = clientId;
        this.role = role;
        this.peerConnection = peerConnection;

        // Initialize negotiation state
        this.negotiationState = {
            makingOffer: false,
            ignoreOffer: false,
            isSettingRemoteAnswerPending: false
        };

        // Initialize role coordination state
        this.roleCoordination = {
            roleRequested: false,
            roleConfirmed: false,
            remoteImpoliteDetected: false,
            coordinationTimeout: null
        };

        // Start with polite role by default, will be determined through coordination
        this.negotiationRole = {
            isPolite: true
        };

        debugLog(`[PerfectNegotiation] Initialized with business role: ${role}`);

        this.setupEventHandlers();

        // Role coordination will be started after signaling connection is established
    }

    /**
     * Set up all the Perfect Negotiation event handlers
     */
    private setupEventHandlers() {
        this.setupNegotiationNeededHandler();
        this.setupIceCandidateHandler();
        this.setupSignalingMessageHandler();
        this.setupConnectionStateHandler();
    }

    /**
     * Handle negotiation needed events with Perfect Negotiation pattern
     */
    private setupNegotiationNeededHandler() {
        this.pc.onnegotiationneeded = async () => {
            try {
                debugLog(`[PerfectNegotiation] Negotiation needed, isPolite: ${this.negotiationRole.isPolite}`);

                this.negotiationState.makingOffer = true;
                await this.pc.setLocalDescription();

                debugLog('[PerfectNegotiation] Created offer, sending via signaling');
                await this.signaling.sendMessage({
                    type: 'offer',
                    roomId: this.roomId,
                    content: this.pc.localDescription!
                });

                debugLog('[PerfectNegotiation] Offer sent successfully, waiting for answer...');

            } catch (err) {
                debugError('[PerfectNegotiation] Error during negotiation:', err);
                this.negotiationState.makingOffer = false; // Only reset on error
            }
            // Note: makingOffer stays true until we receive an answer or error
        };
    }

    /**
     * Handle ICE candidate events
     */
    private setupIceCandidateHandler() {
        this.pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                debugLog('[PerfectNegotiation] Sending ICE candidate');
                this.signaling.sendMessage({
                    type: 'ice-candidate',
                    roomId: this.roomId,
                    content: candidate
                }).catch(error => {
                    debugError('[PerfectNegotiation] Failed to send ICE candidate:', error);
                });
            }
        };
    }

    /**
     * Handle incoming signaling messages with Perfect Negotiation logic
     */
    private setupSignalingMessageHandler() {
        this.signaling.onMessage(async (message: SignalingMessage) => {
            // Skip messages from self
            if (message.sender === this.clientId) {
                return;
            }

            try {
                if (message.type === 'offer' || message.type === 'answer') {
                    await this.handleDescription(message);
                } else if (message.type === 'ice-candidate') {
                    await this.handleIceCandidate(message);
                } else if (message.type === 'role-claim' || message.type === 'role-release' || message.type === 'role-conflict') {
                    this.handleRoleCoordinationMessage(message);
                }
            } catch (err) {
                debugError('[PerfectNegotiation] Error handling signaling message:', err);
            }
        });
    }

    /**
     * Handle incoming description (offer/answer) with Perfect Negotiation collision detection
     */
    private async handleDescription(message: SignalingMessage) {
        const description = message.content as RTCSessionDescriptionInit;

        if (description.type === 'offer') {
            debugLog(`[PerfectNegotiation] Received offer, current state: makingOffer=${this.negotiationState.makingOffer}, signalingState=${this.pc.signalingState}`);

            // Perfect Negotiation collision detection logic
            const readyForOffer = !this.negotiationState.makingOffer &&
                (this.pc.signalingState === "stable" || this.negotiationState.isSettingRemoteAnswerPending);

            const offerCollision = !readyForOffer;

            this.negotiationState.ignoreOffer = !this.negotiationRole.isPolite && offerCollision;

            if (this.negotiationState.ignoreOffer) {
                debugLog('[PerfectNegotiation] IGNORING offer due to collision (impolite peer)');
                return;
            }

            debugLog('[PerfectNegotiation] ACCEPTING offer and creating answer');

            // If we were making an offer but we're polite, we need to rollback
            if (this.negotiationRole.isPolite && this.negotiationState.makingOffer) {
                debugLog('[PerfectNegotiation] Polite peer rolling back own offer to accept incoming offer');
                this.negotiationState.makingOffer = false;
            }

            // Handle the offer
            this.negotiationState.isSettingRemoteAnswerPending = false;
            await this.pc.setRemoteDescription(description);

            // Create and send answer
            await this.pc.setLocalDescription();
            await this.signaling.sendMessage({
                type: 'answer',
                roomId: this.roomId,
                content: this.pc.localDescription!
            });

            debugLog('[PerfectNegotiation] Processed offer and sent answer');

        } else if (description.type === 'answer') {
            debugLog('[PerfectNegotiation] Received answer');
            this.negotiationState.isSettingRemoteAnswerPending = true;
            await this.pc.setRemoteDescription(description);
            this.negotiationState.isSettingRemoteAnswerPending = false;

            // We received an answer, so we're no longer making an offer
            this.negotiationState.makingOffer = false;

            debugLog('[PerfectNegotiation] Processed answer, negotiation complete');
        }
    }

    /**
     * Handle incoming ICE candidates with Perfect Negotiation error handling
     */
    private async handleIceCandidate(message: SignalingMessage) {
        const candidate = message.content as RTCIceCandidateInit;

        try {
            await this.pc.addIceCandidate(candidate);
            debugLog('[PerfectNegotiation] Added ICE candidate');
        } catch (err) {
            if (!this.negotiationState.ignoreOffer) {
                throw err;
            }
            debugLog('[PerfectNegotiation] Ignored ICE candidate error due to offer collision');
        }
    }

    /**
     * Check if this peer is the first to arrive in the room
     * Used to determine initial negotiation role for true P2P
     */
    private isFirstToArrive(): boolean {
        try {
            // Get other valid participants (excluding ourselves)
            const allParticipants = this.signaling.getValidParticipants();
            const otherParticipants = allParticipants.filter(p => p.clientId !== this.clientId);
            const isFirst = otherParticipants.length === 0;

            debugLog(`[PerfectNegotiation] Arrival check for ${this.role} (${this.clientId}): ${isFirst ? 'FIRST' : 'SECOND'} to arrive`);
            debugLog(`[PerfectNegotiation] All participants: ${allParticipants.length}, Others: ${otherParticipants.length}`);
            debugLog(`[PerfectNegotiation] Other participant IDs: ${otherParticipants.map(p => p.clientId).join(', ')}`);

            return isFirst;
        } catch (error) {
            debugWarn('[PerfectNegotiation] Could not determine arrival order, falling back to role-based assignment');
            // Fallback to original role-based assignment if arrival detection fails
            return this.role !== Role.PATIENT;
        }
    }

    /**
     * Check if this peer is currently alone in the room
     * Used for intelligent role switching when peer disconnects
     */
    private isAloneInRoom(): boolean {
        try {
            const allParticipants = this.signaling.getValidParticipants();
            const otherParticipants = allParticipants.filter(p => p.clientId !== this.clientId);
            return otherParticipants.length === 0;
        } catch (error) {
            debugWarn('[PerfectNegotiation] Could not check room occupancy');
            return false;
        }
    }

    /**
     * Check if the remote peer appears to have disconnected
     * Based on connection state and room occupancy
     */
    private isPeerGone(): boolean {
        const isDisconnected = this.pc.connectionState === 'disconnected' ||
            this.pc.connectionState === 'failed' ||
            this.pc.iceConnectionState === 'disconnected' ||
            this.pc.iceConnectionState === 'failed';

        return isDisconnected && this.isAloneInRoom();
    }

    /**
     * Handle intelligent role switching when impolite peer disconnects
     * This ensures connection recovery in P2P scenarios
     */
    private handleRoleSwitch(): void {
        if (this.negotiationRole.isPolite && this.isPeerGone()) {
            debugLog('[PerfectNegotiation] Impolite peer disconnected, attempting to claim impolite role for recovery');
            
            // Reset coordination state and try to claim impolite role
            this.roleCoordination.remoteImpoliteDetected = false;
            this.roleCoordination.roleRequested = false;
            this.roleCoordination.roleConfirmed = false;
            
            // Claim the impolite role
            this.claimImpoliteRole();
        }
    }

    /**
     * Enhanced connection state handler with intelligent role switching
     */
    private setupConnectionStateHandler() {
        this.pc.onconnectionstatechange = () => {
            debugLog(`[PerfectNegotiation] Connection state: ${this.pc.connectionState}`);

            // Handle intelligent role switching when peer disconnects
            if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed') {
                this.handleRoleSwitch();
            }

            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(this.pc.connectionState);
            }
        };
    }

    /**
     * Register callback for connection state changes
     */
    public onConnectionStateChanged(callback: (state: RTCPeerConnectionState) => void) {
        this.onConnectionStateChange = callback;
    }

    /**
     * Get current negotiation state (for debugging)
     */
    public getNegotiationState(): NegotiationState & NegotiationRole {
        return {
            ...this.negotiationState,
            ...this.negotiationRole
        };
    }

    /**
     * Reset negotiation state (useful for connection resets)
     */
    public resetNegotiationState() {
        this.negotiationState = {
            makingOffer: false,
            ignoreOffer: false,
            isSettingRemoteAnswerPending: false
        };
        // Reset trigger flag to allow reconnection attempts
        this.hasTriggeredInitialConnection = false;
        debugLog('[PerfectNegotiation] Negotiation state reset, can trigger connection again');
    }

    /**
     * Attempt automatic reconnection with Perfect Negotiation and intelligent role switching
     * This method can be called when connection fails to trigger a new negotiation
     */
    public async attemptReconnection(): Promise<void> {
        debugLog('[PerfectNegotiation] Attempting automatic reconnection...');

        // Only attempt reconnection if we're in a stable state
        if (this.pc.signalingState !== 'stable' && this.pc.signalingState !== 'closed') {
            debugWarn('[PerfectNegotiation] Cannot attempt reconnection in current signaling state:', this.pc.signalingState);
            return;
        }

        // Handle intelligent role switching before attempting reconnection
        this.handleRoleSwitch();

        // Reset negotiation state for clean reconnection
        this.resetNegotiationState();

        // Only impolite peer initiates reconnection
        if (!this.negotiationRole.isPolite) {
            debugLog('[PerfectNegotiation] Impolite peer initiating reconnection offer...');
            try {
                this.negotiationState.makingOffer = true;
                await this.pc.setLocalDescription();
                debugLog('[PerfectNegotiation] Reconnection offer created, sending via signaling');
                await this.signaling.sendMessage({
                    type: 'offer',
                    roomId: this.roomId,
                    content: this.pc.localDescription!
                });
            } catch (err) {
                debugError('[PerfectNegotiation] Error during reconnection attempt:', err);
            } finally {
                this.negotiationState.makingOffer = false;
            }
        } else {
            debugLog('[PerfectNegotiation] Polite peer waiting for reconnection offer from remote...');
        }
    }

    /**
     * Check if Perfect Negotiation is currently attempting reconnection
     */
    public isAttemptingReconnection(): boolean {
        return this.negotiationState.makingOffer;
    }

    /**
     * Get current negotiation state for debugging
     */
    public getDetailedNegotiationState() {
        return {
            ...this.negotiationState,
            connectionState: this.pc.connectionState,
            iceConnectionState: this.pc.iceConnectionState,
            signalingState: this.pc.signalingState,
            role: this.negotiationRole.isPolite ? 'polite' : 'impolite',
            businessRole: this.role,
            participantsInRoom: this.signaling.getValidParticipants().length,
            isAlone: this.isAloneInRoom()
        };
    }

    /**
     * Force a role switch (for testing or emergency recovery)
     * Use with caution - this bypasses the automatic role detection
     */
    public forceRoleSwitch(newRole: 'polite' | 'impolite'): void {
        debugLog(`[PerfectNegotiation] Forcing role switch from ${this.negotiationRole.isPolite ? 'polite' : 'impolite'} to ${newRole}`);
        this.negotiationRole.isPolite = newRole === 'polite';
    }

    /**
     * Get current role assignment information
     */
    public getRoleInfo() {
        const participants = this.signaling.getValidParticipants();
        return {
            isPolite: this.negotiationRole.isPolite,
            businessRole: this.role,
            roleRequested: this.roleCoordination.roleRequested,
            roleConfirmed: this.roleCoordination.roleConfirmed,
            remoteImpoliteDetected: this.roleCoordination.remoteImpoliteDetected,
            participantsCount: participants.length,
            isAloneInRoom: this.isAloneInRoom(),
            canInitiate: !this.negotiationRole.isPolite && this.roleCoordination.roleConfirmed,
            hasTriggered: this.hasTriggeredInitialConnection
        };
    }

    /**
     * Method called when room becomes ready (both participants present)
     * This allows Perfect Negotiation to trigger connection when needed
     */
    public onRoomReady(): void {
        debugLog('[PerfectNegotiation] Room became ready, checking if we should trigger connection');

        // CRITICAL: Only trigger if we're impolite AND haven't already triggered
        if (this.negotiationRole.isPolite) {
            debugLog('[PerfectNegotiation] Polite peer - waiting for impolite peer to initiate');
            return;
        }

        if (this.hasTriggeredInitialConnection) {
            debugLog('[PerfectNegotiation] ⚠️ Already triggered connection, skipping to prevent double triggering');
            return;
        }

        debugLog('[PerfectNegotiation] ✅ Impolite peer triggering connection from onRoomReady()');
        this.checkInitialConnectionTrigger();
    }

    /**
     * Check if initial connection should be triggered for impolite peer
     * Called during initialization to start connection if conditions are met
     */
    private checkInitialConnectionTrigger(): void {
        // CRITICAL: Only impolite peer should trigger initial connection
        if (this.negotiationRole.isPolite) {
            debugLog('[PerfectNegotiation] Polite peer NEVER triggers connection - waiting for impolite peer');
            return;
        }

        // Prevent double triggering
        if (this.hasTriggeredInitialConnection) {
            debugLog('[PerfectNegotiation] ⚠️ Connection already triggered, preventing duplicate');
            return;
        }

        // Check if both peers are present and ready
        try {
            const allParticipants = this.signaling.getValidParticipants();
            const bothPresent = allParticipants.length >= 2;

            debugLog(`[PerfectNegotiation] Impolite peer checking trigger conditions: bothPresent=${bothPresent}, participants=${allParticipants.length}`);

            if (bothPresent && this.peerConnection?.triggerDataChannelCreation) {
                // Mark as triggered BEFORE triggering to prevent race conditions
                this.hasTriggeredInitialConnection = true;

                debugLog('[PerfectNegotiation] ✅ IMPOLITE PEER TRIGGERING DataChannel creation (SHOULD ONLY HAPPEN ONCE PER ROOM!)');
                // Small delay to ensure everything is properly set up
                setTimeout(() => {
                    if (this.pc.connectionState !== 'closed' && this.pc.signalingState !== 'closed') {
                        this.peerConnection.triggerDataChannelCreation();
                    }
                }, 100);
            } else {
                debugLog('[PerfectNegotiation] Not ready for initial connection trigger yet or missing peerConnection reference');
            }
        } catch (error) {
            debugWarn('[PerfectNegotiation] Could not check initial connection conditions:', error);
        }
    }

    /**
     * Clean up and destroy Perfect Negotiation instance
     * Should be called before discarding the instance to prevent memory leaks
     */
    public destroy() {
        debugLog('[PerfectNegotiation] Destroying instance and cleaning up...');

        // If we're impolite, send role-release message to inform other peers
        if (!this.negotiationRole.isPolite && this.roleCoordination.roleConfirmed) {
            const coordinationContent: RoleCoordinationContent = {
                requestedRole: 'polite',
                clientId: this.clientId,
                timestamp: Date.now()
            };

            this.signaling.sendMessage({
                type: 'role-release',
                roomId: this.roomId,
                content: coordinationContent
            }).catch(error => {
                debugError('[PerfectNegotiation] Failed to send role-release:', error);
            });
        }

        // Clear coordination timeout
        if (this.roleCoordination.coordinationTimeout) {
            clearTimeout(this.roleCoordination.coordinationTimeout);
            this.roleCoordination.coordinationTimeout = null;
        }

        // Clear all event handlers
        this.pc.onnegotiationneeded = null;
        this.pc.onicecandidate = null;
        this.pc.onconnectionstatechange = null;

        // Reset negotiation state
        this.resetNegotiationState();

        // Clear callback
        this.onConnectionStateChange = undefined;

        debugLog('[PerfectNegotiation] Cleanup complete');
    }

    /**
     * Initialize role coordination after signaling service is connected
     * This must be called after the signaling service connection is established
     */
    public initializeRoleCoordination(): void {
        debugLog('[PerfectNegotiation] Starting role coordination after signaling connection established');
        this.startRoleCoordination();
    }

    /**
     * Initiate role coordination process to determine who becomes impolite
     */
    private startRoleCoordination() {
        // If we're first to arrive, claim impolite role
        if (this.isFirstToArrive()) {
            debugLog('[PerfectNegotiation] First to arrive - claiming impolite role');
            this.claimImpoliteRole();
        } else {
            debugLog('[PerfectNegotiation] Not first to arrive - staying polite for now');
            // Set timeout to claim impolite role if no one else does
            this.roleCoordination.coordinationTimeout = setTimeout(() => {
                if (!this.roleCoordination.remoteImpoliteDetected) {
                    debugLog('[PerfectNegotiation] No impolite peer detected after timeout - claiming role');
                    this.claimImpoliteRole();
                }
            }, 1000); // 1 second timeout
        }
    }

    /**
     * Claim the impolite role by sending a role-claim message
     */
    private claimImpoliteRole() {
        if (this.roleCoordination.roleRequested) {
            debugLog('[PerfectNegotiation] Already requested impolite role');
            return;
        }

        this.roleCoordination.roleRequested = true;
        
        const coordinationContent: RoleCoordinationContent = {
            requestedRole: 'impolite',
            clientId: this.clientId,
            timestamp: Date.now()
        };

        debugLog('[PerfectNegotiation] Sending role-claim message');
        this.signaling.sendMessage({
            type: 'role-claim',
            roomId: this.roomId,
            content: coordinationContent
        }).catch(error => {
            debugError('[PerfectNegotiation] Failed to send role-claim:', error);
        });

        // Set timeout for role confirmation
        this.roleCoordination.coordinationTimeout = setTimeout(() => {
            if (!this.roleCoordination.roleConfirmed) {
                // No conflicts detected, confirm our role
                this.confirmImpoliteRole();
            }
        }, 500); // 500ms timeout for conflicts
    }

    /**
     * Confirm impolite role and start connection process
     */
    private confirmImpoliteRole() {
        this.negotiationRole.isPolite = false;
        this.roleCoordination.roleConfirmed = true;
        
        debugLog('[PerfectNegotiation] ✅ Confirmed as IMPOLITE peer');
        
        // Clear timeout
        if (this.roleCoordination.coordinationTimeout) {
            clearTimeout(this.roleCoordination.coordinationTimeout);
            this.roleCoordination.coordinationTimeout = null;
        }

        // Check if we should trigger initial connection
        this.checkInitialConnectionTrigger();
    }

    /**
     * Handle role coordination conflicts using clientId comparison
     */
    private handleRoleConflict(remoteClientId: string) {
        debugLog(`[PerfectNegotiation] Role conflict detected with ${remoteClientId}`);
        
        // Use deterministic comparison: lower clientId wins impolite role
        if (this.clientId < remoteClientId) {
            debugLog('[PerfectNegotiation] ✅ Won conflict - keeping impolite role');
            this.confirmImpoliteRole();
        } else {
            debugLog('[PerfectNegotiation] ❌ Lost conflict - becoming polite');
            this.becomePolite();
            
            // Send role-conflict message to inform the other peer
            const coordinationContent: RoleCoordinationContent = {
                requestedRole: 'polite',
                clientId: this.clientId,
                timestamp: Date.now()
            };

            this.signaling.sendMessage({
                type: 'role-conflict',
                roomId: this.roomId,
                content: coordinationContent
            });
        }
    }

    /**
     * Become polite peer
     */
    private becomePolite() {
        this.negotiationRole.isPolite = true;
        this.roleCoordination.roleConfirmed = true;
        this.roleCoordination.remoteImpoliteDetected = true;
        
        debugLog('[PerfectNegotiation] ✅ Confirmed as POLITE peer');
        
        // Clear timeout
        if (this.roleCoordination.coordinationTimeout) {
            clearTimeout(this.roleCoordination.coordinationTimeout);
            this.roleCoordination.coordinationTimeout = null;
        }
    }

    /**
     * Handle incoming role coordination messages
     */
    private handleRoleCoordinationMessage(message: SignalingMessage) {
        const content = message.content as RoleCoordinationContent;
        
        if (message.type === 'role-claim') {
            debugLog(`[PerfectNegotiation] Received role-claim from ${content.clientId}`);
            
            this.roleCoordination.remoteImpoliteDetected = true;
            
            if (this.roleCoordination.roleRequested && !this.roleCoordination.roleConfirmed) {
                // We both want impolite role - resolve conflict
                this.handleRoleConflict(content.clientId);
            } else if (!this.roleCoordination.roleRequested) {
                // We hadn't claimed yet - let them have it
                this.becomePolite();
            }
            
        } else if (message.type === 'role-release') {
            debugLog(`[PerfectNegotiation] Received role-release from ${content.clientId}`);
            
            this.roleCoordination.remoteImpoliteDetected = false;
            
            // If we're polite and the impolite peer disconnected, we can claim the role
            if (this.negotiationRole.isPolite && !this.roleCoordination.roleRequested) {
                debugLog('[PerfectNegotiation] Impolite peer disconnected - claiming role');
                this.claimImpoliteRole();
            }
            
        } else if (message.type === 'role-conflict') {
            debugLog(`[PerfectNegotiation] Received role-conflict from ${content.clientId}`);
            
            // The other peer is acknowledging they lost the conflict
            if (!this.roleCoordination.roleConfirmed) {
                this.confirmImpoliteRole();
            }
        }
    }
}
