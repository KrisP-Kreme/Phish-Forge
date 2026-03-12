'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import Section from './Section'
import Layout from './Layout'
import ErrorNotification from './ErrorNotification'
import { sections } from './constants/sections'
import { AnimatedNavFramer } from '@/components/ui/animated-nav-framer'

const navItems = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Mission' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'meet-the-devs', label: 'Team' },
  { id: 'join', label: 'Get Started' }
]

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ container: containerRef })
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 })

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const scrollPosition = containerRef.current.scrollTop
        const windowHeight = window.innerHeight
        const newActiveSection = Math.floor(scrollPosition / windowHeight)
        setActiveSection(newActiveSection)
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
    }
  }, [])

  const handleNavClick = (index: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: index * window.innerHeight,
        behavior: 'smooth'
      })
    }
  }

  return (
    <Layout>
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] origin-left z-[60]"
        style={{
          scaleX,
          backgroundColor: 'hsl(var(--primary))'
        }}
      />

      {/* Animated Navigation Bar */}
      <AnimatedNavFramer
        navItems={navItems}
        activeSection={activeSection}
        onNavClick={handleNavClick}
      />

      {/* Side Dot Navigation */}
      <nav className="fixed top-0 right-0 h-screen flex flex-col justify-center z-30 p-4">
        {sections.map((section, index) => (
          <button
            key={section.id}
            className={`w-3 h-3 rounded-full my-2 transition-all ${
              index === activeSection ? 'scale-150' : ''
            }`}
            style={{ 
              backgroundColor: index === activeSection 
                ? 'hsl(var(--primary))' 
                : 'hsl(var(--muted-foreground) / 0.5)' 
            }}
            onClick={() => handleNavClick(index)}
            aria-label={`Navigate to ${section.id}`}
          />
        ))}
      </nav>

      {/* Main Content */}
      <div 
        ref={containerRef} 
        className="h-full overflow-y-auto snap-y snap-mandatory pt-[72px]"
      >
        {sections.map((section, index) => (
          <Section
            key={section.id}
            {...section}
            isActive={index === activeSection}
          />
        ))}
      </div>
    </Layout>
    
  )
}