import React, { useEffect, useState, useRef } from "react";
import {
  Button,
  Form,
  Row,
  Col,
  Card,
  Tooltip,
  Popover,
  OverlayTrigger,
} from "react-bootstrap";
import { RoomSupabase, Room } from "@/features/room/roomSupabase";
import { useDispatch } from "react-redux";
import { roomIdUpdated } from "@/features/room/roomSlice";
import { supabase } from "@/lib/supabaseClient";

export default function DoctorRoomManager({
  onCreateRoom,
}: {
  onCreateRoom: (fn: () => Promise<void>) => void;
}) {
  // State pour stocker les rooms et l'état d'édition
  // Utilisation de useState pour gérer les rooms et l'état d'édition des noms
  const [rooms, setRooms] = useState<Room[]>([]);

  // Stocker le nom de la salle pendant la modification du nom d'une salle
  // Pour ensuite le mettre plus tard dans l'input
  const [editingRooms, setEditingRooms] = useState<Record<string, string>>({});

  // Regarder si on est en train de modifier ou non le nom de la salle
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  // Gestion des erreurs lors de la modification du nom d'une salle (si le nom est en double)
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dispatch = useDispatch();

  // Charger les rooms au montage
  useEffect(() => {
    loadRooms();
  }, []);

  // Récupérer les rooms dans roomSupabase.ts et les mettres dans rooms
  const loadRooms = async () => {
    const result = await RoomSupabase.getAllRooms();
    if (result) setRooms(result);
  };

  // Générer l'index du nom par défaut à la création de la prochaine salle à créer en fonction des index des salles ayant déjà un nom par défaut du type 'Salle {index}'
  // Incrémente de 1 en 1 en regardant si l'index est unique, sinon, repartir de 1 et ajouter 1 jusqu'à que ce soit le cas
  function getNextAvailableRoomNumber(rooms: Room[]): number {
    // Créer un ensemble de valeurs uniques pour stocker les index des salles avec un nom du type 'Salle {index}' (saisi par défaut)
    // Permet de comparer les index si ils sont déjà utilisés ou non
    const takenNumbers = new Set<number>();

    // Pour chaque salle déjà créée
    rooms.forEach((room) => {
      // Match exact : "Salle " suivi d'un nombre, et rien d'autre après
      const match = room.short_name.match(/^Salle (\d+)$/);
      // Si le match est réussi, l'ajouter au set d'index
      if (match) {
        takenNumbers.add(parseInt(match[1], 10));
      }
    });

    // Incrémentation de 1 en 1 en fonction du set d'index uniques
    // Tant qu'un index est pris (ça veut dire qu'il n'est pas libre), aller  au prochain index jusqu'à qu'il ne soit pas pris
    let i = 1;
    while (takenNumbers.has(i)) {
      i++;
    }
    // Retourner l'index libre
    return i;
  }

  // Fonction pour créer une salle
  const handleCreateRoom = React.useCallback(async () => {
    // Obtenir un index de libre dans rooms pour les salles nommées du type 'Salle {index}'
    const nextNumber = getNextAvailableRoomNumber(rooms);

    // Définir le nom de la salle par défaut
    const newRoomName = `Salle ${nextNumber}`;

    // Créer la nouvelle salle avec le nom par défaut dans roomSupabase.ts
    const newRoom = await RoomSupabase.createRoom(newRoomName);

    // Une fois créée, l'ajouter au suivi de l'ensemble des salles
    if (newRoom) {
      setRooms((prev) => [...prev, newRoom]);
    }
  }, [rooms]);

  // Envoyer la fonction de création de salles au composant parent (ConsultationRoom)
  // Car le bouton de création de salle est dans ConsultationPage mais il faut garder la logique ici pour mettre à jour l'affichage correctement des salles
  React.useEffect(() => {
    if (onCreateRoom) {
      onCreateRoom(handleCreateRoom);
    }
  }, [onCreateRoom, handleCreateRoom]);

  // Fonction au click sur le nom d'une salle pour le modifier et indiquant le début de la modification du nom
  const handleStartEdit = (id: string) => {
    // Mettre l'état de modification sur true
    setEditing((prev) => ({ ...prev, [id]: true }));

    // Initialiser la valeur éditée à la valeur courante si pas déjà fait
    // Ajouter à la liste de salle en cours de modification avec l' [id de la salle] : [si la salle en cours de modification n'existe pas déjà dans la liste, mettre le nom de la salle en cours de modification]
    setEditingRooms((prev) => ({
      ...prev,
      [id]: prev[id] ?? rooms.find((r) => r.id === id)?.short_name ?? "",
    }));
  };

  // Mis à jour du nom de la salle en cours de modification à chaque entrée de caractère
  const handleUpdateName = (id: string, value: string) => {
    setEditingRooms((prev) => ({ ...prev, [id]: value }));
  };

  // Ref pour re focus sur l'input de modification du nom d'une salle
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Fonction pour sauvegarder le nouveau nom de la salle une fois sorti de l'input ou après avoir appuyé sur 'entrée'
  const handleSaveName = async (id: string) => {
    // Récupérer le nouveau nom de la salle en cours de modification
    const newName = editingRooms[id]?.trim();

    // Si le nouveau nom n'existe pas, arrêter la fonction
    if (!newName) return;

    // Regarder dans la supabase si le nom existe ou non
    const { data: existing, error } = await supabase
      .from("rooms")
      .select("id")
      .eq("short_name", newName)
      .neq("id", id); // exclure la salle qu'on modifie

    if (error) {
      console.error("Erreur lors de la vérification du nom :", error);
      return;
    }

    if (existing && existing.length > 0) {
      // Le nom est déjà pris, afficher l’erreur et rester en mode édition
      setErrors((prev) => ({ ...prev, [id]: "Ce nom est déjà utilisé." }));
      // Re-focus le champ après une courte pause (sinon onBlur empêche le refocus immédiat)
      setTimeout(() => {
        inputRefs.current[id]?.focus();
      }, 0);
      return;
    }

    // Modifier dans la liste des salles dans la supabase le nom de la salle correspondante
    await supabase.from("rooms").update({ short_name: newName }).eq("id", id);

    // Supprimer l'erreur pour cette salle (si elle existait)
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });

    // Retier de la liste des salles en cours de modifications, la salle qui a fini d'être modifiée
    setEditingRooms((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });

    // Recharger les salles
    loadRooms();

    // Mettre sur false l'état de modification
    setEditing((prev) => ({ ...prev, [id]: false }));
  };

  // Fonction de suppression d'une salle
  const handleDeleteRoom = async (id: string) => {
    // Popup de confirmation de suppression de la salle
    const confirm = window.confirm("Supprimer cette salle ?");

    // Si oui, supprimer la salle et recharger les salles
    if (confirm) {
      await RoomSupabase.deleteRoom(id);
      loadRooms();
    }
  };

  // Fonction pour rejoindre une salle
  const handleJoinRoom = (id: string) => {
    dispatch(roomIdUpdated(id));
  };

  return (
    <div className="h-80">
      <Row className="gy-4">
        {/* Pour chaque salle de rooms */}
        {rooms.map((room) => (
          <Col
            className="mb-4"
            key={room.id}
            style={{
              flex: "0 0 32%",
              maxWidth: "32%",
            }}
          >
            {/* Afficher en card la salle et ses infos */}
            <Card className="card p-0 bg-grey">
              <Card.Body className="pb-1">
                <Form.Group>
                  {editing[room.id] ? (
                    // Si l'état de modification est sur true
                    // Afficher l'input de modification
                    // Si on sort de l'input ou appuie sur 'entrée', l'état de modification est sur false via handleSaveName
                    <>
                      <Form.Control
                        type="text"
                        value={editingRooms[room.id]}
                        onChange={(e) =>
                          handleUpdateName(room.id, e.target.value)
                        }
                        onBlur={() => handleSaveName(room.id)}
                        autoFocus
                        ref={(el) => {
                          inputRefs.current[room.id] = el;
                        }}
                      />
                      {errors[room.id] && (
                        <Form.Text className="text-danger">
                          {errors[room.id]}
                        </Form.Text>
                      )}
                    </>
                  ) : (
                    // Afficher simplement le nom de la salle si on n'est pas en train de modifier le nom de la salle
                    // Mise en place d'une pop-up indiquant qu'on peut modifier le nom de la salle en cliquant sur le label
                    <OverlayTrigger
                      trigger={["hover", "focus"]}
                      placement="top"
                      overlay={
                        <Popover className="roomPopup bg-white-pink border-0 card p-0 rounded-2">
                          <Popover.Body className="p-1 small">
                            Cliquer pour modifier le nom
                          </Popover.Body>
                        </Popover>
                      }
                    >
                      {/* Si on clique sur le label, on entre dans la modification du nom de la salle */}
                      <Form.Label
                        className="fw-bold"
                        onClick={() => handleStartEdit(room.id)}
                        style={{ cursor: "pointer" }}
                      >
                        {room.short_name}
                      </Form.Label>
                    </OverlayTrigger>
                  )}
                </Form.Group>

                {/* Afficher l'id de la salle */}
                <p className="color-lightblue" style={{ fontSize: "0.7rem" }}>
                  {room.id}
                </p>

                {/* Bouton pour rejoindre une salle */}
                <Button
                  variant="primary"
                  className="primary-btn mt-3 w-75 d-block mx-auto"
                  onClick={() => handleJoinRoom(room.id)}
                  size="sm"
                >
                  Rejoindre
                </Button>

                {/* Bouton pour supprimer une salle */}
                <Button
                  className="tertiary-btn mt-3 w-100"
                  onClick={() => handleDeleteRoom(room.id)}
                  size={"sm"}
                >
                  Supprimer
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
