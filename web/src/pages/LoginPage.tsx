import { type FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import '../components/IntakeForm.css'
import { Layout } from '../components/Layout'
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

    // Redirect happens via useEffect once session is in context
  }

  return (
    <Layout>
      <div className="login-card surface-card">
        <div className="login-card__intro">
          <h2 className="login-card__heading">Staff sign in</h2>
          <p className="login-card__subtext">
            For coordinators and kitchen staff. Recipients do not need an account.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="form-error-banner" role="alert">
              {error}
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="field__input"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="field__input"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>

        <p className="login-card__footer">
          <Link to="/" className="login-card__link">
            Request meal delivery
          </Link>
        </p>
      </div>
    </Layout>
  )
}
