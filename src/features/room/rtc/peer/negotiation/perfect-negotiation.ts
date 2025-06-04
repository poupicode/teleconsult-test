/**
 * Perfect Negotiation Implementation
 * 
 * This implements the WebRTC Perfect Negotiation pattern as described in:
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
 * 
 * Perfect negotiation eliminates the complexity of managing offer/answer collisions
 * by assigning asymmetric roles to peers that are independent of business logic.
 */

import { SignalingService, SignalingMessage } from '../../signaling';
import { Role, NegotiationRole, NegotiationState } from '../models/types';

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

        // Determine negotiation role based on arrival order for true P2P
        // The first to arrive becomes impolite (initiator)
        // The second to arrive becomes polite (waiter)
        // This creates a truly peer-to-peer system where either side can initiate
        this.negotiationRole = {
            isPolite: !this.isFirstToArrive()
        };

        debugLog(`[PerfectNegotiation] Initialized with role: ${role}, isPolite: ${this.negotiationRole.isPolite}`);

        this.setupEventHandlers();

        // If we're the impolite peer and room is ready, trigger DataChannel creation
        this.checkInitialConnectionTrigger();
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

        debugLog(`[PerfectNegotiation] Handling ${description.type}, current signaling state: ${this.pc.signalingState}`);

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

            try {
                // Handle the offer
                this.negotiationState.isSettingRemoteAnswerPending = false;
                await this.pc.setRemoteDescription(description);
                debugLog('[PerfectNegotiation] Remote description set successfully');

                // Create and send answer
                await this.pc.setLocalDescription();
                debugLog('[PerfectNegotiation] Local description (answer) created');

                await this.signaling.sendMessage({
                    type: 'answer',
                    roomId: this.roomId,
                    content: this.pc.localDescription!
                });

                debugLog('[PerfectNegotiation] Answer sent successfully');
            } catch (err) {
                debugError('[PerfectNegotiation] Error processing offer:', err);
                throw err;
            }

        } else if (description.type === 'answer') {
            debugLog('[PerfectNegotiation] Received answer');
            try {
                this.negotiationState.isSettingRemoteAnswerPending = true;
                await this.pc.setRemoteDescription(description);
                this.negotiationState.isSettingRemoteAnswerPending = false;

                // We received an answer, so we're no longer making an offer
                this.negotiationState.makingOffer = false;

                debugLog('[PerfectNegotiation] Processed answer, negotiation complete');
            } catch (err) {
                debugError('[PerfectNegotiation] Error processing answer:', err);
                this.negotiationState.isSettingRemoteAnswerPending = false;
                this.negotiationState.makingOffer = false;
                throw err;
            }
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
     * Enhanced to handle temporary disconnections during rapid reconnection scenarios
     */
    private isPeerGone(): boolean {
        const isConnectionDead = this.pc.connectionState === 'disconnected' ||
            this.pc.connectionState === 'failed' ||
            this.pc.iceConnectionState === 'disconnected' ||
            this.pc.iceConnectionState === 'failed';

        // For role switching during rapid reconnection scenarios:
        // If connection is dead but peer is still in signaling (rapid return),
        // allow role switch to handle degraded connection states
        const isAloneOrDegradedConnection = this.isAloneInRoom() || 
            (isConnectionDead && this.shouldHandleDegradedConnection());

        return isConnectionDead && isAloneOrDegradedConnection;
    }

    /**
     * Determine if we should handle a degraded connection during rapid reconnection
     * This helps distinguish between true disconnect and temporary connection issues
     */
    private shouldHandleDegradedConnection(): boolean {
        // If both participants are present but connection is dead, 
        // this suggests a rapid reconnection scenario where we need to handle degraded state
        const allParticipants = this.signaling.getValidParticipants();
        const otherParticipants = allParticipants.filter(p => p.clientId !== this.clientId);
        
        const bothParticipantsPresent = otherParticipants.length > 0;
        const connectionIsDead = this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed';
        
        debugLog(`[PerfectNegotiation] Degraded connection check: bothPresent=${bothParticipantsPresent}, connectionDead=${connectionIsDead}`);
        
        return bothParticipantsPresent && connectionIsDead;
    }

    /**
     * Handle intelligent role switching when impolite peer disconnects
     * This ensures connection recovery in P2P scenarios
     */
    private handleRoleSwitch(): void {
        if (this.negotiationRole.isPolite && this.isPeerGone()) {
            debugLog('[PerfectNegotiation] Impolite peer disconnected, switching to impolite role for recovery');
            this.negotiationRole.isPolite = false;
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

        // Check if connection might be recoverable before forcing reconnection
        if (this.isConnectionRecoverable()) {
            debugLog('[PerfectNegotiation] Connection might be recoverable, allowing natural recovery first...');
            
            // Give connection time to recover naturally before forcing negotiation
            setTimeout(() => {
                if (!this.isConnectionRecoverable()) {
                    debugLog('[PerfectNegotiation] Natural recovery failed, proceeding with forced reconnection');
                    this.performForcedReconnection();
                } else {
                    debugLog('[PerfectNegotiation] ✅ Connection recovered naturally!');
                }
            }, 2000); // 2s delay for natural recovery
            
            return;
        }

        // Connection is definitely broken, proceed with immediate reconnection
        this.performForcedReconnection();
    }

    /**
     * Check if the current connection might be recoverable
     */
    private isConnectionRecoverable(): boolean {
        const connectionState = this.pc.connectionState;
        const iceState = this.pc.iceConnectionState;
        const signalingState = this.pc.signalingState;
        
        // Very tolerant criteria - only reject if definitely broken
        const isDefinitelyBroken = 
            connectionState === 'failed' || connectionState === 'closed' ||
            iceState === 'failed' || iceState === 'closed' ||
            signalingState === 'closed';
            
        return !isDefinitelyBroken;
    }

    /**
     * Perform forced reconnection when natural recovery is not possible
     */
    private async performForcedReconnection(): Promise<void> {
        debugLog('[PerfectNegotiation] Performing forced reconnection...');

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
            arrivalOrder: this.negotiationRole.isPolite ? 'second' : 'first', // Role is permanent, don't re-check
            participantsCount: participants.length,
            isAloneInRoom: this.isAloneInRoom(),
            canInitiate: !this.negotiationRole.isPolite,
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
                debugLog(`[PerfectNegotiation] Participants: ${allParticipants.map(p => `${p.role}:${p.clientId}`).join(', ')}`);

                // Small delay to ensure everything is properly set up
                setTimeout(() => {
                    if (this.pc.connectionState !== 'closed' && this.pc.signalingState !== 'closed') {
                        debugLog('[PerfectNegotiation] Executing DataChannel creation...');
                        this.peerConnection.triggerDataChannelCreation();
                    } else {
                        debugWarn('[PerfectNegotiation] Peer connection closed before DataChannel creation could execute');
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
}
