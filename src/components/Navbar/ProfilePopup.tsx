import { Overlay, Popover, Button } from "react-bootstrap";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

import styles from "./Navbar.module.css";

// Définition des types pour les props du composant ProfilePopup
interface PropsPopup {
  target: any;
  isProfileButtonClicked: boolean;
}

// Le composant ProfilePopup affiche les informations de l'utilisateur connecté
// et permet de se déconnecter ou de modifier son compte.
export default function ProfilePopup({
  target,
  isProfileButtonClicked,
}: PropsPopup) {
  const { user, logout, session } = useAuth();
  const navigate = useNavigate();

  // Fonction pour gérer la déconnexion de l'utilisateur
  // et rediriger vers la page de connexion
  const handleLogout = async () => {
    await logout();
    navigate("/login"); // Retour à la page d'accueil
  };

  // Logique pour modifier le compte de l'utilisateur
  // et rediriger vers une page de modification de compte
  const handleModifyAccount = () => {
    navigate("/modify-account");
  };

  // Récupération du type d'utilisateur (patient ou praticien) depuis le store Redux
  const userKind: string | null = user?.user_metadata.user_kind;

  return (
    <Overlay
      placement="bottom-end"
      target={target}
      show={isProfileButtonClicked}
    >
      {(props) => (
        <Popover
          className={`${styles.popup} card bg-grey`}
          id="overlay-example"
          {...props}
        >
          <Popover.Header as="h3" className="fs-5 mb-4">
            {/* Titre du popover */}
            {session ? "Username" : "Vous n'êtes pas encore connecté"}
          </Popover.Header>
          <Popover.Body>
            {/* Informations de l'utilisateur */}
            {session ? (
              <>
                <ul>
                  <li key="user-email">
                    <p className="color-lightblue">{user?.email}</p>
                  </li>
                  <li key="user-kind">
                    <p className="fs-6">
                      Rôle :{" "}
                      {userKind &&
                        userKind.charAt(0).toUpperCase() +
                          userKind.slice(1).toLowerCase()}
                    </p>
                  </li>
                </ul>
                <ul className="d-grid gap-2">
                  <li key="modify-button" className="mt-2">
                    {/* Bouton pour modifier le compte */}
                    <Button
                      variant="secondary"
                      className="secondary-btn"
                      onClick={handleModifyAccount}
                    >
                      Modifier le compte
                    </Button>
                  </li>
                  <li key="logout-button" className="mt-2 mb-2">
                    {/* Bouton de déconnexion */}
                    <Button
                      variant="link"
                      className="tertiary-btn"
                      onClick={handleLogout}
                    >
                      Se déconnecter
                    </Button>
                  </li>
                </ul>
              </>
            ) : (
              <Button
                variant="primary"
                className="primary-btn mb-3"
                onClick={() => {
                  navigate("/login");
                }}
              >
                Se connecter
              </Button>
            )}
          </Popover.Body>
        </Popover>
      )}
    </Overlay>
  );
}
