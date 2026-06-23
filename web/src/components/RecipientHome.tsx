import { SevaLogo } from './SevaLogo'
import './RecipientHome.css'

interface RecipientHomeProps {
  onRequest: () => void
}

const STEPS = [
  {
    number: '01',
    title: 'Submit your request',
    description: 'Tell us your household needs, address, and preferred time window.',
  },
  {
    number: '02',
    title: 'Coordinator review',
    description: 'A community coordinator approves your request, typically within 24 hours.',
  },
  {
    number: '03',
    title: 'Sevadar delivers',
    description: 'A volunteer delivers fresh, hot langar to your door.',
  },
]

export function RecipientHome({ onRequest }: RecipientHomeProps) {
  return (
    <div className="recipient-home">
      <header className="recipient-home__header">
        <SevaLogo size="md" />
        <h1 className="recipient-home__title">Langar Seva</h1>
        <p className="recipient-home__subtitle">Prepared with seva. Delivered with dignity.</p>
      </header>

      <div className="recipient-home__body">
        <section className="recipient-home__hero" aria-labelledby="hero-heading">
          <div className="recipient-home__hero-texture" aria-hidden="true" />
          <div className="recipient-home__hero-inner">
            <h2 id="hero-heading" className="recipient-home__hero-title">
              Free langar, delivered to your door.
            </h2>
            <p className="recipient-home__hero-copy">
              A coordinator from your nearest Gurdwara will review your request and assign a
              sevadar.
            </p>
            <button type="button" className="recipient-home__cta" onClick={onRequest}>
              Request a meal
            </button>
          </div>
        </section>

        <section className="recipient-home__steps" aria-labelledby="steps-heading">
          <div className="recipient-home__steps-header">
            <h2 id="steps-heading" className="recipient-home__steps-title">
              How it works
            </h2>
          </div>
          <ol className="recipient-home__steps-list">
            {STEPS.map((step) => (
              <li key={step.number} className="recipient-home__step">
                <span className="recipient-home__step-number">{step.number}</span>
                <div>
                  <h3 className="recipient-home__step-title">{step.title}</h3>
                  <p className="recipient-home__step-copy">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
