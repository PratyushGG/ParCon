'use client'

import { Button } from '@/frontend/components/ui/button'
import { useState } from 'react'

interface YouTubeConnectionButtonProps {
  childId: string
  childName: string
  isConnected: boolean
}

export default function YouTubeConnectionButton({ 
  childId, 
  childName, 
  isConnected 
}: YouTubeConnectionButtonProps) {
  const [loading, setLoading] = useState(false)
  
  async function handleConnect() {
    setLoading(true)
    window.location.href = `/api/youtube/auth?childId=${childId}`
  }
  
  async function handleDisconnect() {
    if (!confirm(`Are you sure you want to disconnect YouTube for ${childName}? This will remove access to their watch history.`)) {
      return
    }
    
    setLoading(true)
    
    try {
      const response = await fetch('/api/youtube/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ childId }),
      })
      
      if (response.ok) {
        window.location.reload()
      } else {
        alert('Failed to disconnect YouTube. Please try again.')
        setLoading(false)
      }
    } catch (error) {
      console.error('Disconnect error:', error)
      alert('Failed to disconnect YouTube. Please try again.')
      setLoading(false)
    }
  }
  
  if (isConnected) {
    return (
      <Button 
        variant="outline" 
        onClick={handleDisconnect}
        disabled={loading}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        {loading ? 'Disconnecting...' : 'Disconnect YouTube'}
      </Button>
    )
  }
  
  return (
    <Button 
      onClick={handleConnect}
      disabled={loading}
    >
      {loading ? 'Connecting...' : 'Connect YouTube'}
    </Button>
  )
}
