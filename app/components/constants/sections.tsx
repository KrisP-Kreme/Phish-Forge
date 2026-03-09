import { Badge } from "@/components/ui/badge"
import { HowItWorks } from "@/components/ui/how-it-works"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"
import Image from "next/image"

// Investigation String Component with Physics
const InvestigationStrings = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  
  // Create dynamic physics for string curves
  // These values control the curvature and sway of the strings
  const curve1Sag = useTransform(scrollY, [0, 1000], [20, 28])  // Vertical sag deepens with scroll
  const curve2Sag = useTransform(scrollY, [0, 1000], [18, 25])
  const curve3Sag = useTransform(scrollY, [0, 1000], [22, 32])
  
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none hidden md:block" style={{ zIndex: 0 }} viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <filter id="string-blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
        </filter>
      </defs>
      
      {/* Left card to center card string - curved with physics */}
      <motion.path 
        initial={{ d: "M 16.66 15 Q 33.33 20 50 10" }}
        animate={{ 
          d: [
            "M 16.66 15 Q 33.33 20 50 10",
            "M 16.66 15 Q 34 23 50 10",
            "M 16.66 15 Q 32.5 22 50 10",
            "M 16.66 15 Q 33.33 20 50 10"
          ]
        }}
        stroke="#c44536" 
        strokeWidth="0.3" 
        strokeDasharray="0.8,0.8" 
        opacity="0.7"
        fill="none"
        filter="url(#string-blur)"
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Center card to right card string - curved with physics */}
      <motion.path 
        initial={{ d: "M 50 10 Q 66.66 18 83.33 15" }}
        animate={{ 
          d: [
            "M 50 10 Q 66.66 18 83.33 15",
            "M 50 10 Q 66 21 83.33 15",
            "M 50 10 Q 67.5 19 83.33 15",
            "M 50 10 Q 66.66 18 83.33 15"
          ]
        }}
        stroke="#c44536" 
        strokeWidth="0.3" 
        strokeDasharray="0.8,0.8" 
        opacity="0.7"
        fill="none"
        filter="url(#string-blur)"
        transition={{
          duration: 4.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.7
        }}
      />
      
      {/* Additional cross connection - long sweeping curve */}
      <motion.path 
        initial={{ d: "M 16.66 15 Q 50 22 83.33 15" }}
        animate={{ 
          d: [
            "M 16.66 15 Q 50 22 83.33 15",
            "M 16.66 15 Q 48 26 83.33 15",
            "M 16.66 15 Q 52 25 83.33 15",
            "M 16.66 15 Q 50 23 83.33 15",
            "M 16.66 15 Q 50 22 83.33 15"
          ]
        }}
        stroke="#c44536" 
        strokeWidth="0.25" 
        strokeDasharray="0.6,1.2" 
        opacity="0.3"
        fill="none"
        filter="url(#string-blur)"
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.2
        }}
      />
      
      {/* Pushpin dots */}
      <circle cx="16.66" cy="15" r="0.5" fill="#c44536" />
      <circle cx="50" cy="10" r="0.5" fill="#c44536" />
      <circle cx="83.33" cy="15" r="0.5" fill="#c44536" />
    </svg>
  )
}

// Developer Investigation Strings Component with Physics
const DevsInvestigationStrings = () => {
  const { scrollY } = useScroll()
  
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none hidden md:block" style={{ zIndex: 0 }} viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <filter id="devs-string-blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
        </filter>
      </defs>
      
      {/* Connection string between developers - centered pushpins */}
      <motion.path 
        initial={{ d: "M 25 8 Q 50 22 75 8" }}
        animate={{ 
          d: [
            "M 25 8 Q 50 22 75 8",
            "M 25 8 Q 48 28 75 8",
            "M 25 8 Q 52 25 75 8",
            "M 25 8 Q 50 23 75 8",
            "M 25 8 Q 50 22 75 8"
          ]
        }}
        stroke="#c44536" 
        strokeWidth="0.3" 
        strokeDasharray="0.8,0.8" 
        opacity="0.7"
        fill="none"
        filter="url(#devs-string-blur)"
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Secondary connection for depth */}
      <motion.path 
        initial={{ d: "M 25 8 Q 50 18 75 8" }}
        animate={{ 
          d: [
            "M 25 8 Q 50 18 75 8",
            "M 25 8 Q 51 21 75 8",
            "M 25 8 Q 49 20 75 8",
            "M 25 8 Q 50 18 75 8"
          ]
        }}
        stroke="#c44536" 
        strokeWidth="0.25" 
        strokeDasharray="0.6,1.2" 
        opacity="0.4"
        fill="none"
        filter="url(#devs-string-blur)"
        transition={{
          duration: 4.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.8
        }}
      />
      
      {/* Pushpin dots - centered positions for 2 cards */}
      <circle cx="25" cy="8" r="0.5" fill="#c44536" />
      <circle cx="75" cy="8" r="0.5" fill="#c44536" />
    </svg>
  )
}

