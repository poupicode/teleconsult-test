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

// CONFIGURE LOG LEVELS - enable only what you need
const CONFIG = {
    SHOW_NEGOTIATION_LOGS: DEBUG_LOGS && true, 
    SHOW_ICE_LOGS: DEBUG_LOGS && false,     // Set to true only when debugging ICE issues
    SHOW_SIGNALING_LOGS: DEBUG_LOGS && false, // Set to true only when debugging signaling
    SHOW_ALL_ERRORS: true                    // Always show errors
};

// Conditional logging functions with category filtering
const debugLog = (message: string, ...args: any[]) => {
    const isICELog = message.includes('[WebRTC-ICE]') || message.includes('ICE candidate');
    const isSignalingLog = message.includes('signaling') || message.includes('Signaling');
    
    if (!DEBUG_LOGS) return;
    
    if (isICELog && !CONFIG.SHOW_ICE_LOGS) return;
    if (isSignalingLog && !CONFIG.SHOW_SIGNALING_LOGS) return;
    
    console.log(message, ...args);
};

const debugWarn = (message: string, ...args: any[]) => {
    if (DEBUG_LOGS) console.warn(message, ...args);
};

const debugError = (message: string, ...args: any[]) => {
    if (CONFIG.SHOW_ALL_ERRORS) console.error(message, ...args); // Always log errors by default
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

        // Determine negotiation role using deterministic clientId comparison
        // This ensures stable roles regardless of connection/disconnection order
        this.negotiationRole = {
            isPolite: this.determineRoleFromClientId() === 'polite'
        };

        debugLog(`[PerfectNegotiation] Initialized with role: ${role}, isPolite: ${this.negotiationRole.isPolite}`);

        this.setupEventHandlers();
        this.setupPresenceListener();

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
                
                // Check if both peers are present before proceeding with negotiation
                const allParticipants = this.signaling.getValidParticipants();
                const bothPresent = allParticipants.length >= 2;
                
                if (!bothPresent) {
                    debugLog('[PerfectNegotiation] Skipping negotiation - not enough participants yet');
                    return; // Skip negotiation if not enough participants
                }

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
     * Determine negotiation role using deterministic clientId comparison
     * This ensures stable roles regardless of connection/disconnection order
     */
    private determineRoleFromClientId(): 'polite' | 'impolite' {
        const participants = this.signaling.getValidParticipants();
        const others = participants.filter(p => p.clientId !== this.clientId);

        if (others.length === 0) {
            return 'impolite'; // Alone in room = ready to initiate when someone arrives
        }

        // Deterministic comparison of clientIds
        const allIds = [this.clientId, ...others.map(p => p.clientId)].sort();
        const myPosition = allIds.indexOf(this.clientId);

        debugLog(`[PerfectNegotiation] Deterministic role calculation: sortedIds=[${allIds.join(', ')}], myPosition=${myPosition}`);

        return myPosition === 0 ? 'impolite' : 'polite';
    }

    /**
     * Set up presence listener to handle role reevaluation with debouncing AND reconnection
     */
    private setupPresenceListener(): void {
        this.signaling.onPresenceChange(() => {
            // Clear existing timer if presence changes rapidly
            if (this.presenceChangeDebounceTimer) {
                clearTimeout(this.presenceChangeDebounceTimer);
            }

            // Debounce presence changes to avoid excessive role reevaluations
            this.presenceChangeDebounceTimer = setTimeout(() => {
                debugLog('[PerfectNegotiation] 👥 Presence stabilized, checking room state...');
                this.handlePresenceChange();
                this.presenceChangeDebounceTimer = null;
            }, 250); // Increased from 100ms to 250ms for better stability
        });
    }

    /**
     * Handle presence changes with reconnection logic
     */
    private handlePresenceChange(): void {
        const participants = this.signaling.getValidParticipants();
        const bothPresent = participants.length >= 2;
        const isDisconnected = this.pc.connectionState === 'disconnected' ||
            this.pc.connectionState === 'failed' ||
            this.pc.connectionState === 'new';

        debugLog(`[PerfectNegotiation] 🔍 Presence check: bothPresent=${bothPresent}, connectionState=${this.pc.connectionState}`);

        // First, always reevaluate roles
        this.reevaluateRoleIfNeeded();

        // If both are present but connection is broken, trigger reconnection
        if (bothPresent && isDisconnected) {
            debugLog('[PerfectNegotiation] 🔄 Both present but disconnected - checking if we should reconnect');

            setTimeout(() => {
                // Double-check connection state after role reevaluation
                if (this.pc.connectionState !== 'connected' && this.pc.connectionState !== 'connecting') {
                    if (!this.negotiationRole.isPolite) {
                        debugLog('[PerfectNegotiation] 🚀 Impolite peer triggering reconnection due to presence change');
                        this.triggerReconnection();
                    } else {
                        debugLog('[PerfectNegotiation] 🤝 Polite peer waiting for impolite to reconnect');
                    }
                }
            }, 500); // Small delay after role reevaluation
        }
    }

    /**
     * Reevaluate role if needed based on current participants
     */
    private reevaluateRoleIfNeeded(): void {
        const newRole = this.determineRoleFromClientId();
        const currentRole = this.negotiationRole.isPolite ? 'polite' : 'impolite';

        if (newRole !== currentRole) {
            debugLog(`[PerfectNegotiation] 🔄 Role change needed: ${currentRole} → ${newRole} (deterministic)`);
            this.performRoleSwitch(newRole);
        } else {
            debugLog(`[PerfectNegotiation] ✅ Role evaluation: staying ${currentRole} (stable)`);
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
            const isAlone = otherParticipants.length === 0;
            debugLog(`[PerfectNegotiation] 🏠 Room occupancy check: ${isAlone ? 'alone' : `${otherParticipants.length} others`}`);
            return isAlone;
        } catch (error) {
            debugWarn('[PerfectNegotiation] ⚠️ Could not check room occupancy:', error);
            return false;
        }
    }

    /**
     * Handle intelligent role switching and automatic reconnection
     * Complete logic for all disconnection scenarios
     */
    private handleRoleSwitch(): void {
        debugLog('[PerfectNegotiation] 🔄 Handling disconnection, starting recovery process...');

        // Wait a bit for natural recovery before forcing reconnection
        setTimeout(() => {
            if (this.pc.connectionState !== 'connected') {
                debugLog('[PerfectNegotiation] 🔧 Connection not recovered naturally, initiating recovery...');
                this.handleDisconnectionRecovery();
            } else {
                debugLog('[PerfectNegotiation] ✅ Connection recovered naturally, no intervention needed');
            }
        }, 2000); // Give time for natural WebRTC recovery
    }

    /**
     * Complete disconnection recovery logic
     * Handles all scenarios: alone, both present but disconnected, etc.
     */
    private handleDisconnectionRecovery(): void {
        const participants = this.signaling.getValidParticipants();
        const isAlone = participants.filter(p => p.clientId !== this.clientId).length === 0;
        const bothPresent = participants.length >= 2;

        debugLog(`[PerfectNegotiation] 🩺 Recovery diagnosis: alone=${isAlone}, bothPresent=${bothPresent}, connectionState=${this.pc.connectionState}`);

        if (isAlone) {
            debugLog('[PerfectNegotiation] 👤 Alone in room - waiting for other peer to return');
            // When alone, just reset state and wait
            this.resetNegotiationState();
            return;
        }

        if (bothPresent) {
            debugLog('[PerfectNegotiation] 👥 Both peers present but disconnected - initiating reconnection');

            // First, reevaluate roles based on current participants
            this.reevaluateRoleIfNeeded();

            // Then, trigger reconnection if we're impolite
            setTimeout(() => {
                if (!this.negotiationRole.isPolite && this.pc.connectionState !== 'connected') {
                    debugLog('[PerfectNegotiation] 🚀 Impolite peer initiating reconnection after role reevaluation');
                    this.triggerReconnection();
                } else if (this.negotiationRole.isPolite) {
                    debugLog('[PerfectNegotiation] 🤝 Polite peer waiting for impolite peer to reconnect');
                } else {
                    debugLog('[PerfectNegotiation] ✅ Connection recovered during role reevaluation');
                }
            }, 1000); // Small delay after role reevaluation
        }
    }

    /**
     * Trigger actual reconnection attempt
     */
    private triggerReconnection(): void {
        debugLog('[PerfectNegotiation] 🔄 Triggering reconnection attempt...');

        // Reset the trigger flag to allow new connection
        this.hasTriggeredInitialConnection = false;

        // Reset negotiation state for clean reconnection
        this.resetNegotiationState();

        // Trigger connection via DataChannel creation (which starts Perfect Negotiation)
        this.checkInitialConnectionTrigger();
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

        // If switching to impolite, prepare to initiate connection
        if (newRole === 'impolite') {
            debugLog('[PerfectNegotiation] 🚀 New impolite peer - will initiate connection');

            // Small delay to let things settle, then trigger connection
            setTimeout(() => {
                this.checkInitialConnectionTrigger();
            }, 500);
        }
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
     * Simplified role conflict resolution using deterministic reevaluation
     */
    private resolveRoleConflict(): void {
        debugLog('[PerfectNegotiation] 🆘 Resolving role conflict using deterministic reevaluation');
        this.reevaluateRoleIfNeeded();
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

                // Only resolve conflicts if we detect an actual issue
                setTimeout(() => {
                    // Additional safety checks before automatic conflict resolution
                    const hasGenuineConflict = this.hasRoleConflict();
                    const participantCount = this.signaling.getValidParticipants().length;

                    if (hasGenuineConflict && participantCount >= 2) {
                        debugLog('[PerfectNegotiation] 🆘 Genuine role conflict detected, resolving...');
                        this.resolveRoleConflict();
                    } else {
                        debugLog('[PerfectNegotiation] ✅ No role conflict detected, connection stable');
                    }
                }, 1500); // Increased delay to allow signaling to fully stabilize
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
}
