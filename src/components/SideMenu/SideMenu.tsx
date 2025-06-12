import { Button } from "react-bootstrap";
import PatientInformations from "./PatientInformations";
import PraticionnerInformations from "./PraticionnerInformations";
import RoomInformations from "@/components/room/RoomInformations";

import styles from "./SideMenu.module.css";

// Types pour les informations du patient et du praticien du formulaire
type InformationsDetails = {
  name: string;
  first_name: string;
  birth_date?: string;
  gender?: "Homme" | "Femme";
  patient_number?: number;
  consultation_reason?: string;
  occupation?: string;
};

// Types pour les informations entrées dans le menu latéral
type InformationsEntered = {
  userKind: string | null;
  patientInformations: InformationsDetails | null;
  praticienInformations: InformationsDetails | null;
  roomId: string | null;
  connectionStatus: string;
  handleOpenVideoPanel: () => void;
  setIsConsultationTab: (value: boolean) => void;
};

// Composant pour le menu latéral de la page de consultation
// Il affiche les informations du patient ou du praticien et permet de naviguer entre les onglets "Informations" et "Consultation"
const SideMenu = ({
  connectionStatus,
  roomId,
  userKind,
  patientInformations,
  praticienInformations,
  handleOpenVideoPanel,
  setIsConsultationTab
}: InformationsEntered) => {
  // Pour juste mettre le style des boutons d'onglet sur actif ou inactif (et pour changer d'onglet) quand on clique dessus (sur le bouton "Informations du praticien/patient" ou "Consultation")

  return (
    <div className={`w-100 p-2 ${styles.h100vh}`} style={{ overflowY: "auto" }}>
      {/* Si les informations sont entrées, activer la navigation sur le menu latéral */}
      {!roomId ? (
        <>
          {userKind === "patient" ? (
            <PatientInformations patientInformations={patientInformations} setIsConsultationTab={setIsConsultationTab} />
          ) : (
            <PraticionnerInformations
              praticienInformations={praticienInformations}
              setIsConsultationTab={setIsConsultationTab}
            />
          )}
          
        </>
      ) : (
        <RoomInformations
          userKind={userKind}
          roomId={roomId}
          connectionStatus={connectionStatus}
          patientInformations={patientInformations}
          praticienInformations={praticienInformations}
          handleOpenVideoPanel={handleOpenVideoPanel}
        />
      )}
    </div>
  );
};

export default SideMenu;
