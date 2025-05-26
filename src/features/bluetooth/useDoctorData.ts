import { useState, useEffect } from "react";

type DoctorServices = {
  [serviceName: string]: Array<object>;
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

    setDoctorServices((prev) => {
      const updated = { ...prev };
      if (!updated[service]) updated[service] = [];
      updated[service].push(measures);
      return updated;
    });
  };

  useEffect(() => {
    if (newData) {
      processNewData(newData);
      setNewData(null);
    }
  }, [newData]);

  return { doctorServices, receiveData };
}