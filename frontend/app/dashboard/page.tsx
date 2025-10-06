import { createClient } from '@/frontend/lib/supabase/server'
import { getUser } from '@/frontend/lib/auth/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/frontend/components/ui/card'
import { Button } from '@/frontend/components/ui/button'
import Link from 'next/link'
import type { Child } from '@/shared/types/database'
import DashboardAlerts from '@/frontend/components/dashboard/alerts'
import YouTubeConnectionButton from '@/frontend/components/dashboard/youtube-connection-button'
import { ChildCardMenu } from '@/frontend/components/dashboard/child-card-menu'

export default async function DashboardPage() {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return <div>Not authenticated</div>
  }

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
      <DashboardAlerts />
      
      {!hasChildren ? (
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
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Your Children</h2>
          </div>

          <div className="grid gap-4">
            {children.map((child) => (
              <Card key={child.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{child.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <span>{child.age} years old</span>
                        {child.youtube_channel_id ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            ✓ YouTube Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            YouTube Not Connected
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <ChildCardMenu childId={child.id} childName={child.name} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {child.youtube_channel_id ? (
                      <>
                        <Link href={`/videos/${child.id}`}>
                          <Button variant="outline">View Videos</Button>
                        </Link>
                        <Link href={`/scan/${child.id}`}>
                          <Button variant="outline">Scan Videos</Button>
                        </Link>
                        <Link href={`/analyze/${child.id}`}>
                          <Button>Analyze with AI</Button>
                        </Link>
                        <YouTubeConnectionButton
                          childId={child.id}
                          childName={child.name}
                          isConnected={true}
                        />
                      </>
                    ) : (
                      <YouTubeConnectionButton
                        childId={child.id}
                        childName={child.name}
                        isConnected={false}
                      />
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
