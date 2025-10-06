'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createChild, savePreferences } from '@/lib/onboarding/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Step = 'child' | 'preferences' | 'success'

const TOPIC_OPTIONS = [
  'Education', 'Science', 'Coding', 'Gaming',
  'Music', 'Sports', 'Arts & Crafts', 'Other'
]

const BLOCKED_TOPIC_OPTIONS = [
  'Drama', 'Pranks', 'Politics', 'Violence',
  'Inappropriate Language', 'Other'
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('child')
  const [childId, setChildId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Child form state
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge] = useState('')

  // Preferences state
  const [allowedTopics, setAllowedTopics] = useState<string[]>([])
  const [blockedTopics, setBlockedTopics] = useState<string[]>([])
  const [allowMildLanguage, setAllowMildLanguage] = useState(false)
  const [educationalPriority, setEducationalPriority] = useState<'high' | 'medium' | 'low'>('high')

  // Custom topic inputs
  const [customAllowedTopic, setCustomAllowedTopic] = useState('')
  const [customBlockedTopic, setCustomBlockedTopic] = useState('')

  // Handle child form submission
  async function handleChildSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await createChild(formData)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else if (result.childId) {
      setChildId(result.childId)
      setStep('preferences')
      setLoading(false)
    }
  }

  // Handle preferences submission
  async function handlePreferencesSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!childId) {
      setError('No child ID found')
      setLoading(false)
      return
    }

    // Build final topic lists (including custom topics)
    const finalAllowedTopics = [...allowedTopics]
    const finalBlockedTopics = [...blockedTopics]

    // Add custom allowed topic if "Other" is selected and text is entered
    if (allowedTopics.includes('Other') && customAllowedTopic.trim()) {
      finalAllowedTopics.push(customAllowedTopic.trim())
    }

    // Add custom blocked topic if "Other" is selected and text is entered
    if (blockedTopics.includes('Other') && customBlockedTopic.trim()) {
      finalBlockedTopics.push(customBlockedTopic.trim())
    }

    const result = await savePreferences(childId, {
      allowedTopics: finalAllowedTopics,
      blockedTopics: finalBlockedTopics,
      allowMildLanguage,
      educationalPriority,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setStep('success')
      setLoading(false)
    }
  }

  // Toggle topic selection
  function toggleTopic(topic: string, list: string[], setter: (topics: string[]) => void) {
    if (list.includes(topic)) {
      setter(list.filter(t => t !== topic))
    } else {
      setter([...list, topic])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        {step === 'child' && (
          <>
            <CardHeader>
              <CardTitle>Add Your Child</CardTitle>
              <CardDescription>
                Let's start by creating a profile for your child
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleChildSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Child's Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Enter name"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="age">Child's Age</Label>
                  <Input
                    id="age"
                    name="age"
                    type="number"
                    min="1"
                    max="18"
                    placeholder="Enter age (1-18)"
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <p className="text-sm text-gray-500">
                    Age helps us provide age-appropriate content analysis
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating...' : 'Next'}
                </Button>
              </CardContent>
            </form>
          </>
        )}

        {step === 'preferences' && (
          <>
            <CardHeader>
              <CardTitle>Set Content Preferences</CardTitle>
              <CardDescription>
                Help us understand what content is appropriate for {childName}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handlePreferencesSubmit}>
              <CardContent className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <div className="space-y-3">
                  <Label>What topics are OK? (select all that apply)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {TOPIC_OPTIONS.map((topic) => (
                      <label
                        key={topic}
                        className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={allowedTopics.includes(topic)}
                          onChange={() => toggleTopic(topic, allowedTopics, setAllowedTopics)}
                          className="rounded"
                        />
                        <span className="text-sm">{topic}</span>
                      </label>
                    ))}
                  </div>
                  {allowedTopics.includes('Other') && (
                    <div className="mt-3">
                      <Label htmlFor="customAllowed">Specify other allowed topic</Label>
                      <Input
                        id="customAllowed"
                        type="text"
                        placeholder="e.g., Cooking, Photography, etc."
                        value={customAllowedTopic}
                        onChange={(e) => setCustomAllowedTopic(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>What topics should be avoided?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {BLOCKED_TOPIC_OPTIONS.map((topic) => (
                      <label
                        key={topic}
                        className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={blockedTopics.includes(topic)}
                          onChange={() => toggleTopic(topic, blockedTopics, setBlockedTopics)}
                          className="rounded"
                        />
                        <span className="text-sm">{topic}</span>
                      </label>
                    ))}
                  </div>
                  {blockedTopics.includes('Other') && (
                    <div className="mt-3">
                      <Label htmlFor="customBlocked">Specify other blocked topic</Label>
                      <Input
                        id="customBlocked"
                        type="text"
                        placeholder="e.g., Conspiracy theories, etc."
                        value={customBlockedTopic}
                        onChange={(e) => setCustomBlockedTopic(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Allow mild language in educational content?</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="mildLanguage"
                        checked={allowMildLanguage === true}
                        onChange={() => setAllowMildLanguage(true)}
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="mildLanguage"
                        checked={allowMildLanguage === false}
                        onChange={() => setAllowMildLanguage(false)}
                      />
                      <span>No</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Educational priority?</Label>
                  <div className="flex gap-4">
                    {(['high', 'medium', 'low'] as const).map((priority) => (
                      <label key={priority} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="priority"
                          checked={educationalPriority === priority}
                          onChange={() => setEducationalPriority(priority)}
                        />
                        <span className="capitalize">{priority}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Saving...' : 'Save & Continue'}
                </Button>
              </CardContent>
            </form>
          </>
        )}

        {step === 'success' && (
          <>
            <CardHeader>
              <CardTitle>✅ Profile Created!</CardTitle>
              <CardDescription>
                {childName}'s profile has been set up successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Next step: Connect {childName}'s YouTube account to start analyzing their watch history.
              </p>
              <p className="text-sm text-gray-500">
                Note: YouTube OAuth integration coming soon. For now, you can return to the dashboard.
              </p>
              <Button
                className="w-full"
                onClick={() => router.push('/dashboard')}
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
