# Changelog

All notable changes to this project will be documented in this file.

**[Русская версия / Russian version](CHANGELOG_RU.md)**

## [1.6.0.1] - 2026-08-05

### New Features

#### Media Synchronization Between Tabs
- **Media attachment syncs**: When attaching an image/video/GIF in one tab, it automatically appears in all open tabs on the main page
- **Media removal syncs**: When detaching media in one tab, it disappears from all tabs
- **Restoration after reload**: Attached media is restored from the database (`temp_uploads`) when opening a new tab or refreshing the page
- **Draft synchronization**: When publishing a post in one tab, draft text and media are cleared in all open tabs
- Uses `BroadcastChannel API` for cross-tab communication

#### Temporary Uploads System (temp_uploads)
- **temp_uploads table** for storing temporarily uploaded media before post publication, moved away from browser localStorage (which now only stores text)
- **6-hour TTL**: Automatic cleanup of unused media after 6 hours (cronjob) instead of 48
- **API endpoints**:
  - `GET /api/temp-uploads` - get list of uploaded media for current user
  - `DELETE /api/upload/media` - delete media with ownership verification
  - `POST /api/upload/cancel` - cancel upload by tracking ID
- **4-media limit**: Restriction on the number of simultaneously attached files to prevent abuse
- **Tracking ID**: Unique identifier for each upload (allows canceling video upload during conversion)

#### Upload Contexts
- **Main page** (`compose_main`): Media is saved to `temp_uploads`, restored on reload
- **Comments** (`comment_{postId}`): Media is NOT saved to DB, deleted on component unmount
- `X-Upload-Context` header determines upload behavior

### Security

