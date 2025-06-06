import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { roomIdUpdated } from "@/features/room/roomSlice";
import { supabase } from "@/lib/supabaseClient";
import { Button, Card, Row, Col, Spinner } from "react-bootstrap";
import { Room, RoomSupabase } from "@/features/room/roomSupabase";
import { RootState } from "@/app/store";

export default function RoomList() {
  // Stocker l'ensemble des salles
  const [rooms, setRooms] = useState<Room[]>([]);

  // Etat pour regarder si les salles ont fini de se charger
  const [loading, setLoading] = useState<boolean>(true);

  const dispatch = useDispatch();

  // Récupérer l'id actuelle de la salle (si il y a, sinon undefined)
  const currentRoomId = useSelector((state: RootState) => state.room.roomId);

  // Initialiser le chargement et la gestion des salles
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

  // Récupérer les salles depuis la supabase
  const fetchRooms = async () => {
    // Mettre sur true le chargement des salle
    setLoading(true);

    // Récupérer les salles et les mettre dans rooms
    try {
      const { data } = await RoomSupabase.getRooms();
      if (data) setRooms(data);
    } catch (error) {
      console.error("Erreur lors de la récupération des salles:", error);
    } finally {
      // Arrêter l'état de chargement des salles une fois récupérées
      setLoading(false);
    }
  };

  // Fonction pour sélectionner une salle pour la rejoindre
  const handleSelectRoom = (roomId: string) => {
    if (currentRoomId) {
      dispatch(roomIdUpdated(null));
      setTimeout(() => dispatch(roomIdUpdated(roomId)), 500);
    } else {
      dispatch(roomIdUpdated(roomId));
    }
  };

  return (
    <div className="h-80">
      {/* Afficher une animation de chargement en attendant l'affichage des salles */}
      {loading ? (
        <Spinner animation="border" variant="danger"/>
      ) : rooms.length > 0 ? (
        <Row>
          {/* Pour chaque salle de rooms */}
          {rooms.map((room) => (
            <Col
              key={room.id}
              style={{
                flex: "0 0 32%",
                maxWidth: "32%",
              }}
              className="mb-4"
            >
              {/* Afficher en card la salle et ses infos */}
              <Card className="card p-0 bg-grey">
                <Card.Body>
                  {/* Afficher le nom de la salle */}
                  <Card.Title className="fw-semibold">
                    {room.short_name}
                  </Card.Title>

                  {/* Afficher l'id de la salle */}
                  <p className="color-lightblue" style={{ fontSize: "0.7rem" }}>
                    {room.id}
                  </p>

                  {/* Bouton pour sélectionner et rejoindre une salle */}
                  <Button
                    className="w-75 d-block mx-auto primary-btn"
                    size="sm"
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
        <p className="color-red fw-semibold">Aucune salle disponible</p>
      )}
    </div>
  );
}
