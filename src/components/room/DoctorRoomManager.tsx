import React, { useEffect, useState } from "react";
import { Button, Form, Row, Col, Card } from "react-bootstrap";
import { RoomSupabase, Room } from "@/features/room/roomSupabase";
import { useDispatch } from "react-redux";
import { roomIdUpdated } from "@/features/room/roomSlice";
import { supabase } from "@/lib/supabaseClient";

export default function DoctorRoomManager({
  onCreateRoom,
}: {
  onCreateRoom: (fn: () => Promise<void>) => void;
}) {
  // State pour stocker les rooms et l'état d'édition
  // Utilisation de useState pour gérer les rooms et l'état d'édition des noms
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editingRooms, setEditingRooms] = useState<Record<string, string>>({});
  const dispatch = useDispatch();

  // Charger les rooms au montage
  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    const result = await RoomSupabase.getAllRooms();
    if (result) setRooms(result);
    console.log("Rooms loaded:", result);
  };

  const handleCreateRoom = React.useCallback(async () => {
    const newRoom = await RoomSupabase.createRoom("Nouvelle salle");
    if (newRoom) {
      setRooms((prev) => [...prev, newRoom]);
    }
  }, []);

  React.useEffect(() => {
    if (onCreateRoom) {
      onCreateRoom(handleCreateRoom);
    }
  }, [onCreateRoom, handleCreateRoom]);

  const handleUpdateName = (id: string, value: string) => {
    setEditingRooms((prev) => ({ ...prev, [id]: value }));
  };

  const handleSaveName = async (id: string) => {
    const newName = editingRooms[id]?.trim();
    if (!newName) return;
    await supabase.from("rooms").update({ short_name: newName }).eq("id", id);
    setEditingRooms((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    loadRooms();
  };

  const handleDeleteRoom = async (id: string) => {
    const confirm = window.confirm("Supprimer cette salle ?");
    if (confirm) {
      await RoomSupabase.deleteRoom(id);
      loadRooms();
    }
  };

  const handleJoinRoom = (id: string) => {
    dispatch(roomIdUpdated(id));
  };

  return (
    <div className="h-80 pt-4">
      <Row className="gy-4">
        {rooms.map((room) => (
          <Col key={room.id} md={6} lg={4}>
            <Card
              className="shadow-lg p-3"
              style={{ backgroundColor: "#F0EDF4" }}
            >
              <Card.Body>
                <Form.Group>
                  <Form.Label className="fw-bold">{room.short_name}</Form.Label>
                  <Form.Control
                    type="text"
                    value={editingRooms[room.id] ?? room.short_name}
                    onChange={(e) => handleUpdateName(room.id, e.target.value)}
                    onBlur={() => handleSaveName(room.id)}
                  />
                </Form.Group>

                <Button
                  variant="primary"
                  className="rounded-pill w-100 mt-3 text-white"
                  onClick={() => handleJoinRoom(room.id)}
                >
                  Rejoindre
                </Button>

                <Button
                  variant="danger"
                  className="rounded-pill w-100 mt-2 text-white"
                  onClick={() => handleDeleteRoom(room.id)}
                >
                  Supprimer
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
