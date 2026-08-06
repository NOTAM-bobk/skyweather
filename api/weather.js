// Runs on Vercel as a serverless function at /api/weather.
// Primary source: Xweather. If it fails for any reason (bad/missing
// key, quota, outage), we automatically fall back to OpenWeatherMap
// and normalize its response into the same shape the frontend
// already expects — so App.jsx / Radar.jsx don't need to change.
//
// Env vars (Vercel → Project → Settings → Environment Variables):
//   XWEATHER_CLIENT_ID, XWEATHER_CLIENT_SECRET   (required for primary source)
//   OPENWEATHER_API_KEY                          (required for fallback)

const XW_ID = process.env.XWEATHER_CLIENT_ID
const XW_SECRET = process.env.XWEATHER_CLIENT_SECRET
const OWM_KEY = process.env.OPENWEATHER_API_KEY

const XW_ENDPOINTS = {
  conditions: (place) => `conditions/${encodeURIComponent(place)}`,
  forecastDaily: (place) => `forecasts/${encodeURIComponent(place)}?filter=day&limit=8`,
  forecastHourly: (place) => `forecasts/${encodeURIComponent(place)}?filter=1hr&limit=12`,
  airquality: (place) => `airquality/${encodeURIComponent(place)}`,
}

async function fetchWithTimeout(url, ms = 9000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(t)
  }
}

async function fromXweather(kind, place) {
  if (!XW_ID || !XW_SECRET) throw new Error('Xweather credentials not set')
  const path = XW_ENDPOINTS[kind](place)
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://data.api.xweather.com/${path}${sep}client_id=${XW_ID}&client_secret=${XW_SECRET}`
  const res = await fetchWithTimeout(url)
  const json = await res.json()
  if (!res.ok || json.success === false) throw new Error(json?.error?.description || 'Xweather request failed')
  return json.response
}

// ---- OpenWeatherMap fallback ----

const LATLON_RE = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/

async function resolveLatLon(place) {
  const m = place.match(LATLON_RE)
  if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[3]) }
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(place)}&limit=1&appid=${OWM_KEY}`
  const res = await fetchWithTimeout(url)
  const arr = await res.json()
  if (!res.ok || !Array.isArray(arr) || !arr.length) throw new Error(`Couldn't find "${place}"`)
  return { lat: arr[0].lat, lon: arr[0].lon, name: [arr[0].name, arr[0].state].filter(Boolean).join(', ') }
}

// OWM weather-condition ids -> a short code moodFromWeather() in App.jsx
// already knows how to read (it looks for substrings like TS/SN/RA/FG/OV).
function owmCode(id) {
  if (id >= 200 && id < 300) return 'TS'
  if (id >= 300 && id < 600) return 'RA'
  if (id >= 600 && id < 700) return 'SN'
  if (id >= 700 && id < 800) return 'FG'
  if (id === 800) return 'CL'
  return 'OV'
}

