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
    private roleLockedUntil: number = 0; // Timestamp until when role switching is locked

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
     * Handle intelligent role switching when peer disconnects
     * Enhanced logic to prevent unnecessary role switches
     */
    private handleRoleSwitch(): void {
        // Only switch roles if we're alone in the room
        // This prevents role switches during temporary disconnections
        if (!this.isAloneInRoom()) {
            debugLog('[PerfectNegotiation] Other participants still present, no role switch needed');
            return;
        }

        // If we're alone and we were polite, become impolite to handle reconnections
        if (this.negotiationRole.isPolite) {
            debugLog('[PerfectNegotiation] 🔄 Alone in room as polite peer, switching to impolite for reconnection handling');
            this.performRoleSwitch('impolite');
        } else {
            debugLog('[PerfectNegotiation] Already impolite and alone in room, staying impolite');
        }
    }

    /**
     * 🔄 CRITICAL: Complete role switch with proper state management
     * Handles the scenario where peer roles need to change dynamically
     * Enhanced with role switch validation
     */
    private performRoleSwitch(newRole: 'polite' | 'impolite'): void {
        const oldRole = this.negotiationRole.isPolite ? 'polite' : 'impolite';

        if (oldRole === newRole) {
            debugLog(`[PerfectNegotiation] Already ${newRole}, no switch needed`);
            return;
        }

        // Validate that role switch is actually necessary
        if (!this.shouldAllowRoleSwitch(newRole)) {
            debugLog(`[PerfectNegotiation] Role switch to ${newRole} blocked by validation`);
            return;
        }

        debugLog(`[PerfectNegotiation] 🔄 ROLE SWITCH: ${oldRole} → ${newRole}`);

        // 1. Update role
        this.negotiationRole.isPolite = newRole === 'polite';

        // 2. Reset negotiation state for clean slate
        this.resetNegotiationState();

        // 3. If switching to impolite, prepare to initiate connection
        if (newRole === 'impolite') {
            debugLog('[PerfectNegotiation] 🚀 New impolite peer - will initiate connection');

            // Small delay to let things settle, then trigger connection
            setTimeout(() => {
                this.checkInitialConnectionTrigger();
            }, 500);
        }
    }

    /**
     * Validate if a role switch should be allowed
     * Prevents unnecessary role switches during rapid reconnections
     */
    private shouldAllowRoleSwitch(newRole: 'polite' | 'impolite'): boolean {
        // Check if role switching is locked
        if (this.isRoleLocked()) {
            debugLog('[PerfectNegotiation] Role switch blocked - role is locked');
            return false;
        }

        const participants = this.signaling.getValidParticipants();
        const otherParticipants = participants.filter(p => p.clientId !== this.clientId);
        
        // Only allow role switches if we're alone or if there's a genuine conflict
        const isAlone = otherParticipants.length === 0;
        const hasConflict = this.hasRoleConflict();
        
        debugLog(`[PerfectNegotiation] Role switch validation: isAlone=${isAlone}, hasConflict=${hasConflict}, targetRole=${newRole}`);
        
        return isAlone || hasConflict;
    }

    /**
     * Check if there's a genuine role conflict that needs resolution
     */
    private hasRoleConflict(): boolean {
        const participants = this.signaling.getValidParticipants();
        const otherParticipants = participants.filter(p => p.clientId !== this.clientId);
        
        if (otherParticipants.length === 0) {
            return false; // No conflict if alone
        }

        // Check if our current role matches what it should be based on deterministic rules
        const allIds = [this.clientId, ...otherParticipants.map(p => p.clientId)].sort();
        const myPosition = allIds.indexOf(this.clientId);
        const shouldBeImpolite = myPosition === 0;
        const currentlyImpolite = !this.negotiationRole.isPolite;
        
        return shouldBeImpolite !== currentlyImpolite;
    }

    /**
     * 🆘 Handle critical scenario: peer returns quickly creating role conflict
     * This resolves the case where both peers might become impolite
     * Enhanced with better role stability logic
     */
    private resolveRoleConflict(): void {
        try {
            const participants = this.signaling.getValidParticipants();
            const otherParticipants = participants.filter(p => p.clientId !== this.clientId);

            if (otherParticipants.length === 0) {
                debugLog('[PerfectNegotiation] No other participants, staying as current role');
                return;
            }

            // Enhanced deterministic conflict resolution
            // Use a combination of clientId and original role for more stability
            const myId = this.clientId;
            const otherIds = otherParticipants.map(p => p.clientId);
            
            // Use lexicographic comparison for deterministic ordering
            const allIds = [myId, ...otherIds].sort();
            const myPosition = allIds.indexOf(myId);
            
            // First in alphabetical order becomes impolite (initiator)
            const shouldBeImpolite = myPosition === 0;
            const currentRole = this.negotiationRole.isPolite ? 'polite' : 'impolite';
            const targetRole = shouldBeImpolite ? 'impolite' : 'polite';

            debugLog(`[PerfectNegotiation] Conflict resolution: myId=${myId}, allIds=[${allIds.join(', ')}], myPosition=${myPosition}`);
            debugLog(`[PerfectNegotiation] Current role: ${currentRole}, target role: ${targetRole}`);

            if (currentRole !== targetRole) {
                debugLog(`[PerfectNegotiation] 🆘 CONFLICT RESOLUTION: Switching to ${targetRole} (lexicographic ordering)`);
                this.performRoleSwitch(targetRole);
            } else {
                debugLog(`[PerfectNegotiation] ✅ Role conflict check passed - staying ${currentRole}`);
            }
        } catch (error) {
            debugWarn('[PerfectNegotiation] Could not resolve role conflict:', error);
        }
    }

    /**
     * Enhanced connection state handler with intelligent role switching and conflict resolution
     */
    private setupConnectionStateHandler() {
        this.pc.onconnectionstatechange = () => {
            debugLog(`[PerfectNegotiation] Connection state: ${this.pc.connectionState}`);

            // Handle intelligent role switching when peer disconnects
            if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed') {
                this.handleRoleSwitch();
            }

            // 🆘 CRITICAL: When connection becomes connected, check for role conflicts
            // This handles the case where peer returns quickly after disconnect
            if (this.pc.connectionState === 'connected') {
                debugLog('[PerfectNegotiation] ✅ Connection established - checking for role conflicts');
                setTimeout(() => {
                    this.resolveRoleConflict();
                }, 1000); // Allow signaling to update participant list
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
        debugLog(`[PerfectNegotiation] 🔧 Force role switch requested: ${newRole}`);
        this.performRoleSwitch(newRole);
    }

    /**
     * Get current role assignment information
     */
    public getRoleInfo() {
        const participants = this.signaling.getValidParticipants();
        return {
            isPolite: this.negotiationRole.isPolite,
            businessRole: this.role,
            arrivalOrder: this.negotiationRole.isPolite ? 'second' : 'first', // 🔄 Can change with role switches
            participantsCount: participants.length,
            isAloneInRoom: this.isAloneInRoom(),
            canInitiate: !this.negotiationRole.isPolite,
            hasTriggered: this.hasTriggeredInitialConnection,
            clientId: this.clientId, // 🆘 Add for conflict resolution debugging
            otherParticipants: participants.filter(p => p.clientId !== this.clientId).map(p => p.clientId)
        };
    }

    /**
     * 🆘 Manually trigger role conflict resolution
     * Useful when you suspect both peers have become impolite
     */
    public triggerRoleConflictResolution(): void {
        debugLog('[PerfectNegotiation] 🆘 Manual role conflict resolution triggered');
        this.resolveRoleConflict();
    }

    /**
     * 🔒 Lock current role to prevent automatic switches
     * Use this to stabilize roles during testing or specific scenarios
     */
    public lockCurrentRole(): void {
        debugLog(`[PerfectNegotiation] 🔒 Locking current role: ${this.negotiationRole.isPolite ? 'polite' : 'impolite'}`);
        this.roleLockedUntil = Date.now() + 30000; // Lock for 30 seconds
    }

    /**
     * 🔓 Unlock role switching
     */
    public unlockRole(): void {
        debugLog('[PerfectNegotiation] 🔓 Unlocking role switching');
        this.roleLockedUntil = 0;
    }

    /**
     * 🩺 Diagnose role switching issues
     * Call this method to understand why roles are switching unexpectedly
     */
    public diagnoseRoleSwitching(): void {
        const state = this.getDebugRoleState();
        console.log('[PerfectNegotiation] 🩺 ROLE SWITCHING DIAGNOSIS:');
        console.log(`  My ID: ${state.myClientId}`);
        console.log(`  Current role: ${state.myRole}`);
        console.log(`  Should be impolite: ${state.shouldBeImpolite}`);
        console.log(`  Has conflict: ${state.hasConflict}`);
        console.log(`  Is alone: ${state.isAlone}`);
        console.log(`  Role locked: ${this.isRoleLocked()}`);
        console.log(`  All participants:`, state.allParticipants);
        console.log(`  Sorted IDs:`, state.sortedIds);
        console.log(`  Connection state: ${state.connectionState}`);
    }

    /**
     * Check if role switching is currently locked
     */
    private isRoleLocked(): boolean {
        return this.roleLockedUntil > Date.now();
    }

    /**
     * Get detailed state for debugging role issues
     */
    public getDebugRoleState() {
        const participants = this.signaling.getValidParticipants();
        const others = participants.filter(p => p.clientId !== this.clientId);
        const allIds = [this.clientId, ...others.map(p => p.clientId)].sort();
        const myPosition = allIds.indexOf(this.clientId);

        return {
            myClientId: this.clientId,
            myRole: this.negotiationRole.isPolite ? 'polite' : 'impolite',
            myBusinessRole: this.role,
            myPosition: myPosition,
            allParticipants: participants.map(p => ({
                clientId: p.clientId,
                role: p.role,
                // Position in deterministic ordering
                position: allIds.indexOf(p.clientId)
            })),
            sortedIds: allIds,
            shouldBeImpolite: myPosition === 0,
            currentlyImpolite: !this.negotiationRole.isPolite,
            hasConflict: this.hasRoleConflict(),
            connectionState: this.pc.connectionState,
            iceConnectionState: this.pc.iceConnectionState,
            hasTriggered: this.hasTriggeredInitialConnection,
            negotiationState: this.negotiationState,
            isAlone: this.isAloneInRoom()
        };
    }

    /**
     * Method called when room becomes ready (both participants present)
     * This allows Perfect Negotiation to trigger connection when needed
     */
    public onRoomReady(): void {
        debugLog('[PerfectNegotiation] Room became ready, checking if we should trigger connection');

        // 🆘 CRITICAL: Check for role conflicts when room becomes ready
        // This handles rapid reconnection scenarios
        this.resolveRoleConflict();

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
