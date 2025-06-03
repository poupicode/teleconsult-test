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
        
        // Récupérer le user_kind depuis la base de données au lieu des user_metadata
        ProfileService.getUserProfile(session.user.id).then(profile => {
          dispatch(setUser({
            id: session.user.id,
            username: session.user.email ?? '',
            user_kind: profile?.user_kind ?? session.user.user_metadata?.user_kind ?? null,
          }));
        }).catch(error => {
          console.error('[AuthContext] Error loading user profile:', error);
          // Fallback sur user_metadata si la DB échoue
          dispatch(setUser({
            id: session.user.id,
            username: session.user.email ?? '',
            user_kind: session.user.user_metadata?.user_kind ?? null,
          }));
        });
      } else {
        dispatch(setAuthenticated(false));
        dispatch(clearUser());
      }

    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLocalUser(session?.user ?? null);
      if (session && session.user) {
        dispatch(setAuthenticated(true));
        
        // Récupérer le user_kind depuis la base de données au lieu des user_metadata
        ProfileService.getUserProfile(session.user.id).then(profile => {
          dispatch(setUser({
            id: session.user.id,
            username: session.user.email ?? '',
            user_kind: profile?.user_kind ?? session.user.user_metadata?.user_kind ?? null,
          }));
        }).catch(error => {
          console.error('[AuthContext] Error loading user profile on auth change:', error);
          // Fallback sur user_metadata si la DB échoue
          dispatch(setUser({
            id: session.user.id,
            username: session.user.email ?? '',
            user_kind: session.user.user_metadata?.user_kind ?? null,
          }));
        });
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
    await supabase.auth.signOut();
    setSession(null);
    setLocalUser(null);
    dispatch(setAuthenticated(false));
    dispatch(clearUser());
    
    // Nettoyage pour éviter la persistance des données
    localStorage.removeItem('roomState');
    localStorage.removeItem('quickRoomPersist');
    
    // Nettoyer les tokens Supabase
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('[AuthContext] Logout and cleanup completed');
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};