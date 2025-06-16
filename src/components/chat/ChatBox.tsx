import React, { useState, useEffect, useRef } from "react";
import { Card, Form, Button, OverlayTrigger, Popover } from "react-bootstrap";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/app/store";
import { clearMessages } from "../../features/chat/chatSlice";
import { PeerConnection, Role, ChatMessage } from "@/features/room/rtc/peer";
import { BsSend } from "react-icons/bs";
import { FaUserMd, FaUser } from "react-icons/fa";

interface ChatBoxProps {
  peerConnection: PeerConnection | null;
}

// Composant pour afficher un message unique
const ChatMessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const messageTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isPractitioner = message.senderRole === Role.PRACTITIONER;

  return (
    <div className="d-flex mb-2">
      <div className="d-flex align-items-start">
        <OverlayTrigger
          trigger={["hover", "focus"]}
          placement="bottom"
          overlay={
            <Popover className="roomPopup bg-white-pink border-0 card p-0 rounded-2">
              <Popover.Body className={`p-1 small ${!isPractitioner && "color-red"}`}>
                {isPractitioner ? "Praticien" : "Patient"}
              </Popover.Body>
            </Popover>
          }
        >
          <div
            className={`rounded-circle p-2 me-2 d-flex justify-content-center align-items-center ${
              isPractitioner ? "bg-blue" : "bg-red"
            }`}
            style={{ width: "35px", height: "35px", overflow: "hidden" }}
          >
            <img src="/icons/profile-icon.png" alt="Icône profil" width={40} />
          </div>
        </OverlayTrigger>

        <div
          className={`p-2 rounded-3 bg-white-pink`}
          style={{ maxWidth: "80%", borderRadius: "12px",filter: "drop-shadow(-2px 2px 5px rgba(0, 0, 0, 0.3))" }}
        >
            <p className="m-0"><small className={`${!isPractitioner && "color-red"}`} style={{fontSize: ".8em"}}>{isPractitioner ? "Praticien" : "Patient"}</small></p>
          <div className="message-content fw-medium small">
            {message.content}
          </div>
          <div
            className="message-meta text-end"
            style={{ fontSize: "0.75rem" }}
          >
            <small className="fw-semibold opacity-50">{messageTime}</small>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatBox: React.FC<ChatBoxProps> = ({ peerConnection }) => {
  const [message, setMessage] = useState("");
  const [isDataChannelOpen, setIsDataChannelOpen] = useState(false);
  const currentRoomId = useSelector((state: RootState) => state.room.roomId);
  const messagesByRoom = useSelector(
    (state: RootState) => state.chat.messagesByRoom
  );
  const currentUserId = useSelector((state: RootState) => state.user.id);
  const dispatch = useDispatch();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Obtenir les messages de la salle actuelle
  const chatMessages = currentRoomId ? messagesByRoom[currentRoomId] || [] : [];

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
      console.log("[ChatBox] DataChannel not ready yet, setting up polling");
      
      // Check if there are enough participants before polling
      const hasEnoughParticipants = peerConnection.isRoomReady && peerConnection.isRoomReady();
      
      // Use a counter to reduce logging frequency
      let pollCount = 0;
      const LOG_FREQUENCY = 10; // Only log every 10 polls (10 seconds)
      
      const intervalId = setInterval(() => {
        const isAvailable = peerConnection.isDataChannelAvailable();
        
        // Only log occasionally to reduce console spam
        if (pollCount % LOG_FREQUENCY === 0) {
          console.log(
            "[ChatBox] Checking DataChannel availability:",
            isAvailable
          );
        }
        pollCount++;

        if (isAvailable) {
          setIsDataChannelOpen(true);
          clearInterval(intervalId);
          console.log("[ChatBox] DataChannel is now open, stopped polling");
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
      console.log(
        "[ChatBox] DataChannel state changed, availability:",
        isAvailable
      );
      setIsDataChannelOpen(isAvailable);
    }
  }, [chatMessages, peerConnection]); // chatMessages est utilisé comme dépendance pour détecter les dispatches du canal de données

  // Scroll automatique vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() || !peerConnection || !currentRoomId) return;

    const success = peerConnection.sendChatMessage(message.trim());
    if (success) {
      setMessage("");
    }
  };

  return (
    <Card
      className="p-0 bg-white-pink"
      style={{ flexGrow: "1", overflow: "hidden" }}
    >
      <Card.Body className="h-100 w-100 p-0 d-flex flex-column">
        <Card.Title as={"h2"} className="fs-6 text-center mt-2">
          Chat
        </Card.Title>
        <hr className="m-0 mx-2" />
        <div
          className="p-2"
          style={{
            flexGrow: "1",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {peerConnection &&
            peerConnection.isConnected() &&
            !isDataChannelOpen && (
              <div className="p-1 small fw-medium mt-2">
                Établissement de la connexion du chat...
              </div>
            )}

          {chatMessages.length === 0 ? (
            <div className="text-center color-red my-auto small">
              {isDataChannelOpen
                ? "Aucun message pour le moment"
                : "Le chat sera disponible quand la connexion sera établie"}
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
        <hr className="m-0 mx-2" />
        <Form onSubmit={handleSubmit} className="mt-auto p-2">
          <Form.Group className="d-flex">
            <Form.Control
              className="bg-grey border-0 rounded-3 h-25"
              type="text"
              placeholder="Votre message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!isDataChannelOpen || !currentRoomId}
            />
            <Button
              type="submit"
              className="ms-2 px-2 pt-0 pb-0 secondary-btn rounded-2"
              disabled={!isDataChannelOpen || !message.trim() || !currentRoomId}
            >
              <BsSend />
            </Button>
          </Form.Group>
        </Form>
      </Card.Body>

      {/* <div className="h-100" style={{ overflowY: "auto" }}>

      </div> */}
      {/* {peerConnection &&
          peerConnection.isConnected() &&
          !isDataChannelOpen && (
            <div className="text-warning small">
              Établissement de la connexion du chat...
            </div>
          )} */}
      {/* <Card.Body className="d-flex flex-column p-2 h-100">
        <Card.Title as={"h2"} className="fs-6 text-center">
          Chat
        </Card.Title>
        <hr className="m-0" />
        <div
          className="chat-messages p-0"
          style={{
            flexGrow: "1",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
            <p>message</p>
            <p>message</p>
            <p>message</p>
            <p>message</p>
            <p>message</p>
            <p>message</p>
            <p>message</p>
          {chatMessages.length === 0 ? (
            <div className="text-center text-muted my-auto">
              {isDataChannelOpen
                ? "Aucun message pour le moment"
                : "Le chat sera disponible quand la connexion sera établie"}
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
      </Card.Body> */}
    </Card>
  );
};

export default ChatBox;
