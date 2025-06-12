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
interface ConnectedCard {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  service: string;
  deviceName: string;
  measurements: { name: string; data: string | number }[];
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

  const [mergedConnectedCards, setMergedConnectedCards] = useState<object>({});

  const transformConnectedCards = () => {
    // let tempConnectedCards = connectedCards.map(
    //   ({ service, measurements }) => ({ service, measurements })
    // );
  //   Object.fromEntries(
  // Object.entries(data).map(([key, arr]) => [key, Object.assign({}, ...arr)])
// );
    let tempConnectedCards = Object.fromEntries(
      connectedCards
        .map(({ service, measurements }) => ({ service, measurements }))
        .map(({ service, measurements }) => [service, measurements])
    );
    setMergedConnectedCards(tempConnectedCards);

    // setMergedConnectedCards(
    //   Object.fromEntries(data.map(({ nom, mesures }) => [nom, mesures]))
    // );
  };

  useEffect(() => {
    transformConnectedCards();
    console.log(
      `---------------------
      mergedConnectedCards
      ----------------------`,
      mergedConnectedCards
    );
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

  useEffect(() => {
    console.log(
      `------------
        connectedCards
        --------------`,
      connectedCards
    );
  }, [connectedCards]);

  // function transformConnectedCards(){
  //   connectedCards.map((service) => {
  //     service={[obj.nom]: Object.assign({}, ...obj.mesures)}
  //   })
  // }
  // setConnectedCardsFiltred()
  // connectedCards.map((service) => {
  //   // service = { [obj.nom]: Object.assign({}, ...obj.mesures) };
  //   console.log(`----------------------
  //     service
  //     --------------------------`, service)
  // });

  return (
    <div className="p-0 w-100">
      {status === "En attente..." && (
        <p className="pe-3 ps-2">Aucune mesure reçue pour le moment.</p>
      )}

      <div className="w-100 d-flex flex-wrap">
        {connectedCards.map((card) => (
          <div className="w-50 px-2">
            <ServiceCard
              key={`${card.device.id}-${card.service}`}
              service={card.service}
              measurements={card.measurements}
              deviceName={card.deviceName}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
