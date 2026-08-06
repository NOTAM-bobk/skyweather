import { useEffect, useState, useCallback } from 'react'
import {
  Wind,
  Droplets,
  Sun,
  Eye,
  Gauge,
  Sunrise,
  MapPin,
  Radar as RadarIcon,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import Onboarding from './Onboarding.jsx'
import Radar from './Radar.jsx'

// All requests go through our own /api/weather serverless function, which
// holds the Xweather credentials server-side (Vercel Environment Variables
// table) and forwards the request. This avoids exposing the secret in the
// browser and avoids any cross-origin issues calling Xweather directly.
async function apiFetch(kind, place) {
  const url = `/api/weather?kind=${kind}&place=${encodeURIComponent(place)}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  let res
  try {
    res = await fetch(url, { signal: controller.signal })
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Request timed out — check your connection.' : 'Network error reaching the server.')
  } finally {
    clearTimeout(timeout)
  }
  const json = await res.json().catch(() => null)
  if (!json || json.success === false) {
    throw new Error(json?.error?.description || json?.error || `Couldn't load ${kind}`)
  }
  return json.response
}

// Xweather codes weather like "coverage:intensity:type" (e.g. "::CL", "-:RA").
// This maps that + the plain-text description to one of our theme moods.
function moodFromWeather(coded, text, isDay) {
  const c = (coded || '').toUpperCase()
  const t = (text || '').toLowerCase()
  if (c.includes('TS') || t.includes('thunder') || t.includes('storm')) return 'storm'
  if (c.includes('SN') || c.includes('IP') || c.includes('IC') || t.includes('snow') || t.includes('sleet') || t.includes('ice'))
    return 'snow'
  if (c.includes('RA') || c.includes('RW') || c.includes('DZ') || t.includes('rain') || t.includes('drizzle') || t.includes('shower'))
    return 'rain'
  if (c.includes('FG') || c.includes('BR') || c.includes('HZ') || t.includes('fog') || t.includes('mist') || t.includes('haze'))
    return 'fog'
  if (c.includes('OV') || c.includes('BK') || t.includes('cloud') || t.includes('overcast')) return 'cloudy'
  if (isDay === false) return 'clear-night'
  return 'clear-day'
}

function firstOf(x) {
  return Array.isArray(x) ? x[0] : x
}

