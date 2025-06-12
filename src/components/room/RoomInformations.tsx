import {
  ListGroup,
  Button,
  Card,
  OverlayTrigger,
  Popover,
  Row,
  Col,
} from "react-bootstrap";
import { useState, useEffect } from "react";
import { RoomSupabase, Room } from "@/features/room/roomSupabase";

// Types pour les informations du patient et du praticien du formulaire
type InformationsDetails = {
  name: string;
  first_name: string;
  birth_date?: string;
  gender?: "Homme" | "Femme";
  patient_number?: number;
  consultation_reason?: string;
  occupation?: string;
};

type RoomInformationsType = {
  userKind: string | null;
  roomId: string;
  connectionStatus: string;
  patientInformations: InformationsDetails | null;
  praticienInformations: InformationsDetails | null;
  handleOpenVideoPanel: () => void;
};

const RoomInformations = ({
  userKind,
  roomId,
  connectionStatus,
  patientInformations,
  praticienInformations,
  handleOpenVideoPanel,
}: RoomInformationsType) => {
  // State pour stocker les rooms et l'état d'édition
  // Utilisation de useState pour gérer les rooms et l'état d'édition des noms
  const [rooms, setRooms] = useState<Room[]>([]);

  // Charger les rooms au montage
  useEffect(() => {
    loadRooms();
  }, []);

  // Récupérer les rooms dans roomSupabase.ts et les mettres dans rooms
  const loadRooms = async () => {
    const result = await RoomSupabase.getAllRooms();
    if (result) setRooms(result);
  };

  return (
    // L'ensemble de la barre d'informations de la salle de consultation (pour que le bg prennent toute la largeur disponible)
    <div style={{ marginTop: "3.5em" }}>
      <Card className="bg-white-pink p-0 mb-2">
        <Card.Body style={{ padding: ".8em" }}>
          <Card.Title className="fs-6" as={"h2"}>
            Consultation en cours
          </Card.Title>
          <hr className="mt-0 mb-3" />
          <p className="m-0 mb-1 fw-medium">
            Salle : {rooms.find((r) => r.id === roomId)?.short_name}
          </p>
          <p
            className="m-0"
            style={{
              fontSize: ".8em",
            }}
          >
            <small className="color-lightblue">{roomId}</small>
          </p>

          <div className="w-100 mt-3 d-flex justify-content-between align-items-center">
            <hr className="mt-2 mb-2" style={{ width: "55%" }} />
            <p className="m-0 fw-medium small">
              {roomId ? (connectionStatus === "connected" ? "2" : "1") : "0"}/2
              connectés
            </p>
          </div>
          {connectionStatus !== "connected" ? (
            <p
              className="m-0 mt-1"
              style={{
                fontSize: ".8em",
              }}
            >
              <small>
                En attente du {userKind === "patient" ? "praticien" : "patient"}
              </small>
            </p>
          ) : (
            <>
              <p
                className="m-0 mt-1"
                style={{
                  fontSize: ".8em",
                }}
              >
                <small>
                  Médecin : Dr. {praticienInformations?.first_name}{" "}
                  {praticienInformations?.name},{" "}
                  {praticienInformations?.occupation}
                </small>
              </p>
              <p
                className="m-0"
                style={{
                  fontSize: ".8em",
                }}
              >
                <small>
                  Patient : {patientInformations?.first_name}{" "}
                  {patientInformations?.name}
                </small>
              </p>
            </>
          )}
          {connectionStatus === "connected" && (
            <Button
              className="other-btn mt-3 p-0 px-2 mt-2"
              onClick={handleOpenVideoPanel}
            >
              <small>Voir infos patient</small>
            </Button>
          )}
        </Card.Body>
      </Card>
      <Card className="bg-white-pink p-0">
        <Card.Body style={{ padding: ".8em" }}>
          <Card.Title className="fs-6" as={"h2"}>
            État de la connexion
          </Card.Title>
          <hr className="mt-0 mb-3" />
          <Row className="w-100 mx-auto mb-2 flex-wrap">
            <Col md={6} className="p-0 px-1">
              <OverlayTrigger
                trigger={["hover", "focus"]}
                placement="top"
                overlay={
                  <Popover className="roomPopup bg-white-pink border-0 card p-0 rounded-2">
                    <Popover.Body className="p-1 small fw-medium">
                      État de la connexion
                    </Popover.Body>
                  </Popover>
                }
              >
                <div
                  className={`p-0 w-100 text-center rounded-5 small ${
                    connectionStatus === "connected"
                      ? "bg-blue color-white"
                      : connectionStatus === "connecting"
                      ? "bg-lightblue color-blue"
                      : "bg-pink color-red"
                  }`}
                >
                  <strong
                    className={`text-capitalize small fw-medium ${
                      connectionStatus === "connected"
                        ? "color-white"
                        : connectionStatus === "connecting"
                        ? "color-blue"
                        : "color-red"
                    }`}
                  >
                    {connectionStatus === "connected"
                      ? "connecté"
                      : connectionStatus === "connecting"
                      ? "en cours"
                      : connectionStatus === "disconnected"
                      ? "déconnecté"
                      : connectionStatus}
                  </strong>
                </div>
              </OverlayTrigger>
            </Col>
            <Col md={6} className="p-0 px-1">
              <OverlayTrigger
                trigger={["hover", "focus"]}
                placement="top"
                overlay={
                  <Popover className="roomPopup bg-white-pink border-0 card p-0 rounded-2">
                    <Popover.Body className="p-1 small fw-medium">
                      État de la connexion
                    </Popover.Body>
                  </Popover>
                }
              >
                <div className="bg-lightblue p-0 w-100 text-center rounded-5 small">
                  <strong className={`text-capitalize small fw-medium`}>
                    État
                  </strong>
                </div>
              </OverlayTrigger>
            </Col>
          </Row>
          <Row className="w-100 mx-auto">
            <Col md={6} className="p-0 px-1">
              <OverlayTrigger
                trigger={["hover", "focus"]}
                placement="top"
                overlay={
                  <Popover className="roomPopup bg-white-pink border-0 card p-0 rounded-2">
                    <Popover.Body className="p-1 small fw-medium">
                      État de la connexion
                    </Popover.Body>
                  </Popover>
                }
              >
                <div className="bg-lightblue p-0 w-100 text-center rounded-5 small">
                  <strong className={`text-capitalize small fw-medium`}>
                    État
                  </strong>
                </div>
              </OverlayTrigger>
            </Col>
            <Col md={6} className="p-0 px-1">
              <OverlayTrigger
                trigger={["hover", "focus"]}
                placement="top"
                overlay={
                  <Popover className="roomPopup bg-white-pink border-0 card p-0 rounded-2">
                    <Popover.Body className="p-1 small fw-medium">
                      État de la connexion
                    </Popover.Body>
                  </Popover>
                }
              >
                <div className="bg-lightblue p-0 w-100 text-center rounded-5 small">
                  <strong className={`text-capitalize small fw-medium`}>
                    État
                  </strong>
                </div>
              </OverlayTrigger>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};
export default RoomInformations;
