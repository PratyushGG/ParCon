# PRD-01: YouTube OAuth Integration

## Overview
Implement Google OAuth 2.0 flow to allow parents to connect their child's YouTube account to our application, enabling us to access watch history data.

## User Flow
1. Parent completes onboarding (child name, age, preferences)
2. Parent clicks "Connect YouTube Account" button
3. Redirected to Google OAuth consent screen
4. Parent signs in with child's Google account
5. Parent grants permission to view YouTube watch history
6. Redirected back to our app with authorization code
7. We exchange code for access token and refresh token
8. Tokens stored securely in database
9. Parent sees "YouTube Connected ✓" status

## Technical Requirements

### Google Cloud Console Setup
- Create Google Cloud project
- Enable YouTube Data API v3
- Configure OAuth 2.0 credentials
- Set up OAuth consent screen
- Add authorized redirect URIs:
  - Development: `http://localhost:3000/api/youtube/callback`
  - Production: `https://yourdomain.com/api/youtube/callback`

### Required OAuth Scopes
```
https://www.googleapis.com/auth/youtube.readonly
```

### API Endpoints to Create

#### 1. `/api/youtube/auth/route.ts` (GET)
**Purpose**: Initiate OAuth flow

**Request**:
- Query params: `childId` (UUID)

**Logic**:
1. Validate user is authenticated
2. Validate `childId` belongs to authenticated parent
3. Generate OAuth state parameter (include childId for callback)
4. Build Google OAuth URL with:
   - client_id
   - redirect_uri
   - scope (youtube.readonly)
   - response_type=code
   - access_type=offline (to get refresh token)
   - prompt=consent (force consent to get refresh token)
   - state (encrypted childId)
5. Redirect to Google OAuth URL

**Response**: 
- 302 Redirect to Google

---

#### 2. `/api/youtube/callback/route.ts` (GET)
**Purpose**: Handle OAuth callback from Google

**Request**:
- Query params: `code`, `state`, `error` (optional)

**Logic**:
1. Check for error parameter (user denied access)
2. Verify and decrypt state parameter to get childId
3. Exchange authorization code for tokens:
   ```
   POST https://oauth2.googleapis.com/token
   {
     code: code,
     client_id: process.env.GOOGLE_CLIENT_ID,
     client_secret: process.env.GOOGLE_CLIENT_SECRET,
     redirect_uri: process.env.GOOGLE_REDIRECT_URI,
     grant_type: 'authorization_code'
   }
   ```
4. Receive tokens response:
   ```json
   {
     "access_token": "ya29.xxx",
     "refresh_token": "1//xxx",
     "expires_in": 3599,
     "scope": "https://www.googleapis.com/auth/youtube.readonly",
     "token_type": "Bearer"
   }
   ```
5. Get YouTube channel ID using access token:
   ```
   GET https://www.googleapis.com/youtube/v3/channels?part=id&mine=true
   ```
6. Update `children` table:
   ```typescript
   await supabase
     .from('children')
     .update({
       youtube_channel_id: channelId,
       youtube_access_token: accessToken,
       youtube_refresh_token: refreshToken,
       token_expires_at: new Date(Date.now() + expiresIn * 1000)
     })
     .eq('id', childId)
   ```
7. Trigger initial watch history fetch (async)
8. Redirect to dashboard with success message

**Response**:
- 302 Redirect to `/dashboard?youtube=connected`

---

#### 3. `/api/youtube/disconnect/route.ts` (POST)
**Purpose**: Remove YouTube connection

**Request**:
- Body: `{ childId: string }`

**Logic**:
1. Validate user owns child
2. Revoke Google tokens:
   ```
   POST https://oauth2.googleapis.com/revoke
   token=<access_token>
   ```
3. Update `children` table:
   ```typescript
   await supabase
     .from('children')
     .update({
       youtube_channel_id: null,
       youtube_access_token: null,
       youtube_refresh_token: null,
       token_expires_at: null
     })
     .eq('id', childId)
   ```
4. Optionally delete associated videos

**Response**:
```json
{ "success": true }
```

---

### Helper Functions to Create

#### `/lib/services/youtube/oauth.ts`

```typescript
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
}> {
  // Exchange refresh token for new access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  
  return response.json()
}

export async function getValidAccessToken(childId: string): Promise<string> {
  // Get child's tokens from DB
  // Check if expired
  // Refresh if needed
  // Update DB
  // Return valid access token
}

export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}
```

---

### Environment Variables Required

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/youtube/callback

# For encrypting state parameter
OAUTH_STATE_SECRET=random-32-char-string
```

---

### Database Schema (Already Exists)
Table: `children`
- `youtube_channel_id` VARCHAR(255) - YouTube channel ID
- `youtube_access_token` TEXT - Encrypted access token
- `youtube_refresh_token` TEXT - Encrypted refresh token  
- `token_expires_at` TIMESTAMP - Token expiration time

---

### Frontend Integration

#### Update `/app/onboarding/page.tsx`
Add "Connect YouTube" button in success step:

```typescript
<Button
  onClick={() => {
    window.location.href = `/api/youtube/auth?childId=${childId}`
  }}
>
  Connect YouTube Account
</Button>
```

#### Update `/app/dashboard/page.tsx`
Show connection status:

```typescript
{child.youtube_channel_id ? (
  <Badge variant="success">YouTube Connected ✓</Badge>
) : (
  <Button 
    variant="outline"
    onClick={() => {
      window.location.href = `/api/youtube/auth?childId=${child.id}`
    }}
  >
    Connect YouTube
  </Button>
)}
```

---

### Security Considerations

1. **Token Encryption**: Store access/refresh tokens encrypted in database
2. **State Parameter**: Use signed/encrypted state to prevent CSRF
3. **HTTPS Only**: Enforce HTTPS in production
4. **Token Rotation**: Implement refresh token rotation
5. **Scope Minimization**: Only request `youtube.readonly` scope
6. **Row Level Security**: Ensure RLS policies prevent token access across parents

---

### Error Handling

1. **User Denies Access**: Show friendly error, allow retry
2. **Invalid State**: Return 400 error, possible CSRF attack
3. **Token Exchange Fails**: Log error, show user-friendly message
4. **Network Errors**: Retry with exponential backoff
5. **Expired Tokens**: Auto-refresh using refresh token

---

### Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Access token stored in database
- [ ] Refresh token stored in database
- [ ] Channel ID retrieved correctly
- [ ] Token refresh works when expired
- [ ] Disconnect removes all tokens
- [ ] Error handling for denied access
- [ ] CSRF protection via state parameter
- [ ] Multiple children can have different YouTube accounts
- [ ] Tokens encrypted at rest

---

### Success Metrics

- OAuth completion rate > 90%
- Token refresh success rate > 99%
- Zero token leaks or security incidents

---

### Future Enhancements

1. Support for multiple YouTube accounts per child
2. OAuth token health monitoring
3. Automatic re-authentication prompts when tokens expire
4. Support for YouTube Premium accounts (different API limits)
