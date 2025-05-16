import { useAuth } from "@/contexts/AuthContext";
import React from "react";
import { Navigate, Outlet } from "react-router-dom";

/**
 * ProtectedRoute - Protège les routes nécessitant une authentification
 * Redirige vers la page de connexion si l'utilisateur n'est pas connecté
 */
export const ProtectedRoute = () => {
    const { session, loading } = useAuth();

    // Si le chargement est en cours, on peut afficher un loader ou rien
    if (loading) {
        return <div>Chargement...</div>;
    }

    // Si l'utilisateur n'est pas connecté, rediriger vers la page de connexion
    if (!session) {
        return <Navigate to="/login" replace />;
    }

    // Si l'utilisateur est connecté, afficher les composants enfants
    return <Outlet />;
};

/**
 * PublicOnlyRoute - Protège les routes qui ne devraient être accessibles que lorsque l'utilisateur n'est pas connecté
 * Par exemple, la page de connexion/inscription
 * Redirige vers la page d'accueil si l'utilisateur est déjà connecté
 */
export const PublicOnlyRoute = () => {
    const { session, loading } = useAuth();

    if (loading) {
        return <div>Chargement...</div>;
    }

    // Si l'utilisateur est connecté, rediriger vers la page d'accueil
    if (session) {
        return <Navigate to="/" replace />;
    }

    // Si l'utilisateur n'est pas connecté, afficher les composants enfants
    return <Outlet />;
};