import { useState } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { Confirmation } from './components/Confirmation'
import { IntakeForm } from './components/IntakeForm'
import { RecipientHome } from './components/RecipientHome'
import { RecipientLayout } from './components/RecipientLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DriverRoutePage } from './pages/DriverRoutePage'
import { KitchenPage } from './pages/KitchenPage'
import { LoginPage } from './pages/LoginPage'
import { DispatchPage } from './pages/DispatchPage'
import { PublicDriverRoutePage } from './pages/PublicDriverRoutePage'
import { RecipientsPage } from './pages/RecipientsPage'
import { StaffHome } from './pages/StaffHome'
import { TrackingPage } from './pages/TrackingPage'
import type { RecipientRow } from './types/database'

type IntakeStep = 'home' | 'form'

function IntakePage() {
  const [step, setStep] = useState<IntakeStep>('home')
  const [submittedRecipient, setSubmittedRecipient] = useState<RecipientRow | null>(null)

  function handleReset() {
    setSubmittedRecipient(null)
    setStep('home')
  }

  return (
    <RecipientLayout>
      {submittedRecipient ? (
        <Confirmation recipient={submittedRecipient} onReset={handleReset} />
      ) : step === 'home' ? (
        <RecipientHome onRequest={() => setStep('form')} />
      ) : (
        <IntakeForm
          onSuccess={setSubmittedRecipient}
          onBack={() => setStep('home')}
        />
      )}
    </RecipientLayout>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<IntakePage />} />
      <Route path="/track/:token" element={<TrackingPage />} />
      <Route path="/driver/route/:token" element={<PublicDriverRoutePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/staff/login" element={<Navigate to="/login" replace />} />
      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <StaffHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/kitchen"
        element={
          <ProtectedRoute>
            <KitchenPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/recipients"
        element={
          <ProtectedRoute requiredRole="coordinator">
            <RecipientsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/dispatch"
        element={
          <ProtectedRoute requiredRole="coordinator">
            <DispatchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/driver/routes/:routeId"
        element={
          <ProtectedRoute>
            <DriverRoutePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
