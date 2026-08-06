// Runs on Vercel as a serverless function at /api/weather.
// Reads credentials from Vercel's Environment Variables table
// (Project Settings → Environment Variables) — NOT the VITE_-prefixed
// kind, since those get bundled into the client. These stay server-only.
const CLIENT_ID = process.env.XWEATHER_CLIENT_ID
const CLIENT_SECRET = process.env.XWEATHER_CLIENT_SECRET

const ENDPOINTS = {
  conditions: (place) => `conditions/${encodeURIComponent(place)}`,
  forecastDaily: (place) => `forecasts/${encodeURIComponent(place)}?filter=day&limit=8`,
  forecastHourly: (place) => `forecasts/${encodeURIComponent(place)}?filter=1hr&limit=12`,
  airquality: (place) => `airquality/${encodeURIComponent(place)}`,
}

export default async function handler(req, res) {
  const { place, kind } = req.query

  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.status(500).json({
      success: false,
      error: 'Missing XWEATHER_CLIENT_ID / XWEATHER_CLIENT_SECRET environment variables on the server.',
    })
    return
  }
  if (!place || !kind || !ENDPOINTS[kind]) {
    res.status(400).json({ success: false, error: 'Missing or invalid "place"/"kind" query params.' })
    return
  }

  const path = ENDPOINTS[kind](place)
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://data.api.xweather.com/${path}${sep}client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 9000)
    const xwRes = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    const json = await xwRes.json()
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.status(xwRes.ok ? 200 : 502).json(json)
  } catch (err) {
    res.status(504).json({ success: false, error: err.name === 'AbortError' ? 'Xweather request timed out.' : String(err) })
  }
}
