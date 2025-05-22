import { Navbar, Nav, Container, Button } from "react-bootstrap";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import React from "react";

const AppNavbar = () => {
  const { user, logout, session } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/"); // Retour à la page d'accueil
  };

  // if (!session) return null; // Pas de navbar si pas connecté

  return (
    <Navbar bg="light" expand="lg">
      <Container>
        <Navbar.Brand href="/">Téléconsultation</Navbar.Brand>
        <Nav className="ms-auto">
          <Navbar.Text className="me-3">
            Connecté en tant que <strong>{user?.email}</strong>
          </Navbar.Text>
          <Button variant="outline-danger" onClick={handleLogout}>
            Déconnexion
          </Button>
        </Nav>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;