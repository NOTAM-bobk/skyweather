import { useState } from 'react'
import { Sun, MapPin, CloudRain, ChevronRight, Loader2, Search } from 'lucide-react'

const STEPS = ['welcome', 'location', 'preference']

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [cityInput, setCityInput] = useState('')
  const [place, setPlace] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const [rainAlerts, setRainAlerts] = useState(true)

  function useMyLocation() {
    setLocError('')
    if (!navigator.geolocation) {
      setLocError("This browser can't share a location. Type your city instead.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setPlace({
          query: `${pos.coords.latitude},${pos.coords.longitude}`,
          label: 'Current location',
        })
      },
      () => {
        setLocating(false)
        setLocError("Couldn't get your location. Try typing your city below.")
      },
      { timeout: 8000 }
    )
  }

  function useTypedCity(e) {
    e.preventDefault()
    if (!cityInput.trim()) return
    setPlace({ query: cityInput.trim(), label: cityInput.trim() })
  }

  function finish() {
    localStorage.setItem('sky-onboarded', '1')
    localStorage.setItem('sky-rain-alerts', rainAlerts ? '1' : '0')
    localStorage.setItem('sky-place', JSON.stringify(place))
    onComplete(place)
  }

  return (
    <div className="app-shell" data-mood="clear-day" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ambient drifting sun */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-8%',
          right: '-6%',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
          opacity: 0.5,
          animation: 'drift 9s ease-in-out infinite',
        }}
      />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '28px 0 8px' }}>
        {STEPS.map((s, i) => (
          <span
            key={s}
            style={{
              width: i === step ? 28 : 8,
              height: 8,
              borderRadius: 999,
              background: i === step ? 'var(--accent)' : 'var(--surface-2)',
              transition: 'all 300ms ease',
            }}
          />
        ))}
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px 24px 48px',
          maxWidth: 480,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {step === 0 && (
          <div className="rise-in" style={{ textAlign: 'center' }}>
            <div
              className="blob-card"
              style={{
                width: 96,
                height: 96,
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 28px',
                borderRadius: '38% 62% 60% 40% / 45% 40% 60% 55%',
              }}
            >
              <Sun size={44} color="var(--accent)" strokeWidth={2.2} />
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, margin: '0 0 12px', lineHeight: 1.05 }}>
              Meet your sky.
            </h1>
            <p style={{ color: 'var(--on-bg-muted)', fontSize: 17, lineHeight: 1.5, margin: '0 0 36px' }}>
              Sky turns real weather data into something you actually want to check —
              fast, friendly, and genuinely useful.
            </p>
            <button className="pill-btn" onClick={() => setStep(1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Let's go <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="rise-in" style={{ textAlign: 'center', width: '100%' }}>
            <div
              className="blob-card"
              style={{
                width: 96,
                height: 96,
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 28px',
                borderRadius: '60% 40% 40% 60% / 55% 60% 40% 45%',
              }}
            >
              <MapPin size={40} color="var(--accent)" strokeWidth={2.2} />
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, margin: '0 0 10px' }}>
              Where should we look?
            </h1>
            <p style={{ color: 'var(--on-bg-muted)', fontSize: 16, margin: '0 0 28px' }}>
              We'll use this to pull hyper-local conditions and radar.
            </p>

            <button
              className="pill-btn"
              onClick={useMyLocation}
              disabled={locating}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}
            >
              {locating ? <Loader2 size={18} className="rise-in" style={{ animation: 'none' }} /> : <MapPin size={18} />}
              {locating ? 'Locating…' : 'Use my location'}
            </button>

            <form onSubmit={useTypedCity} style={{ display: 'flex', gap: 8 }}>
              <div
                className="blob-card"
                style={{ flex: 1, padding: '4px 4px 4px 16px', display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-pill)' }}
              >
                <Search size={18} color="var(--on-bg-muted)" style={{ flexShrink: 0 }} />
                <input
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="City, State"
                  aria-label="City name"
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    padding: '12px 10px',
                    fontSize: 15,
                    color: 'var(--on-surface)',
                  }}
                />
              </div>
              <button type="submit" className="pill-btn ghost" aria-label="Search city">
                <ChevronRight size={20} />
              </button>
            </form>

            {locError && (
              <p style={{ color: 'var(--accent)', fontSize: 14, marginTop: 14 }}>{locError}</p>
            )}

            {place && (
              <div className="rise-in" style={{ marginTop: 22 }}>
                <p style={{ fontSize: 15, marginBottom: 12 }}>
                  Got it — <strong>{place.label}</strong>
                </p>
                <button className="pill-btn" onClick={() => setStep(2)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  Continue <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="rise-in" style={{ textAlign: 'center', width: '100%' }}>
            <div
              className="blob-card"
              style={{
                width: 96,
                height: 96,
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 28px',
                borderRadius: '55% 45% 35% 65% / 50% 55% 45% 50%',
              }}
            >
              <CloudRain size={40} color="var(--accent)" strokeWidth={2.2} />
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, margin: '0 0 10px' }}>
              One quick thing.
            </h1>
            <p style={{ color: 'var(--on-bg-muted)', fontSize: 16, margin: '0 0 28px' }}>
              Want a heads-up before rain rolls in? We'll wire up real alerts as Sky grows —
              for now this just saves your preference.
            </p>

            <button
              onClick={() => setRainAlerts((v) => !v)}
              className="blob-card"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 28,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 15 }}>Rain heads-up</span>
              <span
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 999,
                  background: rainAlerts ? 'var(--accent)' : 'rgba(0,0,0,0.15)',
                  position: 'relative',
                  transition: 'background 200ms ease',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: rainAlerts ? 23 : 3,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--surface)',
                    transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                />
              </span>
            </button>

            <button className="pill-btn" onClick={finish} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Get started <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
