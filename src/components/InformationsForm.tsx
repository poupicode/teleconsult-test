import { useForm } from "react-hook-form";
import { Button, Form, Row, Col } from "react-bootstrap";

// Types des informations du patient

type InformationsDetails = {
  name: string;
  first_name: string;
  birth_date?: string;
  gender?: "Homme" | "Femme";
  patient_number?: number;
  consultation_reason?: string;
  occupation?: string;
};

// Propriétés du composant InformationsForm
type InformationsFormProps = {
  userKind: string | null;
  setIsInformationsEntered: (value: boolean) => void;
  setPatientInformations: (data: InformationsDetails) => void;
  setIsConsultationTab: (value: boolean) => void;
  setPraticienInformations: (data: InformationsDetails) => void;
  praticienInformations: InformationsDetails | null;
  patientInformations: InformationsDetails | null;
  isInformationsEntered: boolean;
};

// Composant pour le formulaire d'informations du patient ou du praticien
const InformationsForm = ({
  userKind,
  setIsInformationsEntered,
  setPatientInformations,
  setIsConsultationTab,
  setPraticienInformations,
  praticienInformations,
  patientInformations,
  isInformationsEntered,
}: InformationsFormProps) => {
  // Utilisation de useForm pour gérer le formulaire
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InformationsDetails>();

  // Fonction de soumission du formulaire
  const onSubmit = (data: InformationsDetails) => {
    // Vérification du type d'utilisateur et formatage des données
    const formattedData =
      userKind === "patient"
        ? {
            ...data,
            birth_date: new Date(data.birth_date!).toLocaleDateString("fr-FR"),
          }
        : data;

    // Mise à jour des états en fonction du type d'utilisateur
    userKind === "patient"
      ? setPatientInformations(formattedData)
      : setPraticienInformations(formattedData);
    setIsInformationsEntered(true);
    setIsConsultationTab(true);
  };
  return (
    <div
      className="mt-3 w-100"
    >
      {/* Formulaire d'informations */}
      <Form
        onSubmit={handleSubmit(onSubmit)}
        className="d-flex flex-column align-items-center w-100"
      >
        <div>
          <Row>
            <Col>
              {/* Informations du patient : nom */}
              {/* Quand il faut modifier le nom, le nom actuel du patient/praticien est pré-rempli */}
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium">Nom :</Form.Label>
                <Form.Control
                  className="bg-grey"
                  type="text"
                  defaultValue={
                    isInformationsEntered
                      ? userKind === "patient"
                        ? patientInformations?.name
                        : praticienInformations?.name
                      : "tt"
                  }
                  {...register("name", {
                    required: "Nom requis",
                    onChange: (e) => {
                      e.target.value = e.target.value.toUpperCase();
                    },
                  })}
                />
                {errors.name && (
                  <small className="text-danger">{errors.name.message}</small>
                )}
              </Form.Group>
            </Col>
            <Col>
              {/* Informations du praticien : prénom */}
              {/* Quand il faut modifier le prénom, le prénom actuel du patient/praticien est pré-rempli */}
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium">Prénom :</Form.Label>
                <Form.Control
                  className="bg-grey"
                  type="text"
                  defaultValue={
                    isInformationsEntered
                      ? userKind === "patient"
                        ? patientInformations?.first_name
                        : praticienInformations?.first_name
                      : "tt"
                  }
                  {...register("first_name", {
                    required: "Prénom requis",
                    onChange: (e) => {
                      const value = e.target.value;
                      // Capitalize uniquement la première lettre
                      const capitalized =
                        value.charAt(0).toUpperCase() + value.slice(1);
                      e.target.value = capitalized;
                    },
                  })}
                />
                {errors.first_name && (
                  <small className="text-danger">
                    {errors.first_name.message}
                  </small>
                )}
              </Form.Group>
            </Col>
          </Row>
          {userKind === "patient" ? (
            <Row>
              <Col>
                {/* Informations du patient : date de naissance */}
                {/* Quand il faut modifier la date de naissance, la date actuelle du patient est pré-remplie */}
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium">
                    Date de naissance :
                  </Form.Label>
                  <Form.Control
                    className="bg-grey"
                    type="date"
                    defaultValue={
                      isInformationsEntered && userKind === "patient"
                        ? patientInformations
                            ?.birth_date!.split("/")
                            .reverse()
                            .join("-") ?? ""
                        : "2025-10-10"
                    }
                    {...register("birth_date", { required: "Date requise" })}
                  />
                  {errors.birth_date && (
                    <small className="text-danger">
                      {errors.birth_date.message}
                    </small>
                  )}
                </Form.Group>

                {/* Informations du patient : numéro patient */}
                {/* Quand il faut modifier le numéro patient, le numéro actuel du patient est pré-rempli */}
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium">
                    Numéro patient :
                  </Form.Label>
                  <Form.Control
                    className="bg-grey"
                    type="number"
                    defaultValue={
                      isInformationsEntered && userKind === "patient"
                        ? patientInformations?.patient_number ?? ""
                        : "56789"
                    }
                    {...register("patient_number", {
                      required: "Numéro requis",
                    })}
                  />
                  {errors.patient_number && (
                    <small className="text-danger">
                      {errors.patient_number.message}
                    </small>
                  )}
                </Form.Group>
              </Col>
              <Col>
                {/* Informations du patient : sexe */}
                {/* Quand il faut modifier le sexe, le sexe actuel du patient est pré-rempli */}
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium">Sexe :</Form.Label>
                  <Form.Select
                    defaultValue={
                      isInformationsEntered && userKind === "patient"
                        ? patientInformations?.gender ?? ""
                        : "Homme"
                    }
                    className="bg-grey"
                    {...register("gender", {
                      required: "Choisissez un sexe",
                    })}
                  >
                    <option value="">-- Choisir --</option>
                    <option value="Homme">Homme</option>
                    <option value="Femme">Femme</option>
                  </Form.Select>
                  {errors.gender && (
                    <small className="text-danger">
                      {errors.gender.message}
                    </small>
                  )}
                </Form.Group>

                {/* Informations du patient : motif de consultation */}
                {/* Quand il faut modifier le motif de consultation, le motif actuel du patient est pré-rempli */}
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium">
                    Motif de consultation :
                  </Form.Label>
                  <Form.Control
                    className="bg-grey"
                    type="text"
                    maxLength={60}
                    defaultValue={
                      isInformationsEntered && userKind === "patient"
                        ? patientInformations?.consultation_reason ?? ""
                        : "eeee"
                    }
                    {...register("consultation_reason", {
                      required: "Motif requis",
                      maxLength: {
                        value: 60,
                        message: "Le motif ne doit pas dépasser 60 caractères",
                      },
                    })}
                  />
                  {errors.consultation_reason && (
                    <small className="text-danger">
                      {errors.consultation_reason.message}
                    </small>
                  )}
                </Form.Group>
              </Col>
            </Row>
          ) : (
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                <Form.Label className="fw-medium">Profession :</Form.Label>
                <Form.Control
                  className="bg-grey"
                  type="text"
                  defaultValue={
                    isInformationsEntered
                      ? praticienInformations?.occupation
                      : "ttt"
                  }
                  {...register("occupation", {
                    required: "Profession requise",
                    onChange: (e) => {
                      const value = e.target.value;
                      // Capitalize uniquement la première lettre
                      const capitalized =
                        value.charAt(0).toUpperCase() + value.slice(1);
                      e.target.value = capitalized;
                    },
                  })}
                />
                {errors.first_name && (
                  <small className="text-danger">
                    {errors.first_name.message}
                  </small>
                )}
              </Form.Group>
              </Col>
            </Row>
          )}
        </div>

        {/* Bouton de confirmation */}
        <Button
          type="submit"
          variant="primary"
          className="primary-btn d-block mt-2"
        >
          Confirmer
        </Button>
      </Form>
    </div>
  );
};
export default InformationsForm;
