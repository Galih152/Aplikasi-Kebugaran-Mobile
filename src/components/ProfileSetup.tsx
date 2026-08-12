import { useState } from 'react'
import type { UserProfile } from '@/types/fitness'
import { isProfileComplete } from '@/lib/storage'

const C = {
  card: '#FFFFFF',
  salmon: '#F4907A',
  dark: '#1C1C22',
  mid: '#6B6B80',
  soft: '#B0B0C0',
  bg: '#D6EEF0',
}

export default function ProfileSetup({
  initial,
  onSave,
  onCancel,
  title = 'Data Tubuh',
}: {
  initial?: UserProfile | null
  onSave: (p: UserProfile) => void
  onCancel?: () => void
  title?: string
}) {
  const [heightCm, setHeightCm] = useState(String(initial?.heightCm ?? ''))
  const [weightKg, setWeightKg] = useState(String(initial?.weightKg ?? ''))
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    const profile: UserProfile = {
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
      name: initial?.name,
      updatedAt: new Date().toISOString(),
    }
    if (!isProfileComplete(profile)) {
      setError('Tinggi 100–250 cm dan berat 30–250 kg.')
      return
    }
    setError(null)
    onSave(profile)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.dark, fontFamily: 'Nunito, sans-serif' }}>{title}</div>
      <div style={{ fontSize: 13, color: C.mid, lineHeight: 1.45 }}>
        Isi tinggi dan berat untuk menghitung estimasi kalori saat lari atau bersepeda.
      </div>

      <div style={{ borderRadius: 18, background: C.card, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>Tinggi (cm)</span>
          <input
            type="number"
            inputMode="decimal"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="170"
            style={{
              border: '1.5px solid #E8E8EE',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 16,
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 700,
              color: C.dark,
              outline: 'none',
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>Berat (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="65"
            style={{
              border: '1.5px solid #E8E8EE',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 16,
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 700,
              color: C.dark,
              outline: 'none',
            }}
          />
        </label>
        {error && <div style={{ fontSize: 12, color: '#FF3B30', fontWeight: 600 }}>{error}</div>}
      </div>

      <button
        onClick={handleSave}
        style={{
          width: '100%',
          padding: 16,
          borderRadius: 20,
          border: 'none',
          cursor: 'pointer',
          background: `linear-gradient(135deg, ${C.salmon}, #F7C59F)`,
          color: '#fff',
          fontSize: 16,
          fontWeight: 800,
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        Simpan
      </button>

      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            width: '100%',
            padding: 13,
            borderRadius: 18,
            border: '1.5px solid #E8E8EE',
            background: 'transparent',
            cursor: 'pointer',
            color: C.mid,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Batal
        </button>
      )}
    </div>
  )
}
