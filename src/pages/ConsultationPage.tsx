import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Button, Collapse } from "react-bootstrap";
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
import DoctorRoomManager from "@/components/room/DoctorRoomManager";

type PatientInformationsFormData = {
  name: string;
  first_name: string;
  birth_date: string;
  gender: "Homme" | "Femme";
  patient_number: number;
  consultation_reason: string;
};

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
  const [isInformationsEntered, setIsInformationsEntered] = useState(false);
  const [patientInformations, setPatientInformations] =
    useState<PatientInformationsFormData | null>(null);
  const [praticienInformations, setPraticienInformations] =
    useState<PraticienInformationsFormData | null>(null);
  const [isConsultationTab, setIsConsultationTab] = useState(false);

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

  const handleDisconnect = () => {
    if (peerConnection) {
      console.log("[ConsultationPage] Déconnexion explicite du PeerConnection");
      peerConnection.disconnect();
    }
    setPeerConnection(null);
    dispatch(roomIdUpdated(null));
  };

  const handlePeerConnectionReady = (peer: PeerConnection) => {
    setPeerConnection(peer);
  };

  const onCreateRoomClick = async () => {
    const room = await RoomSupabase.createRoom("Ma salle privée");
    if (room) {
      dispatch(roomIdUpdated(room.id));
    }
  };

  return (
    <div className="d-flex" style={{ minHeight: "100vh" }}>
      {/* Sidebar */}
      <div
        className="bg-light p-3"
        style={{ width: "220px", borderRight: "1px solid #dee2e6" }}
      >
        <SideMenu
          userKind={userKind}
          isInformationsEntered={isInformationsEntered}
          patientInformations={patientInformations}
          isConsultationTab={isConsultationTab}
          setIsConsultationTab={setIsConsultationTab}
        />
      </div>

      {/* Main Content */}
      <div className="flex-grow-1 p-4">
        <h2 className="text-danger fw-bold mb-4 mt-5">
          {isConsultationTab
            ? "Consultation en cours"
            : `Informations du ${
                userKind === "patient" ? "patient" : "praticien"
              }`}
        </h2>

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
          <>
            {/* Gestion Bluetooth */}
            {userKind === "patient" && peerConnection && (
              <BluetoothContext peerConnection={peerConnection} />
            )}
            {userKind === "practitioner" && peerConnection && (
              <DoctorInterface peerConnection={peerConnection} />
            )}

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

            {/* Consultation Room */}
            <div
              className="card shadow-lg p-3 mb-4 rounded mt-5"
              style={{ backgroundColor: "#F0EDF4" }}
            >
              <ConsultationRoom
                onPeerConnectionReady={handlePeerConnectionReady}
              />
            </div>

            {/* Room Infos & Quit Button */}
            {roomId && (
              <div
                className="card shadow-sm p-3 mb-4 rounded"
                style={{ backgroundColor: "#fff" }}
              >
                <p className="fw-bold mb-1">Salle : {roomName || "n/a"}</p>
                <p className="text-muted small">{roomId}</p>
                <Button
                  variant="warning"
                  size="sm"
                  className="rounded-pill w-100 mt-2"
                  onClick={handleDisconnect}
                >
                  Quitter la consultation
                </Button>
              </div>
            )}

            {/* ChatBox */}
            {roomId && (
              <div
                className="card shadow-sm p-3 rounded"
                style={{ backgroundColor: "#F0EDF4" }}
              >
                <ChatBox peerConnection={peerConnection} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
