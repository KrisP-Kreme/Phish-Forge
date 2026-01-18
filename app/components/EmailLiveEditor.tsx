'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, RotateCcw, X } from 'lucide-react'
import type { AIDataSection } from '@/app/types'
import { motion } from 'framer-motion'

interface EmailLiveEditorProps {
  domain: string
  partner: AIDataSection
  isLoading?: boolean
  onClose: () => void
  onLoadingChange?: (loading: boolean) => void
}

export default function EmailLiveEditor({
  domain,
  partner,
  isLoading: initialLoading = false,
  onClose,
  onLoadingChange,
}: EmailLiveEditorProps) {
  const [isLoading, setIsLoading] = useState(initialLoading)
  const [email, setEmail] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [editedHtml, setEditedHtml] = useState('')

  // Fetch email on mount
  useEffect(() => {
    fetchEmail()
  }, [partner, domain])

  const fetchEmail = async () => {
    setIsLoading(true)
    setError(null)
    onLoadingChange?.(true)

    try {
      console.log('[EmailLiveEditor] Fetching email for:', {
        targetDomain: domain,
        partnerName: partner.name,
        partnerUrl: partner.url,
      })

      const response = await fetch('/api/email/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        },
        body: JSON.stringify({
          domain: domain, // Target company domain (the victim being targeted)
          partner: {
            name: partner.name,
            type: partner.type,
            relationship: partner.relationship,
            url: partner.url, // Partner URL used to scrape PARTNER's design
          },
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate email')
      }

      setEmail(data.data)
      setEditedHtml(data.data?.html_body || data.data?.body_html || '')
      setError(null)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMsg)
      console.error('[EmailLiveEditor] Error:', errorMsg)
    } finally {
      setIsLoading(false)
      onLoadingChange?.(false)
    }
  }

  const htmlBody = editedHtml || email?.html_body || email?.body_html || ''

  const handleCopy = () => {
    navigator.clipboard.writeText(editedHtml)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = () => {
    fetchEmail()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gray-900 flex flex-col"
    >
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-700 flex items-center justify-between bg-gray-800">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">Email Generator - Live Editor</h3>
          <p className="text-sm text-gray-400">
            Target: <span className="font-semibold">{domain}</span> • Partner: <span className="font-semibold">{partner.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={isLoading}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Regenerate
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={isLoading || !htmlBody}
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copied!' : 'Copy HTML'}
          </Button>

          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content Area - Split View */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Side - HTML Code */}
        <div className="flex-1 flex flex-col border-r border-gray-700 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-700 bg-gray-800">
            <p className="text-xs font-semibold text-gray-300">HTML CODE EDITOR</p>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full"
              >
                <div className="animate-spin mb-4">
                  <div className="w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full" />
                </div>
                <p className="text-gray-400">Generating email...</p>
              </motion.div>
            ) : error ? (
              <div className="p-4">
                <p className="text-red-400 text-sm mb-4">{error}</p>
                <Button size="sm" onClick={handleRegenerate}>
                  Try Again
                </Button>
              </div>
            ) : (
              <textarea
                value={editedHtml}
                onChange={(e) => setEditedHtml(e.target.value)}
                className="flex-1 p-4 bg-gray-950 text-gray-50 font-mono text-xs resize-none border-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                placeholder="HTML email code will appear here..."
                spellCheck="false"
                style={{
                  backgroundColor: 'rgb(3, 7, 18)',
                  color: 'rgb(248, 250, 252)',
                  caretColor: 'rgb(96, 165, 250)',
                }}/>
            )}
          </div>
        </div>

        {/* Right Side - Rendered Preview */}
        <div className="flex-1 flex flex-col border-l border-gray-700 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-700 bg-gray-800">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-300">LIVE PREVIEW</p>
              {email?.subject && (
                <p className="text-xs text-gray-400 truncate ml-4">
                  <span className="font-semibold">Subject:</span> {email.subject}
                </p>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-white">
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full"
              >
                <div className="animate-spin mb-4">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full" />
                </div>
                <p className="text-gray-600">Generating email...</p>
              </motion.div>
            ) : error ? (
              <div className="p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            ) : htmlBody ? (
              <iframe
                title="Email Preview"
                srcDoc={htmlBody}
                className="w-full h-full border-none"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No HTML content to preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
