import React, { useEffect } from 'react';
import { useDoctorData } from '@/features/bluetooth/useDoctorData';
import { PeerConnection } from '@/features/room/rtc/peer/connection/peer-connection';

interface DoctorInterfaceProps {
  peerConnection?: PeerConnection;
}

export default function DoctorInterface({ peerConnection }: DoctorInterfaceProps) {
  const { doctorServices, receiveData } = useDoctorData();

  useEffect(() => {
    if (peerConnection) {
      peerConnection.getDataChannelManager().onMeasurement(receiveData);
    }
  }, [peerConnection, receiveData]);

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
          {Object.entries(doctorServices).map(([service, entry], index) => {
            const innerData = Object.values(entry)[0]; // <- récupère l'objet ex: blood_pressure

            return (
              <div key={index} className="border p-4 rounded">
                <h3 className="font-semibold">{service}</h3>
                <ul className="list-disc pl-5">
                  {innerData && typeof innerData === 'object' ? (
                    Object.entries(innerData).map(([key, value]) => (
                      <li key={key}>
                        <strong>{key}</strong>: {String(value)}
                      </li>
                    ))
                  ) : (
                    <li>Données non valides</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
