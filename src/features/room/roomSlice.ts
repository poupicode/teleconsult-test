/**
 * Room Slice
 * 
 * This file defines the Redux slice for managing video consultation rooms.
 * It handles room state, user roles, and participant tracking.
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Role } from './rtc/peer';

/**
 * Interface defining a room participant
 */
interface Participant {
  id: string;
  role: Role;
  isConnected: boolean;
}

/**
 * Interface defining the room state structure
 */
interface RoomState {
  roomId: string | null;
  userRole: Role | null;
  userId: string | null;
  participants: Participant[];
}

/**
 * Initial state for room - no active room
 */
const initialState: RoomState = {
  roomId: null,
  userRole: null,
  userId: null,
  participants: []
};

/**
 * Room slice containing reducers to manage room state
 */
const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    /**
     * Updates the current room ID
     */
    roomIdUpdated(state, action: PayloadAction<string | null>) {
      state.roomId = action.payload;
    },
    /**
     * Sets the current user's role in the room
     */
    userRoleSet(state, action: PayloadAction<Role>) {
      state.userRole = action.payload;
    },
    /**
     * Sets the current user's ID
     */
    userIdSet(state, action: PayloadAction<string>) {
      state.userId = action.payload;
    },
    /**
     * Adds a new participant to the room if they don't already exist
     */
    participantJoined(state, action: PayloadAction<Participant>) {
      const exists = state.participants.some(p => p.id === action.payload.id);
      if (!exists) {
        state.participants.push(action.payload);
      }
    },
    /**
     * Removes a participant from the room
     */
    participantLeft(state, action: PayloadAction<string>) {
      state.participants = state.participants.filter(p => p.id !== action.payload);
    },
    /**
     * Updates a participant's connection status
     */
    participantConnectionStatusChanged(state, action: PayloadAction<{ id: string, isConnected: boolean }>) {
      const participant = state.participants.find(p => p.id === action.payload.id);
      if (participant) {
        participant.isConnected = action.payload.isConnected;
      }
    },
    /**
     * Resets the room state back to initial values
     */
    resetRoom(state) {
      state.roomId = null;
      state.participants = [];
    },
  },
});

export const {
  roomIdUpdated,
  userRoleSet,
  userIdSet,
  participantJoined,
  participantLeft,
  participantConnectionStatusChanged,
  resetRoom
} = roomSlice.actions;
export default roomSlice.reducer;
