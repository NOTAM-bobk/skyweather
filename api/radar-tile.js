// Proxies a single Xweather radar tile at /api/radar-tile?z=&x=&y=
const CLIENT_ID = process.env.XWEATHER_CLIENT_ID
const CLIENT_SECRET = process.env.XWEATHER_CLIENT_SECRET

export default async function handler(req, res) {
  const { z, x, y } = req.query
  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.status(500).send('Missing XWEATHER_CLIENT_ID / XWEATHER_CLIENT_SECRET environment variables.')
    return
  }
  if (z == null || x == null || y == null) {
    res.status(400).send('Missing z/x/y query params.')
    return
  }

  const token = `${CLIENT_ID}_${CLIENT_SECRET}`
  const url = `https://maps.api.xweather.com/${token}/radar,admin/${z}/${x}/${y}/current.png`

  try {
    const tileRes = await fetch(url)
    if (!tileRes.ok) {
      res.status(tileRes.status).end()
      return
    }
    const buf = Buffer.from(await tileRes.arrayBuffer())
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600')
    res.status(200).send(buf)
  } catch (err) {
    res.status(502).send('Radar tile request failed.')
  }
}
