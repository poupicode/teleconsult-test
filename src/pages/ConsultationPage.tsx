import React, { useState, useEffect } from "react";
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
import DoctorInterfaceConsultation from "@/components/room/DoctorInterfaceConsultation";
import DoctorInterfaceConsultation from "@/components/room/DoctorInterfaceConsultation";

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
    if (peerConnection) {
      console.log("[ConsultationPage] Déconnexion explicite du PeerConnection");
      peerConnection.disconnect();
    }
    dispatch(roomIdUpdated(null));
  };

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
    const room = await RoomSupabase.createRoom();
    if (room) {
      dispatch(roomIdUpdated(room.id));
    }
  };

  useEffect(() => {
    if (showRoomBrowser) {
      // Logic if needed on showing browser
      // Logic if needed on showing browser
    }
  }, [showRoomBrowser]);

  const handlePeerConnectionReady = (peer: PeerConnection) => {
    setPeerConnection(peer);
  };

  return (
    <Container fluid className="mt-4">
    <Container fluid className="mt-4">
      <Row>
        <Col md={3}>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Informations patient</Card.Title>
              <p>
                Cette section pourra contenir des informations sur le patient
              </p>
            </Card.Body>
            {userKind === "patient" && <BluetoothContext />}
            {userKind === "practitioner" && <DoctorInterface />}
          </Card>
        <Col md={3}>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Informations patient</Card.Title>
              <p>
                Cette section pourra contenir des informations sur le patient
              </p>
            </Card.Body>
            {userKind === "patient" && <BluetoothContext />}
            {userKind === "practitioner" && <DoctorInterface />}
          </Card>
        </Col>

        <Col md={6}>
          <Card className="mb-3">
            <Card.Body>
              <ConsultationRoom
                onPeerConnectionReady={handlePeerConnectionReady}
              />
            </Card.Body>
          </Card>
          {/* Interface du praticien pour créer et gérer les salles */}
          {userKind === "practitioner" && (
            <Card className="mb-3">
              <Card.Body>
                <DoctorInterfaceConsultation />
              </Card.Body>
            </Card>
          )}
        </Col>

        <Col md={3}>
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

              {userKind === "practitioner" && !roomId && (
                <Button
                  variant="primary"
                  onClick={onCreateRoomClick}
                  className="mb-3 w-100"
                >
                  <MdAddIcCall className="me-1" /> Créer une salle
                </Button>
              )}

              {userKind === "patient" && <RoomList />}
            </Card.Body>
          </Card>

          {roomId && (
            <Card className="mb-3">
              <ChatBox peerConnection={peerConnection} />
            </Card>
          {roomId && (
            <Card className="mb-3">
              <ChatBox peerConnection={peerConnection} />
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
}
