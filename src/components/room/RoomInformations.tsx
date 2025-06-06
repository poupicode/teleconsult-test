import { Container, ListGroup, Card, Button, CardTitle } from "react-bootstrap";
import { useState } from "react";
import { Role } from "../../features/room/rtc/peer";

type RoomInformationsType = {
  roomReady: boolean;
  userKind: string | null;
  handleDisconnect: () => void;
};

const RoomInformations = ({
  roomReady,
  userKind,
  handleDisconnect,
}: RoomInformationsType) => {
  // useState pour l'animation au survol de la barre d'informations de la salle de consultation
  const [informationsHovered, setInformationsHovered] = useState(false);

  return (
    // L'ensemble de la barre d'informations de la salle de consultation (pour que le bg prennent toute la largeur disponible)
    <div
      className="position-absolute w-100 bottom-0 bg-white-pink z-3"
      onMouseEnter={() => setInformationsHovered(true)}
      onMouseLeave={() => setInformationsHovered(false)}
    >
      {/* Ensemble contenant les éléments de la barre d'informations */}
      <div style={{ width: "calc(100vw - 26em)" }}>
        {/* Séparateur */}
        <hr
          style={{ transition: "0.4s ease" }}
          className={`ms-3 me-3 mb-0 ${!informationsHovered ? "mt-0" : "mt-2"}`}
        />
        {/* Groupe des éléments d'informations */}
        <ListGroup
          className="border-0 flex-row justify-content-between"
          variant="flush"
        >
          {/* Les informations de la salle */}
          <ListGroup.Item
            as={"li"}
            className="bg-transparent border-0 mt-2 mb-2"
          >
            <h3
              className={`fs-5 color-red ${!informationsHovered ? "mb-0" : ""}`}
              style={{
                transition: "0.4s ease",
                overflow: "hidden",
                ...(informationsHovered
                  ? { maxHeight: "200px", opacity: 1 }
                  : { maxHeight: "0", opacity: 0 }),
              }}
            >
              Consultation en cours
            </h3>
            <p className={`m-0 ${!informationsHovered ? "fw-medium" : ""}`}>
              Salle : fearless Bridget
            </p>
            <p
              className="m-0"
              style={{
                fontSize: ".8em",
                transition: "max-height 0.4s ease, opacity 0.4s ease",
                overflow: "hidden",
                ...(informationsHovered
                  ? { maxHeight: "200px", opacity: 1 }
                  : { maxHeight: "0", opacity: 0 }),
              }}
            >
              <small className="color-lightblue">
                zhefueyhyui-dbhfniezfefhbeyfhueif
              </small>
            </p>
          </ListGroup.Item>

          {/* Les informations de la connexion du patient/praticien et des informations du praticien pour le patient */}
          <ListGroup.Item
            as={"li"}
            className="bg-transparent border-0 mt-2 mb-2"
          >
            {userKind === "patient" && (
              <h3
                style={{
                  transition: "0.4s ease",
                  overflow: "hidden",
                  ...(informationsHovered
                    ? { maxHeight: "200px", opacity: 1 }
                    : { maxHeight: "0", opacity: 0 }),
                }}
                className={`fs-5 color-red ${
                  !informationsHovered ? "mb-0" : ""
                }`}
              >
                Praticien
              </h3>
            )}

            <p className={`m-0 ${!informationsHovered ? "fw-medium" : ""}`}>
              {!roomReady
                ? `En attente de ${
                    userKind === "practitioner"
                      ? "du patient"
                      : "du praticien"
                  }`
                : userKind === "patient" && "Dr. "}
            </p>
          </ListGroup.Item>

          {/* Bouton pour quitter la consultation */}
          {/* Il manque la fonction de déconnexion de la salle à ajouter/relier */}
          <ListGroup.Item
            as={"li"}
            className="bg-transparent border-0 mt-auto mb-auto"
          >
            <Button
              style={{ transition: "0.4s ease" }}
              className={`secondary-btn ps-4 pe-4 ${
                !informationsHovered ? "pb-1 pt-1" : ""
              }`}
              onClick={handleDisconnect}
            >
              Quitter la salle
            </Button>
          </ListGroup.Item>
        </ListGroup>
      </div>
    </div>
  );
};
export default RoomInformations;
