import { useForm } from 'react-hook-form';
import { supabase } from '@/lib/supabaseClient';
import { useState } from 'react';
import { Alert, Button, Form } from 'react-bootstrap';
import { useNavigate } from "react-router-dom";
import React from 'react';

type FormValues = {
  email: string;
  password: string;
  username: string;
  user_kind: 'patient' | 'practitioner';
};

export default function LoginRegister() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            .from('profiles')
            .insert([{
              id: userId,
              username: data.username,
              user_kind: data.user_kind,
              avatar_url: '',
              website: '',
            }]);

          if (insertError) {
            console.error('Erreur ajout profil :', insertError);
            setError('Inscription échouée lors de la création du profil.');
            return;
          }
        }

        setMessage('Inscription réussie ! Vérifiez vos mails.');
        navigate("/login");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (signInError) setError(signInError.message);
      else {
        setMessage('Connexion réussie !');
        navigate("/");
      }
    }
    reset();
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="mb-3">{isRegistering ? 'Inscription' : 'Connexion'}</h2>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <Form.Control type="email" {...register('email', { required: 'Email requis' })} />
          {errors.email && <small className="text-danger">{errors.email.message}</small>}
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Mot de passe</Form.Label>
          <Form.Control type="password" {...register('password', { required: 'Mot de passe requis' })} />
          {errors.password && <small className="text-danger">{errors.password.message}</small>}
        </Form.Group>

        {isRegistering && (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Nom d'utilisateur</Form.Label>
              <Form.Control type="text" {...register('username', { required: 'Nom d\'utilisateur requis' })} />
              {errors.username && <small className="text-danger">{errors.username.message}</small>}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Rôle</Form.Label>
              <Form.Select {...register('user_kind', { required: 'Choisissez un rôle' })}>
                <option value="">-- Choisir --</option>
                <option value="patient">Patient</option>
                <option value="practitioner">Praticien</option>
              </Form.Select>
              {errors.user_kind && <small className="text-danger">{errors.user_kind.message}</small>}
            </Form.Group>
          </>
        )}

        {message && <Alert variant="success">{message}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        <Button type="submit" variant="primary" className="me-2">
          {isRegistering ? "S'inscrire" : 'Se connecter'}
        </Button>
        <Button variant="link" onClick={() => setIsRegistering(!isRegistering)}>
          {isRegistering ? 'Déjà inscrit ?' : 'Pas de compte ?'}
        </Button>
      </Form>
    </div>
  );
}
