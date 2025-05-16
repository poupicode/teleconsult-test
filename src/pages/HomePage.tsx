import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";
import { useAuth } from "@/contexts/AuthContext";

function HomePage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const handleLoginClick = () => {
    navigate("/login");
  };

  return (
    <div className="container mt-5">
      <h1>Bienvenue</h1>
      {session ? (
        <>
          <p>Vous êtes connecté avec succès !</p>
          <Button
            variant="primary"
            onClick={() => navigate("/consultation")}
            className="mt-3"
          >
            Accéder à la consultation
          </Button>
        </>
      ) : (
        <>
          <p>Vous n'êtes pas encore connecté.</p>
          <Button
            variant="primary"
            onClick={handleLoginClick}
            className="mt-3"
          >
            Se connecter
          </Button>
        </>
      )}
    </div>
  );
}

export default HomePage;