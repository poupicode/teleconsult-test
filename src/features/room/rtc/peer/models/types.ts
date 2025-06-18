/**
 * WebRTC Types and Interfaces
 * 
 * This file defines the type definitions used throughout the WebRTC implementation.
 * It includes enums, interfaces, and type aliases for various communication aspects.
 */

// Enums
/**
 * User roles in the teleconsultation system
 */
export enum Role {
    PATIENT = 'patient',
    PRACTITIONER = 'practitioner'
}

/**
 * Perfect Negotiation roles - independent of business logic roles
 * This determines behavior during offer/answer collisions
 */
export interface NegotiationRole {
    isPolite: boolean;  // True if this peer should be polite (defer to incoming offers)
}

/**
 * Perfect Negotiation state tracking
 */
export interface NegotiationState {
    makingOffer: boolean;                    // Currently creating/sending an offer
    ignoreOffer: boolean;                    // Should ignore incoming offers due to collision
    isSettingRemoteAnswerPending: boolean;   // Currently setting remote answer
}

/**
 * Interface for general DataChannel messages
 */
export interface DataChannelMessage {
    type: string;       // Message type identifier
    payload: any;       // The actual message content
    sender: string;     // ID of the message sender
    senderRole: Role;   // Role of the message sender
    timestamp: number;  // When the message was sent
}

/**
 * Interface for chat-specific messages
 */
export interface ChatMessage {
    sender: string;     // ID of the message sender
    senderRole: Role;   // Role of the message sender
    content: string;    // Chat message text content
    timestamp: number;  // When the message was sent
}

/**
 * Improved typing for signaling messages
 */

/**
 * Interface for WebRTC offer messages
 */
export interface OfferMessage {
    type: 'offer';
    content: RTCSessionDescriptionInit;
}

/**
 * Interface for WebRTC answer messages
 */
export interface AnswerMessage {
    type: 'answer';
    content: RTCSessionDescriptionInit;
}

/**
 * Interface for WebRTC ICE candidate messages
 */
export interface IceCandidateMessage {
    type: 'ice-candidate';
    content: RTCIceCandidateInit;
}

/**
 * Union type for all signaling message types
 */
export type TypedSignalingMessage = OfferMessage | AnswerMessage | IceCandidateMessage;

// Repository of MediaStreams received from other peers
export type MediaStreamList = {
    [id: string]: MediaStream | null;
};

export type VideoDevicesType = MediaDeviceInfo[];

export type ExtendedSessionDescription = RTCSessionDescription
    & {
        mediaStreamMetadata: {
            [k: string]: string;
        }
    } | null;