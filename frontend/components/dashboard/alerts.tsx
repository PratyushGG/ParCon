'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DashboardAlerts() {
  const searchParams = useSearchParams()
  const [show, setShow] = useState(true)
  
  const youtubeStatus = searchParams.get('youtube')
  const errorMessage = searchParams.get('message')
  
  useEffect(() => {
    if (youtubeStatus) {
      const timer = setTimeout(() => setShow(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [youtubeStatus])
  
  if (!youtubeStatus || !show) return null
  
  if (youtubeStatus === 'connected') {
    return (
      <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start justify-between">
        <div>
          <p className="font-semibold">✓ YouTube Connected Successfully!</p>
          <p className="text-sm mt-1">
            We can now analyze the watch history for this child. Videos will be fetched and analyzed automatically.
          </p>
        </div>
        <button
          onClick={() => setShow(false)}
          className="text-green-600 hover:text-green-800"
        >
          ✕
        </button>
      </div>
    )
  }
  
  if (youtubeStatus === 'error') {
    const friendlyMessages: Record<string, string> = {
      'not_authenticated': 'Please log in again to connect YouTube',
      'missing_parameters': 'OAuth flow was incomplete. Please try again.',
      'invalid_state': 'Security verification failed. Please try again.',
      'child_not_found': 'Child profile not found',
      'update_failed': 'Failed to save connection. Please try again.',
      'unknown_error': 'An unexpected error occurred',
    }
    
    const message = errorMessage ? friendlyMessages[errorMessage] || errorMessage : 'Failed to connect YouTube'
    
    return (
      <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start justify-between">
        <div>
          <p className="font-semibold">✕ YouTube Connection Failed</p>
          <p className="text-sm mt-1">{message}</p>
        </div>
        <button
          onClick={() => setShow(false)}
          className="text-red-600 hover:text-red-800"
        >
          ✕
        </button>
      </div>
    )
  }
  
  return null
}
