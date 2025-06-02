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
 * Load persisted room state from localStorage
 */
const loadPersistedRoomState = (): RoomState => {
  try {
    const persistedState = localStorage.getItem('roomState');
    if (persistedState) {
      const parsed = JSON.parse(persistedState);
      console.log('[RoomSlice] Loaded persisted room state:', parsed);
      return parsed;
    }
  } catch (error) {
    console.warn('[RoomSlice] Failed to load persisted room state:', error);
  }
  
  return {
    roomId: null,
    userRole: null,
    userId: null,
    participants: []
  };
};

/**
 * Save room state to localStorage
 */
const saveRoomState = (state: RoomState) => {
  try {
    // Only save if there's an active room
    if (state.roomId) {
      localStorage.setItem('roomState', JSON.stringify(state));
      console.log('[RoomSlice] Saved room state to localStorage:', state);
    } else {
      // Clear localStorage if no active room
      localStorage.removeItem('roomState');
      console.log('[RoomSlice] Cleared room state from localStorage');
    }
  } catch (error) {
    console.warn('[RoomSlice] Failed to save room state:', error);
  }
};

/**
 * Initial state for room - load from localStorage if available
 */
const initialState: RoomState = loadPersistedRoomState();

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
      saveRoomState(state);
    },
    /**
     * Sets the current user's role in the room
     */
    userRoleSet(state, action: PayloadAction<Role>) {
      state.userRole = action.payload;
      saveRoomState(state);
    },
    /**
     * Sets the current user's ID
     */
    userIdSet(state, action: PayloadAction<string>) {
      state.userId = action.payload;
      saveRoomState(state);
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
      saveRoomState(state);
    },

    /**
     * Nettoyer les ressources associées à une salle lors d'une déconnexion WebRTC
     */
    cleanupRoomState(state, action: PayloadAction<{ roomId: string }>) {
      if (state.roomId === action.payload.roomId) {
        console.log(`[RoomSlice] Cleaning up room state for room: ${action.payload.roomId}`);
        state.participants = [];
      }
    },

    /**
     * Réinitialiser l'état des participants lorsque la connexion est réinitialisée
     */
    resetParticipantsConnection(state, action: PayloadAction<{ roomId: string }>) {
      if (state.roomId === action.payload.roomId) {
        console.log(`[RoomSlice] Resetting participants connection states for room: ${action.payload.roomId}`);
        // Garder les participants mais réinitialiser leur état de connexion
        state.participants = state.participants.map(p => ({ ...p, isConnected: false }));
      }
    },

    /**
     * Valide et met à jour l'état de la room après un reload
     * Vérifie que la room existe toujours dans la base de données
     */
    validatePersistedRoom(state, action: PayloadAction<{ roomExists: boolean }>) {
      if (!action.payload.roomExists && state.roomId) {
        console.log(`[RoomSlice] Persisted room ${state.roomId} no longer exists, clearing state`);
        state.roomId = null;
        state.participants = [];
        saveRoomState(state);
      }
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
  resetRoom,
  cleanupRoomState,
  resetParticipantsConnection,
  validatePersistedRoom
} = roomSlice.actions;
export default roomSlice.reducer;
