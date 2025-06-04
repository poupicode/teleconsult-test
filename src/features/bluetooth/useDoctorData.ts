import { useState, useEffect } from "react";

type DoctorServices = {
  [serviceName: string]: object;
};

export function useDoctorData() {
  const [doctorServices, setDoctorServices] = useState<DoctorServices>({});
  const [newData, setNewData] = useState<object | null>(null);

  const receiveData = (rawDataReceived: any) => {
  const payload = rawDataReceived.payload;
  if (!payload) return;
  console.log('[Médecin] Payload reçu :', payload);
  setNewData(payload); // ✅ on n’envoie QUE les données utiles à processNewData
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
