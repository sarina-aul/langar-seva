import './SevaLogo.css'

type SevaLogoSize = 'sm' | 'md' | 'lg'
type SevaLogoVariant = 'ink' | 'paper'

interface SevaLogoProps {
  size?: SevaLogoSize
  variant?: SevaLogoVariant
}

export function SevaLogo({ size = 'md', variant = 'ink' }: SevaLogoProps) {
  return (
    <div className={`seva-logo seva-logo--${size} seva-logo--${variant}`}>
      <div className="seva-logo__mark" aria-hidden="true">
        <span className="seva-logo__symbol" aria-label="Ik Onkar">
          ੴ
        </span>
      </div>
      <div className="seva-logo__text">
        <span className="seva-logo__name">Seva Eats</span>
        {size === 'lg' && (
          <span className="seva-logo__caption">ਸੇਵਾ • Selfless Service</span>
        )}
      </div>
    </div>
  )
}
