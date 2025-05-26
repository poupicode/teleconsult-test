import { useState, useEffect, use } from "react";
import { Container, Row, Col, Card, Button, Collapse } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import RoomBrowser from "@/components/room/RoomBrowser";
import RoomList from "@/components/room/RoomList";
import ConsultationRoom from "@/components/room/ConsultationRoom";
import ChatBox from "@/components/chat/ChatBox";
import { RootState } from "@/app/store";
import { roomIdUpdated } from "@/features/room/roomSlice";
import { RoomSupabase } from "@/features/room/roomSupabase";
import { MdAddIcCall } from "react-icons/md";
import { PeerConnection } from "@/features/room/rtc/peer";
import BluetoothContext from "@/components/bluetooth/BluetoothContext";
import DoctorInterface from "@/components/bluetooth/DoctorInterface";
import SideMenu from "@/components/SideMenu";
import InformationsForm from "@/components/InformationsForm";
import Header from "@/components/Header";

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
  const userKind = useSelector((state: RootState) => state.user.user_kind);
  const roomId = useSelector((state: RootState) => state.room.roomId);
  const dispatch = useDispatch();
  const [showRoomBrowser, setShowRoomBrowser] = useState(false);
  const [roomName, setRoomName] = useState<string>("");
  const [peerConnection, setPeerConnection] = useState<PeerConnection | null>(
    null
  );

  const handleDisconnect = () => {
    // Déconnecter explicitement le PeerConnection avant de quitter la salle
    if (peerConnection) {
      console.log("[ConsultationPage] Déconnexion explicite du PeerConnection");
      peerConnection.disconnect();
    }
    dispatch(roomIdUpdated(null));
  };

  // Charger les détails de la salle si on est connecté
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

  const onCreateRoomClick = async () => {
    // Création d'une salle avec un nom généré automatiquement
    const room = await RoomSupabase.createRoom();
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
        <Col md={3} className="bg-grey p-0">
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
        <Col md={9}>
          {/* Composant Header de tableau de bord */}
          <Header
            variant="dashboard"
            title={`Information du ${
              userKind === "patient" ? "patient" : "praticien"
            }`}
          />
          {/* Si l'onglet de consultation n'est pas actif (du menu latéral), afficher le formulaire d'entrée d'informations */}
          {!isConsultationTab ? (
            <InformationsForm
              userKind={userKind}
              setIsInformationsEntered={setIsInformationsEntered}
              setPatientInformations={setPatientInformations}
              setPraticienInformations={setPraticienInformations}
              setIsConsultationTab={setIsConsultationTab}
            />
          ) : (
            // Si l'onglet de consultation est actif (du menu latéral), afficher :
            <>
              {userKind === "patient" && peerConnection && (
                <BluetoothContext peerConnection={peerConnection} />
              )}
              {userKind === "practitioner" && peerConnection && (
                <DoctorInterface peerConnection={peerConnection} />
              )}
              <Card className="mb-3">
                <Card.Body>
                  <ConsultationRoom
                    onPeerConnectionReady={handlePeerConnectionReady}
                  />
                </Card.Body>
              </Card>
              <Card className="mb-3">
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
                  <Card.Title>Consultation en cours</Card.Title>

                  {/* Affichage de l'ID de la room ou "n/a" si aucune room */}
                  <div className="mb-3 p-2 bg-light rounded border">
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
                  </div>

                  {/* Bouton de création de salle pour les praticiens */}
                  {userKind === "practitioner" && !roomId && (
                    <Button
                      variant="primary"
                      onClick={onCreateRoomClick}
                      className="mb-3 w-100"
                    >
                      <MdAddIcCall className="me-1" /> Créer une salle
                    </Button>
                  )}

                  {/* Liste des rooms pour les patients (toujours visible) */}
                  {userKind === "patient" && <RoomList />}
                </Card.Body>
              </Card>

              {/* Nouvelle carte pour le chatbox sous la consultation en cours */}
              {roomId && (
                <Card className="mb-3">
                  <ChatBox peerConnection={peerConnection} />
                </Card>
              )}
            </>
          )}
        </Col>
      </Row>
    </Container>
  );
}
