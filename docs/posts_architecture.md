# Post and Reply Architecture

The system uses **nested posts** instead of a separate comments table.

## Fields

- `parent_id` — reference to the parent post (null for original posts)
- `is_quick_reply` — reply type (quick or thread)

## Post types

**Original post** — `parent_id IS NULL`
- Shown in the feed and in the author's "Posts" tab

**Quick reply** — `parent_id IS NOT NULL`, `is_quick_reply = true`
- Created via the modal (💬 button) or the `ComposeWidget` in the feed
- Shown in the author's "Posts" tab with a quoted card of the parent
- Shown in the news feed
- The quoted card (`QuotedPost`) displays the parent's images

**Thread reply** — `parent_id IS NOT NULL`, `is_quick_reply = false`
- Created via `ComposeWidget` on the post page or in the lightbox's right panel
- Shown only in the author's "Replies" tab
- NOT shown in the feed

## Media files

Media files (images, GIFs, videos) are stored in the `post_media` table:

| DB column | Type | Description |
|---|---|---|
| `id` | serial | PK |
| `post_id` | int | FK → posts.id (CASCADE DELETE) |
| `media_url` | varchar(255) | File path (images: `/uploads/posts/`, GIFs: `/uploads/gifs/`, videos: `/uploads/videos/`) |
| `thumb_url` | varchar(255) | Thumbnail (600px for images, first-frame preview for videos) |
| `media_type` | varchar(20) | Media type: `image`, `gif`, `video` |
| `display_order` | int | Display order (0–3) |

`Post::attachMedia()` maps these columns to the API response's shortened keys: `url`, `thumb`, `type`, `order` (see [api/classes/Post.php](../api/classes/Post.php)).

### Limits and processing

Maximum of 4 media items of the types listed below.

- **Images**: JPEG/PNG/WEBP, up to 5MB each
  - Automatic 600px thumbnail generation to save bandwidth in the feed
  - **Magic bytes verification** via `FileValidator::isValidImage()` to guard against forged files
- **GIF**: up to 10MB
  - Automatic conversion to MP4 via FFmpeg (~96% size savings)
  - **Safe conversion** via `proc_open()` with an argument array (command injection protection)
  - **Magic bytes verification** via `FileValidator::isValidGif()`
- **Video**: MP4/WebM/AVI/MOV/MPEG, up to 100MB
  - HLS conversion via FFmpeg with multiple quality levels (360p, 720p, 1080p)
  - First-frame preview generation
  - Converted to H.264 (video) + AAC (audio) for cross-browser compatibility
  - **PID is saved** to the DB so the conversion can be cancelled (cross-platform)

### Upload security

**File validation:**
- MIME type check via `finfo_file()`
- Magic bytes check (first bytes of the file) via `FileValidator`
- `getimagesize()` check for images
- Centralized configuration via `FileUploadConfig`

**Attack protection:**
- **Path traversal**: all paths are validated via `realpath()`
- **Command injection**: FFmpeg is invoked via `proc_open()` with an argument array
- **CSRF**: Origin/Referer check for all POST requests
- **Rate limiting**: protection against IP spoofing via a proxy whitelist

**Cross-platform upload cancellation:**
- FFmpeg's process PID is saved to `temp_uploads.process_pid`
- Windows: terminated via `taskkill /F /PID <pid>`
- Linux: terminated via `kill -9 <pid>`
- Falls back to `pkill -f` if no PID is available

### API endpoints

- `POST /api/upload/post-images` — upload images (returns `[{url, thumb, type: 'image'}]`)
- `POST /api/upload/post-gif` — upload a GIF with auto-conversion to MP4 (returns `{url, type: 'gif'}`)
- `POST /api/upload/post-video` — upload a video with HLS conversion (returns `{url, thumb, type: 'video'}`)
- `DELETE /api/upload/media` — delete a media file from the server (checks ownership, path traversal protection)
- `DELETE /api/upload/cancel` — cancel an upload by tracking_id (terminates the FFmpeg process by PID)

### Temporary uploads

The `temp_uploads` table tracks unused media files:
- All uploaded media is registered as temporary via `TempUploadsHelper`
- Limit: maximum of 4 media files at once (locked via `pg_advisory_lock`)
- Removed from `temp_uploads` when a post is created
- A cron job cleans up files older than 6 hours (see [cleanup_temp_uploads.php](../cleanup_temp_uploads.php))
- Cleanup happens when `ComposeWidget` unmounts for comments
- The `process_pid` column tracks conversion process PIDs

### Display

- **Post feed**: thumbnails for images and videos, autoplay for GIFs
- **Lightbox (MediaLightbox)**: full-size images, VideoPlayer with HLS for videos
- **Quoted posts (QuotedPost)**: thumbnails, "GIF"/"VIDEO" badges

### VideoPlayer

A custom video player supporting:
- HLS.js for adaptive streaming
- Play/pause, timeline, seeking
- Draggable volume slider (saved to `users.video_volume`)
- Quality switching (Auto, 360p, 720p, 1080p)
- Playback speed (0.25x - 2x)
- Two-tier settings menu (⚙️)
- Multi-language support (EN/RU)

## Query logic

| Request | What it returns |
|---|---|
| Feed `GET /api/posts` | `parent_id IS NULL` OR `is_quick_reply = true` |
| Profile "Posts" | Original posts + author's quick replies |
| Profile "Replies" | Thread replies to other users' tweets (self-replies excluded) |
| Post replies `GET /api/posts/:id/replies` | All posts with `parent_id = :id` |

## Post detail page

- If the post is a quick reply, the quoted parent post is shown inside it (with images)
- If the post is a thread reply, the parent is not shown above it
- A view is registered via `POST /api/posts/{id}/view` with per-session deduplication (3 hours via Redis) — reopening the same post as the same user/IP within that window doesn't increment the counter. The same mechanism is used for feed views (see `Post.jsx`, `IntersectionObserver` with a 50% visibility threshold and a 3-second delay)

## Live updates

- **Feed (Home)**: polling every 30 sec; new posts are not inserted automatically — a "Show N posts" button appears
- **Post page**: polling every 20 sec; new replies are appended to the list automatically
- Both mechanisms work through repeated requests to existing API endpoints without WebSockets
