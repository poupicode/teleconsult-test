import { Navbar, Nav, Container, Button } from "react-bootstrap";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";

import ProfilePopup from "./ProfilePopup";
import NavbarPattern from "./NavbarPattern";
import styles from "./Navbar.module.css";

// Le composant AppNavbar représente la barre de navigation de l'application.
const AppNavbar = () => {
  const { user, session } = useAuth();
  const [isProfileButtonClicked, setIsProfileButtonClicked] = useState(false);

  const target = useRef(null);

  // Fermer la pop up à chaque navigation ("changeement de page")
  // pour éviter que la pop up reste ouverte si l'utilisateur navigue
  const location = useLocation();
  useEffect(() => {
    setIsProfileButtonClicked(false);
  }, [location.pathname]);

  return (
    <Navbar className={`bg-blue position-fixed w-100 p-0`} style={{zIndex: "200"}} expand="lg">
      {/* Motif de fond de la Navbar */}
      <NavbarPattern />

      {/* Contenu de la Navbar */}
      <Container className={styles.navbar}>
        {/* Titre de l'application */}
        <Navbar.Brand className="color-white fw-black fs-3" href="/">
          Téléconsultation
        </Navbar.Brand>

        {/* Informations de l'utilisateur */}
        <Nav className="ms-auto">
          {session && (
            <Navbar.Text className="me-3 color-white">
              Connecté en tant que :{" "}
              <strong className="color-white">{user?.email}</strong>
            </Navbar.Text>
          )}

          {/* Bouton de profil */}
          <Button
            variant="secondary"
            className={styles.profileBtn}
            ref={target}
            onClick={() => setIsProfileButtonClicked(!isProfileButtonClicked)}
          >
            <img src="/icons/profile-icon.png" alt="Icône profil" width={50} />
          </Button>

          {/* Pop-up de profil */}
          <ProfilePopup
            target={target.current}
            isProfileButtonClicked={isProfileButtonClicked}
          />
        </Nav>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;
