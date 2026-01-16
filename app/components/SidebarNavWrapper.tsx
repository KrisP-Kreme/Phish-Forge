'use client'

import SidebarNav from './SidebarNav'
import { sections } from './constants/sections'

export default function SidebarNavWrapper() {
  const handleNavigate = (id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <SidebarNav
      sections={sections}
      activeSection={0}
      onNavigate={handleNavigate}
    />
  )
}