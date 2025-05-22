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
    <div className="container mt-5 w-100">
      <h1>Bienvenue</h1>
      {session ? (
        <>
          <p className="text-center">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Adipisci quod cupiditate error, omnis at aliquid? Possimus pariatur maiores, recusandae obcaecati, a enim distinctio consequatur cumque sapiente modi optio aut? Rerum!</p>
          <Button
            variant="primary"
            onClick={() => navigate("/consultation")}
            className="mt-3 primary-btn mx-auto d-block"
          >
            Accéder à la consultation
          </Button>
        </>
      ) : (
        <>
          <p className="text-center">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Adipisci quod cupiditate error, omnis at aliquid? Possimus pariatur maiores, recusandae obcaecati, a enim distinctio consequatur cumque sapiente modi optio aut? Rerum!</p>
          <Button
            variant="primary"
            onClick={handleLoginClick}
            className="mt-5 primary-btn mx-auto d-block fs-5"
          >
            Commencer
          </Button>
        </>
      )}
    </div>
  );
}

export default HomePage;