import { useState, useEffect, use } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Collapse,
  ListGroup,
} from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/app/store";
import { roomIdUpdated } from "@/features/room/roomSlice";
import { RoomSupabase } from "@/features/room/roomSupabase";
import { PeerConnection } from "@/features/room/rtc/peer";
import RoomBrowser from "@/components/room/RoomBrowser";
import RoomList from "@/components/room/RoomList";
import ConsultationRoom from "@/components/room/ConsultationRoom";
import ChatBox from "@/components/chat/ChatBox";
import BluetoothContext from "@/components/bluetooth/BluetoothContext";
import DoctorInterface from "@/components/bluetooth/DoctorInterface";
import SideMenu from "@/components/SideMenu";
import InformationsForm from "@/components/InformationsForm";
import Header from "@/components/Header";
import DoctorRoomManager from "@/components/room/DoctorRoomManager";

// Définition des types pour les données du formulaire pour les informations du patient
type PatientInformationsFormData = {
  name: string;
  first_name: string;
  birth_date: string;
  gender: "Homme" | "Femme";
  patient_number: number;
  consultation_reason: string;
};

// Définition des types pour les données du formulaire pour les informations du praticien
type PraticienInformationsFormData = {
  name: string;
  first_name: string;
};

export default function ConsultationPage() {
  // Récupération des données du store Redux : le rôle de l'utilisateur, l'ID de la salle, etc.
  const userKind = useSelector((state: RootState) => state.user.user_kind);
  const roomId = useSelector((state: RootState) => state.room.roomId);

  // Utilisation du hook useDispatch pour envoyer des actions Redux
  // (par exemple, pour mettre à jour l'ID de la salle)
  const dispatch = useDispatch();

  // État local pour gérer l'affichage du navigateur de salle, le nom de la salle et la connexion PeerConnection
  // (PeerConnection est utilisé pour gérer la connexion WebRTC entre le patient et le praticien)
  const [showRoomBrowser, setShowRoomBrowser] = useState(false);
  const [roomName, setRoomName] = useState<string>("");
  const [peerConnection, setPeerConnection] = useState<PeerConnection | null>(
    null
  );

  // Fonction pour gérer la déconnexion de la salle
  // Elle déconnecte explicitement le PeerConnection et met à jour l'ID de la salle dans le store Redux
  const handleDisconnect = () => {
    // Déconnecter explicitement le PeerConnection avant de quitter la salle
    if (peerConnection) {
      console.log("[ConsultationPage] Déconnexion explicite du PeerConnection");
      peerConnection.disconnect();
    }
    // Réinitialiser l'état local de PeerConnection
    setPeerConnection(null);
    dispatch(roomIdUpdated(null));
  };

  // Charger les détails de la salle si on est connecté
  // (par exemple, pour afficher le nom de la salle)
  // Utilisation de useEffect pour charger le nom de la salle lorsque roomId change
  useEffect(() => {
    if (roomId) {
      RoomSupabase.getRoom(roomId).then((room) => {
        if (room) {
          setRoomName(room.short_name);
        }
      });
    } else {
      setRoomName("");
    }
  }, [roomId]);

  // Fonction pour créer une nouvelle salle lorsque le praticien clique sur le bouton "Créer une salle"
  // Elle utilise RoomSupabase pour créer une salle avec un nom généré automatiquement
  const onCreateRoomClick = async () => {
    const room = await RoomSupabase.createRoom("Ma salle privée");
    if (room) {
      dispatch(roomIdUpdated(room.id));
    }
  };

  // Lorsque showRoomBrowser change, si on l'affiche, on définit refreshTrigger à true
  useEffect(() => {
    if (showRoomBrowser) {
      // On peut ajouter une logique supplémentaire ici si nécessaire
    }
  }, [showRoomBrowser]);

  // Référence à l'instance de PeerConnection créée dans ConsultationRoom
  // Cette fonction est appelée lorsque la connexion PeerConnection est prête
  // (par exemple, lorsque le praticien ou le patient est prêt à commencer la consultation)
  const handlePeerConnectionReady = (peer: PeerConnection) => {
    setPeerConnection(peer);
  };

  //  Pour vérifier si le formulaire de remplissage des informations du patient est bien rempli avant de pouvoir naviguer dans le Side Menu
  // (pour le patient et praticien, on ne peut pas accéder à la consultation sans avoir rempli les informations)
  const [isInformationsEntered, setIsInformationsEntered] = useState(false);

  // Stocker les informations du patient issues du formulaire côté patient
  // (ce sont les informations du patient qui seront envoyées au praticien une fois dans la salle de consultation et affichées dans le menu latéral (pour le patient))
  const [patientInformations, setPatientInformations] =
    useState<PatientInformationsFormData | null>(null);

  // Stocker les informations du patient issues du formulaire côté praticien
  // (ce sont les informations du praticien qui seront envoyés au patient une fois dans la salle de consultation)
  const [praticienInformations, setPraticienInformations] =
    useState<PraticienInformationsFormData | null>(null);

  // Pour afficher les informations du patient et du praticien dans la console une fois qu'elles sont définies par le formulaire
  //  A enlever en production
  useEffect(() => {
    if (praticienInformations) {
      console.log("Informations praticien :", praticienInformations);
    }
  }, [praticienInformations]);
  useEffect(() => {
    if (patientInformations) {
      console.log("Informations patient :", patientInformations);
    }
  }, [patientInformations]);

  // Savoir si on est dans l'onglet de consultation ou d'informations
  // (pour afficher le formulaire ou la consultation)
  const [isConsultationTab, setIsConsultationTab] = useState(false);

  return (
    <Container fluid>
      <Row>
        {/* Colonne gauche : Side Menu */}
        <Col
          className="bg-grey p-0"
          style={{ flex: "0 0 20%", maxWidth: "20%" }}
        >
          {/* <SideMenu /> avec les props appropriées */}
          <SideMenu
            userKind={userKind}
            isInformationsEntered={isInformationsEntered}
            patientInformations={patientInformations}
            isConsultationTab={isConsultationTab}
            setIsConsultationTab={setIsConsultationTab}
          />
        </Col>

        {/* Colonne centrale : Consultation Room */}
        <Col className="p-0" style={{ flex: "0 0 80%", maxWidth: "80%" }}>
          {/* Composant Header de tableau de bord */}
          <Header variant="dashboard">
            {!isConsultationTab ? (
              // Si on est dans l'onglet "Information patient/praticien"
              // Afficher le titre en fonction du type d'utilisateur (patient ou praticien)
              <h1>
                {`Information du ${
                  userKind === "patient" ? "patient" : "praticien"
                }`}
              </h1>
            ) : !roomId ? (
              // Si on est dans l'onglet "Consultation" mais qu'aucune salle n'est sélectionnée
              // Afficher pour le patient le titre "Choisissez une salle"
              // Afficher pour le praticien le titre "Choisissez une salle" avec les 2 boutons de création/suppression de salle
              <div className="d-flex flex-row align-items-center justify-content-between">
                <h1>Choisissez une salle de consultation</h1>
                {userKind === "practitioner" && (
                  <>
                    {/* Mettre les éléments du praticien sur la création/suppression de salle */}
                  </>
                )}
              </div>
            ) : userKind === "practitioner" ? (
              // Si on est dans l'onglet "Consultation", qu'une salle a été choisie et que l'utilisateur est un praticien
              // Afficher le titre "Salle de téléconsultation"
              <h1>Salle de téléconsultation</h1>
            ) : (
              // Si on est dans l'onglet "Consultation", qu'une salle a été choisie et que l'utilisateur est un patient
              // Afficher les éléments de connexion bluetooth côté patient et les informations des appareils
              <>
                {/* Elements de connexion bluetooth côté patient et informations appreils */}
              </>
            )}
          </Header>
          {/* Si l'onglet de consultation n'est pas actif (du menu latéral), afficher le formulaire d'entrée d'informations */}
          {!isConsultationTab ? (
            <InformationsForm
              userKind={userKind}
              setIsInformationsEntered={setIsInformationsEntered}
              setPatientInformations={setPatientInformations}
              setPraticienInformations={setPraticienInformations}
              setIsConsultationTab={setIsConsultationTab}
              praticienInformations={praticienInformations}
              patientInformations={patientInformations}
              isInformationsEntered={isInformationsEntered}
            />
          ) : (
            // Si l'onglet de consultation est actif (du menu latéral), afficher : (mettre dans ConsultationRoom toute la logique de la page de consultation : création de salle, affichage de la consultation, chat, etc.)
            // Le bouton de création de salle pour le praticien à mettre dans le header
            <>
              {/* Composant de gestion des données Bluetooth */}
              {/* {userKind === "patient" && peerConnection && (
                <BluetoothContext peerConnection={peerConnection} />
              )}
              {userKind === "practitioner" && peerConnection && (
                <DoctorInterface peerConnection={peerConnection} />
              )} */}

              {/* RoomBrowser pour le praticien */}
              {userKind === "practitioner" && (
                <div className="mb-4">
                  <DoctorRoomManager />
                </div>
              )}
              {/* RoomList pour les patients */}
              {userKind === "patient" && (
                <div className="mb-5">
                  <RoomList />
                </div>
              )}
              <ConsultationRoom
                onPeerConnectionReady={handlePeerConnectionReady}
              />

              {/* <Card className="mb-3">
                <Card.Header>
                  {userKind === "practitioner" && (
                    <>
                      <Button
                        onClick={() => setShowRoomBrowser(!showRoomBrowser)}
                        aria-controls="room-browser-collapse"
                        aria-expanded={showRoomBrowser}
                        className="mb-2 w-100"
                      >
                        {showRoomBrowser
                          ? "Masquer les consultations"
                          : "Gérer les consultations"}
                      </Button>
                      <Collapse in={showRoomBrowser}>
                        <div id="room-browser-collapse">
                          <RoomBrowser isVisible={showRoomBrowser} />
                        </div>
                      </Collapse>
                    </>
                  )}
                </Card.Header>
                <Card.Body>
                  <Card.Title>Consultation en cours</Card.Title> */}

              {/* Affichage de l'ID de la room ou "n/a" si aucune room */}
              {/* <div className="mb-3 p-2 bg-light rounded border">
                    <p className="mb-1">
                      <strong>Salle : {roomName || "n/a"}</strong>
                    </p>
                    <p className="mb-1 text-muted small">
                      {roomId || "Aucune salle sélectionnée"}
                    </p>

                    {roomId && (
                      <Button
                        variant="warning"
                        size="sm"
                        onClick={handleDisconnect}
                        className="w-100"
                      >
                        Quitter la consultation
                      </Button>
                    )}
                  </div> */}

              {/* Bouton de création de salle pour les praticiens */}
              {/* {userKind === "practitioner" && !roomId && (
                    <Button
                      variant="primary"
                      onClick={onCreateRoomClick}
                      className="mb-3 w-100"
                    >
                      <MdAddIcCall className="me-1" /> Créer une salle
                    </Button>
                  )} */}

              {/* Liste des rooms pour les patients (toujours visible) */}
              {/* {userKind === "patient" && <RoomList />}
                </Card.Body>
              </Card> */}

              {/* Nouvelle carte pour le chatbox sous la consultation en cours */}
              {/* {roomId && (
                <Card className="mb-3">
                  <ChatBox peerConnection={peerConnection} />
                </Card>
              )} */}
            </>
          )}
        </Col>
      </Row>
    </Container>
  );
}
