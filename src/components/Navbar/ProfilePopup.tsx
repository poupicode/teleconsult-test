import { Overlay, Popover, Button } from "react-bootstrap";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { RootState } from "@/app/store";
import { useSelector } from "react-redux";

import styles from "./Navbar.module.css";

interface PropsPopup {
  target: any;
  isProfileButtonClicked: boolean;
}

export default function ProfilePopup({
  target,
  isProfileButtonClicked,
}: PropsPopup) {
  const { user, logout, session } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login"); // Retour à la page d'accueil
  };

  const userKind: string | null = useSelector((state: RootState) => state.user.user_kind);

  return (
    <Overlay
      placement="bottom-end"
      target={target}
      show={isProfileButtonClicked}
    >
      {(props) => (
        <Popover className={`${styles.popup} card bg-grey`} id="overlay-example" {...props}>
          <Popover.Header as="h3" className="fs-5 mb-4">
            {session ? "Username" : "Vous n'êtes pas encore connecté"}
          </Popover.Header>
          <Popover.Body>
            {session ? (
              <>
                <ul>
                  <li key="user-email">
                    <p className="color-lightblue">{user?.email}</p>
                  </li>
                  <li key="user-kind">
                    <p className="fs-6">Rôle : {userKind && (userKind.charAt(0).toUpperCase() + userKind.slice(1).toLowerCase())}</p>
                  </li>
                </ul>
                <ul className="d-grid gap-2">
                  <li key="modify-button" className="mt-2">
                    <Button variant="secondary" className="secondary-btn">
                      Modifier le compte
                    </Button>
                  </li>
                  <li key="logout-button" className="mt-2 mb-2">
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
              <Button variant="primary" className="primary-btn mb-3"
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
