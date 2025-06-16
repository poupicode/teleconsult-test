import React, { useEffect } from "react";
import { useDoctorData } from "@/features/bluetooth/useDoctorData";
import { PeerConnection } from "@/features/room/rtc/peer/connection/peer-connection";
import ServiceCard from "./ServiceCard";

// Props attendues : peerConnection est optionnelle
interface DoctorInterfaceProps {
  peerConnection?: PeerConnection; // La connexion WebRTC transmise en props
}

export default function DoctorInterface({
  peerConnection,
}: DoctorInterfaceProps) {
  const { doctorServices, receiveData } = useDoctorData(); // Pour stocker et traiter les mesures reçues

  useEffect(()=>{
      console.log(`Données du store côté patient`, doctorServices)
    },[doctorServices])

  useEffect(() => {
    if (!peerConnection) return; // Sécurité : on quitte si la connexion WebRTC n’est pas encore disponible

    // Fonction qui essaie d’enregistrer le callback de réception des données
    const tryRegister = () => {
      // Vérifie si le dataChannel est prêt
      if (peerConnection.isDataChannelAvailable()) {
        // Récupère le gestionnaire de canal de données
        const manager = peerConnection.getDataChannelManager();
        // Enregistre la fonction receiveData pour traiter les messages de type "measurement"
        manager.onMeasurement(receiveData);
      } else {
        // Si le canal n’est pas encore prêt, on retente dans 500ms
        setTimeout(tryRegister, 500);
      }
    };

    // Lance la tentative d’enregistrement du callback
    tryRegister();
  }, [peerConnection, receiveData]); // Se relance uniquement si peerConnection ou receiveData changent

  return (
    <div>
      {Object.entries(doctorServices).length === 0 ? (
        <p className="pe-3 ps-2">Aucune mesure reçue pour le moment.</p>
      ) : (
        <div className="w-100 d-flex flex-wrap">
          {/* {Object.entries(doctorServices).map(([service, entry], index) => (
            <div className="w-50 px-2">
              <ServiceCard
                key={`${service}-${index}`}
                service={service}
                measurements={entry}
              />
            </div>
          ))} */}
        </div>
      )}
    </div>
  );
}