#### Fixed Race Conditions
- **Race condition in post creation**: Used atomic `DELETE...RETURNING` in `Post::create()` to prevent media duplication across multiple posts
- **Race condition in 4-media limit**: Replaced `pg_advisory_xact_lock` (didn't work in autocommit mode) with session-level `pg_advisory_lock`/`pg_advisory_unlock` for proper locking when checking upload limits

#### Protection Against Unauthorized Access
- **Deleting other users' files**: Added `user_id` check in `DELETE FROM temp_uploads` when deleting media - users can only delete their own files
- **Media URL validation**: Added URL format validation before post creation - only paths inside `/uploads/(videos|posts|gifs)/` are accepted

#### MIME Type Verification
- MIME type verification via `finfo_file()` already implemented for all media types (images, GIFs, videos)
- Prevents uploading malicious files with fake extensions

### Bug Fixes

#### Critical Bugs
- **Comments with media didn't work**: `Post::create()` attempted to delete media from `temp_uploads` for all post types, including comments. Now the check only runs for main posts (`$parentId === null`)
- **Draft synchronization**: When publishing a post in one tab, `localStorage` with the draft wasn't cleared in other tabs. Added `post_created` event handling to clear drafts in all tabs

#### Media Restoration
- **Media returned after deletion**: Media restored from `temp_uploads` is now marked with `isRestored: true` flag and doesn't sync with global `UploadContext`, preventing it from reappearing after deletion
- **Removal from context**: Added `removeUpload(id)` call in `handleRemove` to remove media from global upload context

### Logging
- Added detailed logging in `deleteUploadedMedia()` for debugging media deletion issues
- Logs include: ownership check, DELETE result from DB, file deletion from disk

### Technical Improvements
- Improved error handling when working with `temp_uploads`
- Optimized media synchronization between tabs via `BroadcastChannel`
- Added `finally` blocks to guarantee advisory lock release

---

## [1.5.2] - 2026-08-05

### Fixed
- **Video upload**: fixed `proc_open() undefined` error - enabled function in php.ini for parallel video conversion
- **Video audio**: fixed missing audio in converted HLS streams
  - Fixed `$out` array cleanup before second `exec()` in `getVideoInfo()`
  - Function now correctly detects audio track presence
- **Master.m3u8**: fixed playlist generation - all qualities (360p/720p/1080p) are now added to the list
  - Issue: `proc_close()` returned -1 instead of real exit code
  - Solution: use `$status['exitcode']` from `proc_get_status()`
- **Video quality selection**: quality switcher now displays correctly during playback
- **Media deletion**: fixed deletion of completed uploads from temp_uploads
  - Issue: after `clearCompleted()` element was not found in global context
  - Solution: `MediaUpload.handleRemove()` now calls `postsAPI.deleteMedia()` directly
- **Tracking ID**: fixed custom header `X-Tracking-ID` passing through Nginx
  - Added directive `fastcgi_param HTTP_X_TRACKING_ID $http_x_tracking_id`
  - tracking_id now correctly saved in temp_uploads for all media types
- **File permissions**: temporarily set 777 permissions on uploads/ for Linux compatibility
- **PDOStatement**: fixed `db->query()` result usage - added `->fetch()` and `->fetchAll()`

### Changed
- **Migration from Windows to Linux**: project now runs on Nginx instead of Apache
  - Updated PHP-FPM configuration for Nginx
  - Enabled PHP extensions: `fileinfo`, `exec`, `proc_open`, `proc_close`, `proc_get_status`
  - Installed FFmpeg for video conversion
- **Code refactoring**: improved structure and readability
  - Created universal `deleteMediaFile($path, $mediaType)` function for media deletion
  - `cancelUpload()` code reduced from ~40 to ~10 lines
  - Moved FFmpeg paths to `config/config.php`:
    ```php
    'ffmpeg' => [
        'binary' => '/usr/bin/ffmpeg',
        'ffprobe' => '/usr/bin/ffprobe'
    ]
    ```
  - Added constructor to `PostController` for config loading
- **Error logging**: added logging to 7 catch blocks via `error_log()`
  - Images/GIFs/videos registration in temp_uploads
  - Media deletion from temp_uploads
  - Rate limit checking for videos
- **State synchronization**: improved sync between local and global upload state
  - `MediaUpload` now correctly removes items from local state

### Removed
- **Debug code**: removed all temporary files and logging
  - Removed test files: `test_upload.php`, `test_temp_uploads.php`
  - Removed `transcode.log` file and all logging to it
  - Removed test file entries from nginx.conf
  - Kept only critical logging via `error_log()`

### Security
- **Authentication**: verified all public functions in PostController
  - All protected endpoints correctly use `requireAuth()`
  - Public endpoints (`view`, `getComments`) intentionally without authorization

### Technical Details
- FFmpeg paths now configured in `config/config.php`
- Universal `deleteMediaFile()` function supports types: `video`, `image`, `gif`
- For videos, ffmpeg process is automatically killed on deletion
- For images, thumbnails are automatically deleted
- Nginx passes custom headers to PHP-FPM via `fastcgi_param`
- All database errors logged with clear messages

---

## [1.5.1] - 2026-08-04

### Changed
- **Video attachment to post**: you can now leave video for upload with conversion and freely navigate the site. 
When leaving the site or refreshing the page, upload is interrupted and file is deleted from server. Warning appears before page refresh.

### Global
- **Migration to Nginx**: configuration now in nginx.conf instead of multiple .htaccess files; vite.config.js updated.
- On Windows, issues will arise at least with media content: particularly with disk deletion. Linux only is recommended.


## [1.5.0] - 2026-08-03

### Added
- **Video upload**: support for video file uploads (MP4, WebM, AVI, MOV, MKV) up to 100MB
  - API endpoint `POST /api/upload/post-video` with HLS conversion via FFmpeg
  - Automatic HLS stream generation with multiple quality levels (360p, 720p, 1080p)
  - Conversion to H.264 (video) + AAC (audio) for cross-browser compatibility
- **VideoPlayer**: custom video player with HLS.js support and full controls
  - Play/Pause, timeline with seeking
  - Volume control with draggable vertical slider
  - Quality switching (Auto, 360p, 720p, 1080p)
  - Playback speed adjustment (0.25x - 2x)
  - Two-level settings menu (⚙️) like Twitter
  - Adaptive sizing for screen (vertical and horizontal videos)
- **Video volume persistence**: 
  - Column `users.video_volume` (default 0.45 = 45%)
  - API endpoint `PATCH /user/video-volume`
  - Auto-save volume level with 1 sec debounce
  - Volume restoration on playback (in feed and lightbox)
- **Temporary uploads**: `temp_uploads` table for tracking unused media files
  - Automatic registration of all uploaded media (images, GIFs, videos)
  - Cron task for cleaning files older than 48 hours
  - Temporary file deletion on ComposeWidget unmount for comments
- **MediaLightbox**: 
  - VideoPlayer integration with full controls
  - Quick reply via ComposeReplyModal on 💬 click
  - Correct vertical video display
- **Video player localization**: interface translations (EN/RU)
  - "Playback speed" / "Скорость видео"
  - "Quality" / "Качество"
  - "Normal" / "Обычная"
  - "Auto" / "Авто"

### Fixed
- **MediaUpload**: fixed `Undefined array key "id"` error in temp_uploads registration (used `$authUser['id']` instead of `$authUser['userId']`)
- **VideoPlayer**: 
  - Fixed video overflow beyond lightbox boundaries (added `max-width: 100%; max-height: 100%`)
  - Fixed video freeze on quality switching (added `LEVEL_SWITCHED` subscription)
  - Fixed video scale on quality switching (forced `width: 100%; height: 100%` with `object-fit: contain`)
  - Fixed lightbox closing on video/controls click (added `e.stopPropagation()`)
- **PostMedia**: fixed video playback in feed without sound (added `video.volume` setting from saved preferences)
- **Volume**: fixed volume slider disappearing on hover (removed CSS `:hover`, added JS control with 300ms delay)
- **ComposeWidget**: fixed media file leak on comment cancel (added cleanup on unmount via `useRef`)

### Security
- **Video validation**: MIME type checking via `finfo_file()` and extension whitelist
- **Size limit**: maximum 100MB for video files
- **FFmpeg isolation**: all file paths validated, only files from `/uploads/videos/` used
- **Temporary file cleanup**: automatic deletion of unused media after 48h

### Performance
- **HLS adaptive streaming**: automatic quality selection based on connection speed
- **Video thumbnails**: preview generation for fast feed loading
- **Volume save debounce**: 1 sec delay to reduce server load

## [1.4.0] - 2026-08-02

### Added
- **Media unification**: merged images and GIFs into unified `post_media` system with different file type support
- **Image thumbnails**: automatic thumbnail creation (600px) to save traffic in post feed
- **GIF to MP4 conversion**: automatic GIF conversion to MP4 via FFmpeg (~96% file size savings)
- **MediaLightbox**: modal window for media viewing with arrow navigation and post info display
- **MediaUpload**: component for uploading images and GIFs with preview
- **PostMedia**: component for displaying media in posts with GIF support (pause/play on click)
- API endpoint `POST /api/upload/post-gif` — GIF upload with automatic MP4 conversion
- Method `PostController::createThumbnail()` — thumbnail generation via GD
- Method `PostController::convertGifToMp4()` — GIF to MP4 conversion via FFmpeg
- **RateLimitMiddleware** — middleware for rate limiting (uses APCu)

### Security
- **MIME validation via file content**: file type checking via `finfo_file()` instead of `$_FILES['type']` to protect against malicious file uploads disguised as images (`PostController.php`, `UserController.php`)
- **File extension whitelist**: additional check for `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` extensions
- **Rate Limiting**: request frequency limiting via `RateLimitMiddleware` (APCu):
  - Registration: 3 attempts per 10 minutes from one IP
  - Login: 5 attempts per 5 minutes from one IP (counter reset after successful login)
  - Post creation: 20 posts per 10 minutes per user
- **avatar_url validation**: only URLs from `/uploads/avatars/` with correct extensions allowed (regex check)
- **FFmpeg path validation**: verify files for conversion are in `/uploads/gifs/` (protection from path traversal)
- **File deletion**: automatic media file and thumbnail deletion when posts are deleted (`Post::delete()`)
- **SQL logging limitation**: query details (SQL, parameters) logged only in `development` mode
- **CSP headers**: added to `.htaccess`:
  - `Content-Security-Policy` — content source restrictions
  - `X-Content-Type-Options: nosniff` — MIME-sniffing protection
  - `X-Frame-Options: DENY` — clickjacking protection
  - `X-XSS-Protection: 1; mode=block` — additional XSS protection
  - `Referrer-Policy: strict-origin-when-cross-origin` — referrer control
- **XSS protection**: React automatically escapes all output via `{post.content}` — HTML tags displayed as text, not executed

### Changed
- **Post.php**: `attachMedia()` method now returns `media` (JSON array with `url`, `thumb`, `type`, `order`) instead of `images`
- **PostController::uploadPostImages()**: returns `{url, thumb}` instead of just `url`
- **ComposeWidget**: updated media upload handling for thumbnail support
- **PostMedia**: feed displays thumbnails (`item.thumb`), lightbox displays originals (`item.url`)
- **QuotedPost**: updated to work with `media` field instead of `images`
- **ImageLightbox** renamed to **MediaLightbox** with video and GIF support
- GIFs in feed displayed as `<video autoplay loop muted>` with "GIF" badge and pause on click
- GIFs in lightbox displayed as video without controls (autoplay + loop)

### Fixed
- **Lightbox scaling**: large images now correctly scale to screen size (`max-width: 100%`, `max-height: 100%`, `min-height: 0`, `overflow: hidden`)
- **Media preview in ComposeWidget**: limited grid max height (400px for 1/3/4 images, 300px for 2) so large images don't occupy entire screen
- **Static caching**: added headers to `.htaccess` for correct caching (HTML — `no-cache`, JS/CSS with hashes — `immutable`, API — `no-cache`), fixed style disappearing after cache clear
- **Lightbox not opening**: added `post` prop to `PostMedia` component in `Post.jsx` and `PostPage.jsx`
- **Media not displaying in QuotedPost**: updated component to work with new `media` field

### Removed
- `004_add_retweets.sql` and `008_add_post_images.sql`
- Components `ImageUpload.jsx`, `PostImages.jsx` (replaced with `MediaUpload.jsx`, `PostMedia.jsx`)
- Table `post_images` (replaced with `post_media`)

### Technical Details
- FFmpeg path: `C:/ffmpeg/bin/ffmpeg.exe` (hardcoded in `PostController.php`)
- Thumbnails created via PHP GD with quality JPEG 85, PNG 8, WebP 85
- GIFs converted to MP4 with parameters: `-movflags faststart -pix_fmt yuv420p -c:v libx264 -preset fast -crf 23`
- Original GIF deleted after successful conversion
- Without FFmpeg, GIF saved without conversion
- Support for up to 4 media files per post (images + GIFs)

---

## [1.3.0] - 2026-08-01

### Added
- **ComposeWidget** — unified component for writing posts and replies (`ComposeWidget.jsx`, `ComposeWidget.css`): avatar on left, textarea, below — attachment icons (photo, GIF, emoji) and Post/Reply button on right
- **Image attachment in replies**: `ComposeWidget` supports photo uploads everywhere — on home page, under post, in lightbox
- **Dynamic feed updates** (Home): polling every 30 sec; when new posts appear, "Show N posts" button displayed, on click — posts inserted at beginning of feed
- **Dynamic comment updates** (PostPage): polling every 20 sec, new replies added automatically
- **Images in QuotedPost**: when quick replying to post with images they now display inside quoted post
- Translation keys `post_page.views`, `post_page.comments_count`, `post_page.likes_count` in `ru.json` and `en.json`

### Changed
- **ComposePost**, **PostPage**, **ImageLightbox** — inline reply forms replaced with `ComposeWidget`
- **ImageUpload** — added props `inputRef` (external file input trigger) and `hideButton` (hide built-in button)
- **ImageLightbox** — right panel now aligns to right screen edge (removed `max-width` and `margin: auto` from container)
- **ImageLightbox** — hidden right panel scrollbar (content scrolls, bar not visible)
- **ImageLightbox** — fixed CSS variables: `--bg-primary` → `--bg`, `--text-primary` → `--text`, `--border-color` → `--border` etc.; now works correctly in light theme
- **ImageLightbox** — clicking dark background (outside image and right panel) closes window
- **ImageLightbox** — removed hardcoded Russian strings, fixed locale from `'ru-RU'` to `t('locale')`
- **PostPage** — removed duplicate states `replyText`, `submitting`, `replyError`, `textareaRef`

---

## [1.2.0] - 2026-08-01

### Added
- **Image attachment to posts**: users can add up to 4 images to a post
- **Adaptive grid display**: images displayed in optimal grid depending on quantity (1-4)
- **Lightbox for viewing**: clicking image opens it in full size
- **ImageUpload component**: interface for selecting and previewing images before publishing
- **PostImages component**: adaptive image display in posts with rounded corners
- **API endpoint** `POST /api/upload/post-images` — image upload (up to 4, max 5MB each)
- **post_images table** in DB for storing post-image relationships
- File type validation (JPEG, PNG, GIF, WEBP) and size (max 5MB)
- Automatic image file deletion when post is deleted

### Changed
- Updated `Post::create()` method to support image URL array
- Updated `PostController::create()` to handle `image_urls` field
- Extended `Post::baseSelect()` to include images in post selections
- Updated API client (`postsAPI`) with `uploadImages` methods and extended `create`
- `ComposePost` component now supports image upload
- `Post` component displays attached images

### Technical Details
- Images stored in `/uploads/posts/`
- Uses PostgreSQL JSON aggregation for efficient image selection
- Cascade deletion of `post_images` records when post is deleted
- Lazy loading of images for performance optimization
- Responsive design with mobile device adaptation

---

## [1.1.0] - 2026-08-01

### Changed
- **API architecture refactoring**: Migration from monolithic `api/index.php` to modular structure with controllers
- Reduced `api/index.php` size from 407 to 60 lines of code
- Improved code scalability and maintainability

### Added
- **Router.php** — routing system with dynamic URL parameter support
- **middleware/AuthMiddleware.php** — centralized authorization handling
- **controllers/AuthController.php** — controller for registration, login and session management
- **controllers/PostController.php** — controller for working with posts (creation, likes, retweets, comments)
- **controllers/UserController.php** — controller for profiles, settings and avatar uploads

### Technical Details
- All controllers isolated and can be tested independently
- Added brief method comments in Russian
- API endpoints unchanged — backward compatibility preserved
- Structure prepared for future feature expansion (blogs, music, etc.)

---

## [1.0.0] - Earlier

### Initial Version
- Basic social network functionality
- User registration and authorization
- Post and reply creation
- Likes and retweets
- Post comments
- User profiles
- Themes and multi-language support
