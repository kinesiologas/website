import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

function mapAuthUserToProfile(user) {
  return {
    id: user.id,
    email: user.email ?? '',
    full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? '',
    avatar_url: user.user_metadata?.avatar_url ?? '',
    role: 'user',
    active: true,
    model_id: null,
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const loadProfile = useCallback(async (user) => {
    if (!supabase || !user) {
      setProfile(null);
      return null;
    }

    const { data, error } = await supabase
      .from('app_profiles')
      .select('id, email, full_name, avatar_url, role, active, model_id')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('App profile unavailable. Falling back to auth metadata.', error);
      const fallbackProfile = mapAuthUserToProfile(user);
      setProfile(fallbackProfile);
      return fallbackProfile;
    }

    if (data) {
      setProfile(data);
      return data;
    }

    const fallbackProfile = mapAuthUserToProfile(user);
    const { data: createdProfile, error: insertError } = await supabase
      .from('app_profiles')
      .insert(fallbackProfile)
      .select('id, email, full_name, avatar_url, role, active, model_id')
      .maybeSingle();

    if (insertError) {
      console.warn('App profile could not be created. Using in-memory profile.', insertError);
      setProfile(fallbackProfile);
      return fallbackProfile;
    }

    setProfile(createdProfile ?? fallbackProfile);
    return createdProfile ?? fallbackProfile;
  }, []);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return undefined;
    }

    let isMounted = true;

    async function hydrateSession() {
      setIsLoading(true);
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      const nextSession = data?.session ?? null;
      setSession(nextSession);

      if (nextSession?.user) {
        await loadProfile(nextSession.user);
      } else {
        setProfile(null);
      }

      if (isMounted) {
        setIsLoading(false);
      }
    }

    hydrateSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user) {
        loadProfile(nextSession.user);
      } else {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithPassword = useCallback(async ({ email, password }) => {
    if (!supabase) {
      throw new Error('Supabase no esta configurado.');
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw error;
    }
  }, []);

  const signUpWithPassword = useCallback(async ({ email, password, fullName }) => {
    if (!supabase) {
      throw new Error('Supabase no esta configurado.');
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      throw error;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      throw new Error('Supabase no esta configurado.');
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      return null;
    }

    return loadProfile(session.user);
  }, [loadProfile, session?.user]);

  const updateOwnProfile = useCallback(
    async ({ fullName, avatarUrl }) => {
      if (!supabase || !session?.user) {
        throw new Error('No hay una sesion activa.');
      }

      const { data, error } = await supabase
        .from('app_profiles')
        .update({
          full_name: fullName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id)
        .select('id, email, full_name, avatar_url, role, active, model_id')
        .maybeSingle();

      if (error) {
        throw error;
      }

      setProfile(data);
      return data;
    },
    [session?.user],
  );

  const value = useMemo(
    () => ({
      authError,
      isLoading,
      isSupabaseConfigured,
      profile,
      refreshProfile,
      session,
      signInWithGoogle,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      updateOwnProfile,
      user: session?.user ?? null,
    }),
    [
      authError,
      isLoading,
      profile,
      refreshProfile,
      session,
      signInWithGoogle,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      updateOwnProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
