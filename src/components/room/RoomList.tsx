import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { roomIdUpdated } from "@/features/room/roomSlice";
import { supabase } from "@/lib/supabaseClient";
import { Button, Card, Row, Col, Spinner } from "react-bootstrap";
import { Room, RoomSupabase } from "@/features/room/roomSupabase";
import { RootState } from "@/app/store";

export default function RoomList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const dispatch = useDispatch();
  const currentRoomId = useSelector((state: RootState) => state.room.roomId);

  useEffect(() => {
    fetchRooms();
    const subscription = supabase
      .channel("room_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        fetchRooms
      )
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
    if (currentRoomId) {
      dispatch(roomIdUpdated(null));
      setTimeout(() => dispatch(roomIdUpdated(roomId)), 500);
    } else {
      dispatch(roomIdUpdated(roomId));
    }
  };

  return (
    <div>
      <h5 className="mb-4 fw-bold">Salles disponibles</h5>

      {loading ? (
        <Spinner animation="border" variant="primary" />
      ) : rooms.length > 0 ? (
        <Row>
          {rooms.map((room) => (
            <Col md={6} lg={4} className="mb-4" key={room.id}>
              <Card className="shadow-sm h-100">
                <Card.Body>
                  <Card.Title className="fw-semibold">
                    {room.short_name}
                  </Card.Title>
                  <Card.Text
                    className="text-muted"
                    style={{ fontSize: "0.9rem" }}
                  >
                    ID : {room.id}
                  </Card.Text>
                  <Button
                    variant={currentRoomId === room.id ? "secondary" : "danger"}
                    className="w-100 text-white rounded-pill"
                    disabled={currentRoomId === room.id}
                    onClick={() => handleSelectRoom(room.id)}
                  >
                    {currentRoomId === room.id ? "Salle actuelle" : "Rejoindre"}
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <p className="text-muted">Aucune salle disponible</p>
      )}
    </div>
  );
}
