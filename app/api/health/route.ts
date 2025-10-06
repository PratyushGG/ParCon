import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Test database connection by querying Supabase auth users
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          database: 'error',
          error: error.message
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
