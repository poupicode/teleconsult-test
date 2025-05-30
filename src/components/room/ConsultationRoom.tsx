import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/app/store';
import { RoomSupabase } from '../../features/room/roomSupabase';
import { PeerConnection, Role } from '../../features/room/rtc/peer';
import { participantJoined, userIdSet, userRoleSet } from '../../features/room/roomSlice';
import { v4 as uuidv4 } from 'uuid';
import { Alert, Badge } from 'react-bootstrap';

interface ConsultationRoomProps {
  onPeerConnectionReady?: (peerConnection: PeerConnection) => void;
}

export default function ConsultationRoom({ onPeerConnectionReady }: ConsultationRoomProps) {
  const dispatch = useDispatch();
  const { roomId, userRole, userId } = useSelector((state: RootState) => state.room);
  const userKind = useSelector((state: RootState) => state.user.user_kind);

  const [peerConnection, setPeerConnection] = useState<PeerConnection | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [roomReady, setRoomReady] = useState<boolean>(false);

  // Référence pour suivre la salle précédemment connectée
  const previousRoomIdRef = useRef<string | null>(null);

  // Generate a user ID if none exists
  useEffect(() => {
    if (!userId) {
      const newUserId = uuidv4();
      dispatch(userIdSet(newUserId));
    }

    // Set user role based on user kind
    if (userKind && !userRole) {
      const role = userKind === 'practitioner' ? Role.PRACTITIONER : Role.PATIENT;
      dispatch(userRoleSet(role));
    }
  }, [userId, userRole, userKind, dispatch]);

  // Déconnecter explicitement la connexion WebRTC précédente lors d'un changement de salle
  useEffect(() => {
    // Si la roomId a changé et qu'il y avait une salle précédente
    if (previousRoomIdRef.current && previousRoomIdRef.current !== roomId) {
      // Nettoyer l'ancienne connexion
      if (peerConnection) {
        console.log(`[ConsultationRoom] Room changed from ${previousRoomIdRef.current} to ${roomId}, disconnecting previous peer connection`);

        // Désactiver la connexion en cours
        const disconnect = async () => {
          await peerConnection.disconnect();
          console.log('[ConsultationRoom] Previous peer connection disconnected');

          // Réinitialiser l'état après la déconnexion
          setPeerConnection(null);
          setConnectionStatus('disconnected');
          setRoomReady(false);
        };

        disconnect();
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
      setConnectionStatus('disconnected');
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
      console.log('[ConsultationRoom] Disconnecting existing peer connection before connecting to new room');

      // Désactiver tous les callbacks et l'état actuel avant de déconnecter
      setConnectionStatus('disconnecting');
      setRoomReady(false);

      // Déconnecter proprement la connexion existante
      await peerConnection.disconnect();
      setPeerConnection(null);

      // Petit délai plus long pour s'assurer que toutes les déconnexions sont bien effectuées
      // et que les canaux Supabase sont correctement fermés
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

        // Optimisation pour les patients: si la salle devient prête et que l'utilisateur est un patient,
        // attendons quelques instants que le praticien ait bien réinitialisé sa connexion
        if (isReady && userRole === Role.PATIENT) {
          console.log('[ConsultationRoom] Room is ready and we are the patient, waiting for practitioner to initialize...');

          // Petit délai pour s'assurer que le praticien est prêt à négocier
          // Nous n'avons pas besoin de reconnecter le service de signalisation ici,
          // car cela pourrait créer une boucle infinie
          setTimeout(() => {
            console.log('[ConsultationRoom] Patient is now ready to receive connection from practitioner');
            // Le praticien va détecter notre présence naturellement, 
            // pas besoin de forcer une reconnexion qui pourrait causer une boucle
          }, 1000);
        }
      });

      // Connect signaling
      await peer.connect();

      // Add the participant to the store
      dispatch(participantJoined({
        id: userId,
        role: userRole,
        isConnected: true
      }));

    } catch (error) {
      console.error('Error setting up WebRTC:', error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="mb-4">Consultation Room</h2>

      {!roomId ? (
        <Alert variant="info">
          Veuillez sélectionner ou créer une salle pour démarrer une consultation.
        </Alert>
      ) : (
        <>
          <Alert variant={connectionStatus === 'connected' ? 'success' :
            connectionStatus === 'connecting' ? 'warning' : 'danger'}>
            État de la connexion: <strong>{connectionStatus}</strong>
            {roomReady && (
              <Badge bg="success" className="ms-2">
                Salle prête ({userRole === Role.PRACTITIONER ? 'Patient connecté' : 'Praticien connecté'})
              </Badge>
            )}
            {!roomReady && (
              <Badge bg="warning" className="ms-2">
                En attente {userRole === Role.PRACTITIONER ? 'du patient' : 'du praticien'}
              </Badge>
            )}
          </Alert>
        </>
      )}
    </div>
  );
}