'use server'

import { createClient } from '@/frontend/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

/**
 * Sign up a new parent user
 */
export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // After successful signup, create parent record in our database
  if (data.user) {
    const { error: dbError } = await supabase
      .from('parents')
      .insert({
        id: data.user.id,
        email: data.user.email,
      })

    if (dbError) {
      return { error: 'Failed to create parent profile' }
    }
  }

  revalidatePath('/login')
  return { success: true, message: 'Check your email to verify your account!' }
}

/**
 * Sign in an existing parent user
 */
export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/')
  redirect('/login')
}

/**
 * Get the current user session
 */
export async function getSession() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()

  return session
}

/**
 * Get the current authenticated user
 */
export async function getUser() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  return user
}
