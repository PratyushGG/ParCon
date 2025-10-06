import { signOut, getUser } from '@/frontend/lib/auth/actions'
import { Button } from '@/frontend/components/ui/button'

export async function DashboardHeader() {
  const user = await getUser()

  async function handleSignOut() {
    'use server'
    await signOut()
  }

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">
            YouTube Parental Control
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {user?.email}
          </span>
          <form action={handleSignOut}>
            <Button variant="outline" type="submit">
              Logout
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
