import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Button } from 'react-bootstrap';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/app/store';
import { clearMessages } from '../../features/chat/chatSlice';
import { PeerConnection, Role, ChatMessage } from '@/features/room/rtc/peer';
import { BsSend } from 'react-icons/bs';
import { FaUserMd, FaUser } from 'react-icons/fa';

interface ChatBoxProps {
    peerConnection: PeerConnection | null;
}

// Composant pour afficher un message unique
const ChatMessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const messageTime = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isPractitioner = message.senderRole === Role.PRACTITIONER;

    return (
        <div className="d-flex mb-2">
            <div className="d-flex align-items-start">
                <div
                    className={`rounded-circle p-2 me-2 d-flex justify-content-center align-items-center ${isPractitioner ? 'bg-success' : 'bg-primary'}`}
                    style={{ width: '35px', height: '35px' }}
                >
                    {isPractitioner ?
                        <FaUserMd color="white" size={18} /> :
                        <FaUser color="white" size={18} />
                    }
                </div>
                <div
                    className="chat-message p-2 rounded-3 bg-light text-dark"
                    style={{ maxWidth: '80%', borderRadius: '12px' }}
                >
                    <div className="message-content">
                        {message.content}
                    </div>
                    <div className="message-meta text-end text-muted" style={{ fontSize: '0.75rem' }}>
                        {messageTime}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ChatBox: React.FC<ChatBoxProps> = ({ peerConnection }) => {
    const [message, setMessage] = useState('');
    const [isDataChannelOpen, setIsDataChannelOpen] = useState(false);
    const currentRoomId = useSelector((state: RootState) => state.room.roomId);
    const messagesByRoom = useSelector((state: RootState) => state.chat.messagesByRoom);
    const currentUserId = useSelector((state: RootState) => state.user.id);
    const dispatch = useDispatch();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Obtenir les messages de la salle actuelle
    const chatMessages = currentRoomId ? (messagesByRoom[currentRoomId] || []) : [];

    // Nettoyer les messages quand on quitte la salle
    useEffect(() => {
        if (!peerConnection && currentRoomId) {
            dispatch(clearMessages(currentRoomId));
            setIsDataChannelOpen(false);
        }
    }, [peerConnection, dispatch, currentRoomId]);

    // Vérifier périodiquement l'état du DataChannel
    useEffect(() => {
        if (!peerConnection) {
            setIsDataChannelOpen(false);
            return;
        }

        // Vérifier immédiatement l'état du DataChannel
        setIsDataChannelOpen(peerConnection.isDataChannelAvailable());

        // Si le DataChannel n'est pas encore ouvert, configurer une vérification périodique
        if (!peerConnection.isDataChannelAvailable()) {
            console.log('[ChatBox] DataChannel not ready yet, setting up polling');

            const intervalId = setInterval(() => {
                const isAvailable = peerConnection.isDataChannelAvailable();
                console.log('[ChatBox] Checking DataChannel availability:', isAvailable);

                if (isAvailable) {
                    setIsDataChannelOpen(true);
                    clearInterval(intervalId);
                    console.log('[ChatBox] DataChannel is now open, stopped polling');
                }
            }, 1000); // Vérifier toutes les secondes

            return () => {
                clearInterval(intervalId);
            };
        }
    }, [peerConnection]);

    // Pour réagir aux actions redux qui indiquent un changement d'état du DataChannel
    useEffect(() => {
        if (peerConnection) {
            const isAvailable = peerConnection.isDataChannelAvailable();
            console.log('[ChatBox] DataChannel state changed, availability:', isAvailable);
            setIsDataChannelOpen(isAvailable);
        }
    }, [chatMessages, peerConnection]); // chatMessages est utilisé comme dépendance pour détecter les dispatches du canal de données

    // Scroll automatique vers le bas quand de nouveaux messages arrivent
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim() || !peerConnection || !currentRoomId) return;

        const success = peerConnection.sendChatMessage(message.trim());
        if (success) {
            setMessage('');
        }
    };

    return (
        <Card className="chat-box">
            <Card.Header>
                <h5 className="mb-0">Chat</h5>
                {peerConnection && peerConnection.isConnected() && !isDataChannelOpen && (
                    <div className="text-warning small">Établissement de la connexion du chat...</div>
                )}
            </Card.Header>
            <Card.Body className="d-flex flex-column p-0">
                <div
                    className="chat-messages p-3"
                    style={{
                        height: '250px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {chatMessages.length === 0 ? (
                        <div className="text-center text-muted my-auto">
                            {isDataChannelOpen
                                ? 'Aucun message pour le moment'
                                : 'Le chat sera disponible quand la connexion sera établie'}
                        </div>
                    ) : (
                        chatMessages.map((msg, index) => (
                            <ChatMessageItem
                                key={`${msg.timestamp}-${index}`}
                                message={msg}
                            />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <Form onSubmit={handleSubmit} className="mt-auto p-2 border-top">
                    <Form.Group className="d-flex">
                        <Form.Control
                            type="text"
                            placeholder="Votre message..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            disabled={!isDataChannelOpen || !currentRoomId}
                        />
                        <Button
                            variant="primary"
                            type="submit"
                            className="ms-2"
                            disabled={!isDataChannelOpen || !message.trim() || !currentRoomId}
                        >
                            <BsSend />
                        </Button>
                    </Form.Group>
                </Form>
            </Card.Body>
        </Card>
    );
};

export default ChatBox;