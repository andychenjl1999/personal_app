'use client';

import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { getSupabaseClient } from '../../lib/supabase/client';
import TodoApp from '../todos/todo-app';

type AuthStatus = 'checking' | 'signed-out' | 'claiming' | 'ready' | 'blocked';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AuthGate() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let isCurrent = true;

    async function syncSession(nextSession: Session | null) {
      if (!isCurrent) {
        return;
      }

      setSession(nextSession);
      setAuthError('');

      if (!nextSession) {
        setAuthStatus('signed-out');
        return;
      }

      setAuthStatus('claiming');

      const { error } = await supabase.rpc('claim_personal_app_owner');
      if (!isCurrent) {
        return;
      }

      if (error) {
        setAuthError(error.message);
        setAuthStatus('blocked');
        return;
      }

      setAuthStatus('ready');
    }

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!isCurrent) {
        return;
      }

      if (error) {
        setAuthError(error.message);
        setAuthStatus('signed-out');
        return;
      }

      void syncSession(data.session);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });

    return () => {
      isCurrent = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleGoogleSignIn() {
    setIsSigningIn(true);
    setAuthError('');

    try {
      const { error } = await getSupabaseClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        setAuthError(error.message);
        setIsSigningIn(false);
      }
    } catch (signInError) {
      setAuthError(getErrorMessage(signInError, 'Unable to start sign in.'));
      setIsSigningIn(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setAuthError('');

    const { error } = await getSupabaseClient().auth.signOut();
    if (error) {
      setAuthError(error.message);
      setIsSigningOut(false);
      return;
    }

    setSession(null);
    setAuthStatus('signed-out');
    setIsSigningOut(false);
  }

  if (authStatus === 'ready' && session) {
    return (
      <TodoApp
        isSigningOut={isSigningOut}
        onSignOut={() => void handleSignOut()}
        userEmail={session.user.email}
      />
    );
  }

  const isLoading = authStatus === 'checking' || authStatus === 'claiming';
  const isBlocked = authStatus === 'blocked';

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-heading">
        <p className="eyebrow">Personal App v2</p>
        <h1 id="auth-heading">Sign in</h1>
        <p className="auth-copy">
          Use the personal Google account that should own this app's todo data.
        </p>

        {isLoading ? (
          <p className="auth-status">
            {authStatus === 'claiming'
              ? 'Checking app ownership...'
              : 'Checking session...'}
          </p>
        ) : null}

        {authError ? <p className="form-error">{authError}</p> : null}

        {isBlocked ? (
          <button
            className="secondary-button"
            type="button"
            disabled={isSigningOut}
            onClick={() => void handleSignOut()}
          >
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </button>
        ) : (
          <button
            className="auth-button"
            type="button"
            disabled={isLoading || isSigningIn}
            onClick={() => void handleGoogleSignIn()}
          >
            {isSigningIn ? 'Opening Google...' : 'Continue with Google'}
          </button>
        )}
      </section>
    </main>
  );
}
