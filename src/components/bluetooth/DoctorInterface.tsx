import React, { useEffect } from 'react';
import { useDoctorData } from '@/features/bluetooth/useDoctorData';
import { PeerConnection } from '@/features/room/rtc/peer/connection/peer-connection';

// Props attendues : peerConnection est optionnelle
interface DoctorInterfaceProps {
  peerConnection?: PeerConnection;
}

export default function DoctorInterface({ peerConnection }: DoctorInterfaceProps) {
  // Hook personnalisé pour stocker les mesures reçues et fournir une fonction de réception
  const { doctorServices, receiveData } = useDoctorData();

  useEffect(() => {
    // Lorsque peerConnection est disponible, on attache la fonction de réception aux mesures entrantes
    if (peerConnection) {
      peerConnection.getDataChannelManager().onMeasurement(receiveData);
    }
  }, [peerConnection, receiveData]);
// Si la connexion WebRTC n'est pas encore établie, on affiche un message d'erreur
  if (!peerConnection) {
    return <p className="text-red-500">Connexion WebRTC non établie…</p>;
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Mesures reçues</h2>
      {Object.entries(doctorServices).length === 0 ? (
        <p className="text-gray-500">Aucune mesure reçue pour le moment.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(doctorServices).map(([service, entries], index) => (
            <div key={index} className="border p-4 rounded">
              <h3 className="font-semibold">{service}</h3>
              <ul className="list-disc pl-5">
                {entries.map((entry, i) => (
                  <li key={i}>
                    {Object.entries(entry).map(([key, value]) => (
                      <span key={key}>
                        <strong>{key}</strong>: {value}&nbsp;
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
