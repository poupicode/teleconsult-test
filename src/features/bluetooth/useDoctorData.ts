import { useState, useEffect } from "react";

type DoctorServices = {
  [serviceName: string]: Record<string, string | number>; // précision du type si possible
};

// Hook principal utilisé pour recevoir et stocker les mesures
export function useDoctorData() {
  // État principal contenant toutes les mesures organisées par service
  const [doctorServices, setDoctorServices] = useState<DoctorServices>({});
  // État temporaire utilisé pour stocker une nouvelle mesure reçue avant traitement
  const [newData, setNewData] = useState<object | null>(null);

  // Fonction appelée automatiquement par le système WebRTC quand une mesure arrive
  const receiveData = (rawDataReceived: any) => {
    console.log("[Médecin] Payload reçu :", rawDataReceived);
    setNewData(rawDataReceived); // on stocke directement le payload brut reçu (déjà filtré en amont)
  };

  // Fonction qui extrait le service (clé) et les mesures à partir du payload
  const processNewData = (currentData: object) => {
    const service = Object.keys(currentData)[0]; // ex: 'blood_pressure'
    const measures = (currentData as any)[service]; // ex: { systolique: 120, ... }

    // On ajoute ou remplace les mesures pour ce service dans le state principal
    setDoctorServices((prev) => ({
      ...prev,
      [service]: measures,
    }));
  };

  // À chaque fois que newData est mis à jour, on le traite immédiatement
  useEffect(() => {
    if (newData) {
      processNewData(newData);
      setNewData(null);
    }
  }, [newData]);

  return {
    doctorServices, //les mesures prêtes à être affichées
    receiveData,
  }; //la fonction à passer à onMeasurement()
}
