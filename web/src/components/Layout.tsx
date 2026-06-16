import type { ReactNode } from 'react'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <header className="layout__header">
        <div className="layout__brand">
          <div className="layout__mark" aria-hidden="true">
            S
          </div>
          <div>
            <h1 className="layout__title">Seva Eats</h1>
            <p className="layout__tagline">Free langar meals, delivered with dignity</p>
          </div>
        </div>
      </header>
      <main className="layout__main">{children}</main>
      <footer className="layout__footer">
        No payment. No paperwork. No questions asked.
      </footer>
    </div>
  )
}
