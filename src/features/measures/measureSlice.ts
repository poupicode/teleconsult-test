import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AllServices {
  [deviceType: string]: {
    [measures: string]: string;
  }[];
}

const initialState: AllServices = {};

const measureSlice = createSlice({
  name: "measure",
  initialState,
  reducers: {
    setMeasure(
      state,
      action: PayloadAction<{
        [deviceType: string]: { [key: string]: string | number };
      }>
    ) {
      const deviceType = Object.keys(action.payload)[0]; // e.g., "blood_pressure"
      const rawMeasure = action.payload[deviceType];

      const formattedMeasure: { [key: string]: string } = {};
      for (const key in rawMeasure) {
        formattedMeasure[key] = String(rawMeasure[key]);
      }

      if (state[deviceType]) {
        state[deviceType].push(formattedMeasure);
      } else {
        state[deviceType] = [formattedMeasure];
      }
    },
  },
});

export const { setMeasure } = measureSlice.actions;
export default measureSlice.reducer;

