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

  // Transformer les données côté infirmière pour avoir la même structure que ceux côté médecin
  const [mergedConnectedCards, setMergedConnectedCards] =
    useState<object>({});

  const transformConnectedCards = () => {
    let tempConnectedCards = Object.fromEntries(
      connectedCards.map(({ service, deviceName, measurements }) => {
        const merged = Object.assign(
          {},
          ...measurements.map(({ name, data }) => ({ [name]: data }))
        );
        // Ajout du nom de l'appareil à la fin des mesures du services
        return [service, { ...merged, deviceName }];
      })
    );
    setMergedConnectedCards(tempConnectedCards);
  };

  useEffect(() => {
    transformConnectedCards();
  }, [connectedCards]);

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
    <div className="p-0 w-100">
      {status === "En attente..." && (
        <p className="pe-3 ps-2">Aucune mesure reçue pour le moment.</p>
      )}

      <div className="w-100 d-flex flex-wrap">
        {/* Pour chaque service, créer une card */}
        {Object.entries(mergedConnectedCards).map(([service, entry], index) => (
          <div className="w-50 px-2">
            {/* Transmission du nom du service et des mesures en objet */}
            <ServiceCard
              key={`${service}-${index}`}
              service={service}
              measurements={entry}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
