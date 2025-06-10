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
  const [negotiationRole, setNegotiationRole] = useState<'polite' | 'impolite' | null>(null);

  // Reference to track the previously connected room
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

  // Explicitly disconnect the previous WebRTC connection when changing rooms
  useEffect(() => {
    // If the roomId has changed and there was a previous room
    if (previousRoomIdRef.current && previousRoomIdRef.current !== roomId) {
      // Clean up the old connection
      if (peerConnection) {
        console.log(`[ConsultationRoom] Room changed from ${previousRoomIdRef.current} to ${roomId}, disconnecting previous peer connection`);

        // Disable the current connection
        const disconnect = async () => {
          await peerConnection.disconnect();
          console.log('[ConsultationRoom] Previous peer connection disconnected');

          // Reset state after disconnection
          setPeerConnection(null);
          setConnectionStatus('disconnected');
          setRoomReady(false);
          setNegotiationRole(null);
        };

        disconnect();
      }
    }

    // Update the reference for the next render
    previousRoomIdRef.current = roomId;
  }, [roomId]);

  // Handle room connection/disconnection
  useEffect(() => {
    if (roomId && userId && userRole) {
      handleRoomConnection(roomId);
    } else if (!roomId && peerConnection) {
      peerConnection.disconnect();
      setPeerConnection(null);
      setConnectionStatus("disconnected");
      setRoomReady(false);
      setNegotiationRole(null);
    }
  }, [roomId, userId, userRole]);

  // Cleanup effect - only runs on component unmount
  useEffect(() => {
    return () => {
      if (peerConnection) {
        peerConnection.disconnect();
      }
    };
  }, []);

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
      console.log('[ConsultationRoom] Disconnecting existing peer connection before connecting to new room');

      // Disable all callbacks and current state before disconnecting
      setConnectionStatus('disconnecting');
      setRoomReady(false);
      setNegotiationRole(null);

      // Properly disconnect the existing connection
      await peerConnection.disconnect();
      setPeerConnection(null);

      // Slightly longer delay to ensure all disconnections are properly completed
      // and that Supabase channels are correctly closed
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      console.log(`[ConsultationRoom] Creating new peer connection for room: ${roomId}`);
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

        // Perfect Negotiation: if the room becomes ready and we are the polite peer,
        // wait a few moments for the impolite peer to have initialized the connection
        if (isReady) {
          const negotiationState = peer.getPerfectNegotiationState();
          const isPolite = negotiationState.isPolite;
          setNegotiationRole(isPolite ? 'polite' : 'impolite');

          if (isPolite) {
            console.log('[ConsultationRoom] 🤝 Room is ready and we are the polite peer (waits for offers), waiting for impolite peer to initialize...');

            // Small delay to ensure the impolite peer is ready to negotiate
            // Perfect Negotiation automatically handles who initiates the connection
            setTimeout(() => {
              console.log('[ConsultationRoom] 🤝 Polite peer is now ready to receive connection from impolite peer');
              // The impolite peer will detect our presence and automatically initiate the connection
              // via Perfect Negotiation - no manual intervention needed
            }, 1000);
          } else {
            console.log('[ConsultationRoom] 🚀 Room is ready and we are the impolite peer (initiates offers), Perfect Negotiation will handle connection initiation');
          }
        } else {
          setNegotiationRole(null);
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
