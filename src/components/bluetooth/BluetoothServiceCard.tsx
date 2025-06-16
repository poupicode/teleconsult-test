import React, { useRef, useEffect, useState } from "react";
import ServiceCard from "./ServiceCard";
import { useBluetooth } from "@/features/bluetooth/useBluetooth";
import { useDoctorData } from "@/features/bluetooth/useDoctorData";
import { PeerConnection } from "@/features/room/rtc/peer/connection/peer-connection";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/app/store";

interface Props {
  role: "practitioner" | "patient" | null;
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
  // Récupération du store Redux
  // pour les mesures et les services
  const dispatch = useDispatch();
  const allMeasuresStore = useSelector((state: RootState) => state.measure);

  // Médecin : récupère les données via WebRTC
  useDoctorData({ dispatch, role, peerConnection });

  // Patient : utilise le hook Bluetooth pour gérer la connexion et le statut
  const { status, connect } = useBluetooth({
    peerConnection,
    dispatch,
    allMeasuresStore,
  });

  // Envoie les le statut et la fonction de connexion au parent
  useEffect(() => {
    return () => {
      if (role === "patient") {
        onSendConnect?.(connect);
        onSendStatus?.(status);
      }
    };
  }, [connect, status, onSendConnect, onSendStatus, role]);

  // Log des mesures reçues pour le debug
  useEffect(() => {
    console.log("[BluetoothServiceCard] allMeasuresStore:", allMeasuresStore);
  }, [allMeasuresStore]);

  // État pour gérer l'affichage de l'historique des mesures
  // pour chaque service
  const [openHistoryService, setOpenHistoryService] = useState<string | null>(
    null
  );

  return (
    <div className="p-0 pb-2 w-100">
      {/* Affichage des services Bluetooth */}
      {Object.keys(allMeasuresStore).length === 0 ? (
        <p className="pe-3 ps-2">Aucune mesure reçue pour le moment.</p>
      ) : (
        <div className="w-100 d-flex flex-wrap">
          {/* Affichage des cartes de service */}
          {Object.entries(allMeasuresStore).map(
            ([service, measurements], index) => (
              <div className="w-50 px-2" key={`${service}-${index}`}>
                <ServiceCard
                  service={service}
                  measurements={measurements}
                  showHistory={openHistoryService === service}
                  onToggleHistory={() =>
                    setOpenHistoryService(
                      openHistoryService === service ? null : service
                    )
                  }
                />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
