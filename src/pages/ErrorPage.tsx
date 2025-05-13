import React from "react";
import { Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const ErrorPage = () => {
  const navigate = useNavigate();

  return (
    <div className="d-flex flex-column justify-content-center align-items-center vh-100 bg-light text-center">
      <h1 className="display-4 mb-3">😵 Oups !</h1>
      <p className="lead">Vous vous êtes perdu ? Mince !</p>
      <p className="mb-4">Connectez-vous pour retrouver votre chemin.</p>
      <Button variant="primary" onClick={() => navigate("/login")}>
        Se connecter
      </Button>
    </div>
  );
};

export default ErrorPage;