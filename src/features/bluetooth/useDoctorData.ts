import { useState, useEffect } from "react";

type DoctorServices = {
  [serviceName: string]: object;
};

export function useDoctorData() {
  const [doctorServices, setDoctorServices] = useState<DoctorServices>({});
  const [newData, setNewData] = useState<object | null>(null);

  const receiveData = (rawDataReceived: object) => {
    console.log('[Médecin] Mesure reçue :', rawDataReceived);
    setNewData(rawDataReceived);
  };

  const processNewData = (currentData: object) => {
    const service = Object.keys(currentData)[0];
    const measures = (currentData as any)[service];

    setDoctorServices((prev) => ({
      ...prev,
      [service]: measures, // ❗️écrase les anciennes données pour n’afficher que la dernière
    }));
  };

  useEffect(() => {
    if (newData) {
      processNewData(newData);
      setNewData(null);
    }
  }, [newData]);

  return { doctorServices, receiveData };
}
