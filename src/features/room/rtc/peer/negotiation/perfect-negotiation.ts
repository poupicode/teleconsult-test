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
import { logger, LogCategory } from '../../logger';

// Fonctions de logs simplifiées pour la migration
const debugLog = (message: string, ...args: any[]) => logger.debug(LogCategory.NEGOTIATION, message, ...args);
const debugWarn = (message: string, ...args: any[]) => logger.warn(LogCategory.NEGOTIATION, message, ...args);
const debugError = (message: string, ...args: any[]) => logger.error(LogCategory.NEGOTIATION, message, ...args);

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
    private presenceChangeDebounceTimer: NodeJS.Timeout | null = null; // Debounce timer for presence changes

    // Metrics for monitoring (can be exposed for debugging/analytics)
    private roleSwitchCount: number = 0;
    private lastRoleSwitchTime: number = 0;
    private connectionAttempts: number = 0;

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

        // 🚨 SIMPLIFIED: Start with polite role, will be calculated later when both participants are present
        this.negotiationRole = {
            isPolite: true // Default to polite, will be determined when room is ready
        };

        console.log(`🔧 [PerfectNegotiation] INITIALIZED: clientId=${clientId}, waiting for role calculation when room is ready`);
        debugLog(`[PerfectNegotiation] Initialized with business role: ${role}, negotiation role will be determined later`);

        this.setupEventHandlers();
        this.setupPresenceListener();

        // ❌ REMOVED: Don't check initial connection here, wait for room to be ready

        logger.success(LogCategory.NEGOTIATION, `Perfect Negotiation initialized - Role will be determined when both participants are present`);
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
                console.log(`🔥 [PerfectNegotiation] NEGOTIATION NEEDED triggered!`);
                console.log(`🔥 [PerfectNegotiation] Current role: ${this.negotiationRole.isPolite ? 'polite' : 'impolite'}`);
                console.log(`🔥 [PerfectNegotiation] makingOffer: ${this.negotiationState.makingOffer}`);

                debugLog(`[PerfectNegotiation] Negotiation needed, isPolite: ${this.negotiationRole.isPolite}`);

                // Check if both peers are present before proceeding with negotiation
                const allParticipants = this.signaling.getValidParticipants();
                const bothPresent = allParticipants.length >= 2;

                console.log(`🔥 [PerfectNegotiation] Both present: ${bothPresent}, participants: ${allParticipants.length}`);

                if (!bothPresent) {
                    console.log('🔥 [PerfectNegotiation] Skipping negotiation - not enough participants yet');
                    debugLog('[PerfectNegotiation] Skipping negotiation - not enough participants yet');
                    return; // Skip negotiation if not enough participants
                }

                // 🚨 CRITICAL FIX: Only impolite peer should create offers
                if (this.negotiationRole.isPolite) {
                    console.log('🔥 [PerfectNegotiation] I am polite peer - NOT creating offers, waiting for remote');
                    debugLog('[PerfectNegotiation] Polite peer does not create offers - waiting for remote');
                    return;
                }

                console.log('🔥 [PerfectNegotiation] I am impolite peer - CREATING OFFER NOW!');
                debugLog('[PerfectNegotiation] Impolite peer creating offer...');
                this.negotiationState.makingOffer = true;
                await this.pc.setLocalDescription();

                console.log('🔥 [PerfectNegotiation] Offer created, sending via signaling...');
                debugLog('[PerfectNegotiation] Created offer, sending via signaling');
                await this.signaling.sendMessage({
                    type: 'offer',
                    roomId: this.roomId,
                    content: this.pc.localDescription!
                });

                debugLog('[PerfectNegotiation] Offer sent successfully, waiting for answer...');

            } catch (err) {
                debugError('[PerfectNegotiation] Error during negotiation:', err);
                this.negotiationState.makingOffer = false; // Always reset on error
            }
            // Note: makingOffer stays true until we receive an answer or error

            // Timeout protection: reset makingOffer if no answer received after 10s
            setTimeout(() => {
                if (this.negotiationState.makingOffer) {
                    console.warn('🚨 [PerfectNegotiation] Timeout: No answer received after 10s, resetting makingOffer');
                    this.negotiationState.makingOffer = false;
                }
            }, 10000);
        };
    }

    /**
     * Handle ICE candidate events
     */
    private setupIceCandidateHandler() {
        // Track ICE candidate counts to reduce logging noise
        let iceCandidateCount = 0;
        const MAX_DETAILED_CANDIDATES = 2;

        this.pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                // Check if both peers are present before sending candidates
                const allParticipants = this.signaling.getValidParticipants();
                const bothPresent = allParticipants.length >= 2;

                if (!bothPresent) {
                    // Don't send candidates if no other participant is present
                    return;
                }

                // Reduce logging noise
                if (iceCandidateCount < MAX_DETAILED_CANDIDATES) {
                    debugLog('[PerfectNegotiation] Sending ICE candidate');
                } else if (iceCandidateCount === MAX_DETAILED_CANDIDATES) {
                    debugLog(`[PerfectNegotiation] Sending additional ICE candidates (limiting logs)`);
                }

                iceCandidateCount++;

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
            debugLog('[PerfectNegotiation] ✅ Added ICE candidate successfully');
        } catch (err) {
            if (!this.negotiationState.ignoreOffer) {
                debugError('[PerfectNegotiation] ❌ ICE candidate error:', err);
                throw err;
            }
            debugLog('[PerfectNegotiation] 🔇 Ignored ICE candidate error due to offer collision');
        }
    }



    /**
     * ❌ DEPRECATED: Remove this method entirely as it conflicts with calculateInitialRole()
     * All role calculation should use calculateInitialRole() only
     */
    private determineRoleFromClientId(): 'polite' | 'impolite' {
        console.log('[PerfectNegotiation] ⚠️ determineRoleFromClientId() is deprecated - use calculateInitialRole() instead');
        // Fallback to polite for safety, but this method should not be called
        return 'polite';
    }

    /**
     * Set up presence listener - improved with role recalculation
     */
    private setupPresenceListener(): void {
        this.signaling.onPresenceChange(() => {
            const hasPatientAndPractitioner = this.signaling.hasPatientAndPractitioner();

            console.log(`[PerfectNegotiation] 👥 Presence changed, hasPatientAndPractitioner: ${hasPatientAndPractitioner}`);

            if (!hasPatientAndPractitioner) {
                // Participant disconnected - reset trigger flag for reconnection
                console.log('[PerfectNegotiation] 👋 Participant disconnected, resetting trigger flag');
                this.hasTriggeredInitialConnection = false;
            } else {
                // Both participants are back - recalculate roles and potentially trigger connection
                console.log('[PerfectNegotiation] 👥 Both participants present - recalculating roles');
                this.calculateInitialRole();

                // If we're impolite and haven't triggered connection yet, do it now
                if (!this.negotiationRole.isPolite && !this.hasTriggeredInitialConnection) {
                    console.log('[PerfectNegotiation] 🚀 Triggering connection after presence recovery');
                    if (this.peerConnection?.triggerDataChannelCreation) {
                        this.peerConnection.triggerDataChannelCreation();
                        this.hasTriggeredInitialConnection = true;
                    }
                }
            }
        });
    }

    /**
     * ❌ DEPRECATED: Roles are now calculated once in calculateInitialRole()
     * This method is kept for compatibility but does nothing
     */
    private reevaluateRoleIfNeeded(): void {
        console.log('[PerfectNegotiation] ⚠️ reevaluateRoleIfNeeded() called but roles are not recalculated - they are stable once determined');
        // No-op: roles are determined once and remain stable
    }

    /**
     * Check if this peer is currently alone in the room
     * Used for intelligent role switching when peer disconnects
     */
    private isAloneInRoom(): boolean {
        try {
            const allParticipants = this.signaling.getValidParticipants();
            const otherParticipants = allParticipants.filter(p => p.clientId !== this.clientId);
            const isAlone = otherParticipants.length === 0;
            debugLog(`[PerfectNegotiation] 🏠 Room occupancy check: ${isAlone ? 'alone' : `${otherParticipants.length} others`}`);
            return isAlone;
        } catch (error) {
            debugWarn('[PerfectNegotiation] ⚠️ Could not check room occupancy:', error);
            return false;
        }
    }

    /**
     * ❌ DEPRECATED: Role switching is now handled by stable role determination
     */
    private handleRoleSwitch(): void {
        console.log('[PerfectNegotiation] � handleRoleSwitch called but roles are stable - no action needed');
        // No-op: roles are determined once and remain stable
    }

    /**
     * ❌ DEPRECATED: Disconnection recovery is now simplified
     */
    private handleDisconnectionRecovery(): void {
        console.log('[PerfectNegotiation] 📍 handleDisconnectionRecovery called but logic is simplified');
        // No-op: reconnection is handled by simpler triggerReconnection() when needed
    }

    /**
     * Trigger actual reconnection attempt - IMPROVED
     */
    private triggerReconnection(): void {
        console.log('[PerfectNegotiation] 🔄 Triggering reconnection attempt...');

        // Check if both participants are still present
        if (!this.signaling.hasPatientAndPractitioner()) {
            console.log('[PerfectNegotiation] 🔄 Cannot reconnect - missing participants');
            return;
        }

        // Recalculate roles in case the impolite peer was the one who disconnected
        this.calculateInitialRole();

        // Only impolite peer should trigger reconnection
        if (this.negotiationRole.isPolite) {
            console.log('[PerfectNegotiation] 🔄 Polite peer - waiting for impolite to reconnect');
            return;
        }

        console.log('[PerfectNegotiation] 🔄 Impolite peer - initiating reconnection');

        // Reset negotiation state and trigger flag for clean reconnection
        this.resetNegotiationState(true); // This will reset both negotiation state AND trigger flag

        // Directly trigger DataChannel creation (simplified)
        if (this.peerConnection?.triggerDataChannelCreation) {
            console.log('[PerfectNegotiation] 🔄 Triggering DataChannel creation for reconnection');
            this.peerConnection.triggerDataChannelCreation();
            this.hasTriggeredInitialConnection = true;
        } else {
            console.warn('[PerfectNegotiation] 🔄 Cannot trigger reconnection - no peerConnection reference');
        }
    }

    /**
     * Complete role switch with deterministic logic
     * Simplified to use only deterministic role calculation
     */
    private performRoleSwitch(newRole: 'polite' | 'impolite'): void {
        const oldRole = this.negotiationRole.isPolite ? 'polite' : 'impolite';

        if (oldRole === newRole) {
            debugLog(`[PerfectNegotiation] Already ${newRole}, no switch needed`);
            return;
        }

        // Check if role switching is currently locked
        if (this.isRoleLocked()) {
            debugLog(`[PerfectNegotiation] Role switch to ${newRole} blocked - role is locked`);
            return;
        }

        debugLog(`[PerfectNegotiation] 🔄 ROLE SWITCH: ${oldRole} → ${newRole} (deterministic)`);

        // Update role
        this.negotiationRole.isPolite = newRole === 'polite';

        // Update metrics
        this.roleSwitchCount++;
        this.lastRoleSwitchTime = Date.now();
        debugLog(`[PerfectNegotiation] 📊 Role switch #${this.roleSwitchCount} completed`);

        // Reset negotiation state for clean slate
        this.resetNegotiationState();

        // Lock role temporarily to prevent rapid switches (increased from 1s to 2s for better stability)
        this.roleLockedUntil = Date.now() + 2000;

        // ❌ REMOVED: No automatic connection triggering on role switch
        // Roles are stable and only calculated once in calculateInitialRole()
        console.log('[PerfectNegotiation] 📍 Role switched but no auto-connection trigger (roles are stable)');
    }

    /**
     * Check if there's a genuine role conflict that needs resolution
     * Only considers conflicts when both patient and practitioner are present
     */
    private hasRoleConflict(): boolean {
        const participants = this.signaling.getValidParticipants();
        const hasPatientAndPractitioner = this.signaling.hasPatientAndPractitioner();

        // No conflict if we don't have both participants yet
        if (!hasPatientAndPractitioner || participants.length < 2) {
            return false;
        }

        const otherParticipants = participants.filter(p => p.clientId !== this.clientId);

        // Check if our current role matches what it should be based on deterministic rules
        const allIds = [this.clientId, ...otherParticipants.map(p => p.clientId)].sort();
        const myPosition = allIds.indexOf(this.clientId);
        const shouldBeImpolite = myPosition === 0;
        const currentlyImpolite = !this.negotiationRole.isPolite;

        return shouldBeImpolite !== currentlyImpolite;
    }

    /**
     * ❌ DEPRECATED: Role conflicts are resolved by stable role determination
     */
    private resolveRoleConflict(): void {
        console.log('[PerfectNegotiation] 📍 resolveRoleConflict called but roles are stable - no action needed');
        // No-op: roles are determined once and remain stable
    }

    /**
     * Simplified connection state handler with basic WebRTC reconnection
     */
    private setupConnectionStateHandler() {
        this.pc.onconnectionstatechange = () => {
            console.log(`[PerfectNegotiation] 📊 Connection state changed: ${this.pc.connectionState}`);
            debugLog(`[PerfectNegotiation] Connection state: ${this.pc.connectionState}`);

            // Handle WebRTC connection failures - only for truly failed connections
            if (this.pc.connectionState === 'failed') {
                console.log('[PerfectNegotiation] ❌ Connection failed, will attempt reconnection after delay...');

                // Small delay to let things settle, then trigger reconnection
                setTimeout(() => {
                    // Only try reconnection if both participants are still present
                    if (this.signaling.hasPatientAndPractitioner()) {
                        console.log('[PerfectNegotiation] 🔄 Both participants present, attempting WebRTC reconnection');
                        this.triggerReconnection();
                    } else {
                        console.log('[PerfectNegotiation] 👋 Participant missing, skipping WebRTC reconnection');
                    }
                }, 1000);
            } else if (this.pc.connectionState === 'disconnected') {
                console.log('[PerfectNegotiation] 🔌 Connection disconnected, allowing natural recovery...');
                // Note: Not triggering immediate reconnection for 'disconnected' state
                // This allows WebRTC's natural ICE recovery mechanisms to work
                // Presence-based logic will handle participant departure scenarios
            }

            if (this.pc.connectionState === 'connected') {
                console.log('[PerfectNegotiation] ✅ Connection established successfully');
            }

            // Notify callback if set
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
     * @param resetTriggerFlag - Whether to also reset the hasTriggeredInitialConnection flag
     */
    public resetNegotiationState(resetTriggerFlag: boolean = false) {
        this.negotiationState = {
            makingOffer: false,
            ignoreOffer: false,
            isSettingRemoteAnswerPending: false
        };

        if (resetTriggerFlag) {
            this.hasTriggeredInitialConnection = false;
            debugLog('[PerfectNegotiation] Negotiation state AND trigger flag reset');
        } else {
            debugLog('[PerfectNegotiation] Negotiation state reset (trigger flag preserved)');
        }
    }

    /**
     * Attempt automatic reconnection with Perfect Negotiation and intelligent role switching
     * This method can be called when connection fails to trigger a new negotiation
     */
    public async attemptReconnection(): Promise<void> {
        this.connectionAttempts++;
        debugLog(`[PerfectNegotiation] Attempting automatic reconnection (#${this.connectionAttempts})...`);

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
            debugLog('[PerfectNegotiation] Impolite peer initiating reconnection offer with ICE restart...');
            try {
                this.negotiationState.makingOffer = true;
                // Use iceRestart: true for forced reconnection to get fresh ICE candidates
                const offer = await this.pc.createOffer({ iceRestart: true });
                await this.pc.setLocalDescription(offer);
                debugLog('[PerfectNegotiation] Reconnection offer with ICE restart created, sending via signaling');
                logger.info(LogCategory.ICE, "🔄 ICE restart triggered for forced reconnection");
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
     * ❌ DEPRECATED: Manual role conflict resolution (no longer needed)
     */
    public triggerRoleConflictResolution(): void {
        console.log('[PerfectNegotiation] ⚠️ triggerRoleConflictResolution() is deprecated - roles are stable');
        // No-op: roles are determined once and remain stable
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
     * 🔄 Reset metrics (useful for testing or long-running sessions)
     */
    public resetMetrics(): void {
        debugLog('[PerfectNegotiation] 📊 Resetting performance metrics');
        this.roleSwitchCount = 0;
        this.lastRoleSwitchTime = 0;
        this.connectionAttempts = 0;
    }

    /**
     * 📊 Get performance metrics for monitoring and debugging
     */
    public getMetrics() {
        return {
            roleSwitchCount: this.roleSwitchCount,
            lastRoleSwitchTime: this.lastRoleSwitchTime,
            timeSinceLastRoleSwitch: this.lastRoleSwitchTime > 0 ? Date.now() - this.lastRoleSwitchTime : 0,
            connectionAttempts: this.connectionAttempts,
            currentRole: this.negotiationRole.isPolite ? 'polite' : 'impolite',
            isRoleLocked: this.isRoleLocked(),
            roleLockedTimeRemaining: Math.max(0, this.roleLockedUntil - Date.now()),
            hasTriggeredConnection: this.hasTriggeredInitialConnection,
            negotiationState: this.negotiationState
        };
    }

    /**
     * 🩺 Diagnose role switching issues
     * Call this method to understand why roles are switching unexpectedly
     */
    public diagnoseRoleSwitching(): void {
        const state = this.getDebugRoleState();
        const metrics = this.getMetrics();

        console.log('[PerfectNegotiation] 🩺 ROLE SWITCHING DIAGNOSIS:');
        console.log(`  My ID: ${state.myClientId}`);
        console.log(`  Current role: ${state.myRole}`);
        console.log(`  Should be impolite: ${state.shouldBeImpolite}`);
        console.log(`  Has conflict: ${state.hasConflict}`);
        console.log(`  Is alone: ${state.isAlone}`);
        console.log(`  Role locked: ${this.isRoleLocked()}`);
        console.log(`  📊 METRICS:`);
        console.log(`    Role switches: ${metrics.roleSwitchCount}`);
        console.log(`    Connection attempts: ${metrics.connectionAttempts}`);
        console.log(`    Time since last switch: ${metrics.timeSinceLastRoleSwitch}ms`);
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
     * This calculates roles and triggers connection if needed
     */
    public onRoomReady(): void {
        console.log('[PerfectNegotiation] 🎯 Room became ready, calculating roles and checking connection trigger');

        // 🚨 STEP 1: Calculate roles now that both participants are present
        this.calculateInitialRole();

        // 🚨 STEP 2: If we're impolite, trigger connection
        if (!this.negotiationRole.isPolite && !this.hasTriggeredInitialConnection) {
            console.log('[PerfectNegotiation] ✅ I am impolite peer, triggering DataChannel creation');
            if (this.peerConnection?.triggerDataChannelCreation) {
                this.peerConnection.triggerDataChannelCreation();
                this.hasTriggeredInitialConnection = true;
            }
        } else if (this.negotiationRole.isPolite) {
            console.log('[PerfectNegotiation] ⏳ I am polite peer, waiting for impolite peer to initiate');
        } else {
            console.log('[PerfectNegotiation] ⚠️ Already triggered connection, skipping');
        }
    }

    /**
     * ❌ DEPRECATED: Check if initial connection should be triggered for impolite peer
     * This method is no longer used since roles are calculated once and connections
     * are triggered directly in onRoomReady()
     */
    private checkInitialConnectionTrigger(): void {
        console.log('[PerfectNegotiation] ⚠️ checkInitialConnectionTrigger() called but this method is deprecated');
        console.log('[PerfectNegotiation] ⚠️ Connections are now triggered directly in onRoomReady()');
        // No-op: this method is no longer used
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

        // Clear debounce timer
        if (this.presenceChangeDebounceTimer) {
            clearTimeout(this.presenceChangeDebounceTimer);
            this.presenceChangeDebounceTimer = null;
        }

        // Reset negotiation state
        this.resetNegotiationState();

        // Clear callback
        this.onConnectionStateChange = undefined;

        debugLog('[PerfectNegotiation] Cleanup complete');
    }

    /**
     * 🚨 CRITICAL FIX: Calculate role AFTER signaling connection
     * This should be called once the signaling is connected and participants are known
     * This is the ONLY method that should determine negotiation roles
     */
    public calculateInitialRole(): void {
        console.log(`🎯 [PerfectNegotiation] calculateInitialRole() CALLED - clientId: ${this.clientId}`);

        // Only calculate roles when both participants are present
        if (!this.signaling.hasPatientAndPractitioner()) {
            console.log(`🎯 [PerfectNegotiation] Not both participants present yet, keeping polite role as default`);
            return;
        }

        const participants = this.signaling.getValidParticipants();
        const others = participants.filter(p => p.clientId !== this.clientId);

        console.log(`🎯 [PerfectNegotiation] Participants: ${participants.map(p => `${p.clientId}(${p.role})`).join(', ')}`);

        // Simple deterministic role assignment based on clientId
        const allIds = [this.clientId, ...others.map(p => p.clientId)].sort();
        const myPosition = allIds.indexOf(this.clientId);
        const shouldBeImpolite = myPosition === 0; // First in sorted order is impolite (initiator)

        // Only update role if it's different
        const currentRole = this.negotiationRole.isPolite ? 'polite' : 'impolite';
        const newRole = shouldBeImpolite ? 'impolite' : 'polite';

        if (currentRole !== newRole) {
            this.negotiationRole.isPolite = !shouldBeImpolite;
            console.log(`🎯 [PerfectNegotiation] ROLE CHANGED: ${currentRole} → ${newRole} (clientIds: ${allIds.join(', ')}, myPosition: ${myPosition})`);
        } else {
            console.log(`🎯 [PerfectNegotiation] ROLE CONFIRMED: ${newRole} (already set correctly)`);
        }

        // If we're impolite, we can trigger connection
        if (!this.negotiationRole.isPolite) {
            console.log(`🎯 [PerfectNegotiation] I'm impolite, will trigger connection when room is ready`);
        }

        console.log(`🎯 [PerfectNegotiation] calculateInitialRole() COMPLETED`);
    }

    /**
     * 🚨 Force negotiation manually when onnegotiationneeded doesn't trigger
     * This is a fallback to ensure connection always starts
     */
    public async forceNegotiation(): Promise<void> {
        console.log('🚨 [PerfectNegotiation] FORCING NEGOTIATION manually');

        try {
            // Check PeerConnection state first
            if (this.pc.connectionState === 'closed' || this.pc.signalingState === 'closed') {
                console.error('🚨 [PerfectNegotiation] Cannot force negotiation - PeerConnection is closed');
                return;
            }

            // Only impolite peer should create offers
            if (this.negotiationRole.isPolite) {
                console.log('🚨 [PerfectNegotiation] Polite peer - cannot force negotiation, only impolite can');
                return;
            }

            // Check if both peers are present
            const allParticipants = this.signaling.getValidParticipants();
            const bothPresent = allParticipants.length >= 2;

            if (!bothPresent) {
                console.log('🚨 [PerfectNegotiation] Cannot force negotiation - not enough participants');
                return;
            }

            // Avoid double negotiation
            if (this.negotiationState.makingOffer) {
                console.log('🚨 [PerfectNegotiation] Already making offer, skipping force negotiation');
                return;
            }

            console.log('🚨 [PerfectNegotiation] Creating forced offer...');
            this.negotiationState.makingOffer = true;

            await this.pc.setLocalDescription();
            console.log('🚨 [PerfectNegotiation] Forced offer created, sending via signaling');

            await this.signaling.sendMessage({
                type: 'offer',
                roomId: this.roomId,
                content: this.pc.localDescription!
            });

            console.log('🚨 [PerfectNegotiation] Forced offer sent successfully');
        } catch (error) {
            console.error('🚨 [PerfectNegotiation] Error during forced negotiation:', error);
            this.negotiationState.makingOffer = false;
        }
    }
}