async function owmConditions(place) {
  const { lat, lon, name } = await resolveLatLon(place)
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${OWM_KEY}`
  const res = await fetchWithTimeout(url)
  const j = await res.json()
  if (!res.ok) throw new Error(j?.message || 'OpenWeatherMap request failed')
  const nowSec = Math.floor(Date.now() / 1000)
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const windDir = dirs[Math.round(((j.wind?.deg ?? 0) % 360) / 22.5) % 16]
  const w = j.weather?.[0] || {}
  const ob = {
    tempF: j.main?.temp,
    feelslikeF: j.main?.feels_like,
    humidity: j.main?.humidity,
    pressureMB: j.main?.pressure,
    visibilityMI: j.visibility != null ? j.visibility / 1609.34 : null,
    windSpeedMPH: j.wind?.speed,
    windDir,
    weatherPrimary: w.description ? w.description[0].toUpperCase() + w.description.slice(1) : w.main,
    weatherPrimaryCoded: owmCode(w.id ?? 800),
    isDay: j.sys?.sunrise && j.sys?.sunset ? nowSec > j.sys.sunrise && nowSec < j.sys.sunset : true,
    uvindex: null, // not on OWM's free current-weather endpoint
  }
  return { ob, place: { name: name || j.name } }
}

async function owmForecast(place, kind) {
  const { lat, lon } = await resolveLatLon(place)
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${OWM_KEY}`
  const res = await fetchWithTimeout(url)
  const j = await res.json()
  if (!res.ok) throw new Error(j?.message || 'OpenWeatherMap request failed')
  const list = j.list || []

  if (kind === 'forecastHourly') {
    return {
      periods: list.slice(0, 12).map((it) => ({
        tempF: it.main?.temp,
        dateTimeISO: new Date(it.dt * 1000).toISOString(),
      })),
    }
  }

  // Group 3-hour entries into daily min/max (kind === 'forecastDaily').
  // OWM's free forecast endpoint doesn't include per-day sunrise/sunset —
  // only today's, attached separately from the current-weather call.
  const byDay = new Map()
  for (const it of list) {
    const day = it.dt_txt.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, { max: -Infinity, min: Infinity })
    const d = byDay.get(day)
    d.max = Math.max(d.max, it.main?.temp_max ?? it.main?.temp)
    d.min = Math.min(d.min, it.main?.temp_min ?? it.main?.temp)
  }
  const periods = [...byDay.values()].slice(0, 8).map((d) => ({ maxTempF: d.max, minTempF: d.min }))

  if (kind === 'forecastDaily' && periods[0]) {
    try {
      const wRes = await fetchWithTimeout(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}`
      )
      const w = await wRes.json()
      if (w.sys?.sunrise) periods[0].sunriseISO = new Date(w.sys.sunrise * 1000).toISOString()
      if (w.sys?.sunset) periods[0].sunsetISO = new Date(w.sys.sunset * 1000).toISOString()
    } catch {
      // sunrise/sunset just won't show for today — not worth failing the whole forecast over
    }
  }

  return { periods }
}

async function owmAirQuality(place) {
  const { lat, lon } = await resolveLatLon(place)
  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OWM_KEY}`
  const res = await fetchWithTimeout(url)
  const j = await res.json()
  if (!res.ok) throw new Error(j?.message || 'OpenWeatherMap request failed')
  // Note: OWM's AQI is a 1–5 European index, not the 0–500 US scale
  // Xweather returns — shown as-is, it's just a different scale on fallback.
  const aqi = j.list?.[0]?.main?.aqi ?? null
  return { periods: [{ aqi: { aqi } }] }
}

async function fromOpenWeather(kind, place) {
  if (!OWM_KEY) throw new Error('OpenWeatherMap key not set')
  if (kind === 'conditions') return owmConditions(place)
  if (kind === 'forecastDaily' || kind === 'forecastHourly') return owmForecast(place, kind)
  if (kind === 'airquality') return owmAirQuality(place)
  throw new Error('Unknown kind')
}

export default async function handler(req, res) {
  const { place, kind } = req.query
  if (!place || !kind || !XW_ENDPOINTS[kind]) {
    res.status(400).json({ success: false, error: 'Missing or invalid "place"/"kind" query params.' })
    return
  }

  let response
  let source = 'xweather'
  try {
    response = await fromXweather(kind, place)
  } catch (xwErr) {
    try {
      response = await fromOpenWeather(kind, place)
      source = 'openweathermap'
    } catch (owmErr) {
      res.status(502).json({
        success: false,
        error: `Both weather sources failed. Xweather: ${xwErr.message}. OpenWeatherMap: ${owmErr.message}.`,
      })
      return
    }
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  res.setHeader('X-Weather-Source', source)
  // Wrap in an array so the frontend's firstOf() helper works the same
  // way regardless of which source answered.
  res.status(200).json({ success: true, response: [response] })
}
