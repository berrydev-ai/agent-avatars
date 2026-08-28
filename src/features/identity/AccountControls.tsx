import { useEffect, useRef, useState, type FormEvent } from 'react';

import { AppClientError } from '../../lib/supabase';
import { useOptionalIdentity } from './identity-context';

type FormMode = 'sign-in' | 'sign-up';

export function AccountControls() {
  const identity = useOptionalIdentity();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FormMode>('sign-in');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) emailRef.current?.focus();
  }, [open, mode]);

  if (identity === null) return null;

  const activeIdentity = identity;
  const { available, auth } = activeIdentity;

  function close(): void {
    setOpen(false);
    setMessage('');
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const email = formString(fields, 'email');
    const password = formString(fields, 'password');
    const confirmation = formString(fields, 'confirmation');
    if (mode === 'sign-up' && password !== confirmation) {
      setMessage('Passwords must match.');
      return;
    }
    setPending(true);
    setMessage('');
    try {
      if (mode === 'sign-in') {
        await activeIdentity.signIn({ email, password });
        close();
      } else {
        const result = await activeIdentity.signUp({ email, password });
        setMessage(
          `Check ${result.email} for a confirmation link, then return here.`,
        );
      }
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (!available) {
    return (
      <p className="account-status" role="status">
        Accounts unavailable
      </p>
    );
  }

  if (auth.status === 'loading') {
    return (
      <p className="account-status" role="status">
        Checking account…
      </p>
    );
  }

  if (auth.status === 'authenticated') {
    return (
      <div className="account-summary">
        <span>{auth.user.email}</span>
        <button
          className="button button-header"
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void activeIdentity
              .signOut()
              .catch((error: unknown) => setMessage(authErrorMessage(error)))
              .finally(() => setPending(false));
          }}
        >
          {pending ? 'Signing out…' : 'Sign out'}
        </button>
        {message ? (
          <span className="account-inline-error" role="alert">
            {message}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="account-entry">
      {auth.status === 'error' ? (
        <p className="account-inline-error" role="alert">
          This account link is invalid or expired. Sign in or request a new
          confirmation email.
        </p>
      ) : null}
      <button
        ref={triggerRef}
        className="button button-header"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Close account panel' : 'Sign in'}
      </button>
      {open ? (
        <section
          className="account-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="account-panel-title"
        >
          <div className="account-panel-heading">
            <h2 id="account-panel-title">
              {mode === 'sign-in' ? 'Welcome back' : 'Create an account'}
            </h2>
            <button className="text-button" type="button" onClick={close}>
              Close
            </button>
          </div>
          <div className="account-tabs" aria-label="Account action">
            <button
              type="button"
              aria-pressed={mode === 'sign-in'}
              onClick={() => {
                setMode('sign-in');
                setMessage('');
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={mode === 'sign-up'}
              onClick={() => {
                setMode('sign-up');
                setMessage('');
              }}
            >
              Create account
            </button>
          </div>
          <form
            className="account-form"
            onSubmit={(event) => void submit(event)}
          >
            <label htmlFor="account-email">Email</label>
            <input
              ref={emailRef}
              id="account-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
            <label htmlFor="account-password">Password</label>
            <input
              id="account-password"
              name="password"
              type="password"
              autoComplete={
                mode === 'sign-in' ? 'current-password' : 'new-password'
              }
              required
            />
            {mode === 'sign-up' ? (
              <>
                <p className="field-hint">Use 12–72 UTF-8 bytes.</p>
                <label htmlFor="account-confirmation">Confirm password</label>
                <input
                  id="account-confirmation"
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </>
            ) : null}
            <button
              className="button button-primary"
              type="submit"
              disabled={pending}
            >
              {pending
                ? mode === 'sign-in'
                  ? 'Signing in…'
                  : 'Creating account…'
                : mode === 'sign-in'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
          </form>
          {message ? (
            <p className="account-message" role="alert">
              {message}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function authErrorMessage(error: unknown): string {
  if (!(error instanceof AppClientError)) {
    return 'Account access failed. Please try again.';
  }
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return 'Check your email and password, then try again.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a moment, then try again.';
    case 'NETWORK_ERROR':
      return 'Account service could not be reached. Try again shortly.';
    default:
      return 'Account access failed. Please try again.';
  }
}

function formString(fields: FormData, key: string): string {
  const value = fields.get(key);
  return typeof value === 'string' ? value : '';
}
