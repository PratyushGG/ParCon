'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getChildData, updateChild } from '@/frontend/lib/onboarding/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Button } from '@/frontend/components/ui/button'
import { Input } from '@/frontend/components/ui/input'
import { Label } from '@/frontend/components/ui/label'

const TOPIC_OPTIONS = [
  'Education', 'Science', 'Coding', 'Gaming',
  'Music', 'Sports', 'Arts & Crafts', 'Other'
]

const BLOCKED_TOPIC_OPTIONS = [
  'Drama', 'Pranks', 'Politics', 'Violence',
  'Inappropriate Language', 'Other'
]

export default function EditChildPage() {
  const router = useRouter()
  const params = useParams()
  const childId = params.childId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Child form state
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge] = useState('')

  // Preferences state
  const [allowedTopics, setAllowedTopics] = useState<string[]>([])
  const [blockedTopics, setBlockedTopics] = useState<string[]>([])
  const [allowMildLanguage, setAllowMildLanguage] = useState(false)
  const [educationalPriority, setEducationalPriority] = useState<'high' | 'medium' | 'low'>('high')

  // Custom topics that were added by user
  const [customAllowedTopics, setCustomAllowedTopics] = useState<string[]>([])
  const [customBlockedTopics, setCustomBlockedTopics] = useState<string[]>([])

  // Current input values for adding new custom topics
  const [newAllowedTopic, setNewAllowedTopic] = useState('')
  const [newBlockedTopic, setNewBlockedTopic] = useState('')

  // Fetch existing data on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const result = await getChildData(childId)

      if ('error' in result) {
        setError(result.error)
        setLoading(false)
        return
      }

      // Set child data
      setChildName(result.child.name)
      setChildAge(result.child.age.toString())

      // Set preferences if they exist
      if (result.preferences) {
        const savedAllowed = result.preferences.allowed_topics || []
        const savedBlocked = result.preferences.blocked_topics || []

        // Separate predefined and custom topics
        const allowedPredefined = savedAllowed.filter(t => TOPIC_OPTIONS.includes(t))
        const allowedCustom = savedAllowed.filter(t => !TOPIC_OPTIONS.includes(t))

        const blockedPredefined = savedBlocked.filter(t => BLOCKED_TOPIC_OPTIONS.includes(t))
        const blockedCustom = savedBlocked.filter(t => !BLOCKED_TOPIC_OPTIONS.includes(t))

        setAllowedTopics(allowedPredefined)
        setCustomAllowedTopics(allowedCustom)

        setBlockedTopics(blockedPredefined)
        setCustomBlockedTopics(blockedCustom)

        setAllowMildLanguage(result.preferences.allow_mild_language || false)
        setEducationalPriority(result.preferences.educational_priority || 'high')
      }

      setLoading(false)
    }

    fetchData()
  }, [childId])

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Build final topic lists - combine predefined and custom topics
    const finalAllowedTopics = [...allowedTopics, ...customAllowedTopics]
    const finalBlockedTopics = [...blockedTopics, ...customBlockedTopics]

    const result = await updateChild(
      childId,
      {
        name: childName,
        age: parseInt(childAge),
      },
      {
        allowedTopics: finalAllowedTopics,
        blockedTopics: finalBlockedTopics,
        allowMildLanguage,
        educationalPriority,
      }
    )

    if (result.error) {
      setError(result.error)
      setSaving(false)
    } else {
      router.push('/dashboard')
    }
  }

  // Add custom allowed topic
  function addCustomAllowedTopic() {
    const topic = newAllowedTopic.trim()
    if (topic && !customAllowedTopics.includes(topic) && !TOPIC_OPTIONS.includes(topic)) {
      setCustomAllowedTopics([...customAllowedTopics, topic])
      setNewAllowedTopic('')
    }
  }

  // Add custom blocked topic
  function addCustomBlockedTopic() {
    const topic = newBlockedTopic.trim()
    if (topic && !customBlockedTopics.includes(topic) && !BLOCKED_TOPIC_OPTIONS.includes(topic)) {
      setCustomBlockedTopics([...customBlockedTopics, topic])
      setNewBlockedTopic('')
    }
  }

  // Remove custom allowed topic
  function removeCustomAllowedTopic(topic: string) {
    setCustomAllowedTopics(customAllowedTopics.filter(t => t !== topic))
  }

  // Remove custom blocked topic
  function removeCustomBlockedTopic(topic: string) {
    setCustomBlockedTopics(customBlockedTopics.filter(t => t !== topic))
  }

  // Toggle topic selection
  function toggleTopic(topic: string, list: string[], setter: (topics: string[]) => void) {
    if (list.includes(topic)) {
      setter(list.filter(t => t !== topic))
    } else {
      setter([...list, topic])
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !childName) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-red-600">{error}</p>
            <Button onClick={() => router.push('/dashboard')} className="mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Edit Child Profile</CardTitle>
          <CardDescription>
            Update {childName}'s information and content preferences
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Child Information */}
            <div className="space-y-4 pb-6 border-b">
              <h3 className="font-semibold text-lg">Child Information</h3>

              <div className="space-y-2">
                <Label htmlFor="name">Child's Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter name"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Child's Age</Label>
                <Input
                  id="age"
                  type="number"
                  min="1"
                  max="18"
                  placeholder="Enter age (1-18)"
                  value={childAge}
                  onChange={(e) => setChildAge(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
            </div>

            {/* Content Preferences */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Content Preferences</h3>

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
                        disabled={saving}
                      />
                      <span className="text-sm">{topic}</span>
                    </label>
                  ))}
                  {customAllowedTopics.map((topic) => (
                    <label
                      key={topic}
                      className="flex items-center justify-between space-x-2 p-2 border rounded bg-blue-50 border-blue-200"
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={true}
                          readOnly
                          className="rounded"
                        />
                        <span className="text-sm">{topic}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomAllowedTopic(topic)}
                        className="text-red-600 hover:text-red-800 text-xs"
                        disabled={saving}
                      >
                        ✕
                      </button>
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <Label htmlFor="newAllowed">Add custom allowed topic</Label>
                  <Input
                    id="newAllowed"
                    type="text"
                    placeholder="Type a topic and press Enter (e.g., Cooking, Photography)"
                    value={newAllowedTopic}
                    onChange={(e) => setNewAllowedTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCustomAllowedTopic()
                      }
                    }}
                    className="mt-2"
                    disabled={saving}
                  />
                </div>
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
                        disabled={saving}
                      />
                      <span className="text-sm">{topic}</span>
                    </label>
                  ))}
                  {customBlockedTopics.map((topic) => (
                    <label
                      key={topic}
                      className="flex items-center justify-between space-x-2 p-2 border rounded bg-blue-50 border-blue-200"
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={true}
                          readOnly
                          className="rounded"
                        />
                        <span className="text-sm">{topic}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomBlockedTopic(topic)}
                        className="text-red-600 hover:text-red-800 text-xs"
                        disabled={saving}
                      >
                        ✕
                      </button>
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <Label htmlFor="newBlocked">Add custom blocked topic</Label>
                  <Input
                    id="newBlocked"
                    type="text"
                    placeholder="Type a topic and press Enter (e.g., Conspiracy theories)"
                    value={newBlockedTopic}
                    onChange={(e) => setNewBlockedTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCustomBlockedTopic()
                      }
                    }}
                    className="mt-2"
                    disabled={saving}
                  />
                </div>
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
                      disabled={saving}
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mildLanguage"
                      checked={allowMildLanguage === false}
                      onChange={() => setAllowMildLanguage(false)}
                      disabled={saving}
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
                        disabled={saving}
                      />
                      <span className="capitalize">{priority}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard')}
                disabled={saving}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
