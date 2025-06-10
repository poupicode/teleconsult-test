import { Button } from "react-bootstrap";
import PatientInformations from "./PatientInformations";

import styles from "./SideMenu.module.css";

// Types pour les informations du patient et du praticien du formulaire
type InformationsFormDetails = {
  name: string;
  first_name: string;
  birth_date: string;
  gender: "Homme" | "Femme";
  patient_number: number;
  consultation_reason: string;
};

// Types pour les informations entrées dans le menu latéral
type InformationsEntered = {
  isInformationsEntered: boolean;
  userKind: string | null;
  patientInformations: InformationsFormDetails | null;
  isConsultationTab: boolean;
  setIsConsultationTab: (value: boolean) => void;
};

// Composant pour le menu latéral de la page de consultation
// Il affiche les informations du patient ou du praticien et permet de naviguer entre les onglets "Informations" et "Consultation"
const SideMenu = ({ isInformationsEntered, userKind, patientInformations, isConsultationTab, setIsConsultationTab }: InformationsEntered) => {
  // Pour juste mettre le style des boutons d'onglet sur actif ou inactif (et pour changer d'onglet) quand on clique dessus (sur le bouton "Informations du praticien/patient" ou "Consultation")
  function handleChangeTab() {
    setIsConsultationTab(!isConsultationTab);
  }

  return (
    <div className={`w-100 ${styles.h100vh}`}>
      {/* Si les informations sont entrées, activer la navigation sur le menu latéral */}
      <ul className={`${!isInformationsEntered && styles.sideMenuInactive}`}>
        <li key="informations">
          <Button
            className={`w-100 text-start ${styles.noRouded} ${
              styles.btnTab
            } ${styles.mt4em} ${!isConsultationTab && "fw-medium"}`}
            disabled={!isConsultationTab}
            onClick={handleChangeTab}
          >
            {/* Titre de l'onglet : patient ou praticien*/}
            Informations du {userKind === "patient" ? "patient" : "praticien"}
          </Button>
        </li>
        <li key="consultation">
          <Button
            className={`w-100 text-start ${styles.noRouded} ${styles.btnTab} ${
              isConsultationTab && "fw-medium"
            }`}
            disabled={isConsultationTab}
            onClick={handleChangeTab}
          >
            Consultation
          </Button>
        </li>
        {/* Afficher les informations du patient si elles sont disponibles (se réactualise quand on rentre les informations dans patientInformations (dans le composant parent ConsultationPage)) */}
        {isInformationsEntered && userKind==="patient" && (
          <li key="patient" className="mt-2 p-2" style={{height: "unset"}}>
            <PatientInformations patientInformations={patientInformations} />
          </li>
        )}
      </ul>
    </div>
  );
};

export default SideMenu;
