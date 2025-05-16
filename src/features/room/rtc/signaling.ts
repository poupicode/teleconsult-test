/**
 * Signaling Service
 * 
 * This file implements a WebRTC signaling service using Supabase Realtime.
 * It handles the exchange of connection offers, answers, and ICE candidates 
 * between peers, as well as participant presence management.
 */
import { supabase } from '@/lib/supabaseClient';
import { Role } from './peer';

/**
 * Represents a signaling message exchanged between peers
 */
export type SignalingMessage = {
    type: 'offer' | 'answer' | 'ice-candidate';  // Type of signaling message
    sender: string;                              // Client ID of the sender
    receiver?: string;                           // Optional target client ID
    roomId: string;                              // Room identifier
    content: RTCSessionDescriptionInit | RTCIceCandidateInit;  // WebRTC specific content
    created_at?: Date;                           // Message timestamp
};

/**
 * Represents a user present in a room
 */
export type UserPresence = {
    clientId: string;  // Unique identifier for the client
    role: Role;        // Role in the consultation (patient or practitioner)
};

/**
 * Manages WebRTC signaling between peers using Supabase Realtime channels
 */
export class SignalingService {
    public roomId: string;
    public clientId: string;
    private role: Role;
    private messageCallback: ((message: SignalingMessage) => void) | null = null;
    private presenceCallback: ((presences: UserPresence[]) => void) | null = null;
    private subscription: any = null;
    private presenceSubscription: any = null;
    private roomPresences: UserPresence[] = [];

    /**
     * Creates a new signaling service instance
     * @param roomId Room identifier for the consultation
     * @param clientId Unique identifier for this client
     * @param role The role of the participant (patient or practitioner)
     */
    constructor(roomId: string, clientId: string, role: Role) {
        console.log(`[Signaling] Creating service for room: ${roomId}, client: ${clientId}, role: ${role}`);
        this.roomId = roomId;
        this.clientId = clientId;
        this.role = role;
    }

    /**
     * Connects to Supabase realtime channels for signaling and presence
     */
    async connect() {
        console.log(`[Signaling] Connecting to room channel: ${this.roomId}`);

        // Create a specific channel for the room signaling
        this.subscription = supabase
            .channel(`room:${this.roomId}`)
            .on('broadcast', { event: 'signaling' }, (payload) => {
                const message = payload.payload as SignalingMessage;
                console.log(`[Signaling] Received message: ${message.type} from ${message.sender}`);

                // Skip messages from self
                if (message.sender === this.clientId) {
                    console.log('[Signaling] Ignoring message from self');
                    return;
                }

                // Process message if it's not for a specific receiver or it's for this client
                if (!message.receiver || message.receiver === this.clientId) {
                    if (this.messageCallback) {
                        this.messageCallback(message);
                    }
                }
            })
            .subscribe((status) => {
                console.log(`[Signaling] Subscription status: ${status}`);
            });

        // Create a presence channel for the room
        this.presenceSubscription = supabase
            .channel(`presence:${this.roomId}`)
            .on('presence', { event: 'sync' }, () => {
                const state = this.presenceSubscription.presenceState();
                console.log('[Signaling] Presence state updated:', state);

                // Convert presence state to user presences array
                const presences: UserPresence[] = [];
                Object.values(state).forEach((stateItem: any) => {
                    stateItem.forEach((presence: any) => {
                        presences.push({
                            clientId: presence.clientId,
                            role: presence.role
                        });
                    });
                });

                this.roomPresences = presences;

                // Notify about presence change
                if (this.presenceCallback) {
                    this.presenceCallback(this.roomPresences);
                }
            })
            .subscribe(async (status) => {
                console.log(`[Signaling] Presence subscription status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    // Enter the room with role information
                    await this.presenceSubscription.track({
                        clientId: this.clientId,
                        role: this.role,
                        online_at: new Date().toISOString(),
                    });
                }
            });
    }

    /**
     * Sends a signaling message through the Supabase realtime channel
     * @param message The message to send (without sender info)
     */
    async sendMessage(message: Omit<SignalingMessage, 'sender'>) {
        console.log(`[Signaling] Sending message: ${message.type}`);

        const completeMessage = {
            ...message,
            sender: this.clientId,
            created_at: new Date(),
        };

        try {
            // Use the broadcast feature to send messages instead of database insertion
            const result = await this.subscription.send({
                type: 'broadcast',
                event: 'signaling',
                payload: completeMessage
            });

            console.log('[Signaling] Message sent successfully');
            return { error: null };
        } catch (error) {
            console.error('[Signaling] Error sending message:', error);
            return { error };
        }
    }

    /**
     * Returns the list of current room participants
     */
    getRoomPresences(): UserPresence[] {
        return this.roomPresences;
    }

    /**
     * Checks if the room has both patient and practitioner roles present
     */
    hasPatientAndPractitioner(): boolean {
        const hasPatient = this.roomPresences.some(p => p.role === Role.PATIENT);
        const hasPractitioner = this.roomPresences.some(p => p.role === Role.PRACTITIONER);
        return hasPatient && hasPractitioner;
    }

    /**
     * Registers a callback for room presence changes
     * @param callback Function to call when presence changes
     */
    onPresenceChange(callback: (presences: UserPresence[]) => void) {
        this.presenceCallback = callback;
    }

    /**
     * Registers a callback for incoming messages
     * @param callback Function to call when a message is received
     */
    onMessage(callback: (message: SignalingMessage) => void) {
        this.messageCallback = callback;
    }

    /**
     * Disconnects from all channels and cleans up resources
     */
    disconnect() {
        console.log('[Signaling] Disconnecting');
        if (this.presenceSubscription) {
            // Leave presence
            this.presenceSubscription.untrack();
            supabase.removeChannel(this.presenceSubscription);
            this.presenceSubscription = null;
        }
        if (this.subscription) {
            supabase.removeChannel(this.subscription);
            this.subscription = null;
        }
    }
}