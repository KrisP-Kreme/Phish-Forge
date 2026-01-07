import { Badge } from "../ui/badge"

export const sections = [
  { 
    id: 'home', 
    title: "phishforge.",
    
    
  },
  { 
    id: 'features', 
    title: 'Why Us?', 
    content: 'We provide resources, mentorship, and a supportive network to help you grow your projects.' 
  },
  { 
    id: 'how-it-works', 
    title: 'How It Works', 
    content: 'Access to expert advice, networking opportunities, and cutting-edge tools to accelerate your growth.' 
  },
  { 
    id: 'meet-the-devs', 
    title: 'Meet the Devs', 
    content: (
      <section id="about" className="py-12 md:py-16" style={{ backgroundColor: 'var(--card)' }}>
         <div className="mx-auto px-6 w-full">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-start w-full">
            {/* Profile column: Nikolas */}
            <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-6 w-full">
              <div className="min-w-0 md:pr-6 md:max-w-[560px]">
                <h4 className="text-3xl md:text-4xl font-bold mb-6">Nikolas Vittorio</h4>
                <p className="text-lg md:text-xl text-[var(--muted-foreground)] mb-8 leading-relaxed">
                  Nikolas has just wrapped up his final year as a Computer Science student at RMIT University majoring in Cybersecurity, with a strong interest in offensive security and red teaming.
                  <br /><br />
                  He holds the Practical Junior Penetration Tester (PJPT) certification from TCM Security and is currently pursuing the Certified Penetration Testing Specialist (CPTS).
                  <br /><br />
                  With his background in Cybersecurity and a real passion for ethical hacking and cybersecurity education, he co-created PhishForge alongside Kristijan.
                </p>
                <div className="flex gap-4">
                  <a href="https://www.linkedin.com/in/nikolas-vittorio/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-foreground)] hover:text-[var(--accent)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.268c-.966 0-1.75-.784-1.75-1.75s.784-1.75 1.75-1.75 1.75.784 1.75 1.75-.784 1.75-1.75 1.75zm13.5 11.268h-3v-5.604c0-1.335-.026-3.053-1.863-3.053-1.865 0-2.151 1.458-2.151 2.966v5.691h-3v-10h2.881v1.367h.041c.401-.757 1.379-1.553 2.839-1.553 3.036 0 3.599 1.997 3.599 4.592v5.594z"/></svg>
                  </a>
                  <a href="https://github.com/NikolasVittorio" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-foreground)] hover:text-[var(--accent)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5c-6.627 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.387.6.113.82-.262.82-.583 0-.287-.01-1.044-.016-2.05-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.744.083-.729.083-.729 1.205.084 1.839 1.238 1.839 1.238 1.07 1.834 2.809 1.304 3.495.997.108-.775.418-1.304.762-1.604-2.665-.305-5.466-1.332-5.466-5.931 0-1.31.468-2.381 1.235-3.221-.123-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.984-.399 3.005-.404 1.02.005 2.048.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.654 1.653.242 2.873.119 3.176.77.84 1.233 1.911 1.233 3.221 0 4.61-2.804 5.624-5.476 5.921.43.371.814 1.102.814 2.222 0 1.604-.014 2.896-.014 3.289 0 .323.216.701.825.582 4.765-1.589 8.199-6.085 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  </a>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="rounded-lg p-3 border w-[420px] md:w-[520px]" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
                  <div className="aspect-square rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--accent)' }}>
                    <img 
                      src="https://media.licdn.com/dms/image/v2/D5603AQFaFiAHGH0S1w/profile-displayphoto-shrink_800_800/B56ZdTf2RoG0Ac-/0/1749452547793?e=1769644800&v=beta&t=ha0weoqz5CGxIs-n-wZbTCzdalEKS23FjdWcM2jNYck" 
                      className="w-full h-full object-cover" 
                      style={{ color: 'var(--accent-foreground)' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Profile column: Kristijan */}
            <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-6 w-full">
              <div className="min-w-0 md:pr-6 md:max-w-[560px]">
                <h4 className="text-3xl md:text-4xl font-bold mb-6">Kristijan Popordanoski</h4>
                <p className="text-lg md:text-xl text-[var(--muted-foreground)] mb-8 leading-relaxed">
                  Kristijan is a passionate full-stack developer skilled in building smooth and reliable end-to-end web applications using modern frameworks like Node.js, React and .NET.
                  <br /><br />
                  The idea of being able to fashion a website capable of spreading awareness about how easily phishing attacks can be executed is what inspired him to partner up with Nikolas and create PhishForge.
                  <br /><br />
                  He has just completed his Bachelor's degree in Computer Science at RMIT University and is eager to work on more innovative projects like this one.
                </p>
                <div className="flex gap-4">
                  <a href="https://www.linkedin.com/in/kristijanpopordanoski/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-foreground)] hover:text-[var(--accent)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.761 0 5-2.239 5-5v-14c0-2.761-2.239-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.268c-.966 0-1.75-.784-1.75-1.75s.784-1.75 1.75-1.75 1.75.784 1.75 1.75-.784 1.75-1.75 1.75zm13.5 11.268h-3v-5.604c0-1.335-.026-3.053-1.863-3.053-1.865 0-2.151 1.458-2.151 2.966v5.691h-3v-10h2.881v1.367h.041c.401-.757 1.379-1.553 2.839-1.553 3.036 0 3.599 1.997 3.599 4.592v5.594z"/></svg>
                  </a>
                  <a href="https://github.com/KrisP-Kreme" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-foreground)] hover:text-[var(--accent)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5c-6.627 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.387.6.113.82-.262.82-.583 0-.287-.01-1.044-.016-2.05-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.744.083-.729.083-.729 1.205.084 1.839 1.238 1.839 1.238 1.07 1.834 2.809 1.304 3.495.997.108-.775.418-1.304.762-1.604-2.665-.305-5.466-1.332-5.466-5.931 0-1.31.468-2.381 1.235-3.221-.123-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.984-.399 3.005-.404 1.02.005 2.048.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.654 1.653.242 2.873.119 3.176.77.84 1.233 1.911 1.233 3.221 0 4.61-2.804 5.624-5.476 5.921.43.371.814 1.102.814 2.222 0 1.604-.014 2.896-.014 3.289 0 .323.216.701.825.582 4.765-1.589 8.199-6.085 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  </a>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="rounded-lg p-3 border w-[420px] md:w-[520px]" style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}>
                  <div className="aspect-square rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--accent)' }}>
                    <img 
                      src="https://media.licdn.com/dms/image/v2/D5603AQHgvXs3z9ctCA/profile-displayphoto-shrink_800_800/B56Zb3NGs4GoAc-/0/1747904130971?e=1769644800&v=beta&t=l45iflxyflZSSNJztffd5DZ8PQjkdmtYmPPPhJ-Yn6Y" 
                      className="w-full h-full object-cover" 
                      style={{ color: 'var(--accent-foreground)' }}
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
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
