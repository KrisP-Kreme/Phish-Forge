'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, RotateCcw, X, Edit2, Eye } from 'lucide-react'
import type { AIDataSection, EmailGenerateAPIResponse } from '@/app/types'
import { motion } from 'framer-motion'

interface EmailCodeEditorProps {
  domain: string
  partner: AIDataSection
  isLoading?: boolean
  onClose: () => void
  onLoadingChange?: (loading: boolean) => void
}

export default function EmailCodeEditor({
  domain,
  partner,
  isLoading: initialLoading = false,
  onClose,
  onLoadingChange,
}: EmailCodeEditorProps) {
  const [isLoading, setIsLoading] = useState(initialLoading)
  const [email, setEmail] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [copied, setCopied] = useState(false)
  const [previousEmail, setPreviousEmail] = useState<string | null>(null)

  // Fetch email on mount
  useEffect(() => {
    fetchEmail()
  }, [partner, domain])

  const fetchEmail = async () => {
    setIsLoading(true)
    setError(null)
    onLoadingChange?.(true)

    try {
      // Extract partner domain for scraping THEIR design (the sender's branding)
      let partnerDomain = partner.url

      if (partnerDomain) {
        try {
          partnerDomain = new URL(partnerDomain).hostname || partnerDomain
        } catch {
          // If URL parsing fails, try adding https:// prefix
          try {
            partnerDomain = new URL(`https://${partnerDomain}`).hostname || partnerDomain
          } catch {
            // Fallback to the URL as-is
          }
        }
      }
      // Fallback: if no URL, generate domain from partner name
      if (!partnerDomain) {
        partnerDomain = partner.name.toLowerCase().replace(/\s+/g, '')
      }

      console.log('[EmailCodeEditor] Extracted partnerDomain:', partnerDomain)
      console.log('[EmailCodeEditor] Target domain:', domain)
      
      const response = await fetch('/api/email/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        },
        body: JSON.stringify({
          domain: domain, // Target company domain (what we're scraping for design)
          partner: {
            name: partner.name,
            type: partner.type,
            relationship: partner.relationship,
            url: partner.url,
          },
          previousEmail: previousEmail || undefined,
        }),
      })

      const data: EmailGenerateAPIResponse = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate email')
      }

      setEmail(data.data)
      setEditedContent(data.data?.html_body || '')
      setPreviousEmail(data.data?.html_body || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
      onLoadingChange?.(false)
    }
  }

  const handleCopy = () => {
    const contentToCopy = editMode ? editedContent : (email?.html_body || email?.body_html || '')
    navigator.clipboard.writeText(contentToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = () => {
    fetchEmail()
  }

  const handleToggleEditMode = () => {
    if (!editMode) {
      setEditedContent(email?.html_body || email?.body_html || '')
    }
    setEditMode(!editMode)
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">Email Generator</h3>
          <p className="text-sm text-gray-600">
            Partner: <span className="font-semibold">{partner.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit Mode Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleEditMode}
            className="gap-2"
            disabled={isLoading || !email}
          >
            {editMode ? (
              <>
                <Eye className="w-4 h-4" />
                Preview
              </>
            ) : (
              <>
                <Edit2 className="w-4 h-4" />
                Edit
              </>
            )}
          </Button>

          {/* Close Button */}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Loading State */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-64"
          >
            <div className="animate-spin mb-4">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full" />
            </div>
            <p className="text-gray-600">Generating email...</p>
          </motion.div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4"
          >
            <p className="text-sm font-semibold text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              className="mt-3 gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </Button>
          </motion.div>
        )}

        {/* Email Display */}
        {email && !isLoading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Subject Preview */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase">Subject</label>
              <div className="mt-2 p-3 bg-white rounded border border-gray-200 text-sm text-gray-900">
                {email.subject}
              </div>
            </div>

            {/* HTML Content - Edit/Preview */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase">
                HTML Body
                {editMode && <span className="ml-2 text-orange-600">(Editing)</span>}
              </label>
              <div className="mt-2">
                {editMode ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-64 p-3 bg-gray-950 border border-gray-700 rounded font-mono text-xs text-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    spellCheck="false"
                    style={{
                      backgroundColor: 'rgb(3, 7, 18)',
                      color: 'rgb(248, 250, 252)',
                      caretColor: 'rgb(96, 165, 250)',
                      borderColor: 'rgb(55, 65, 81)',
                    }}
                  />
                ) : (
                  <div className="bg-gray-950 p-3 rounded border border-gray-700 overflow-x-auto max-h-64 overflow-y-auto"
                    style={{
                      backgroundColor: 'rgb(3, 7, 18)',
                      borderColor: 'rgb(55, 65, 81)',
                    }}
                  >
                    <pre className="text-xs text-gray-50 whitespace-pre-wrap break-words" style={{ color: 'rgb(248, 250, 252)' }}>
                      {email.body_html}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Text Version (preview only) */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase">Text Version</label>
              <div className="mt-2 bg-white p-3 rounded border border-gray-200 text-xs text-gray-900 max-h-32 overflow-y-auto">
                <pre className="whitespace-pre-wrap break-words">{email.body_text}</pre>
              </div>
            </div>

            {/* From/To Headers */}
            {email.headers && (
              <div className="bg-gray-100 rounded p-3 text-xs space-y-1">
                {email.headers.from && (
                  <p>
                    <span className="font-semibold text-gray-700">From:</span>{' '}
                    <span className="text-gray-900">{email.headers.from}</span>
                  </p>
                )}
                {email.headers.to && (
                  <p>
                    <span className="font-semibold text-gray-700">To:</span>{' '}
                    <span className="text-gray-900">{email.headers.to}</span>
                  </p>
                )}
              </div>
            )}

            {/* Generated At */}
            <p className="text-xs text-gray-500">
              Generated: {new Date(email.generated_at).toLocaleString()}
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer - Actions */}
      {email && !isLoading && !error && (
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 flex items-center gap-3">
          <Button
            onClick={handleCopy}
            className="gap-2 flex-1"
            variant={copied ? 'default' : 'outline'}
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copied!' : 'Copy HTML'}
          </Button>

          <Button
            onClick={handleRegenerate}
            variant="outline"
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Regenerate
          </Button>
        </div>
      )}
    </div>
  )
}
