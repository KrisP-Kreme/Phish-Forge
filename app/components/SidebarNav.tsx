'use client'

import Image from 'next/image'

type SidebarNavProps = {
  sections: { id: string; title: string }[]
  activeSection: number
  onNavigate: (id: string) => void
}

const RADIAL_NAV_IDS = [
  'how-it-works',
  'meet-the-devs',
  'join',
]

export default function SidebarNav({
  sections,
  onNavigate,
}: SidebarNavProps) {
  const navSections = RADIAL_NAV_IDS
    .map(id => sections.find(section => section.id === id))
    .filter(Boolean) as { id: string; title: string }[]

  return (
    <nav className="sidebar">
      {/* HUB → HOME */}
      <div className="hub" onClick={() => onNavigate('home')}>
        <Image
          src="/weldfish.png"
          alt="PhishForge logo"
          width={28}
          height={28}
          priority
        />
      </div>

      <ul className="list">
        {navSections.map((section, index) => {
          const startAngle = -140
          const endAngle = -40
          const count = navSections.length

          const visualIndex = count - 1 - index

          const angle =
            startAngle +
            (visualIndex * (endAngle - startAngle)) / (count - 1)

          return (
            <li
              key={section.id}
              className="item"
              style={{ ['--angle' as any]: `${angle}deg` }}
              onClick={() => onNavigate(section.id)}
            >
              <span className="dot" />
              <span className="label">{section.title}</span>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}