import React, { useState, useEffect, use } from "react";
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
import SideMenu from "@/components/SideMenu";
import InformationsForm from "@/components/InformationsForm";
import Header from "@/components/Header";
import DoctorRoomManager from "@/components/room/DoctorRoomManager";
import { useSimpleRoomPersistence } from '@/hooks/useSimpleRoomPersistence';
import { useSimpleBeforeUnload } from '@/hooks/useSimpleBeforeUnload';

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
    const [roomName, setRoomName] = useState<string>('');
    const [peerConnection, setPeerConnection] = useState<PeerConnection | null>(null);
    const [showRestorationMessage, setShowRestorationMessage] = useState(false);

    // Hook de persistance des rooms avec détection de retour rapide (version simplifiée)
    const { wasRoomRestored, restoredRoomId, isQuickReturn, saveForQuickReturn, clearRestorationFlag } = useSimpleRoomPersistence();

    // Hook pour enregistrer les départs de page (version simplifiée)
    useSimpleBeforeUnload(saveForQuickReturn);

    // Afficher un message de restauration si une room a été restaurée
    useEffect(() => {
        if (wasRoomRestored && restoredRoomId) {
            setShowRestorationMessage(true);
            // Masquer le message après 5 secondes
            const timer = setTimeout(() => {
                setShowRestorationMessage(false);
                clearRestorationFlag();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [wasRoomRestored, restoredRoomId, clearRestorationFlag]);

    // Fonction pour gérer la déconnexion de la salle
  // Elle déconnecte explicitement le PeerConnection et met à jour l'ID de la salle dans le store Redux
    const handleDisconnect = async () => {
        // Déconnecter explicitement le PeerConnection avant de quitter la salle
        if (peerConnection) {
            console.log('[ConsultationPage] Déconnexion explicite du PeerConnection');

            try {
                // Attendre que la déconnexion soit terminée avant de mettre à jour le state
                await peerConnection.disconnect();
                console.log('[ConsultationPage] PeerConnection déconnecté avec succès');
                setPeerConnection(null);
            } catch (err) {
                console.error('[ConsultationPage] Erreur lors de la déconnexion:', err);
            } finally {
                // Mettre à jour le state Redux pour indiquer qu'on n'est plus dans une room
                dispatch(roomIdUpdated(null));
            }
        } else {
            dispatch(roomIdUpdated(null));
        }
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


  // Gestion du bouton de création de salle dans le header

  // Savoir si on est dans l'onglet de consultation ou d'informations
  // (pour afficher le formulaire ou la consultation)
  const [isConsultationTab, setIsConsultationTab] = useState(false);

  // Stocker dans un state la fonction de création de salle envoyé et remonté depuis DoctorRoomManager dans ConsultationRoom
  const [receiveHandleCreateRoom, setReceiveHandleCreateRoom] = React.useState<
    (() => Promise<void>) | null
  >(null);

  // Récupérer la fonction de création de salle envoyé et remonté depuis DoctorRoomManager dans ConsultationRoom
  const getHandleCreateRoom = React.useCallback((fn: () => Promise<void>) => {
    setReceiveHandleCreateRoom(() => fn);
  }, []);

  // Créer la fonction au click qui va appeler la fonction de création de salle envoyé et remonté depuis DoctorRoomManager dans ConsultationRoom
  const handleCreateRoom = React.useCallback(async () => {
    if (receiveHandleCreateRoom) {
      await receiveHandleCreateRoom(); // appelle la fonction async de l'enfant
    } else {
      alert("Fonction pas encore reçue");
    }
  }, [receiveHandleCreateRoom]);


  // Gestion du bouton de connexion à un appareil bluetooth dans le header

  // Stocker dans un state la fonction de connexion Bluetooth envoyé et remonté depuis BluetoothContext dans ConsultationRoom
  const [receiveHandleConnect, setReceiveHandleConnect] = React.useState<
    (() => Promise<void>) | null
  >(null);

  // Récupérer la fonction de connexion Bluetooth envoyé et remonté depuis BluetoothContext dans ConsultationRoom
  const getHandleConnect = React.useCallback((fn: () => Promise<void>) => {
    setReceiveHandleConnect(() => fn);
  }, []);

  // Créer la fonction au click qui va appeler la fonction de connexion BluetoothContext envoyé et remonté depuis DoctorRoomManager dans ConsultationRoom
  const handleConnect = React.useCallback(async () => {
    if (receiveHandleConnect) {
      receiveHandleConnect();
    } else {
      alert("Fonction pas encore reçue");
    }
  }, [receiveHandleConnect]);

  return (
    <Container fluid>
      <Row>
        {/* Colonne gauche : Side Menu */}
        <Col
          className="bg-grey p-0"
          style={{ flex: "0 0 22%", maxWidth: "22%" }}
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
        <Col className="p-0 h-100" style={{ flex: "0 0 78%", maxWidth: "78%" }}>
          {/* Composant Header de tableau de bord */}
          <Header variant="dashboard">
            {!isConsultationTab ? (
              // Si on est dans l'onglet "Information patient/praticien"
              // Afficher le titre en fonction du type d'utilisateur (patient ou praticien)
              <h2 className="fs-3">
                {`Information du ${
                  userKind === "patient" ? "patient" : "praticien"
                }`}
              </h2>
            ) : !roomId ? (
              // Si on est dans l'onglet "Consultation" mais qu'aucune salle n'est sélectionnée
              // Afficher pour le patient le titre "Choisissez une salle"
              // Afficher pour le praticien le titre "Choisissez une salle" avec les 2 boutons de création/suppression de salle
              <div className="d-flex flex-row align-items-center justify-content-between w-100">
                <h2 className="fs-3">Choisissez une salle de consultation</h2>

                {userKind === "practitioner" && (
                  <>
                    <Button
                      className="primary-btn ps-3 pe-3 d-block"
                      onClick={handleCreateRoom}
                    >
                      Créer une salle
                    </Button>
                  </>
                )}
              </div>
            ) : userKind === "practitioner" ? (
              // Si on est dans l'onglet "Consultation", qu'une salle a été choisie et que l'utilisateur est un praticien
              // Afficher le titre "Salle de téléconsultation"
              <h2 className="fs-3">Salle de téléconsultation</h2>
            ) : (
              // Si on est dans l'onglet "Consultation", qu'une salle a été choisie et que l'utilisateur est un patient
              // Afficher les éléments de connexion bluetooth côté patient et les informations des appareils
              <>
                {/* Bouton de connexion d'un appareil Bluetooth */}
                <Button
                  onClick={handleConnect}
                  className="primary-btn pe-3 ps-3"
                >
                  Connecter un appareil
                </Button>
                <p className="m-0 fw-medium">Type de l'appareil</p>
                <p className="m-0" style={{maxWidth: "18em", fontSize: ".7em"}}>État : En attenteqq qq qqqq q qqqqq qqqqqq qqqqqqq qq qqq</p>
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
              <ConsultationRoom
                onPeerConnectionReady={handlePeerConnectionReady}
                handleDisconnect={handleDisconnect}
                onCreateRoom={getHandleCreateRoom}
                onSendConnect={getHandleConnect}
              />

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
