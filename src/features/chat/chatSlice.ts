/**
 * Chat Slice
 * 
 * This file defines the Redux slice for managing chat messaging functionality.
 * It handles storage and organization of messages by room, loading states, and error handling.
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatMessage } from '@/features/room/rtc/peer';

/**
 * Interface defining the chat state structure
 */
interface ChatState {
    messagesByRoom: Record<string, ChatMessage[]>; // Messages organized by room ID
    isLoading: boolean; // Loading state indicator
    error: string | null; // Error message if any
}

/**
 * Initial state for chat - empty messages, not loading, no error
 */
const initialState: ChatState = {
    messagesByRoom: {},
    isLoading: false,
    error: null
};

/**
 * Chat slice containing reducers to manage chat messages
 */
const chatSlice = createSlice({
    name: 'chat',
    initialState,
    reducers: {
        /**
         * Handles a new message received for a specific room
         * Creates the room's message array if it doesn't exist
         */
        messageReceived: (state, action: PayloadAction<{ roomId: string, message: ChatMessage }>) => {
            const { roomId, message } = action.payload;
            if (!state.messagesByRoom[roomId]) {
                state.messagesByRoom[roomId] = [];
            }
            state.messagesByRoom[roomId].push(message);
        },
        /**
         * Clears all messages for a specific room
         */
        clearMessages: (state, action: PayloadAction<string>) => {
            const roomId = action.payload;
            state.messagesByRoom[roomId] = [];
        },
        /**
         * Clears all messages across all rooms
         */
        clearAllMessages: (state) => {
            state.messagesByRoom = {};
        },
        /**
         * Sets an error message
         */
        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
        },
        /**
         * Clears any error message
         */
        clearError: (state) => {
            state.error = null;
        }
    }
});

export const { messageReceived, clearMessages, clearAllMessages, setError, clearError } = chatSlice.actions;
export default chatSlice.reducer;