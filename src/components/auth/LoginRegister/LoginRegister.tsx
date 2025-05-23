import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabaseClient";
import { useState, useEffect } from "react";
import { Alert, Button, Form, Row, Col } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import Select from "react-select";

import styles from "./LoginRegister.module.css";

type FormValues = {
  email: string;
  password: string;
  username: string;
  user_kind: "patient" | "practitioner";
};

export default function LoginRegister({
  onIsRegistering,
}: {
  onIsRegistering: (value: boolean) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onIsRegistering(isRegistering);
  }, [isRegistering]);

  const navigate = useNavigate();

  const onSubmit = async (data: FormValues) => {
    setError(null);
    setMessage(null);

    if (isRegistering) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { user_kind: data.user_kind },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user.id;

        if (userId) {
          const { error: insertError } = await supabase
            .from("profiles")
            .insert([
              {
                id: userId,
                username: data.username,
                user_kind: data.user_kind,
                avatar_url: "",
                website: "",
              },
            ]);

          if (insertError) {
            console.error("Erreur ajout profil :", insertError);
            setError("Inscription échouée lors de la création du profil.");
            return;
          }
        }

        setMessage("Inscription réussie ! Vérifiez vos mails.");
        navigate("/login");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (signInError) setError(signInError.message);
      else {
        setMessage("Connexion réussie !");
        navigate("/");
      }
    }
    reset();
  };

  return (
    <div>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Row className="d-flex flex-nowrap justify-content-center w-100 mb-4">
          <Col md={7} className={`${!isRegistering && "w-100"}`}>
            <Form.Group className={`mb-4 mx-auto ${styles.w25vw}`}>
              <Form.Label className="fw-medium">Email :</Form.Label>
              <Form.Control
                className="bg-grey"
                type="email"
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

          {isRegistering && (
            <Col md={7}>
              <Form.Group className={`mb-4 mx-auto ${styles.w25vw}`}>
                <Form.Label className="fw-medium">
                  Nom d'utilisateur :
                </Form.Label>
                <Form.Control
                  className="bg-grey"
                  type="text"
                  {...register("username", {
                    required: "Nom d'utilisateur requis",
                  })}
                />
                {errors.username && (
                  <small className="text-danger">
                    {errors.username.message}
                  </small>
                )}
              </Form.Group>

              <Form.Group className={`mb-4 mx-auto ${styles.w25vw}`}>
                <Form.Label className="fw-medium">Rôle :</Form.Label>
                <Form.Select
                  className="bg-grey"
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
          )}
        </Row>
        <div>
          {message && <Alert variant="success">{message}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}

          <Button
            type="submit"
            className="mb-3 d-block mx-auto w-auto primary-btn"
            variant="primary"
          >
            {isRegistering ? "S'inscrire" : "Se connecter"}
          </Button>
          <Button
            className="d-block mx-auto w-auto tertiary-btn"
            variant="link"
            onClick={() => setIsRegistering(!isRegistering)}
          >
            {isRegistering ? "Déjà inscrit ?" : "Pas de compte ?"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
