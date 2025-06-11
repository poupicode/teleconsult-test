import { Container, Row, Col, Card, Button } from "react-bootstrap";

type InformationsDetails = {
  name: string;
  first_name: string;
  birth_date?: string;
  gender?: "Homme" | "Femme";
  patient_number?: number;
  consultation_reason?: string;
  occupation?: string;
};

type PatientInformationsProps = {
  patientInformations: InformationsDetails | null;
  userKind: "patient" | "practitioner" | null;
  setIsConsultationTab: (value: boolean) => void;
};

const PatientInformationsDisplay = ({
  patientInformations,
  userKind,
  setIsConsultationTab,
}: PatientInformationsProps) => {
  function handleModify(){
    setIsConsultationTab(false)
  }
  return (
    <Card className="bg-grey mt-3">
      <Card.Body className="p-2 position-relative">
        <Row>
          <Col style={{ borderRight: "#c0d4ec solid 1px" }}>
            <Card.Title as={"h2"} className="fs-5">
              Patient
            </Card.Title>
            <hr className="mt-2 mb-3" />
            <ul className="mb-0">
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
                  Numéro du patient:{" "}
                  {patientInformations?.patient_number || "N/A"}
                </small>
              </li>
            </ul>
          </Col>
          <Col>
            <p>
              <small>
                Motif de consultation:{" "}
                {patientInformations?.consultation_reason || "N/A"}
              </small>
            </p>
          </Col>
        </Row>
        {userKind === "patient" && (
          <Button
            className="secondary-btn pe-3 ps-3 pt-1 pb-1 position-absolute"
            size="sm"
            style={{ bottom: ".3em", right: ".3em" }}
            onClick={handleModify}
          >
            Modifier
          </Button>
        )}
      </Card.Body>
    </Card>
  );
};
export default PatientInformationsDisplay;
