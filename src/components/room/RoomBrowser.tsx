import React, { useEffect, useState } from 'react';
import { Button, ListGroup, Badge } from 'react-bootstrap';
import { Room, RoomSupabase } from '../../features/room/roomSupabase';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { roomIdUpdated } from '@/features/room/roomSlice';

interface RoomBrowserProps {
  isVisible?: boolean;
}

export default function RoomBrowser({ isVisible = true }: RoomBrowserProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const currentRoomId = useSelector((state: RootState) => state.room.roomId);
  const dispatch = useDispatch();

  const fetchRooms = async () => {
    const { data, error } = await RoomSupabase.getRooms();
    if (error) {
      console.error('Erreur de récupération des rooms:', error);
    } else {
      setRooms(data || []);
    }
  };

  // Charger les rooms au montage initial et configurer l'abonnement aux changements
  useEffect(() => {
    // Charger les rooms immédiatement
    fetchRooms();

    // Configurer un abonnement aux changements dans la table des rooms
    const roomsSubscription = RoomSupabase.subscribeToRooms((payload) => {
      console.log('Changement détecté dans les rooms:', payload);
      fetchRooms(); // Recharger les rooms quand il y a un changement
    });

    // Nettoyage de l'abonnement à la destruction du composant
    return () => {
      if (roomsSubscription) {
        roomsSubscription.unsubscribe();
      }
    };
  }, []);

  // Effet additionnel pour recharger les rooms quand le composant devient visible
  useEffect(() => {
    // La variable isVisible serait passée comme prop depuis ConsultationPage
    // pour indiquer si le composant est déplié/visible
    if (isVisible && document.visibilityState === 'visible') {
      fetchRooms();
    }
  }, [isVisible, document.visibilityState]);

  const handleCreateRoom = async () => {
    // Création d'une salle avec un nom généré automatiquement
    const room = await RoomSupabase.createRoom();
    if (room) {
      fetchRooms();
      dispatch(roomIdUpdated(room.id));
    }
  };

  const handleDeleteAllRooms = async () => {
    await RoomSupabase.deleteAllRooms();
    fetchRooms();
    // Si on est connecté à une room qui vient d'être supprimée, on se déconnecte
    if (currentRoomId) {
      dispatch(roomIdUpdated(null));
    }
  };

  const handleDisconnect = () => {
    dispatch(roomIdUpdated(null));
  };

  const handleSelectRoom = (roomId: string) => {
    dispatch(roomIdUpdated(roomId));
  };

  return (
    <div className="p-3">
      <h4>Admin Room Browser</h4>

      {currentRoomId && (
        <div className="mb-3 p-2 bg-light border rounded">
          <strong>Connecté à : {currentRoomId}</strong>
        </div>
      )}

      <div className="mb-3">
        <h5>Rooms disponibles:</h5>
        <ListGroup className="mb-3">
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <ListGroup.Item
                key={room.id}
                action={room.id !== currentRoomId}
                active={room.id === currentRoomId}
                onClick={() => room.id !== currentRoomId && handleSelectRoom(room.id)}
                className={room.id === currentRoomId ? 'cursor-default' : ''}
              >
                <div>
                  <strong>{room.short_name}</strong>
                  <div className="small text-muted">{room.id}</div>
                  {room.id === currentRoomId && (
                    <Badge bg="primary" className="mt-1">Salle actuelle</Badge>
                  )}
                </div>
              </ListGroup.Item>
            ))
          ) : (
            <ListGroup.Item>Aucune room disponible</ListGroup.Item>
          )}
        </ListGroup>
      </div>

      <div className="d-flex flex-wrap gap-2">
        <Button variant="primary" onClick={handleCreateRoom}>
          Créer une room
        </Button>

        {currentRoomId && (
          <Button variant="warning" onClick={handleDisconnect}>
            Se déconnecter
          </Button>
        )}

        <Button variant="danger" onClick={handleDeleteAllRooms}>
          Supprimer toutes les rooms
        </Button>
      </div>
    </div>
  );
}