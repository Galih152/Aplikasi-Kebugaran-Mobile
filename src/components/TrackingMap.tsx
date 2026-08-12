import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { GeoPoint } from '@/types/fitness'

const defaultIcon = L.divIcon({
  className: 'tracking-marker',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#1C1C22;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function FollowCenter({ points, following }: { points: GeoPoint[]; following: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!following || points.length === 0) return
    const last = points[points.length - 1]
    map.panTo([last.lat, last.lng], { animate: true })
  }, [points, following, map])
  return null
}

export default function TrackingMap({
  points,
  accentColor,
  following,
}: {
  points: GeoPoint[]
  accentColor: string
  following: boolean
}) {
  const center: [number, number] =
    points.length > 0
      ? [points[points.length - 1].lat, points[points.length - 1].lng]
      : [-6.2, 106.816666]

  const latLngs = points.map((p) => [p.lat, p.lng] as [number, number])

  return (
    <div className="tracking-map">
      <MapContainer
        center={center}
        zoom={16}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {latLngs.length > 1 && (
          <Polyline positions={latLngs} pathOptions={{ color: accentColor, weight: 4 }} />
        )}
        {points.length > 0 && (
          <Marker position={[points[points.length - 1].lat, points[points.length - 1].lng]} icon={defaultIcon} />
        )}
        <FollowCenter points={points} following={following} />
      </MapContainer>
    </div>
  )
}
