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
    
    // Callbacks
    private onConnectionStateChange?: (state: RTCPeerConnectionState) => void;

    constructor(
        pc: RTCPeerConnection,
        signaling: SignalingService,
        roomId: string,
        clientId: string,
        role: Role
    ) {
        this.pc = pc;
        this.signaling = signaling;
        this.roomId = roomId;
        this.clientId = clientId;
        this.role = role;
        
        // Initialize negotiation state
        this.negotiationState = {
            makingOffer: false,
            ignoreOffer: false,
            isSettingRemoteAnswerPending: false
        };
        
        // Determine negotiation role based on business role
        // Patient is polite, Practitioner is impolite
        // This could also be determined by who joins first, random number, etc.
        this.negotiationRole = {
            isPolite: this.role === Role.PATIENT
        };
        
        debugLog(`[PerfectNegotiation] Initialized with role: ${role}, isPolite: ${this.negotiationRole.isPolite}`);
        
        this.setupEventHandlers();
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
                
            } catch (err) {
                debugError('[PerfectNegotiation] Error during negotiation:', err);
            } finally {
                this.negotiationState.makingOffer = false;
            }
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
        
        if (description.type === 'offer') {
            // Perfect Negotiation collision detection logic
            const readyForOffer = !this.negotiationState.makingOffer && 
                (this.pc.signalingState === "stable" || this.negotiationState.isSettingRemoteAnswerPending);
            
            const offerCollision = !readyForOffer;
            
            this.negotiationState.ignoreOffer = !this.negotiationRole.isPolite && offerCollision;
            
            if (this.negotiationState.ignoreOffer) {
                debugLog('[PerfectNegotiation] Ignoring offer due to collision (impolite peer)');
                return;
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
            this.negotiationState.isSettingRemoteAnswerPending = true;
            await this.pc.setRemoteDescription(description);
            this.negotiationState.isSettingRemoteAnswerPending = false;
            
            debugLog('[PerfectNegotiation] Processed answer');
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
     * Handle connection state changes
     */
    private setupConnectionStateHandler() {
        this.pc.onconnectionstatechange = () => {
            debugLog(`[PerfectNegotiation] Connection state: ${this.pc.connectionState}`);
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
        debugLog('[PerfectNegotiation] Negotiation state reset');
    }

    /**
     * Attempt automatic reconnection with Perfect Negotiation
     * This method can be called when connection fails to trigger a new negotiation
     */
    public async attemptReconnection(): Promise<void> {
        debugLog('[PerfectNegotiation] Attempting automatic reconnection...');
        
        // Only attempt reconnection if we're in a stable state
        if (this.pc.signalingState !== 'stable' && this.pc.signalingState !== 'closed') {
            debugWarn('[PerfectNegotiation] Cannot attempt reconnection in current signaling state:', this.pc.signalingState);
            return;
        }
        
        // Reset negotiation state for clean reconnection
        this.resetNegotiationState();
        
        // For impolite peer (practitioner), create a new offer to restart negotiation
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
            role: this.negotiationRole.isPolite ? 'polite' : 'impolite'
        };
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
