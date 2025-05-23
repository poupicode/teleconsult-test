import { Button } from "react-bootstrap";
import { useState } from "react";
import PatientInformations from "./PatientInformations";

import styles from "./SideMenu.module.css";

type InformationsEntered = {
  isInformationsEntered: boolean;
};

const SideMenu = ({ isInformationsEntered }: InformationsEntered) => {
  // Pour juste mettre le style des boutons d'onglet sur actif ou inactif (et pour changer d'onglet)
  const [isConsultationTab, setIsConsultationTab] = useState(false);

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
        {isInformationsEntered && (
          <li key="patient" className="mt-3 p-2">
            <PatientInformations />
          </li>
        )}
      </ul>
    </div>
  );
};

export default SideMenu;
