import React, { useEffect, useState, useRef, useCallback, use, useContext } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, store } from "@/app/store";
import { RoomSupabase } from "../../features/room/roomSupabase";
import { MediaStreamList, PeerConnection, Role } from "../../features/room/rtc/peer";
import {
  participantJoined,
  userIdSet,
  userRoleSet,
} from "../../features/room/roomSlice";
import { v4 as uuidv4 } from "uuid";
import { Alert, Badge, Button } from "react-bootstrap";

import DoctorRoomManager from "@/components/room/DoctorRoomManager";
import RoomList from "@/components/room/RoomList";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import MediaStreamsContext from "@/contexts/MediaStreamsContext";
import { StreamsByDevice, streamUpdated } from "@/features/streams/streamSlice";
import BluetoothServiceCard from "@/components/bluetooth/BluetoothServiceCard";

interface ConsultationRoomProps {
  onPeerConnectionReady?: (peerConnection: PeerConnection) => void;
  handleDisconnect: () => void;
  onCreateRoom: (fn: () => Promise<void>) => void;
  setConnectionStatus: (value: string) => void;
  connectionStatus: string;
}

export default function ConsultationRoom({
  onPeerConnectionReady,
  handleDisconnect,
  onCreateRoom,
  setConnectionStatus,
  connectionStatus,
}: ConsultationRoomProps) {
  const dispatch = useDispatch();

  const [mediaStreams, addMediaStreams] = useContext(MediaStreamsContext); // dans ton component
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

  // Etat pour voir si la salle est prête ou non (c'est-à-dire si on est dedans ou pas)
  const [roomReady, setRoomReady] = useState<boolean>(false);
  const [negotiationRole, setNegotiationRole] = useState<
    "polite" | "impolite" | null
  >(null);

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
        console.log(
          `[ConsultationRoom] Room changed from ${previousRoomIdRef.current} to ${roomId}, disconnecting previous peer connection`
        );

        // Disable the current connection
        const disconnect = async () => {
          await peerConnection.disconnect();
          console.log(
            "[ConsultationRoom] Previous peer connection disconnected"
          );

          // Reset state after disconnection
          setPeerConnection(null);
          setConnectionStatus("disconnected");
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
      console.log(
        "[ConsultationRoom] Disconnecting existing peer connection before connecting to new room"
      );

      // Disable all callbacks and current state before disconnecting
      setConnectionStatus("disconnecting");
      setRoomReady(false);
      setNegotiationRole(null);

      // Properly disconnect the existing connection
      await peerConnection.disconnect();
      setPeerConnection(null);

      // Slightly longer delay to ensure all disconnections are properly completed
      // and that Supabase channels are correctly closed
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    try {
      console.log(
        `[ConsultationRoom] Creating new peer connection for room: ${roomId}`
      );
      // Create a new peer connection
      const peer = new PeerConnection(roomId, userId, userRole);
      setPeerConnection(peer);

      // ✅ Injecte les streams AVANT connect()
      const localStreams: StreamsByDevice = store.getState().streams.local;
      for (const [device, streamDetails] of Object.entries(localStreams)) {
        const streamId = streamDetails.streamId;
        if (streamId && mediaStreams[streamId]) {
          peer.replaceDeviceStream(mediaStreams[streamId], device as keyof StreamsByDevice);
        } else {
          console.warn(`⚠️ Stream ${streamId} manquant dans mediaStreams`);
        }
      }

      // Ensuite seulement
      await peer.connect();

      // ✅ Setup callback pour recevoir les streams distants au fur et à mesure
      peer.onRemoteStream((device, stream) => {
        console.log(`[ConsultationRoom] Received remote stream for device: ${device}`, stream);

        // Add the stream to the mediaStreams context
        addMediaStreams({ [stream.id]: stream });

        // Add the stream to the redux store
        store.dispatch(
          streamUpdated({
            origin: "remote",
            deviceType: device as keyof StreamsByDevice,
            streamDetails: { streamId: stream.id },
          })
        );
      });

      // ❌ SUPPRIMER CETTE LIGNE (elle était appelée trop tôt)
      // addStreamsToStore(peer, addMediaStreams);


      // Handle connection state changes
      peer.onConnectionStateChange((state) => {
        setConnectionStatus(state);
      });      // Handle room ready state changes (when both patient and practitioner are present)
      peer.onRoomReady((isReady) => {
        setRoomReady(isReady);

        // Perfect Negotiation: if the room becomes ready and we are the polite peer,
        // wait a few moments for the impolite peer to have initialized the connection
        if (isReady) {
          // 🚨 CRITICAL FIX: Add delay to ensure role calculation is complete
          setTimeout(() => {
            const negotiationState = peer.getPerfectNegotiationState();
            const isPolite = negotiationState.isPolite;

            // 🚨 DIAGNOSTIC: Log role info for debugging
            console.log(`[ConsultationRoom] 🔍 ROLE DIAGNOSTIC - clientId: ${userId}, isPolite: ${isPolite}`);

            setNegotiationRole(isPolite ? "polite" : "impolite");

            if (isPolite) {
              console.log(
                "[ConsultationRoom] 🤝 Room is ready and we are the polite peer (waits for offers), waiting for impolite peer to initialize..."
              );

              // Small delay to ensure the impolite peer is ready to negotiate
              // Perfect Negotiation automatically handles who initiates the connection
              setTimeout(() => {
                console.log(
                  "[ConsultationRoom] 🤝 Polite peer is now ready to receive connection from impolite peer"
                );
                // The impolite peer will detect our presence and automatically initiate the connection
                // via Perfect Negotiation - no manual intervention needed
              }, 1000);
            } else {
              console.log(
                "[ConsultationRoom] 🚀 Room is ready and we are the impolite peer (initiates offers), Perfect Negotiation will handle connection initiation"
              );
            }
          }, 500); // Wait for role calculation to complete
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

  const allMeasuresStore = useSelector((state: RootState) => state.measure);

  useEffect(() => {
    console.log(`---------------------------------------------
      [ConsultationRoom] allMeasuresStore:
      -----------------------------------------`, allMeasuresStore);
  }
    , [allMeasuresStore]);

  // Stocker dans un state la fonction de connexion Bluetooth envoyé et remonté depuis BluetoothContext dans ConsultationRoom
  const [receiveHandleConnect, setReceiveHandleConnect] = React.useState<
    (() => Promise<void>) | null
  >(null);

  // Récupérer la fonction de connexion Bluetooth envoyé et remonté depuis BluetoothContext dans ConsultationRoom
  const getHandleConnect = React.useCallback((fn: () => Promise<void>) => {
    setReceiveHandleConnect(() => fn);
  }, []);

  // Créer la fonction au click qui va appeler la fonction de connexion BluetoothContext envoyé et remonté depuis DoctorRoomManager dans ConsultationRoom
  const handleConnect = React.useCallback(async () => {
    if (receiveHandleConnect) {
      receiveHandleConnect();
    } else {
      alert("Fonction pas encore reçue");
    }
  }, [receiveHandleConnect]);


  // Stocker dans un state la fonction de déconnexion Bluetooth envoyé et remonté depuis BluetoothContext dans ConsultationRoom
  const [receiveBluetoothStatus, setReceiveBluetoothStatus] =
    React.useState<String | null>(null);

  // Récupérer la fonction de déconnexion Bluetooth envoyé et remonté depuis BluetoothContext dans ConsultationRoom
  const getBluetoothStatus = (data: string) => {
    setReceiveBluetoothStatus(data);
  };

  return (
    <div className="position-relative h-100">
      <div className="w-100 m-0 h-100" style={{ overflow: "visible" }}>
        {!roomId ? (
          <div
            className="mt-3 w-100 px-3 pt-3"
            style={{
              overflowY: "auto",
              overflowX: "hidden",
              height: "calc(100% - 1em)",
            }}
          >
            {userKind === "practitioner" && (
              <div className="mb-3">
                <DoctorRoomManager onCreateRoom={onCreateRoom} />
              </div>
            )}
            {userKind === "patient" && (
              <div className="mb-3">
                <RoomList />
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="w-100 pe-3 ps-2">
              <Header variant="consultation">
                {userKind === "practitioner" ? (
                  // Si on est dans l'onglet "Consultation", qu'une salle a été choisie et que l'utilisateur est un praticien
                  // Afficher le titre "Salle de téléconsultation"
                  <h2 className="fs-3">Mesures reçues</h2>
                ) : (
                  // Si on est dans l'onglet "Consultation", qu'une salle a été choisie et que l'utilisateur est un patient
                  // Afficher les éléments de connexion bluetooth côté patient et les informations des appareils
                  <>
                    <Button
                      onClick={handleConnect}
                      className="primary-btn pe-3 ps-3"
                      disabled={connectionStatus !== "connected" && true}
                    >
                      Connecter un appareil
                    </Button>
                    <p
                      className="m-0"
                      style={{ maxWidth: "24em", fontSize: ".7em" }}
                    >
                      État : {receiveBluetoothStatus}
                    </p>
                  </>
                )}
              </Header>
            </div>
            <div
              style={{
                overflowY: "auto",
                height: "calc(100% - 9.5em)",
              }}
              className="pt-3 pe-2 ps-1"
            >
              {peerConnection && <BluetoothServiceCard
                role={userKind}
                peerConnection={peerConnection}
                onSendConnect={getHandleConnect}
                onSendStatus={getBluetoothStatus}
              />}
            </div>
            <Button
              className="secondary-btn position-absolute pe-3 ps-3"
              style={{ bottom: ".6em", left: ".6em" }}
              onClick={handleDisconnect}
            >
              Quitter la salle
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
