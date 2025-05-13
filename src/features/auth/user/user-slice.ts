import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
  id: string | null;
  username: string | null;
  user_kind: 'patient' | 'practitioner' | null;
}

const initialState: UserState = {
  id: null,
  username: null,
  user_kind: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<UserState>) {
      const { id, username, user_kind } = action.payload;

      if (user_kind !== 'patient' && user_kind !== 'practitioner') {
        console.warn(`Invalid user_kind received: ${user_kind}`);
        return state;
      }

      return { id, username, user_kind };
    },
    clearUser() {
      return initialState;
    },
  },
});

export const { setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;