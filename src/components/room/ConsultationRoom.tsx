import React, { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/app/store";
import { RoomSupabase } from "../../features/room/roomSupabase";
import { PeerConnection, Role } from "../../features/room/rtc/peer";
import {
  participantJoined,
  userIdSet,
  userRoleSet,
} from "../../features/room/roomSlice";
import { v4 as uuidv4 } from "uuid";
import { Alert, Badge } from "react-bootstrap";
import RoomInformations from "./RoomInformations";
import DoctorRoomManager from "@/components/room/DoctorRoomManager";
import RoomList from "@/components/room/RoomList";
import { supabase } from "@/lib/supabaseClient";
import BluetoothContext from "@/components/bluetooth/BluetoothContext";
import DoctorInterface from "@/components/bluetooth/DoctorInterface";

interface ConsultationRoomProps {
  onPeerConnectionReady?: (peerConnection: PeerConnection) => void;
  handleDisconnect: () => void;
  onCreateRoom: (fn: () => Promise<void>) => void;
  onSendConnect: (fn: () => Promise<void>) => void;
}

export default function ConsultationRoom({
  onPeerConnectionReady,
  handleDisconnect,
  onCreateRoom,
  onSendConnect
}: ConsultationRoomProps) {
  const dispatch = useDispatch();

  // Récupérer les informations de l'utilisateur et de la salle (si il y a)
  const { roomId, userRole, userId } = useSelector(
    (state: RootState) => state.room
  );

  // Récupérer le rôle de l'utilisateur
  const userKind = useSelector((state: RootState) => state.user.user_kind);

  // Gestion de la connexion
  const [peerConnection, setPeerConnection] = useState<PeerConnection | null>(
    null
  );
  const [connectionStatus, setConnectionStatus] =
    useState<string>("disconnected");
  
  // Etat pour voir si la salle est prête ou non (c'est-à-dire si on est dedans ou pas)
  const [roomReady, setRoomReady] = useState<boolean>(false);

  // Référence pour suivre la salle précédemment connectée
  const previousRoomIdRef = useRef<string | null>(null);

  // Générer un id d'utilisateir s'il y en a pas
  useEffect(() => {
    if (!userId) {
      const newUserId = uuidv4();
      dispatch(userIdSet(newUserId));
    }

    // Définir le rôle de l'utilisateur dans Role en fonction de user kind
    if (userKind && !userRole) {
      const role =
        userKind === "practitioner" ? Role.PRACTITIONER : Role.PATIENT;
      dispatch(userRoleSet(role));
    }
  }, [userId, userRole, userKind, dispatch]);

  // Déconnecter explicitement la connexion WebRTC précédente lors d'un changement de salle
  useEffect(() => {
    // Si la roomId a changé et qu'il y avait une salle précédente
    if (previousRoomIdRef.current && previousRoomIdRef.current !== roomId) {
      // Nettoyer l'ancienne connexion
      if (peerConnection) {
        peerConnection.disconnect();
        setPeerConnection(null);
        setConnectionStatus("disconnected");
        setRoomReady(false);
      }
    }

    // Mettre à jour la référence pour le prochain rendu
    previousRoomIdRef.current = roomId;
  }, [roomId]);

  // Handle room connection/disconnection
  useEffect(() => {
    let isActive = true; // Flag pour gérer le nettoyage asynchrone

    if (roomId && userId && userRole) {
      handleRoomConnection(roomId);
    } else if (!roomId && peerConnection) {
      peerConnection.disconnect();
      setPeerConnection(null);
      setConnectionStatus("disconnected");
      setRoomReady(false);
    }

    return () => {
      isActive = false;
      if (peerConnection) {
        peerConnection.disconnect();
      }
    };
  }, [roomId, userId, userRole]);

  // Expose peerConnection to parent component when it changes
  useEffect(() => {
    if (peerConnection && onPeerConnectionReady) {
      onPeerConnectionReady(peerConnection);
    }
  }, [peerConnection, onPeerConnectionReady]);

  const handleRoomConnection = async (roomId: string) => {
    if (!userId || !userRole) {
      return;
    }

    // Clean up previous connection if it exists
    if (peerConnection) {
      peerConnection.disconnect();
      setPeerConnection(null);
    }

    try {
      // Create a new peer connection
      const peer = new PeerConnection(roomId, userId, userRole);
      setPeerConnection(peer);

      // Handle connection state changes
      peer.onConnectionStateChange((state) => {
        setConnectionStatus(state);
      });

      // Handle room ready state changes (when both patient and practitioner are present)
      peer.onRoomReady((isReady) => {
        setRoomReady(isReady);

        // Optimisation pour les patients: si la salle devient prête et que l'utilisateur est un patient,
        // attendons quelques instants que le praticien ait bien réinitialisé sa connexion
        if (isReady && userRole === Role.PATIENT) {
          console.log(
            "[ConsultationRoom] Room is ready and we are the patient, waiting for practitioner to initialize..."
          );

          // Petit délai pour s'assurer que le praticien est prêt à négocier
          // Nous n'avons pas besoin de reconnecter le service de signalisation ici,
          // car cela pourrait créer une boucle infinie
          setTimeout(() => {
            console.log(
              "[ConsultationRoom] Patient is now ready to receive connection from practitioner"
            );
            // Le praticien va détecter notre présence naturellement,
            // pas besoin de forcer une reconnexion qui pourrait causer une boucle
          }, 1000);
        }
      });

      // Connect signaling
      await peer.connect();

      // Add the participant to the store
      dispatch(
        participantJoined({
          id: userId,
          role: userRole,
          isConnected: true,
        })
      );
    } catch (error) {
      console.error("Error setting up WebRTC:", error);
    }
  };

  return (
    <div
      className="top-0 position-absolute h-100"
      style={{
        width: "100%",
        flex: "0 0 78%",
        maxWidth: "78%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          marginTop: "7.5em",
          overflowY: "auto",
          height: roomId ? "60%" : "calc(100% - 7.5em)",
        }}
        className="p-4 ps-3 pe-3"
      >
        {!roomId ? (
          // Remplacer et mettre ici l'affichage/interface de création de salle
          // ou de sélection de salle
          <div>
            {/* <Alert variant="info">
              Veuillez sélectionner ou créer une salle pour démarrer une
              consultation.
            </Alert> */}
            {/* RoomBrowser pour le praticien */}
            {userKind === "practitioner" && (
              <div className="mb-3">
                <DoctorRoomManager onCreateRoom={onCreateRoom} />
              </div>
            )}
            {/* RoomList pour les patients */}
            {userKind === "patient" && (
              <div className="mb-3">
                <RoomList />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Ici, la barre d'informations de la salle de consultation (en bas de l'écran et qui est en position absolute) */}
            <RoomInformations
              roomReady={roomReady}
              userKind={userKind}
              handleDisconnect={handleDisconnect}
              roomId={roomId}
              connectionStatus={connectionStatus}
            />
            {/* Mettre ici l'affichage des données */}
            {/* Composant de gestion des données Bluetooth */}
            {userKind === "patient" && peerConnection && (
              <BluetoothContext peerConnection={peerConnection} onSendConnect={onSendConnect} />
            )}
            {userKind === "practitioner" && peerConnection && (
              <DoctorInterface peerConnection={peerConnection} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
