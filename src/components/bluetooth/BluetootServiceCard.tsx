import React, { useEffect, useState } from "react";
import ServiceCard from "./ServiceCard";
import { useBluetooth } from "@/features/bluetooth/useBluetooth";
import { useDoctorData } from "@/features/bluetooth/useDoctorData";
import { PeerConnection } from "@/features/room/rtc/peer/connection/peer-connection";

interface Props {
  role: "doctor" | "patient";
  peerConnection?: PeerConnection;
  onSendConnect?: (fn: () => Promise<void>) => void;
  onSendStatus?: (status: string) => void;
}

export default function BluetoothServiceCard({
  role,
  peerConnection,
  onSendConnect,
  onSendStatus,
}: Props) {
  const [mergedConnectedCards, setMergedConnectedCards] = useState<object>({});

  // Médecin : récupère les données via WebRTC
  const { doctorServices, receiveData } = useDoctorData();

  // Infirmier : capte les données via Bluetooth
  const { status, connectedCards, connect } = useBluetooth({
    onMeasurement: (payload) => {
      if (!peerConnection?.isDataChannelAvailable()) return;
      const manager = peerConnection.getDataChannelManager();
      manager.sendMeasurement(payload);
    },
  });

  useEffect(() => {
    if (role === "patient") {
      onSendConnect?.(connect);
      onSendStatus?.(status);
    }
  }, [connect, status, onSendConnect, onSendStatus]);

  useEffect(() => {
    if (role === "patient") {
      const temp = Object.fromEntries(
        connectedCards.map(({ service, deviceName, measurements }) => {
          const merged = Object.assign(
            {},
            ...measurements.map(({ name, data }) => ({ [name]: data }))
          );
          return [service, { ...merged, deviceName }];
        })
      );
      setMergedConnectedCards(temp);
    }
  }, [connectedCards]);

  useEffect(() => {
    if (role === "doctor" && peerConnection?.isDataChannelAvailable()) {
      const manager = peerConnection.getDataChannelManager();
      manager.onMeasurement(receiveData);
    }
  }, [peerConnection, receiveData, role]);

  const displayCards =
    role === "doctor" ? doctorServices : mergedConnectedCards;

  return (
    <div className="p-0 w-100">
      {Object.entries(displayCards).length === 0 ? (
        <p className="pe-3 ps-2">Aucune mesure reçue pour le moment.</p>
      ) : (
        <div className="w-100 d-flex flex-wrap">
          {Object.entries(displayCards).map(([service, entry], index) => (
            <div className="w-50 px-2" key={`${service}-${index}`}>
              <ServiceCard service={service} measurements={entry} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
