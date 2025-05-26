import { Button } from "react-bootstrap";
import PatientInformations from "./PatientInformations";

import styles from "./SideMenu.module.css";

type InformationsFormDetails = {
  name: string;
  first_name: string;
  birth_date: string;
  gender: "Homme" | "Femme";
  patient_number: number;
  consultation_reason: string;
};

type InformationsEntered = {
  isInformationsEntered: boolean;
  userKind: string | null;
  patientInformations: InformationsFormDetails | null;
  isConsultationTab: boolean;
  setIsConsultationTab: (value: boolean) => void;
};

const SideMenu = ({ isInformationsEntered, userKind, patientInformations, isConsultationTab, setIsConsultationTab }: InformationsEntered) => {
  // Pour juste mettre le style des boutons d'onglet sur actif ou inactif (et pour changer d'onglet)

  function handleChangeTab() {
    setIsConsultationTab(!isConsultationTab);
  }

  return (
    <div className={`w-100 ${styles.h100vh}`}>
      <ul className={`${!isInformationsEntered && styles.sideMenuInactive}`}>
        <li key="informations">
          <Button
            className={`w-100 text-start ${styles.noRouded} ${
              styles.btnTab
            } ${styles.mt4em} ${!isConsultationTab && "fw-medium"}`}
            disabled={!isConsultationTab}
            onClick={handleChangeTab}
          >
            Informations du praticien
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
        {isInformationsEntered && userKind==="patient" && (
          <li key="patient" className="mt-2 p-2">
            <PatientInformations patientInformations={patientInformations} />
          </li>
        )}
      </ul>
    </div>
  );
};

export default SideMenu;
