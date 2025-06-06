import { readSfloat16, readIEEE11073Float, readDateTime } from "./parsers";

export interface DeviceType {
  [service: string]: {
    [characteristic: string]: {
      decoder: (data: DataView, offset: number) => number;
      [field: string]: any;
    };
  };
}

const deviceType: DeviceType = {
  blood_pressure: {
    blood_pressure_measurement: {
      decoder: readSfloat16,
      systolic: {
        name: "Systolique (mmHg)",
        value: 1,
      },
      diastolic: {
        name: "Diastolique (mmHg)",
        value: 3,
      },
      pulseRatePresent: {
        name: "Fréquence cardiaque (bpm)",
        data: 0b00000100,
        offset: 14, 
      },
      date: {
        name: "Date de la mesure",
        offset: 7,
        decoder: readDateTime,
      },
    },
  },

  health_thermometer: {
    temperature_measurement: {
      decoder: readIEEE11073Float,
      temperature: {
        name: "Température (°C)",
        value: 1,
      },
      date: {
        name: "Date de la mesure",
        offset: 5,
        decoder: readDateTime,
      },
    },
  },

  //Pour autres instruments, ajouter ici le service
};

export default deviceType;
