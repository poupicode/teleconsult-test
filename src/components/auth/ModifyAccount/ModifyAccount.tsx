import { Alert, Button, Form, Row, Col } from "react-bootstrap";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import styles from "./ModifyAccount.module.css";

// Types des valeurs du formulaire de modification de compte
type FormValues = {
  email: string;
  password: string;
  username: string;
  user_kind: "patient" | "practitioner";
};

// Composant pour modifier les informations du compte utilisateur
const ModifyAccount = () => {
  // Utilisation de useForm pour gérer le formulaire
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>();
  //   Récupération de l'utilisateur connecté depuis le contexte d'authentification
  const { user } = useAuth();
  //   Récupération de la fonction de navigation depuis react-router-dom
  const navigate = useNavigate();

  // Fonction de soumission du formulaire
  // Actuellement, elle ne fait que rediriger vers la page précédente
  const onSubmit = (data: FormValues) => {
    console.log(user);
    navigate(-1); // Retour à la page précédente
    // Ici, vous pouvez ajouter la logique pour mettre à jour les informations de l'utilisateur
  };
  return (
    <div>
      {/* Formulaire de modification de compte */}
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Row className="d-flex flex-nowrap justify-content-center w-100 mb-4">
          <Col md={7}>
            {/* Informations de l'utilisateur : email */}
            {/* Quand l'email de l'utilisateur doit être modifié, l'email actuel est pré-rempli */}
            <Form.Group className={`mb-4 mx-auto ${styles.w25vw}`}>
              <Form.Label className="fw-medium">Email :</Form.Label>
              <Form.Control
                className="bg-grey"
                type="email"
                defaultValue={user?.email || ""}
                {...register("email", { required: "Email requis" })}
              />
              {errors.email && (
                <small className="text-danger">{errors.email.message}</small>
              )}
            </Form.Group>

            <Form.Group className={`mb-4 mx-auto ${styles.w25vw}`}>
              <Form.Label className="fw-medium">Mot de passe :</Form.Label>
              <Form.Control
                className="bg-grey"
                type="password"
                {...register("password", { required: "Mot de passe requis" })}
              />
              {errors.password && (
                <small className="text-danger">{errors.password.message}</small>
              )}
            </Form.Group>
          </Col>

          <Col md={7}>
            <Form.Group className={`mb-4 mx-auto ${styles.w25vw}`}>
              <Form.Label className="fw-medium">Nom d'utilisateur :</Form.Label>
              <Form.Control
                className="bg-grey"
                type="text"
                {...register("username", {
                  required: "Nom d'utilisateur requis",
                })}
              />
              {errors.username && (
                <small className="text-danger">{errors.username.message}</small>
              )}
            </Form.Group>

            {/* Quand le rôle d'utilisateur doit être modifié, le rôle actuel est pré-rempli */}
            <Form.Group className={`mb-4 mx-auto ${styles.w25vw}`}>
              <Form.Label className="fw-medium">Rôle :</Form.Label>
              <Form.Select
                className="bg-grey"
                defaultValue={user?.user_metadata.user_kind || ""}
                {...register("user_kind", {
                  required: "Choisissez un rôle",
                })}
              >
                <option value="">-- Choisir --</option>
                <option value="patient">Patient</option>
                <option value="practitioner">Praticien</option>
              </Form.Select>
              {errors.user_kind && (
                <small className="text-danger">
                  {errors.user_kind.message}
                </small>
              )}
            </Form.Group>
          </Col>
        </Row>
        <div>
          {/* Message d'alerte important */}
          <Alert variant="danger">
            La modification des données n'a pas encore été implémentée
          </Alert>
          <Button
            type="submit"
            className="mb-3 d-block mx-auto w-auto primary-btn"
            variant="primary"
          >
            Enregistrer
          </Button>
          {/* Bouton pour annuler les modifications */}
          {/* Retour à la page précédente */}
          <Button
            className="d-block mx-auto w-auto tertiary-btn"
            variant="link"
            onClick={() => navigate(-1)}
          >
            Retour
          </Button>
        </div>
      </Form>
    </div>
  );
};
export default ModifyAccount;
