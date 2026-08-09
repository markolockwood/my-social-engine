# API Endpoints

## Authentication

- `POST /api/auth/register` — register a new user
- `POST /api/auth/login` — log in (returns access and refresh tokens)
- `POST /api/auth/refresh` — refresh access token using refresh token
- `POST /api/auth/logout` — log out (removes the current refresh token)
- `POST /api/auth/logout-all` — log out from all devices (removes all refresh tokens for the user)
- `GET /api/auth/me` — get the current user
- `PATCH /api/user/theme` — change theme (light/dark)
- `PATCH /api/user/language` — change language (en/ru)
- `PATCH /api/user/profile` — update profile
- `PATCH /api/user/video-volume` — save video volume level (0.0-1.0)
- `PATCH /api/user/username` — change username (protected against user enumeration)
- `PATCH /api/user/country` — change country
- `PATCH /api/user/gender` — change gender (whitelist: Male, Female, Non-binary, Other, Prefer not to say)
- `GET /api/user/account-info` — get account information (registration IP, GeoIP via API)
- `POST /api/upload/avatar` — upload avatar (with magic bytes verification)

### Tokens

**Access Token:**
- Lifetime: 15 minutes
- Sent in the `Authorization: Bearer <token>` header
- Automatically refreshed via refresh token on expiration

**Refresh Token:**
- Lifetime: 30 days
- Stored in the `refresh_tokens` DB table
- Tied to user_id, IP, user-agent
- Used to obtain a new access token via `/api/auth/refresh`

## Posts

- `GET /api/posts` — post feed
- `POST /api/posts` — create a post (optional: `parent_id`, `is_quick_reply`, `media_files[]`)
- `GET /api/posts/{id}` — get a post by ID
- `DELETE /api/posts/{id}` — delete a post
- `GET /api/posts/{id}/replies` — replies to a post
- `GET /api/posts/{id}/counters` — counters only (likes/comments/views), lightweight request for polling
- `POST /api/posts/{id}/view` — register a view (deduplicated per session for 3 hours via Redis, see [posts_architecture.md](posts_architecture.md)); returns `{ counted: true|false }`
- `POST /api/posts/{id}/like` — like a post
- `POST /api/posts/{id}/unlike` — unlike a post
- `GET /api/posts/{id}/comments` — list of comments
- `POST /api/posts/{id}/comments` — add a comment
- `DELETE /api/comments/{id}` — delete a comment
- `POST /api/upload/post-images` — upload images for a post (up to 4, multipart/form-data, magic bytes verification, returns `[{url, thumb, type}]`)
- `POST /api/upload/post-gif` — upload a GIF for a post (1 file, multipart/form-data, magic bytes verification, auto-converted to MP4 via safe proc_open, returns `{url, type: 'gif'}`)
- `POST /api/upload/post-video` — upload a video for a post (1 file up to 100MB, multipart/form-data, HLS conversion via FFmpeg with PID tracking, returns `{url, thumb, type: 'video'}`)
- `DELETE /api/upload/media` — delete a media file from the server (cleanup on post cancel, checks ownership, path traversal protection)
- `DELETE /api/upload/cancel` — cancel an upload by `tracking_id` (interrupts video conversion via cross-platform process termination by PID)
- `GET /api/temp-uploads` — list of the current user's pending temporary media (for draft recovery)

### Headers for media uploads

**Required headers:**
- `Authorization: Bearer <access_token>` — authorization
- `X-Upload-Context: compose_main` — upload context (for temp_uploads and limits)
- `X-Tracking-ID: <uuid>` — ID for grouping files belonging to one post

**CSRF protection:**
- All POST/PUT/PATCH/DELETE requests are checked against the `Origin` or `Referer` header
- Allowed origins are configured in `CsrfMiddleware.php`
- Validation is relaxed for requests carrying a JWT token

### Upload limits

- **Images**: up to 4 files, 5MB max each, formats: JPEG, PNG, WEBP
- **GIF**: 1 file, 10MB max
- **Video**: 1 file, 100MB max, formats: MP4, MOV, WEBM, AVI, MPEG
- **Temp uploads limit**: maximum of 4 media files at once (overflow protection)
- **Video rate limiting**: no more than 2 concurrent conversions per user

## Users

- `GET /api/users/{username}` — user profile (includes `is_following` for the authenticated user)
- `GET /api/users/{username}/posts` — user's posts (original posts + quick replies)
- `GET /api/users/{username}/replies` — user's replies (thread replies to other users' tweets only)
- `POST /api/users/{username}/follow` — follow a user
- `DELETE /api/users/{username}/follow` — unfollow a user
- `GET /api/users/{username}/followers` — list of followers (supports `limit`/`offset`)
- `GET /api/users/{username}/following` — list of who the user follows (supports `limit`/`offset`)

## Security

### Rate Limiting
- Protection against IP spoofing via a whitelist of trusted proxies
- X-Forwarded-For is only honored from localhost (127.0.0.1, ::1)
- IP validation with private address filtering

### CSRF Protection
- Middleware checks Origin/Referer for all state-changing requests
- Whitelist of allowed domains in `CsrfMiddleware.php`
- The JWT token in localStorage provides an additional layer of protection

### File Upload Security
- **Magic bytes verification**: validated via the `FileValidator` class
- **MIME type verification**: via `finfo_file()`
- **Path traversal protection**: all paths are checked via `realpath()`
- **Centralized configuration**: `FileUploadConfig` for all file types

### Command Injection Protection
- FFmpeg is invoked via `proc_open()` with an argument array (not a string)
- All input paths are validated
- FFmpeg binary path is hardcoded/whitelisted

### Cross-platform support
- FFmpeg process PIDs are stored in the DB (`temp_uploads.process_pid`)
- Processes are terminated via OS-specific commands:
  - Windows: `taskkill /F /PID <pid>`
  - Linux: `kill -9 <pid>`

## Errors

All errors are returned in this format:
```json
{
  "error": "Error message"
}
```

**Response codes:**
- `200` — success
- `201` — created
- `400` — bad request
- `401` — unauthorized
- `403` — access denied (CSRF, path traversal)
- `404` — not found
- `429` — too many requests (rate limit)
- `500` — internal server error

**Generalized error messages** (protection against user enumeration):
- `"Registration failed. Please try different credentials"` instead of `"Username already exists"`
- `"Username change failed"` instead of `"Username is already taken"`