function fmtTime(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  if (isNaN(d)) return '--'
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function fmtHour(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  if (isNaN(d)) return '--'
  return d.toLocaleTimeString([], { hour: 'numeric' })
}

export default function App() {
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('sky-onboarded') === '1')
  const [place, setPlace] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sky-place') || 'null')
    } catch {
      return null
    }
  })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState('home') // 'home' | 'radar'
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const load = useCallback(async (p) => {
    if (!p?.query) {
      setError("We lost track of your location. Tap below to set it again.")
      return
    }
    setLoading(true)
    setError('')
    try {
      const [conditionsRaw, dailyRaw, hourlyRaw] = await Promise.all([
        apiFetch('conditions', p.query),
        apiFetch('forecastDaily', p.query),
        apiFetch('forecastHourly', p.query),
      ])
      const ob = firstOf(conditionsRaw)?.ob
      const daily = firstOf(dailyRaw)?.periods || []
      const hourly = firstOf(hourlyRaw)?.periods || []
      const place_ = firstOf(conditionsRaw)?.place
      if (!ob) throw new Error("Xweather didn't recognize that location — try a nearby city.")

      let aqi = null
      try {
        const aqRaw = await apiFetch('airquality', p.query)
        aqi = firstOf(aqRaw)?.periods?.[0]?.aqi?.aqi ?? null
      } catch {
        // air quality isn't available for every location/plan — fail quietly
      }

      setData({ ob, daily, hourly, aqi, placeName: place_?.name || p.label })
    } catch (e) {
      setError(e.message || 'Something went wrong loading the forecast.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!onboarded) return
    if (place?.query) {
      load(place)
    } else {
      setError("We lost track of your location. Tap below to set it again.")
    }
  }, [onboarded, place, load])

  function handleOnboarded(p) {
    setPlace(p)
    setOnboarded(true)
  }

  function changeLocation() {
    localStorage.removeItem('sky-onboarded')
    localStorage.removeItem('sky-place')
    setOnboarded(false)
    setData(null)
  }

  if (!onboarded) {
    return <Onboarding onComplete={handleOnboarded} />
  }

  const mood = data?.ob ? moodFromWeather(data.ob.weatherPrimaryCoded, data.ob.weatherPrimary, data.ob.isDay) : 'clear-day'

  if (view === 'radar') {
    return <Radar place={place} mood={mood} onBack={() => setView('home')} />
  }

  const ob = data?.ob
  const today = data?.daily?.[0]

  return (
    <div className="app-shell" data-mood={mood}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 20px 120px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button
            onClick={changeLocation}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: 'var(--on-bg)' }}
          >
            <MapPin size={16} />
            {data?.placeName || place?.label || 'Your location'}
          </button>
          <button
            onClick={() => load(place)}
            aria-label="Refresh"
            className="blob-card"
            style={{ padding: 10, borderRadius: 'var(--radius-pill)' }}
          >
            {loading ? <Loader2 size={18} /> : <RefreshCw size={18} />}
          </button>
        </header>

        {!online && (
          <div className="blob-card rise-in" style={{ marginTop: 16, fontSize: 14 }}>
            Offline — showing the last forecast we saved.
          </div>
        )}

        {error && (
          <div className="blob-card rise-in" style={{ marginTop: 20 }}>
            <div style={{ color: 'var(--accent)', marginBottom: 12 }}>{error}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="pill-btn ghost" onClick={() => load(place)}>
                Try again
              </button>
              <button className="pill-btn ghost" onClick={changeLocation}>
                Set location
              </button>
            </div>
          </div>
        )}

        {!error && !ob && (
          <div style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
            <Loader2 size={32} style={{ animation: 'drift 1.2s linear infinite' }} />
          </div>
        )}

        {ob && (
          <>
            <div className="rise-in" style={{ textAlign: 'center', margin: '28px 0 8px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 96, lineHeight: 1 }}>
                {Math.round(ob.tempF)}°
              </div>
              <div style={{ fontSize: 19, fontWeight: 600, marginTop: 4 }}>{ob.weatherPrimary}</div>
              <div style={{ color: 'var(--on-bg-muted)', marginTop: 6, fontSize: 15 }}>
                Feels like {Math.round(ob.feelslikeF)}°
                {today && (
                  <>
                    {' '}
                    · High {Math.round(today.maxTempF)}° · Low {Math.round(today.minTempF)}°
                  </>
                )}
              </div>
            </div>

            <div className="blob-card rise-in" style={{ marginTop: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', opacity: 0.7, marginBottom: 12 }}>
                Hourly
              </div>
              <div style={{ display: 'flex', gap: 22, overflowX: 'auto', paddingBottom: 4 }}>
                {(data.hourly || []).slice(0, 12).map((h, i) => (
                  <div key={i} style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>{i === 0 ? 'Now' : fmtHour(h.dateTimeISO)}</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{Math.round(h.tempF)}°</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rise-in"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}
            >
              <StatCard icon={<Wind size={18} />} label="Wind" value={`${Math.round(ob.windSpeedMPH || 0)} mph`} sub={ob.windDir} />
              <StatCard icon={<Droplets size={18} />} label="Humidity" value={`${ob.humidity ?? '--'}%`} />
              <StatCard icon={<Sun size={18} />} label="UV index" value={`${ob.uvindex ?? today?.avgUV ?? '--'}`} />
              <StatCard icon={<Eye size={18} />} label="Visibility" value={`${Math.round(ob.visibilityMI ?? 0)} mi`} />
              <StatCard
                icon={<Sunrise size={18} />}
                label="Sunrise / Sunset"
                value={`${fmtTime(today?.sunriseISO)}`}
                sub={fmtTime(today?.sunsetISO)}
              />
              <StatCard icon={<Gauge size={18} />} label="Pressure" value={`${Math.round(ob.pressureMB || 0)} mb`} />
              {data.aqi != null && <StatCard icon={<Droplets size={18} />} label="Air quality" value={`${data.aqi}`} />}
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => setView('radar')}
        className="pill-btn"
        style={{
          position: 'fixed',
          right: 22,
          bottom: 26,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: 'var(--shadow-lifted)',
        }}
      >
        <RadarIcon size={18} /> Radar
      </button>
    </div>
  )
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="blob-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.75, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
        {icon} {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, opacity: 0.65, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
