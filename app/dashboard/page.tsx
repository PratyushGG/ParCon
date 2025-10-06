import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Child } from '@/lib/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return <div>Not authenticated</div>
  }

  // Fetch children for this parent
  const { data: children, error } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', user.id)
    .returns<Child[]>()

  if (error) {
    console.error('Error fetching children:', error)
  }

  const hasChildren = children && children.length > 0

  return (
    <div className="max-w-4xl mx-auto">
      {!hasChildren ? (
        // Empty State
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle className="text-3xl">👋 Welcome to YouTube Parental Control</CardTitle>
            <CardDescription className="text-lg mt-2">
              Get started by adding your first child and connecting their YouTube account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600 max-w-md mx-auto">
              Once connected, we'll analyze their watch history and help you monitor the content they're viewing.
            </p>
            <Link href="/onboarding">
              <Button size="lg" className="text-lg px-8">
                ➕ Add Your First Child
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        // Has Children - Show Dashboard
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Your Children</h2>
          </div>

          <div className="grid gap-4">
            {children.map((child) => (
              <Card key={child.id}>
                <CardHeader>
                  <CardTitle>{child.name}</CardTitle>
                  <CardDescription>
                    {child.age} years old
                    {child.youtube_channel_id ? ' • YouTube connected' : ' • YouTube not connected'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline">View Videos</Button>
                    {!child.youtube_channel_id && (
                      <Link href="/onboarding">
                        <Button>Connect YouTube</Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="pt-4">
            <Link href="/onboarding">
              <Button variant="outline">
                ➕ Add Another Child
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
