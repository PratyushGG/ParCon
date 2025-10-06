import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="text-center space-y-6 max-w-3xl">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900">
          YouTube Parental Control
        </h1>
        <p className="text-xl text-gray-600">
          Monitor and analyze your child's YouTube watch history with AI-powered content filtering
        </p>

        <div className="flex gap-4 justify-center pt-4">
          <Link href="/signup">
            <Button size="lg" className="text-lg px-8">
              Get Started
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="text-lg px-8">
              Sign In
            </Button>
          </Link>
        </div>

        <div className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2">AI-Powered Analysis</h3>
            <p className="text-gray-600">
              Advanced AI analyzes video content, transcripts, and metadata to identify age-appropriate content
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2">Channel Management</h3>
            <p className="text-gray-600">
              Whitelist trusted channels or block concerning ones with easy-to-use controls
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2">Detailed Insights</h3>
            <p className="text-gray-600">
              Get educational value scores, content warnings, and viewing pattern analytics
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
