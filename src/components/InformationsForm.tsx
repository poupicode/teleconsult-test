import { useForm } from "react-hook-form";
import { Alert, Button, Form, Row, Col } from "react-bootstrap";
import { useState } from "react";

// Types des informations
type PatientInformationsFormData = {
  name: string;
  first_name: string;
  birth_date: string;
  gender: "Homme" | "Femme";
  patient_number: number;
  consultation_reason: string;
};

type PraticienInformationsFormData = {
  name: string;
  first_name: string;
};
type InformationsFormProps = {
  userKind: string | null;
  setIsInformationsEntered: (value: boolean) => void;
  setPatientInformations: (data: PatientInformationsFormData) => void;
  setIsConsultationTab: (value: boolean) => void;
  setPraticienInformations: (data: PraticienInformationsFormData) => void;
};

const formatDateToFR = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR");
};

const InformationsForm = ({
  userKind,
  setIsInformationsEntered,
  setPatientInformations,
  setIsConsultationTab,
  setPraticienInformations,
}: InformationsFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientInformationsFormData>();

  const onSubmit = (data: PatientInformationsFormData) => {
    const formattedData =
      userKind === "patient"
        ? {
            ...data,
            birth_date: new Date(data.birth_date).toLocaleDateString("fr-FR"),
          }
        : data;

    userKind === "patient"
      ? setPatientInformations(formattedData)
      : setPraticienInformations(formattedData);
    setIsInformationsEntered(true);
    setIsConsultationTab(true);
  };
  return (
    <div className="w-100 mt-3">
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Row md={3} className="d-flex justify-content-center">
          <Col>
            <Form.Group className="mb-3">
              <Form.Label className="fw-medium">Nom :</Form.Label>
              <Form.Control
                className="bg-grey"
                type="text"
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
            <Form.Group className="mb-3">
              <Form.Label className="fw-medium">Prénom :</Form.Label>
              <Form.Control
                className="bg-grey"
                type="text"
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

        {userKind === "patient" && (
          <Row md={3} className="d-flex justify-content-center">
            <Col>
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium">
                  Date de naissance :
                </Form.Label>
                <Form.Control
                  className="bg-grey"
                  type="date"
                  {...register("birth_date", { required: "Date requise" })}
                />
                {errors.birth_date && (
                  <small className="text-danger">
                    {errors.birth_date.message}
                  </small>
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium">Numéro patient :</Form.Label>
                <Form.Control
                  className="bg-grey"
                  type="number"
                  {...register("patient_number", { required: "Numéro requis" })}
                />
                {errors.patient_number && (
                  <small className="text-danger">
                    {errors.patient_number.message}
                  </small>
                )}
              </Form.Group>
            </Col>
            <Col>
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium">Sexe :</Form.Label>
                <Form.Select
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
                  <small className="text-danger">{errors.gender.message}</small>
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="fw-medium">
                  Motif de consultation :
                </Form.Label>
                <Form.Control
                  className="bg-grey"
                  type="text"
                  maxLength={80}
                  {...register("consultation_reason", {
                    required: "Motif requis",
                    maxLength: {
                      value: 80,
                      message: "Le motif ne doit pas dépasser 100 caractères",
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
        )}

        <Button
          type="submit"
          variant="primary"
          className="primary-btn d-block mx-auto mt-2"
        >
          Confirmer
        </Button>
      </Form>
    </div>
  );
};
export default InformationsForm;
