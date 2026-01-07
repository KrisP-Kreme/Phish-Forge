import './globals.css'
import '../styles/globals.css'
import { Inter } from 'next/font/google'

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
<<<<<<< HEAD
        {/* < Navigation /> */}
=======
>>>>>>> a8ce73ebb4acf43532b319bfae616d0d2ec292dc
        {children}
      </body>
    </html>
  )
}
