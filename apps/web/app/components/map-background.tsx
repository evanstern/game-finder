interface MapBackgroundProps {
  showCompass?: boolean
  showGlow?: boolean
}

export function MapBackground({
  showCompass = true,
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
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none hidden md:block"
        style={{
          backgroundImage: `linear-gradient(rgba(255,191,71,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,191,71,0.05) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
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

      {showCompass && (
        <div
          className="hidden md:flex absolute bottom-8 right-8 pointer-events-none items-center justify-center"
          style={{
            width: '50px',
            height: '50px',
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{ border: '1px solid rgba(255,191,71,0.12)' }}
          />

          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(rgba(255,191,71,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,191,71,0.06) 1px, transparent 1px)`,
              backgroundSize: '100% 50%, 50% 100%',
              backgroundPosition: 'center center',
            }}
          />

          <span
            className="absolute top-0.5 text-[8px] font-semibold leading-none"
            style={{ color: 'rgba(255,191,71,0.4)' }}
          >
            N
          </span>
          <span
            className="absolute bottom-0.5 text-[8px] font-semibold leading-none"
            style={{ color: 'rgba(255,191,71,0.4)' }}
          >
            S
          </span>
          <span
            className="absolute right-0.5 text-[8px] font-semibold leading-none"
            style={{ color: 'rgba(255,191,71,0.4)' }}
          >
            E
          </span>
          <span
            className="absolute left-0.5 text-[8px] font-semibold leading-none"
            style={{ color: 'rgba(255,191,71,0.4)' }}
          >
            W
          </span>
        </div>
      )}
    </div>
  )
}
