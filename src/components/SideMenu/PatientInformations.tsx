import { Card } from "react-bootstrap";

const PatientInformations = () => {
  return (
    <Card className="mb-3">
      <Card.Body>
        <Card.Title className="color-red">Patient</Card.Title>
        <hr className="mb-4" />
        <ul>
            <li>Nom</li>
            <li>Prénom</li>
            <li>Date de naissance</li>
            <li>Sexe / genre</li>
            <li>Numéro du patient</li>
            <li>Motif de consultation</li>
        </ul>
      </Card.Body>
    </Card>
  );
};
export default PatientInformations;
