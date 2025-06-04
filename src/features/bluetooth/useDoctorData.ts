import { useState, useEffect } from "react";

type DoctorServices = {
  [serviceName: string]: Record<string, string | number>; // précision du type si possible
};

export function useDoctorData() {
  const [doctorServices, setDoctorServices] = useState<DoctorServices>({});
  const [newData, setNewData] = useState<object | null>(null);

  const receiveData = (rawDataReceived: any) => {
    const payload = rawDataReceived.payload;
    if (!payload) return;
    console.log('[Médecin] Payload reçu :', payload);
    setNewData(payload);
  };

  const processNewData = (currentData: object) => {
    const service = Object.keys(currentData)[0];
    const measures = (currentData as any)[service];

    setDoctorServices((prev) => ({
      ...prev,
      [service]: measures,
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
