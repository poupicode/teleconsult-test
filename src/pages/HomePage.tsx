import { useAuth } from "@/contexts/AuthContext";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {

    const { session, user } = useAuth();
    const navigate = useNavigate();
  
    useEffect(() => {
      if (!session) {
        navigate("/login"); // Redirige manuellement
      }
    }, [session]);

    return (
      <div className="container mt-5">
        <h1>Bienvenue</h1>
        <p>Vous êtes connecté avec succès !</p>
      </div>
    );
  }
  
  export default HomePage;