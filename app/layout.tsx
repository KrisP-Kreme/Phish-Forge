import '../styles/globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'PhishForge - Security Awareness Training Platform',
  description: 'Launch AI-powered phishing simulations to strengthen your organization\'s security awareness and defenses',
  generator: 'v0.app',
  icons: {
    icon: '/phishforgelogot.png',
    apple: '/phishforgelogot.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background text-foreground`}>
        {/* < Navigation /> */}
        {children}
      </body>
    </html>
  )
}
