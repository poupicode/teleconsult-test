/**
 * User Slice
 * 
 * This file defines the Redux slice for managing user information.
 * It maintains the current user's data, such as ID, username, and role (patient or practitioner).
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Interface defining the user state structure
 */
interface UserState {
  id: string | null;
  username: string | null;
  user_kind: 'patient' | 'practitioner' | null;
}

/**
 * Initial state for the user - all fields are null by default
 */
const initialState: UserState = {
  id: null,
  username: null,
  user_kind: null,
};

/**
 * User slice containing reducers to manage user data
 */
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    /**
     * Sets the user data with validation for user_kind
     * @param state Current user state
     * @param action Action containing the new user information
     */
    setUser(state, action: PayloadAction<UserState>) {
      const { id, username, user_kind } = action.payload;

      if (user_kind !== 'patient' && user_kind !== 'practitioner') {
        console.warn(`Invalid user_kind received: ${user_kind}`);
        return state;
      }

      return { id, username, user_kind };
    },
    /**
     * Clears all user data, returning to initial state
     */
    clearUser() {
      return initialState;
    },
  },
});

export const { setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;