import React, { useEffect, useState } from "react";
import { Button, ListGroup, Badge, Form } from "react-bootstrap";
import { Room, RoomSupabase } from "../../features/room/roomSupabase";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/store";
import { roomIdUpdated } from "@/features/room/roomSlice";

interface RoomBrowserProps {
  isVisible?: boolean;
}

export default function RoomBrowser({ isVisible = true }: RoomBrowserProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomName, setRoomName] = useState<string>(""); // état pour le nom de la room
  const [error, setError] = useState<string | null>(null);
  const currentRoomId = useSelector((state: RootState) => state.room.roomId);
  const dispatch = useDispatch();

  const fetchRooms = async () => {
    const { data, error } = await RoomSupabase.getRooms();
    if (error) {
      console.error("Erreur de récupération des rooms:", error);
    } else {
      setRooms(data || []);
    }
  };

  useEffect(() => {
    fetchRooms();

    const roomsSubscription = RoomSupabase.subscribeToRooms((payload) => {
      console.log("Changement détecté dans les rooms:", payload);
      fetchRooms();
    });

    return () => {
      if (roomsSubscription) {
        roomsSubscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (isVisible && document.visibilityState === "visible") {
      fetchRooms();
    }
  }, [isVisible, document.visibilityState]);

  const handleCreateRoom = async () => {
    setError(null);
    if (!roomName.trim()) {
      setError("Le nom de la salle ne peut pas être vide.");
      return;
    }
    const room = await RoomSupabase.createRoom(roomName.trim());
    if (room) {
      setRoomName(""); // reset input
      fetchRooms();
      dispatch(roomIdUpdated(room.id));
    } else {
      setError("Erreur lors de la création de la salle.");
    }
  };

  const handleDeleteAllRooms = async () => {
    await RoomSupabase.deleteAllRooms();
    fetchRooms();
    if (currentRoomId) {
      dispatch(roomIdUpdated(null));
    }
  };

  const handleDisconnect = () => {
    console.log('[RoomBrowser] Disconnecting from current room');
    dispatch(roomIdUpdated(null));
  };

  const handleSelectRoom = (roomId: string) => {
    // Si l'utilisateur est déjà dans une salle, on le déconnecte d'abord
    if (currentRoomId) {
      console.log(`[RoomBrowser] Changing rooms from ${currentRoomId} to ${roomId}`);

      // Stocker l'ID de la salle cible dans une variable locale
      const targetRoomId = roomId;

      // Déconnecter de la salle actuelle en mettant roomId à null
      dispatch(roomIdUpdated(null));

      // Délai pour s'assurer que la déconnexion est complètement terminée
      // et que les canaux Supabase sont correctement fermés
      setTimeout(() => {
        console.log(`[RoomBrowser] Connecting to new room ${targetRoomId} after cleanup`);
        dispatch(roomIdUpdated(targetRoomId));
      }, 1500); // Délai augmenté pour s'assurer que tout est bien nettoyé
    } else {
      // Si l'utilisateur n'est pas dans une salle, on peut directement rejoindre la nouvelle
      console.log(`[RoomBrowser] Connecting directly to room ${roomId}`);
      dispatch(roomIdUpdated(roomId));
    }
  };

  return (
    <div className="p-3">
      <h4>Admin Room Browser</h4>

      {currentRoomId && (
        <div className="mb-3 p-2 bg-light border rounded">
          <strong>Connecté à : {currentRoomId}</strong>
        </div>
      )}

      <Form.Group className="mb-3" controlId="roomNameInput">
        <Form.Label>Nom de la salle créer</Form.Label>
        <Form.Control
          type="text"
          placeholder="Entrez le nom de la salle"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
        />
        {error && <Form.Text className="text-danger">{error}</Form.Text>}
      </Form.Group>

      <div className="mb-3">
        <h5>Rooms disponibles :</h5>
        <ListGroup className="mb-3">
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <ListGroup.Item
                key={room.id}
                action={room.id !== currentRoomId}
                active={room.id === currentRoomId}
                onClick={() =>
                  room.id !== currentRoomId && handleSelectRoom(room.id)
                }
                className={room.id === currentRoomId ? "cursor-default" : ""}
              >
                <div>
                  <strong>{room.short_name}</strong>
                  <div className="small text-muted">{room.id}</div>
                  {room.id === currentRoomId && (
                    <Badge bg="primary" className="mt-1">
                      Salle actuelle
                    </Badge>
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
