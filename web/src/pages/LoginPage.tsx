import { type FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { SevaLogo } from '../components/SevaLogo'
import { useAuth } from '../hooks/useAuth'
import { getStaffHomePath, getStaffRole } from '../lib/roles'
import './LoginPage.css'

export function LoginPage() {
  const { session, user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const nextPath = searchParams.get('next') || '/staff'
  const role = getStaffRole(user)

  useEffect(() => {
    if (!loading && session && role) {
      const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/staff'
      navigate(safeNext, { replace: true })
    }
  }, [loading, session, role, nextPath, navigate])

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-page__loading" role="status" aria-live="polite">
          <SevaLogo size="md" />
          <p className="login-page__loading-text">Loading…</p>
        </div>
      </div>
    )
  }

  if (!loading && session && role) {
    return <Navigate to={getStaffHomePath(role)} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = await signIn(email.trim(), password)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    const signedInRole = getStaffRole(result.user)
    if (!signedInRole) {
      setError('This account does not have staff permissions.')
      return
    }
  }

  return (
    <div className="login-page">
      <header className="login-page__hero">
        <div className="login-page__hero-inner">
          <Link to="/" className="login-page__back">
            <span className="login-page__back-icon" aria-hidden="true">
              ←
            </span>
            <span>Back</span>
          </Link>

          <SevaLogo size="md" variant="paper" />
          <h1 className="login-page__title">Staff sign in</h1>
          <p className="login-page__subtitle">
            For coordinators and kitchen staff. Recipients do not need an account.
          </p>
        </div>
      </header>

      <main className="login-page__main">
        <div className="login-page__panel">
          <p className="login-page__scope">Staff portal</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="login-form__error" role="alert">
                {error}
              </div>
            )}

            <div className="login-field">
              <label className="login-field__label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="login-field__input"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="login-field__input"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>

            <button type="submit" className="login-form__submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <footer className="login-page__footer">
          <p className="login-page__footer-note">All meals are free • Community Seva</p>
          <Link to="/" className="login-page__footer-link">
            Request meal delivery
          </Link>
        </footer>
      </main>
    </div>
  )
}
