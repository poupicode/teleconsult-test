/**
 * Peer Module Entry Point
 * 
 * This file serves as the main entry point for the peer module,
 * exporting the main class and all necessary types for WebRTC peer connections.
 */

// Export the main PeerConnection class
export { PeerConnection } from './connection/peer-connection';

// Export all types and interfaces for external use
export * from './models/types';