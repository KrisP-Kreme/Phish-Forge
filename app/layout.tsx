import './globals.css'
import '../styles/globals.css'
import { Inter } from 'next/font/google'
import Navigation from './components/Navigation'
import SidebarNav from './components/SidebarNav'
import { sections } from './components/constants/sections'
import SidebarNavWrapper from './components/SidebarNavWrapper'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Solo Builders Community',
  description: 'Accelerator platform for solo builders working on side projects',
    generator: 'v0.app'
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
        <SidebarNavWrapper />
        {children}
      </body>
    </html>
  )
}
