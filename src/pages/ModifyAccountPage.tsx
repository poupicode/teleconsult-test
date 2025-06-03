import Container from "react-bootstrap/Container";
import Header from "@/components/Header";
import ModifyAccount from "@/components/auth/ModifyAccount";


const ModifyAccountPage = () => {
  return (
    <>
      <Header variant="public">
        <h1>Modifier le compte</h1>
      </Header>
      <Container className="d-flex justify-content-center w-100 mt-4">
        <ModifyAccount />
      </Container>
    </>
  );
};

export default ModifyAccountPage;