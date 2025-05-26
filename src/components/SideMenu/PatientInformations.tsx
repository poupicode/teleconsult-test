import { Card } from "react-bootstrap";

// Composant pour afficher les informations du patient
type InformationsFormDetails = {
  name: string;
  first_name: string;
  birth_date: string;
  gender: "Homme" | "Femme";
  patient_number: number;
  consultation_reason: string;
};

// Types pour les données du formulaire d'informations
type InformationsFormData = {
  patientInformations: InformationsFormDetails | null;
};

// Composant pour afficher les informations du patient dans le menu latéral
const PatientInformations = ({ patientInformations } : InformationsFormData) => {
  return (
    <Card className="mb-3">
      <Card.Body>
        <Card.Title className="color-red">Patient</Card.Title>
        <hr className="mb-3" />
        <ul>
          <li className="mb-2">
            <small>{patientInformations?.name || "N/A"}</small>
          </li>
          <li className="mb-2">
            <small>{patientInformations?.first_name || "N/A"}</small>
          </li>
          <li className="mb-2">
            <small>{patientInformations?.gender || "N/A"}</small>
          </li>
          <li className="mb-2">
            <small>
              Né{patientInformations?.gender === "Femme" && "e"}{" "}
              {patientInformations?.birth_date || "N/A"}
            </small>
          </li>
          <li className="mb-2">
            <small>
              Numéro du patient: {patientInformations?.patient_number || "N/A"}
            </small>
          </li>
          <li>
            <small>
              Motif de consultation:{" "}
              {patientInformations?.consultation_reason || "N/A"}
            </small>
          </li>
        </ul>
      </Card.Body>
    </Card>
  );
};
export default PatientInformations;
