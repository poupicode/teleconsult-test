import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { useDispatch } from "react-redux";
import { setAuthenticated } from "@/features/auth/session/session-slice";
import { setUser, clearUser } from "@/features/auth/user/user-slice";
import { resetRoom } from "@/features/room/roomSlice";
import { clearAllMessages } from "@/features/chat/chatSlice";
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

  const setUserWithProfile = async (authUser: User) => {
    try {
      // Récupérer le profil depuis la base de données pour avoir le user_kind à jour
      const profile = await ProfileService.getUserProfile(authUser.id);
      
      dispatch(setAuthenticated(true));
      dispatch(setUser({
        id: authUser.id,
        username: authUser.email ?? '',
        user_kind: profile?.user_kind ?? null,
      }));
    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error);
      // Fallback vers les métadonnées si échec de récupération du profil
      dispatch(setAuthenticated(true));
      dispatch(setUser({
        id: authUser.id,
        username: authUser.email ?? '',
        user_kind: authUser.user_metadata?.user_kind ?? null,
      }));
    }
  };

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setLocalUser(session?.user ?? null);
      setLoading(false);

      if (session) {
        await setUserWithProfile(session.user);
      } else {
        dispatch(setAuthenticated(false));
        dispatch(clearUser());
        
        // Nettoyer tous les états si aucune session n'est trouvée
        dispatch(resetRoom());
        dispatch(clearAllMessages());
        localStorage.removeItem('roomState');
      }
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setLocalUser(session?.user ?? null);
      if (session && session.user) {
        await setUserWithProfile(session.user);
      } else {
        dispatch(setAuthenticated(false));
        dispatch(clearUser());
        
        // Nettoyer tous les états lors de la perte de session
        dispatch(resetRoom());
        dispatch(clearAllMessages());
        localStorage.removeItem('roomState');
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [dispatch]);

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setLocalUser(null);
    dispatch(setAuthenticated(false));
    dispatch(clearUser());
    
    // Nettoyer complètement tous les états lors de la déconnexion
    dispatch(resetRoom());
    dispatch(clearAllMessages());
    
    // Nettoyer le localStorage des rooms
    localStorage.removeItem('roomState');
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};