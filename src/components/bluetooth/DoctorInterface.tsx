import React, { useEffect } from 'react';
import { useDoctorData } from '@/features/bluetooth/useDoctorData';
import { PeerConnection } from '@/features/room/rtc/peer/connection/peer-connection';

interface DoctorInterfaceProps {
  peerConnection?: PeerConnection;
}

export default function DoctorInterface({ peerConnection }: DoctorInterfaceProps) {
  const { doctorServices, receiveData } = useDoctorData();

  useEffect(() => {
    if (peerConnection?.isDataChannelAvailable()) {
      const manager = peerConnection.getDataChannelManager();
      manager.onMeasurement(receiveData);
      console.log('[Médecin] Abonnement à onMeasurement() effectué');
    }
  }, [peerConnection, receiveData]);

  return (
    <div className="p-4 border rounded-md space-y-4">
      <h2 className="font-bold text-lg">Mesures reçues</h2>
      {Object.entries(doctorServices).length === 0 ? (
        <p className="text-gray-500">Aucune mesure reçue pour le moment.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(doctorServices).map(([service, entry], index) => (
            <div key={index} className="border p-4 rounded">
              <h3 className="font-semibold mb-2">{service}</h3>
              <ul className="list-disc pl-5 space-y-1">
                {Object.entries(entry).map(([key, value]) => (
                  <li key={key}>
                    <strong>{key}</strong>: {String(value)}
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
