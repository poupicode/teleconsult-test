import { useNavigate } from "react-router-dom";
import { Button } from "react-bootstrap";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";

function HomePage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const handleLoginClick = () => {
    navigate("/login");
  };

  return (
    <>
      <Header variant="public" title="Bienvenue" />
      <div className="container ps-5 pe-5 mt-2 w-100">
        {session ? (
          <>
            <p className="text-center w-50 mx-auto mt-5">
              Lorem ipsum dolor sit amet, consectetur adipisicing elit. Adipisci
              quod cupiditate error, omnis at aliquid? Possimus pariatur
              maiores, recusandae obcaecati, a enim distinctio consequatur
              cumque sapiente modi optio aut? Rerum!
            </p>
            <Button
              variant="primary"
              onClick={() => navigate("/consultation")}
              className="mt-5 primary-btn mx-auto d-block"
            >
              Accéder à la consultation
            </Button>
          </>
        ) : (
          <>
            <p className="text-center w-50 mx-auto mt-5">
              Lorem ipsum dolor sit amet, consectetur adipisicing elit. Adipisci
              quod cupiditate error, omnis at aliquid? Possimus pariatur
              maiores, recusandae obcaecati, a enim distinctio consequatur
              cumque sapiente modi optio aut? Rerum!
            </p>
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
    </>
  );
}

export default HomePage;
