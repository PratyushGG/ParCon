# YouTube Parental Control - Project Structure

## Directory Organization

The project has been restructured into **three main directories** for better organization and separation of concerns:

```
ParCon/
├── app/                    # Next.js App Router (entry point - thin wrappers)
├── frontend/               # All frontend code
├── backend/                # All backend code
├── shared/                 # Shared types and constants
├── docs/                   # PRD documentation
├── supabase/               # Database migrations
└── public/                 # Static assets
```

---

## Frontend Structure

```
frontend/
├── app/                    # Next.js pages (actual implementations)
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── login/
│   ├── signup/
│   ├── onboarding/
│   └── dashboard/
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── label.tsx
│   ├── dashboard/          # Dashboard-specific components
│   │   └── header.tsx
│   └── auth/               # Auth components (future)
└── lib/                    # Frontend utilities
    ├── utils.ts
    ├── supabase/
    │   ├── client.ts
    │   └── server.ts
    ├── auth/
    │   └── actions.ts
    └── onboarding/
        └── actions.ts
```

**Import paths for frontend**:
```typescript
import { Button } from '@/frontend/components/ui/button'
import { createClient } from '@/frontend/lib/supabase/server'
import type { Child } from '@/shared/types/database'
```

---

## Backend Structure

```
backend/
├── api/                    # API route handlers (business logic)
│   ├── youtube/
│   │   ├── auth.ts         # PRD-01: OAuth initiation
│   │   ├── callback.ts     # PRD-01: OAuth callback
│   │   └── disconnect.ts   # PRD-01: Disconnect YouTube
│   ├── videos/
│   │   ├── fetch.ts        # PRD-02: Fetch watch history
│   │   ├── list.ts         # PRD-02: List videos
│   │   ├── [videoId].ts    # PRD-02: Get video details
│   │   └── override.ts     # PRD-04: Override AI decision
│   ├── analyze/
│   │   ├── video.ts        # PRD-03: Analyze single video
│   │   └── batch.ts        # PRD-03: Batch analysis
│   ├── notifications/
│   │   ├── list.ts         # PRD-06: List notifications
│   │   ├── read.ts         # PRD-06: Mark as read
│   │   └── mark-all-read.ts # PRD-06: Mark all read
│   ├── channels/
│   │   └── whitelist.ts    # PRD-04: Whitelist/blacklist
│   └── cron/
│       └── sync-watch-history.ts # PRD-05: Cron job
├── services/               # Business logic layer
│   ├── youtube/
│   │   ├── oauth.ts        # PRD-01: OAuth helpers
│   │   ├── api.ts          # PRD-02: YouTube API client
│   │   └── transcript.ts   # PRD-03: Transcript fetching
│   ├── ai/
│   │   ├── analyzer.ts     # PRD-03: AI analysis engine
│   │   └── prompts.ts      # PRD-03: Prompt templates
│   ├── notifications/
│   │   └── create.ts       # PRD-06: Notification creation
│   └── database/
│       └── queries.ts      # Database helpers
├── jobs/                   # Background jobs (PRD-05)
│   ├── sync-watch-history.ts
│   ├── analyze-videos.ts
│   ├── update-trust-scores.ts
│   ├── aggregate-stats.ts
│   └── cleanup-data.ts
├── types/                  # Backend-specific types
│   ├── youtube.ts
│   ├── ai.ts
│   └── jobs.ts
├── utils/                  # Backend utilities
│   ├── errors.ts
│   ├── validation.ts
│   └── constants.ts
└── config/                 # Configuration
    ├── youtube.ts
    ├── ai.ts
    └── jobs.ts
```

**Import paths for backend**:
```typescript
import { analyzeWithAI } from '@/backend/services/ai/analyzer'
import { fetchWatchHistory } from '@/backend/services/youtube/api'
import type { YouTubeVideo } from '@/backend/types/youtube'
```

---

## Shared Structure

```
shared/
├── types/                  # Shared TypeScript types
│   ├── database.ts         # Supabase database types
│   └── api.ts              # API request/response types
└── constants/
    └── index.ts            # Shared constants
```

**Import paths for shared**:
```typescript
import type { Child, Video } from '@/shared/types/database'
import type { VideoAnalysisResponse } from '@/shared/types/api'
```

---

## App Directory (Next.js Entry Point)

```
app/
├── layout.tsx              # Re-exports from frontend/app/layout.tsx
├── page.tsx                # Re-exports from frontend/app/page.tsx
├── globals.css             # Imports from frontend/app/globals.css
├── favicon.ico
├── login/
│   └── page.tsx            # Re-exports from frontend/app/login/page.tsx
├── signup/
│   └── page.tsx
├── onboarding/
│   └── page.tsx
├── dashboard/
│   ├── layout.tsx
│   └── page.tsx
└── api/
    └── health/
        └── route.ts        # Health check endpoint
```

**Pattern**: All `/app` files are thin wrappers that re-export from `/frontend/app`

Example (`/app/login/page.tsx`):
```typescript
import Page from '@/frontend/app/login/page'
export default Page
```

---

## TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "paths": {
      "@/frontend/*": ["./frontend/*"],
      "@/backend/*": ["./backend/*"],
      "@/shared/*": ["./shared/*"],
      "@/*": ["./*"]
    }
  }
}
```

This allows:
- `@/frontend/*` for all frontend code
- `@/backend/*` for all backend code
- `@/shared/*` for shared types
- `@/*` as fallback for root-level files

---

## Migration Summary

### What Changed

1. **Created 3 main directories**: `frontend/`, `backend/`, `shared/`
2. **Moved existing code**:
   - `app/` → `frontend/app/`
   - `components/` → `frontend/components/`
   - `lib/` → `frontend/lib/`
   - `lib/types/database.ts` → `shared/types/database.ts` (copied)
3. **Created new `/app`** directory with thin re-export wrappers
4. **Updated all imports** to use new path aliases
5. **Added tsconfig.json paths** for clean imports

### Benefits

✅ **Clear Separation**: Frontend and backend code completely isolated  
✅ **Better Organization**: Easy to find and navigate code  
✅ **Scalability**: Can split into microservices later if needed  
✅ **Team Collaboration**: Frontend/backend devs work independently  
✅ **Shared Types**: Single source of truth for data contracts  
✅ **Clean Imports**: No relative paths like `../../../`  

---

## Next Steps

Now that the project is restructured, we're ready to implement the 6 PRDs:

1. **PRD-01**: YouTube OAuth (`backend/api/youtube/`, `backend/services/youtube/oauth.ts`)
2. **PRD-02**: Watch History API (`backend/api/videos/`, `backend/services/youtube/api.ts`)
3. **PRD-03**: AI Analysis (`backend/api/analyze/`, `backend/services/ai/`)
4. **PRD-04**: Dashboard Updates (`frontend/app/dashboard/`, `frontend/components/dashboard/`)
5. **PRD-05**: Background Jobs (`backend/jobs/`)
6. **PRD-06**: Notifications (`backend/api/notifications/`, `backend/services/notifications/`)

---

## Testing the Restructure

✅ Dev server starts successfully: `npm run dev`  
✅ Localhost runs at: `http://localhost:3000`  
✅ All pages load correctly  
✅ Auth flow works  
✅ Imports resolve correctly  

---

## Important Notes

- **Never** manually edit files in `/app` directory (they're just re-exports)
- **Always** work in `/frontend` or `/backend` directories
- **Use** shared types from `/shared/types/` for contracts between FE and BE
- **Follow** the import path conventions listed above
- **Keep** backend logic out of frontend files

---

_Project restructured on 2025-10-06_
