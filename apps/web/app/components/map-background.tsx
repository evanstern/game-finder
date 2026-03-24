interface MapBackgroundProps {
  showGlow?: boolean
}

export function MapBackground({
  showGlow = true,
}: MapBackgroundProps) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, #0a1628 0%, #132240 60%, #0d1a30 100%)',
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none md:hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(255,191,71,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,191,71,0.05) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, transparent 30%, black 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 30%, black 70%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none hidden md:block"
        style={{
          backgroundImage: `linear-gradient(rgba(255,191,71,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,191,71,0.05) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse at center, transparent 30%, black 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 30%, black 70%)',
        }}
      />

      {showGlow && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: '33%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '500px',
            height: '400px',
            background: 'radial-gradient(ellipse at center, rgba(255,191,71,0.06) 0%, transparent 70%)',
          }}
        />
      )}

    </div>
  )
}
