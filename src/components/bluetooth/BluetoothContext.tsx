import { useBluetooth } from "../../features/bluetooth/useBluetooth";
import ServiceCard from "./ServiceCard";
import ButtonConnexionApp from "./ButtonConnexionApp";
import { PeerConnection } from "@/features/room/rtc/peer/connection/peer-connection";
import React, { useState, useEffect } from "react";

// Définition des props attendues pour le composant : un objet PeerConnection
interface BluetoothContextProps {
  peerConnection: PeerConnection;
  onSendConnect: (fn: () => Promise<void>) => void;
  onSendStatus: (status: string) => void;
}

export default function BluetoothContext({
  peerConnection,
  onSendConnect,
  onSendStatus,
}: BluetoothContextProps) {
  // Initialisation du hook Bluetooth avec une fonction de rappel "onMeasurement"
  // Cette fonction est appelée à chaque nouvelle mesure reçue via Bluetooth
  const { status, connectedCards, connect } = useBluetooth({
    onMeasurement: (payload) => {
      // Vérifie que le peerConnection est disponible et que le canal de données est prêt
      if (!peerConnection || !peerConnection.isDataChannelAvailable()) return;
      // Récupère le gestionnaire du dataChannel et envoie la mesure au "docteur"
      const manager = peerConnection.getDataChannelManager();
      manager.sendMeasurement(payload);
    },
  });

  // Envoyer la fonction de connexion avec un appareil Bluetooth à l'élément parent
  // Car le bouton de connexion avec un appareil bluetooth est dans ConsultationPage mais il faut garder la logique ici pour mettre à jour l'affichage correctement des données
  React.useEffect(() => {
    if (onSendConnect) {
      onSendConnect(connect);
    }
  }, [onSendConnect, connect]);

  React.useEffect(() => {
    if (onSendStatus) {
      onSendStatus(status);
    }
  }, [onSendStatus, status]);


  return (
    <div className="p-4 border rounded-md space-y-4">
      <p className="text-gray-500">Aucune mesure reçue pour le moment.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connectedCards.map((card) => (
          <ServiceCard
            key={`${card.device.id}-${card.service}`}
            service={card.service}
            measurements={card.measurements}
            deviceName={card.deviceName}
          />
        ))}
      </div>
    </div>
  );
}
