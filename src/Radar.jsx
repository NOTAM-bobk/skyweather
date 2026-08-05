import { useEffect, useState } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import { ArrowLeft } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

// Xweather Raster Maps tile URL format:
// https://maps.api.xweather.com/{client_id}_{client_secret}/{layers}/{z}/{x}/{y}/{offset}.png
export default function Radar({ place, mood, onBack, clientId, clientSecret }) {
  const [center, setCenter] = useState([39.8, -98.6]) // fallback: center of US
  const [zoom, setZoom] = useState(5)

  useEffect(() => {
    const q = place?.query || ''
    const parts = q.split(',')
    if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
      setCenter([parseFloat(parts[0]), parseFloat(parts[1])])
      setZoom(8)
    }
  }, [place])

  const token = clientId && clientSecret ? `${clientId}_${clientSecret}` : null
  const radarUrl = token
    ? `https://maps.api.xweather.com/${token}/radar,admin/{z}/{x}/{y}/current.png`
    : null

  return (
    <div className="app-shell" data-mood={mood} style={{ height: '100vh', position: 'relative' }}>
      <button
        onClick={onBack}
        className="blob-card"
        aria-label="Back"
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 1000,
          padding: 12,
          borderRadius: 'var(--radius-pill)',
          display: 'flex',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <ArrowLeft size={20} />
      </button>

      <div
        className="blob-card"
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          padding: '10px 20px',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Live radar
      </div>

      {!token ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
          Missing Xweather credentials — add VITE_XWEATHER_CLIENT_ID and VITE_XWEATHER_CLIENT_SECRET to see radar.
        </div>
      ) : (
        <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <TileLayer attribution="&copy; Xweather" url={radarUrl} opacity={0.75} />
        </MapContainer>
      )}
    </div>
  )
}
