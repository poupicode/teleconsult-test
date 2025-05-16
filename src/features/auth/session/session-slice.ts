/**
 * Session Slice
 * 
 * This file defines the Redux slice for managing authentication session state.
 * It tracks whether a user is currently authenticated in the application.
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Interface defining the session state structure
 */
interface SessionState {
  isAuthenticated: boolean;
}

/**
 * Initial state for the session - user is not authenticated by default
 */
const initialState: SessionState = {
  isAuthenticated: false,
};

/**
 * Session slice containing reducers to manage authentication state
 */
const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    /**
     * Sets the authentication status
     * @param state Current session state
     * @param action Action containing the new authentication status
     */
    setAuthenticated(state, action: PayloadAction<boolean>) {
      state.isAuthenticated = action.payload;
    },
  },
});

export const { setAuthenticated } = sessionSlice.actions;
export default sessionSlice.reducer;