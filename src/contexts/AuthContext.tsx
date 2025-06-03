import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { useDispatch } from "react-redux";
import { setAuthenticated } from "@/features/auth/session/session-slice";
import { setUser, clearUser } from "@/features/auth/user/user-slice";
import { ProfileService } from "@/services/profileService";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setLocalUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const dispatch = useDispatch();

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setLocalUser(session?.user ?? null);
      setLoading(false);

      if (session) {
        dispatch(setAuthenticated(true));
        
        // Récupérer le user_kind depuis la table profiles plutôt que user_metadata
        // pour éviter les problèmes de persistance des métadonnées Supabase
        try {
          const profile = await ProfileService.getUserProfile(session.user.id);
          dispatch(setUser({
            id: session.user.id,
            username: session.user.email ?? '',
            user_kind: profile?.user_kind ?? null,
          }));
          console.log('[AuthContext] User profile loaded from database:', profile);
        } catch (error) {
          console.error('[AuthContext] Error loading user profile:', error);
          // Fallback sur user_metadata si la DB échoue
          dispatch(setUser({
            id: session.user.id,
            username: session.user.email ?? '',
            user_kind: session.user.user_metadata?.user_kind ?? null,
          }));
        }
      } else {
        dispatch(setAuthenticated(false));
        dispatch(clearUser());
      }

    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setLocalUser(session?.user ?? null);
      if (session && session.user) {
        dispatch(setAuthenticated(true));
        
        // Récupérer le user_kind depuis la table profiles plutôt que user_metadata
        try {
          const profile = await ProfileService.getUserProfile(session.user.id);
          dispatch(setUser({
            id: session.user.id,
            username: session.user.email ?? '',
            user_kind: profile?.user_kind ?? null,
          }));
          console.log('[AuthContext] User profile reloaded from database on auth change:', profile);
        } catch (error) {
          console.error('[AuthContext] Error reloading user profile on auth change:', error);
          // Fallback sur user_metadata si la DB échoue
          dispatch(setUser({
            id: session.user.id,
            username: session.user.email ?? '',
            user_kind: session.user.user_metadata?.user_kind ?? null,
          }));
        }
      } else {
        dispatch(setAuthenticated(false));
        dispatch(clearUser());
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [dispatch]);

  const logout = async () => {
    try {
      // Déconnexion de Supabase
      await supabase.auth.signOut();
      
      // Nettoyage complet de l'état local
      setSession(null);
      setLocalUser(null);
      
      // Nettoyage du Redux store
      dispatch(setAuthenticated(false));
      dispatch(clearUser());
      
      // Nettoyage complet du localStorage pour éviter toute persistance
      // Nettoyer spécifiquement les clés liées à l'application
      localStorage.removeItem('roomState');
      localStorage.removeItem('quickRoomPersist');
      
      // Nettoyer tous les tokens Supabase du localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
      
      // Optionnel: nettoyer sessionStorage aussi
      sessionStorage.clear();
      
      console.log('[AuthContext] Complete logout and cleanup performed');
      
    } catch (error) {
      console.error('[AuthContext] Error during logout:', error);
      
      // Même en cas d'erreur, nettoyer l'état local
      setSession(null);
      setLocalUser(null);
      dispatch(setAuthenticated(false));
      dispatch(clearUser());
      localStorage.removeItem('roomState');
      localStorage.removeItem('quickRoomPersist');
      sessionStorage.clear();
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};