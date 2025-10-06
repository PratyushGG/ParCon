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

/**
 * Get child data for editing
 */
export async function getChildData(childId: string) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Fetch child data
  const { data: child, error: childError } = await supabase
    .from('children')
    .select('*')
    .eq('id', childId)
    .eq('parent_id', user.id)
    .single()

  if (childError || !child) {
    return { error: 'Child not found or unauthorized' }
  }

  // Fetch parent preferences
  const { data: preferences } = await supabase
    .from('parent_preferences')
    .select('*')
    .eq('parent_id', user.id)
    .single()

  return {
    child,
    preferences: preferences || null,
  }
}

/**
 * Update a child profile and preferences
 */
export async function updateChild(
  childId: string,
  childData: {
    name: string
    age: number
  },
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

  // Verify the child belongs to this parent
  const { data: child } = await supabase
    .from('children')
    .select('parent_id')
    .eq('id', childId)
    .single()

  if (!child || child.parent_id !== user.id) {
    return { error: 'Child not found or unauthorized' }
  }

  // Update child profile
  const { error: childError } = await supabase
    .from('children')
    .update({
      name: childData.name,
      age: childData.age,
    })
    .eq('id', childId)

  if (childError) {
    console.error('Error updating child:', childError)
    return { error: 'Failed to update child profile' }
  }

  // Update preferences (same logic as savePreferences)
  const { data: existing } = await supabase
    .from('parent_preferences')
    .select('id')
    .eq('parent_id', user.id)
    .single()

  let result

  if (existing) {
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

/**
 * Delete a child profile
 */
export async function deleteChild(childId: string) {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify the child belongs to this parent
  const { data: child } = await supabase
    .from('children')
    .select('parent_id')
    .eq('id', childId)
    .single()

  if (!child || child.parent_id !== user.id) {
    return { error: 'Child not found or unauthorized' }
  }

  // Delete the child (cascade will handle related records)
  const { error } = await supabase
    .from('children')
    .delete()
    .eq('id', childId)

  if (error) {
    console.error('Error deleting child:', error)
    return { error: 'Failed to delete child' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
