import { Card } from "react-bootstrap";

// Composant pour afficher les informations du patient
type InformationsFormDetails = {
  name: string;
  first_name: string;
  birth_date?: string;
  gender?: "Homme" | "Femme";
  patient_number?: number;
  consultation_reason?: string;
  occupation?: string;
};

// Types pour les données du formulaire d'informations
type InformationsFormData = {
  patientInformations: InformationsFormDetails | null;
};

// Composant pour afficher les informations du patient dans le menu latéral
const PatientInformations = ({ patientInformations } : InformationsFormData) => {
  return (
    <Card className="p-0" style={{marginTop: "3.5em"}}>
      <Card.Body>
        <Card.Title as={"h3"} className="color-red fs-5 m-0">Patient</Card.Title>
        <hr className="mb-3" />
        <ul>
          <li className="mb-1">
            <small>{patientInformations?.name || "N/A"}</small>
          </li>
          <li className="mb-1">
            <small>{patientInformations?.first_name || "N/A"}</small>
          </li>
          <li className="mb-1">
            <small>{patientInformations?.gender || "N/A"}</small>
          </li>
          <li className="mb-1">
            <small>
              Né{patientInformations?.gender === "Femme" && "e"}{" "}
              {patientInformations?.birth_date || "N/A"}
            </small>
          </li>
          <li className="mb-1">
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
