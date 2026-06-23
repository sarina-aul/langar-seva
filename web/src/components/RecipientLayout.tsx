import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './RecipientLayout.css'

interface RecipientLayoutProps {
  children: ReactNode
}

export function RecipientLayout({ children }: RecipientLayoutProps) {
  return (
    <div className="recipient-layout">
      <div className="recipient-layout__frame">
        <div className="recipient-layout__content">{children}</div>
        <footer className="recipient-layout__footer">
          <p className="recipient-layout__footer-note">All meals are free • Community Seva</p>
          <Link to="/login" className="recipient-layout__footer-link">
            Staff sign in
          </Link>
        </footer>
      </div>
    </div>
  )
}
