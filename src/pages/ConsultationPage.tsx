import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Collapse } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import RoomBrowser from '@/components/room/RoomBrowser';
import RoomList from '@/components/room/RoomList';
import ConsultationRoom from '@/components/room/ConsultationRoom';
import ChatBox from '@/components/chat/ChatBox';
import { RootState } from '@/app/store';
import { roomIdUpdated } from '@/features/room/roomSlice';
import { RoomSupabase } from '@/features/room/roomSupabase';
import { MdAddIcCall } from 'react-icons/md';
import { PeerConnection } from '@/features/room/rtc/peer';

export default function ConsultationPage() {
    const userKind = useSelector((state: RootState) => state.user.user_kind);
    const roomId = useSelector((state: RootState) => state.room.roomId);
    const dispatch = useDispatch();
    const [showRoomBrowser, setShowRoomBrowser] = useState(false);
    const [roomName, setRoomName] = useState<string>('');
    const [peerConnection, setPeerConnection] = useState<PeerConnection | null>(null);

    const handleDisconnect = () => {
        // Déconnecter explicitement le PeerConnection avant de quitter la salle
        if (peerConnection) {
            console.log('[ConsultationPage] Déconnexion explicite du PeerConnection');
            peerConnection.disconnect();
        }
        dispatch(roomIdUpdated(null));
    };

    // Charger les détails de la salle si on est connecté
    useEffect(() => {
        if (roomId) {
            RoomSupabase.getRoom(roomId).then(room => {
                if (room) {
                    setRoomName(room.short_name);
                }
            });
        } else {
            setRoomName('');
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

    return (
        <Container fluid className="mt-4">
            <Row>
                {/* Colonne gauche : Espace pour des fonctionnalités futures */}
                <Col md={3}>
                    <Card className="mb-3">
                        <Card.Body>
                            <Card.Title>Informations patient</Card.Title>
                            <p>Cette section pourra contenir des informations sur le patient</p>
                        </Card.Body>
                    </Card>
                </Col>

                {/* Colonne centrale : Consultation Room */}
                <Col md={6}>
                    <Card className="mb-3">
                        <Card.Body>
                            <ConsultationRoom onPeerConnectionReady={handlePeerConnectionReady} />
                        </Card.Body>
                    </Card>
                </Col>

                {/* Colonne droite : RoomBrowser pour praticiens ou RoomList pour patients */}
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
                                        {showRoomBrowser ? 'Masquer les consultations' : 'Gérer les consultations'}
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
                                <p className="mb-1"><strong>Salle : {roomName || 'n/a'}</strong></p>
                                <p className="mb-1 text-muted small">{roomId || 'Aucune salle sélectionnée'}</p>

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
                            {userKind === "patient" && (
                                <RoomList />
                            )}
                        </Card.Body>
                    </Card>

                    {/* Nouvelle carte pour le chatbox sous la consultation en cours */}
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
