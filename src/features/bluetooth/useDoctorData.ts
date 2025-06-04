import { useState, useEffect } from "react";

type DoctorServices = {
  [serviceName: string]: object; // plus `object[]`
};

export function useDoctorData() {
  const [doctorServices, setDoctorServices] = useState<DoctorServices>({});
  const [newData, setNewData] = useState<object | null>(null);

  // Appelé quand une nouvelle mesure arrive via WebRTC
const receiveData = (rawDataReceived: any) => {
  const payload = rawDataReceived.payload;
  if (!payload) return;
  console.log('[Médecin] Payload reçu :', payload);
  setNewData(payload); // ✅ on n'envoie que le contenu utile
};


  // Ajoute la mesure dans l'état local (affichage uniquement, pas de persistance)
  const processNewData = (currentData: object) => {
    const service: string = Object.entries(currentData)[0][0];
    const measures: object = Object.entries(currentData)[0][1];

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

  return {
    doctorServices, // Pour affichage
    receiveData,     // À passer à dataChannelManager.onMeasurement()
  };
}
