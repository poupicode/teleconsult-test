import React, { useEffect } from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import LoginRegister from "../components/auth/LoginRegister";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const AuthPage = () => {

  return (
    <Container fluid className="vh-100 d-flex align-items-center justify-content-center bg-light">
      <Row className="w-100">
        <Col xs={12} sm={8} md={6} lg={4} className="mx-auto">
          <h2 className="text-center mb-4">Connexion ou inscription</h2>
          <LoginRegister />
        </Col>
      </Row>
    </Container>
  );
};

export default AuthPage;