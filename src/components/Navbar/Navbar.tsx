import {
  Navbar,
  Nav,
  Container,
  Button
} from "react-bootstrap";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";

import ProfilePopup from "./ProfilePopup";
import styles from "./Navbar.module.css";

const AppNavbar = () => {
  const { user, session } = useAuth();
  const [isProfileButtonClicked, setIsProfileButtonClicked] = useState(false);

  const target = useRef(null);

  // Fermer la pop up à chaque navigation
  const location = useLocation();
  useEffect(() => {
    setIsProfileButtonClicked(false);
  }, [location.pathname]);

  return (
    <Navbar className={`${styles.navbar} bg-blue position-fixed w-100`} expand="lg">
      <Container>
        <Navbar.Brand className="color-white fw-black fs-3" href="/">Téléconsultation</Navbar.Brand>
        <Nav className="ms-auto">
          {session && (
            <Navbar.Text className="me-3 color-white">
              Connecté en tant que : <strong className="color-white">{user?.email}</strong>
            </Navbar.Text>
          )}
          <Button variant="secondary" className={styles.profileBtn}
            ref={target}
            onClick={() => setIsProfileButtonClicked(!isProfileButtonClicked)}
          >
            <img src="/icons/profile-icon.png" alt="Icône profil" width={50} />
            
          </Button>
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
