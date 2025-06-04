import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { roomIdUpdated } from '@/features/room/roomSlice';
import { supabase } from '@/lib/supabaseClient';
import { Button, ListGroup, Badge } from 'react-bootstrap';
import { Room, RoomSupabase } from '@/features/room/roomSupabase';
import { RootState } from '@/app/store';

export default function RoomList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const dispatch = useDispatch();
  const currentRoomId = useSelector((state: RootState) => state.room.roomId);

  useEffect(() => {
    fetchRooms();
    const subscription = supabase.channel('room_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, fetchRooms)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const { data } = await RoomSupabase.getRooms();
      if (data) setRooms(data);
    } catch (error) {
      console.error("Erreur lors de la récupération des salles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRoom = (roomId: string) => {
    // Si l'utilisateur est déjà dans une salle, on le déconnecte d'abord
    if (currentRoomId) {
      console.log(`[RoomList] Changing rooms from ${currentRoomId} to ${roomId}`);
      
      // Déconnecter de la salle actuelle en mettant roomId à null
      dispatch(roomIdUpdated(null));

      // Augmenter le délai pour s'assurer que la déconnexion est complètement terminée
      // et que toutes les ressources WebRTC sont libérées avant de rejoindre la nouvelle salle
      setTimeout(() => {
        console.log(`[RoomList] Connecting to new room ${roomId} after cleanup`);
        dispatch(roomIdUpdated(roomId));
      }, 1000); // Augmenté à 1 seconde pour permettre un nettoyage complet
    } else {
      // Si l'utilisateur n'est pas dans une salle, on peut directement rejoindre la nouvelle
      console.log(`[RoomList] Connecting directly to room ${roomId}`);
      dispatch(roomIdUpdated(roomId));
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0">Salles disponibles</h5>
      </div>

      {loading ? (
        <p className="text-muted">Chargement des salles...</p>
      ) : rooms.length > 0 ? (
        <div style={{ height: '300px', overflowY: 'auto' }}>
          <ListGroup>
            {rooms.map((room) => (
              <ListGroup.Item
                key={room.id}
                action={currentRoomId !== room.id}
                onClick={() => currentRoomId !== room.id && handleSelectRoom(room.id)}
                className={`d-flex justify-content-between align-items-center ${currentRoomId === room.id ? 'bg-light text-dark cursor-default' : ''}`}
              >
                <div className="text-truncate" style={{ maxWidth: "180px" }}>
                  <span>{room.short_name}</span>
                  <br />
                  <small className="text-muted">{room.id}</small>
                </div>
                <Badge bg={currentRoomId === room.id ? "primary" : "success"} pill>
                  {currentRoomId === room.id ? "Actuelle" : "Rejoindre"}
                </Badge>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </div>
      ) : (
        <p className="text-muted">Aucune salle disponible</p>
      )}
    </div>
  );
}
