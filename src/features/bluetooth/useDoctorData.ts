import { useState, useEffect } from "react";

type DoctorServices = {
  [serviceName: string]: Array<object>;
};

export function useDoctorData() {
  const [doctorServices, setDoctorServices] = useState<DoctorServices>({});
  const [newData, setNewData] = useState<object | null>(null);

  // Appelé quand une nouvelle mesure arrive via WebRTC
  const receiveData = (rawDataReceived: object) => {
    console.log('[Médecin] Mesure reçue via WebRTC :', rawDataReceived); // 👈 LOG ICI
    setNewData(rawDataReceived);
  };

  // Ajoute la mesure dans l'état local (affichage uniquement, pas de persistance)
  const processNewData = (currentData: object) => {
    const service: string = Object.entries(currentData)[0][0];
    const measures: object = Object.entries(currentData)[0][1];

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

  return {
    doctorServices, // Pour affichage
    receiveData,     // À passer à dataChannelManager.onMeasurement()
  };
}
