import { Card, Button } from "react-bootstrap";

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
  praticienInformations: InformationsFormDetails | null;
  setIsConsultationTab: (value: boolean) => void;
};

// Composant pour afficher les informations du patient dans le menu latéral
const PraticionnerInformations = ({
  praticienInformations,
  setIsConsultationTab,
}: InformationsFormData) => {
  return (
    <Card className="p-0" style={{ marginTop: "3.5em" }}>
      <Card.Body>
        <Card.Title as={"h3"} className="color-red fs-5 m-0">
          Praticien
        </Card.Title>
        <hr className="mb-3" />
        <ul>
          <li className="mb-1">
            <small>{praticienInformations?.name || "N/A"}</small>
          </li>
          <li className="mb-1">
            <small>{praticienInformations?.first_name || "N/A"}</small>
          </li>
          <li className="mb-1">
            <small>
              Profession : {praticienInformations?.occupation || "N/A"}
            </small>
          </li>
        </ul>
        <Button
          size="sm"
          className="secondary-btn mt-3 mx-auto d-block"
          onClick={() => setIsConsultationTab(false)}
        >
          Modifier
        </Button>
      </Card.Body>
    </Card>
  );
};
export default PraticionnerInformations;
