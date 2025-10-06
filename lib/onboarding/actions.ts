'use server'

import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'

/**
 * Create a child profile
 */
export async function createChild(formData: FormData) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const name = formData.get('name') as string
  const age = parseInt(formData.get('age') as string)

  if (!name || !age || age < 1 || age > 18) {
    return { error: 'Invalid name or age' }
  }

  const { data, error } = await supabase
    .from('children')
    .insert({
      parent_id: user.id,
      name,
      age,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating child:', error)
    return { error: 'Failed to create child profile' }
  }

  revalidatePath('/dashboard')
  return { success: true, childId: data.id }
}

/**
 * Save parent preferences
 */
export async function savePreferences(
  childId: string,
  preferences: {
    allowedTopics: string[]
    blockedTopics: string[]
    allowMildLanguage: boolean
    educationalPriority: 'high' | 'medium' | 'low'
  }
) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check if preferences already exist for this parent
  const { data: existing } = await supabase
    .from('parent_preferences')
    .select('id')
    .eq('parent_id', user.id)
    .single()

  let result

  if (existing) {
    // Update existing preferences
    result = await supabase
      .from('parent_preferences')
      .update({
        allowed_topics: preferences.allowedTopics,
        blocked_topics: preferences.blockedTopics,
        allow_mild_language: preferences.allowMildLanguage,
        educational_priority: preferences.educationalPriority,
      })
      .eq('parent_id', user.id)
  } else {
    // Create new preferences
    result = await supabase
      .from('parent_preferences')
      .insert({
        parent_id: user.id,
        allowed_topics: preferences.allowedTopics,
        blocked_topics: preferences.blockedTopics,
        allow_mild_language: preferences.allowMildLanguage,
        educational_priority: preferences.educationalPriority,
      })
  }

  if (result.error) {
    console.error('Error saving preferences:', result.error)
    return { error: 'Failed to save preferences' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
