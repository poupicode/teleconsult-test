import React, { useState } from "react";
import { Button, Row, Col, Form } from "react-bootstrap";

type Room = {
  id: number;
  name: string;
  description: string;
  isValidated: boolean;
};

export default function DoctorInterfaceConsultation() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomCounter, setRoomCounter] = useState(1);

  const handleAddRoom = () => {
    const newRoom: Room = {
      id: roomCounter,
      name: "",
      description: "",
      isValidated: false,
    };
    setRooms([...rooms, newRoom]);
    setRoomCounter(roomCounter + 1);
  };

  const handleChange = (id: number, field: keyof Room, value: string) => {
    setRooms((prevRooms) =>
      prevRooms.map((room) =>
        room.id === id ? { ...room, [field]: value } : room
      )
    );
  };

  const handleValidateRoom = (id: number) => {
    setRooms((prevRooms) =>
      prevRooms.map((room) =>
        room.id === id ? { ...room, isValidated: true } : room
      )
    );
  };

  const handleDeleteRoom = (id: number) => {
    const confirmDelete = window.confirm(
      "Voulez-vous vraiment supprimer cette salle ?"
    );
    if (confirmDelete) {
      setRooms((prevRooms) => prevRooms.filter((room) => room.id !== id));
    }
  };

  const isDuplicateName = (name: string, currentId: number): boolean => {
    return rooms.some(
      (room) =>
        room.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        room.id !== currentId
    );
  };

  return (
    <div className="d-flex" style={{ minHeight: "100vh" }}>
      {/* Sidebar */}
      <div
        className="bg-light p-3"
        style={{ width: "220px", borderRight: "1px solid #dee2e6" }}
      >
        <h6 className="fw-bold mb-4">Informations du praticien</h6>
        <div className="fw-bold text-primary">Consultation</div>
      </div>

      {/* Main Content */}
      <div className="flex-grow-1 p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="text-danger fw-bold">
            Choisissez une salle de consultation
          </h2>
          <Button
            variant="danger"
            className="rounded-pill text-white"
            onClick={handleAddRoom}
          >
            Créer une salle
          </Button>
        </div>

        <Row className="gy-4">
          {rooms.map((room) => (
            <Col key={room.id} md={6} lg={4}>
              <div
                className="card shadow-lg p-3 mb-4 rounded"
                style={{ backgroundColor: "#F0EDF4", height: "350px" }}
              >
                <div className="card-body">
                  {/* Nom de la salle */}
                  {!room.isValidated ? (
                    <>
                      {/* Nom de la salle (editable) */}
                      <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">
                          Nom de la salle :
                        </Form.Label>
                        <Form.Control
                          type="text"
                          className="mb-2"
                          maxLength={40}
                          value={room.name}
                          onChange={(e) =>
                            handleChange(room.id, "name", e.target.value)
                          }
                          isInvalid={
                            !room.isValidated &&
                            room.name.trim() !== "" &&
                            isDuplicateName(room.name, room.id)
                          }
                          placeholder="Ex: Salle 1"
                        />
                        {!room.isValidated &&
                          room.name.trim() !== "" &&
                          isDuplicateName(room.name, room.id) && (
                            <Form.Control.Feedback type="invalid">
                              Ce nom existe déjà.
                            </Form.Control.Feedback>
                          )}
                      </Form.Group>

                      {/* Description (editable) */}
                      <Form.Group className="mb-3">
                        <Form.Label>Description :</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          maxLength={70}
                          value={room.description}
                          onChange={(e) =>
                            handleChange(room.id, "description", e.target.value)
                          }
                          placeholder="Ajoutez une description..."
                        />
                        <Form.Text muted>
                          {room.description.length} / 70 caractères
                        </Form.Text>
                      </Form.Group>
                    </>
                  ) : (
                    <>
                      {/* Nom de la salle (affiché) */}
                      <h5
                        className="card-title text-center fw-bold mb-3"
                        style={{
                          height: "48px", // ~2 lignes
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {room.name}
                      </h5>

                      {/* Description (affichée) */}
                      <p
                        className="card-text text-center my-3"
                        style={{
                          height: "72px", // 3 lignes
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <p
                          className="card-text text-center my-3"
                          style={{ maxHeight: "120px", overflowY: "auto" }}
                        >
                          {room.description}
                        </p>
<<<<<<< HEAD
=======
                        {room.description.length > 60
                          ? room.description.slice(0, 60) + "..."
                          : room.description}
>>>>>>> 13da782 (WIP improved the aesthetics of the cards solved a few text problems that appeared when they weren't supposed to.)
=======
>>>>>>> 2e61740 (the cards are now good, the connection between the “rejoindre” button and the visio still needs to be made)
                      </p>
                    </>
                  )}

                  {/* Bouton d'action */}
                  {room.isValidated ? (
                    <Button
                      type="button"
                      className="btn btn-danger rounded-pill mx-auto d-block mb-3 px-5 text-white"
                    >
                      Rejoindre
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="btn btn-success rounded-pill mx-auto d-block mb-5 px-5 text-white"
                      onClick={() => handleValidateRoom(room.id)}
                      disabled={
                        room.name.trim() === "" ||
                        isDuplicateName(room.name, room.id)
                      }
                    >
                      Créer
                    </Button>
                  )}

                  {room.isValidated && (
                    <>
                      <hr className="my-3 border border-primary" />
                      <div className="d-flex justify-content-center">
                        <button
                          type="button"
                          className="btn btn-link text-danger"
                          onClick={() => handleDeleteRoom(room.id)}
                        >
                          Supprimer la salle
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
}
