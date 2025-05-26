import Container from "react-bootstrap/Container";
import Header from "@/components/Header";
import ModifyAccount from "@/components/auth/ModifyAccount";


const ModifyAccountPage = () => {
  return (
    <>
      <Header variant="public" title="Modifier le compte" />
      <Container className="d-flex justify-content-center w-100 mt-4">
        <ModifyAccount />
      </Container>
    </>
  );
};

export default ModifyAccountPage;