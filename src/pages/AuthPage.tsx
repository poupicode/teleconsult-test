import { useState } from "react";
import Container from "react-bootstrap/Container";
import LoginRegister from "@/components/auth/LoginRegister";
import Header from "@/components/Header";


const AuthPage = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  return (
    <>
      <Header variant="public">
        <h2>{!isRegistering ? "Connexion" : "Inscription"}</h2>
      </Header>
      <Container className="d-flex justify-content-center w-100 mt-4">
        <LoginRegister onIsRegistering={(val : boolean) => setIsRegistering(val)} />
      </Container>
    </>
  );
};

export default AuthPage;