export const sections = [
  { 
    id: 'home', 
    title: "phishforge.",
    content: (isActive: boolean) => (
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Left Content Section */}
        <div className="flex-1 max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0, y: 50 }}
              animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                animate={isActive ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.8, rotate: -10 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <Image 
                  src="/phishforgelogot.png" 
                  alt="PhishForge Logo"
                  width={80}
                  height={80}
                  className="w-16 h-16 md:w-20 md:h-20 object-contain"
                />
              </motion.div>
              <h1 
                className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight" 
                style={{ color: 'hsl(var(--foreground))' }}
              >
                phishforge.
              </h1>
            </motion.div>
            <motion.p 
              className="text-base md:text-lg text-muted-foreground leading-relaxed"
              initial={{ opacity: 0, y: 50 }}
              animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Crafting the next generation of security awareness through organic, hand-drawn simulations. Dive into a world where phishing defenses feels like storytelling.
            </motion.p>
            <motion.div 
              className="flex items-center gap-4 pt-2"
              initial={{ opacity: 0, y: 20 }}
              animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <button 
                className="px-6 py-3 rounded-lg font-bold text-sm md:text-base transition-all hover:opacity-90"
                style={{ 
                  backgroundColor: 'hsl(var(--foreground))',
                  color: 'hsl(var(--background))'
                }}
              >
                Start Forging
              </button>
              <button 
                className="px-6 py-3 rounded-lg font-medium text-sm md:text-base transition-all hover:bg-foreground/5 border-2"
                style={{ 
                  borderColor: 'hsl(var(--foreground))',
                  color: 'hsl(var(--foreground))'
                }}
              >
                Watch Demo
              </button>
            </motion.div>
          </motion.div>
        </div>

        {/* Right Character Image */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="hidden lg:block flex-shrink-0"
        >
          <img 
            src="/weldfish.png" 
            alt="PhishForge Mascot"
            className="w-72 xl:w-96 h-auto object-contain"
            style={{
              filter: 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.15))'
            }}
          />
        </motion.div>
      </div>
    )
  },
  { 
    id: 'features', 
    title: '', 
    content: (isActive: boolean) => (
      <div className="w-full max-w-5xl mx-auto px-6">
        <motion.div 
          className="space-y-12"
          initial={{ opacity: 0, y: 30 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Our Mission
            </h2>
          </div>

          <motion.div
            className="space-y-6 text-center max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Over <span className="font-bold text-foreground">60% of small and medium-sized businesses</span> fall 
              victim to phishing attacks annually, costing billions in damages.
            </p>
            
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Traditional security awareness training fails because it lacks the contextual awareness 
              that real attackers exploit.
            </p>
          </motion.div>
          
          <motion.div
            className="space-y-6 text-center max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Real-world phishing doesn't use generic templates. Attackers research your business 
              partners, understand your workflows, and craft emails that mirror legitimate communications.
            </p>
            
            <motion.p 
              className="text-base md:text-lg leading-relaxed font-semibold text-foreground pt-2" 
              initial={{ opacity: 0, y: 20 }}
              animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              PhishForge changes that. We create contextually-aware simulations that truly test 
              your team's defenses—preparing them for the attacks they'll actually face.
            </motion.p>
          </motion.div>
        </motion.div>
      </div>
    )
  },
  { 
    id: 'how-it-works', 
    title: 'How It Works', 
    content: <HowItWorks className="" />
  },
  { 
    id: 'meet-the-devs', 
    title: 'Meet the Devs',
    isTackleBox: true,
    content: (isActive: boolean) => (
      <div className="w-full max-w-7xl mx-auto space-y-12">
        {/* Simple Typography Header */}
        <motion.div 
          className="text-center space-y-4"
          initial={{ opacity: 0, y: 30 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.5 }}
        >
          <motion.h2 
            className="text-4xl md:text-6xl font-bold leading-[1.1] tracking-tight" 
            style={{ color: 'hsl(var(--foreground))' }}
            initial={{ opacity: 0, y: 50 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.5 }}
          >
            Meet the Devs
          </motion.h2>
          <motion.p 
            className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 50 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            The minds behind PhishForge, dedicated to cybersecurity education and building innovative security awareness tools.
          </motion.p>
        </motion.div>

        {/* Developer Cards Grid with Investigation Board Style */}
        <motion.div 
          className="relative grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 py-8"
          initial={{ opacity: 0, y: 50 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {/* Red investigation strings connecting the cards */}
          <DevsInvestigationStrings />
          
          {/* Nikolas Card - Polaroid Style */}
          <motion.div 
            className="relative transform hover:scale-105 hover:rotate-0 transition-all duration-300" 
            style={{ rotate: '-2deg', zIndex: 1 }}
            whileHover={{ y: -8, rotate: 0 }}
          >
            {/* Pushpin */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center z-10"
                 style={{ backgroundColor: '#c44536' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8b2e23' }}></div>
            </div>
            
            <div className="bg-white p-4 pb-12 shadow-xl border-2" 
                 style={{ borderColor: 'hsl(var(--border))' }}>
              {/* Polaroid Photo Area */}
              <div className="w-full aspect-[4/3] overflow-hidden mb-4" 
                   style={{ backgroundColor: 'hsl(var(--muted))' }}>
                <img 
                  src="https://media.licdn.com/dms/image/v2/D5603AQFaFiAHGH0S1w/profile-displayphoto-shrink_800_800/B56ZdTf2RoG0Ac-/0/1749452547793?e=1769644800&v=beta&t=ha0weoqz5CGxIs-n-wZbTCzdalEKS23FjdWcM2jNYck" 
                  alt="Nikolas Vittorio"
                  className="w-full h-full object-cover" 
                />
              </div>
              
              {/* Developer Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <h4 className="font-bold text-xs tracking-wide" style={{ color: 'hsl(var(--foreground))' }}>
                    NIKOLAS VITTORIO
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Final year CS student at RMIT majoring in Cybersecurity. PJPT certified, pursuing CPTS. Passionate about offensive security and red teaming.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <a href="https://www.linkedin.com/in/nikolas-vittorio/" target="_blank" rel="noopener noreferrer" 
                     className="inline-flex items-center gap-1 text-xs font-bold transition-colors hover:opacity-70" 
                     style={{ color: 'hsl(var(--primary))' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                  <a href="https://github.com/NikolasVittorio" target="_blank" rel="noopener noreferrer" 
                     className="inline-flex items-center gap-1 text-xs font-bold transition-colors hover:opacity-70" 
                     style={{ color: 'hsl(var(--primary))' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Kristijan Card - Polaroid Style */}
          <motion.div 
            className="relative transform hover:scale-105 hover:rotate-0 transition-all duration-300" 
            style={{ rotate: '1.5deg', zIndex: 1 }}
            whileHover={{ y: -8, rotate: 0 }}
          >
            {/* Pushpin */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center z-10"
                 style={{ backgroundColor: '#c44536' }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8b2e23' }}></div>
            </div>
            
            <div className="bg-white p-4 pb-12 shadow-xl border-2" 
                 style={{ borderColor: 'hsl(var(--border))' }}>
              {/* Polaroid Photo Area */}
              <div className="w-full aspect-[4/3] overflow-hidden mb-4" 
                   style={{ backgroundColor: 'hsl(var(--muted))' }}>
                <img 
                  src="https://media.licdn.com/dms/image/v2/D5603AQHgvXs3z9ctCA/profile-displayphoto-shrink_800_800/B56Zb3NGs4GoAc-/0/1747904130971?e=1769644800&v=beta&t=l45iflxyflZSSNJztffd5DZ8PQjkdmtYmPPPhJ-Yn6Y" 
                  alt="Kristijan Popordanoski"
                  className="w-full h-full object-cover" 
                />
              </div>
              
              {/* Developer Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <h4 className="font-bold text-xs tracking-wide" style={{ color: 'hsl(var(--foreground))' }}>
                    KRISTIJAN POPORDANOSKI
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Full-stack developer skilled in Node.js, React, and .NET. Recently completed Bachelor's in CS at RMIT. Passionate about cybersecurity education.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <a href="https://www.linkedin.com/in/kristijanpopordanoski/" target="_blank" rel="noopener noreferrer" 
                     className="inline-flex items-center gap-1 text-xs font-bold transition-colors hover:opacity-70" 
                     style={{ color: 'hsl(var(--primary))' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                  <a href="https://github.com/KrisP-Kreme" target="_blank" rel="noopener noreferrer" 
                     className="inline-flex items-center gap-1 text-xs font-bold transition-colors hover:opacity-70" 
                     style={{ color: 'hsl(var(--primary))' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

        </motion.div>
      </div>
    )
  },
  { 
    id: 'join', 
    title: 'Get Started', 
    content: 'Ready to take your side project to the next level? Join our community today and start building your future.',
    showButton: true,
    buttonText: 'Join Now'
  },
]