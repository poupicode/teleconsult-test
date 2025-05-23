import { useState } from "react";
import Container from "react-bootstrap/Container";
import { Row, Col } from "react-bootstrap";
import LoginRegister from "@/components/auth/LoginRegister";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";

import styles from "./AuthPage.module.css";

const AuthPage = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  return (
    <>
      <Header variant="public" title={!isRegistering ? "Connexion" : "Inscription"} />
      <Container className="d-flex justify-content-center w-100 mt-4">
        <LoginRegister onIsRegistering={(val : boolean) => setIsRegistering(val)} />
      </Container>
    </>
  );
};

export default AuthPage;
