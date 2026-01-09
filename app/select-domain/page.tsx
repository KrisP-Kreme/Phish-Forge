'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Layout from '../components/Layout'
import LaptopMockup from '../components/LaptopMockup'
import ErrorNotification from '../components/ErrorNotification'

export default function SelectDomainPage() {
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Layout>
      <ErrorNotification message={error} onDismiss={() => setError(null)} />
      <div className="h-full flex flex-col justify-end w-full p-0 m-0">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full"
        >
          <LaptopMockup onTyping={setIsTyping} onError={setError}>
          </LaptopMockup>
        </motion.div>
      </div>
    </Layout>
  )
}