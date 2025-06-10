import { ListGroup, Button } from "react-bootstrap";
import { useState, useEffect } from "react";
import { RoomSupabase, Room } from "@/features/room/roomSupabase";

type RoomInformationsType = {
  roomReady: boolean;
  userKind: string | null;
  handleDisconnect: () => void;
  roomId: string;
  connectionStatus: string
};

const RoomInformations = ({
  roomReady,
  userKind,
  handleDisconnect,
  roomId,
  connectionStatus
}: RoomInformationsType) => {
  // useState pour l'animation au survol de la barre d'informations de la salle de consultation
  const [informationsHovered, setInformationsHovered] = useState(false);

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
    <div
      className="position-absolute w-100 bottom-0 bg-white-pink z-3"
      onMouseEnter={() => setInformationsHovered(true)}
      onMouseLeave={() => setInformationsHovered(false)}
    >
      {/* Ensemble contenant les éléments de la barre d'informations */}
      <div className="position-relative" style={{ width: "calc(100vw - 26em)" }}>
        {/* Badge d'état de connexion */}
        <div className={`position-absolute small rounded-5 ${!connectionStatus ? "bg-blue color-white" : "bg-pink color-red"}`} style={{bottom: "calc(100% + .5em)", left: "-1em", padding: ".2em .6em"}}>État : <strong className={!connectionStatus ? "color-white" : "color-red"}>{!connectionStatus ? "Connecté" : "Déconnecté"}</strong></div>

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
            {/* Titre de la section informations de la salle */}
            <h3
              className={`fs-5 color-red mb-0`}
              style={{
                transition: "0.4s ease",
                overflow: "hidden",
                ...(informationsHovered
                  ? { maxHeight: "200px", opacity: 1, height: "1.5em" }
                  : { maxHeight: "0", opacity: 0, height: "0" }),
              }}
            >
              Consultation en cours
            </h3>

            {/* Nom de la salle */}
            <p className={`m-0 ${!informationsHovered ? "fw-medium" : ""}`}>
              Salle : {rooms.find((r) => r.id === roomId)?.short_name}
            </p>

            {/* ID de la salle */}
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
              <small className="color-lightblue">{roomId}</small>
            </p>
          </ListGroup.Item>

          {/* Les informations de la connexion du patient/praticien et des informations du praticien pour le patient */}
          <ListGroup.Item
            as={"li"}
            className="bg-transparent border-0 mt-2 mb-2"
          >
            {userKind === "patient" && (
              // Titre de la section information du praticien (affiché uniquement côté patient)
              <h3
                style={{
                  transition: "0.4s ease",
                  overflow: "hidden",
                  ...(informationsHovered
                    ? { maxHeight: "200px", opacity: 1, height: "1.5em" }
                    : { maxHeight: "0", opacity: 0, height: "0" }),
                }}
                className={`fs-5 color-red ${
                  !informationsHovered ? "mb-0" : ""
                }`}
              >
                Praticien {roomReady && "connecté"}
              </h3>
            )}

            {/* Etat de connextion du patient / praticien */}
            {/* Si connecté, afficher le nom du médecin pour le patient ou 'Patient connecté' pour le médecin */}
            <p className={`m-0 ${!informationsHovered ? "fw-medium" : ""}`}>
              {!roomReady ? (
                `En attente ${
                  userKind === "practitioner" ? "du patient" : "du praticien"
                }`
              ) : userKind === "patient" ? (
                "Dr. Nom Prénom"
              ) : (
                <strong>Patient connecté</strong>
              )}
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
