'use client'

interface SelectFishProps {
  onSelect?: () => void
}

export default function SelectFish({ onSelect }: SelectFishProps) {
  return (
    <button
      onClick={onSelect}
      style={{
        padding: '10px 20px',
        backgroundColor: '#ff6b6b',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
      }}
    >
      Select Fish
    </button>
  )
}
