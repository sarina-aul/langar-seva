import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Confirmation } from './components/Confirmation'
import { IntakeForm } from './components/IntakeForm'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { KitchenPage } from './pages/KitchenPage'
import { LoginPage } from './pages/LoginPage'
import { StaffHome } from './pages/StaffHome'
import type { RecipientRow } from './types/database'

function IntakePage() {
  const [submittedRecipient, setSubmittedRecipient] = useState<RecipientRow | null>(null)

  return (
    <Layout>
      {submittedRecipient ? (
        <Confirmation
          recipient={submittedRecipient}
          onReset={() => setSubmittedRecipient(null)}
        />
      ) : (
        <IntakeForm onSuccess={setSubmittedRecipient} />
      )}
    </Layout>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<IntakePage />} />
      <Route path="/login" element={<LoginPage />} />
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
    </Routes>
  )
}

export default App
