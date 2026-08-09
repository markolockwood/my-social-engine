# MyTwit - Social Network

A ready-to-use Twitter-like social network built with React, PHP 8.1, and PostgreSQL. Deployable on any local or production server with Nginx. No installer yet, everything is done manually.

**🇷🇺 [Русская версия / Russian version](README_RU.md)**

**📋 [Changelog](CHANGELOG.md)** | **[Changelog RU](CHANGELOG_RU.md)**

## Features

### Core Functionality
- ✅ User registration and authentication
- ✅ JWT authentication with access/refresh tokens (access token 15 minutes, refresh token 30 days)
- ✅ Automatic token refresh without logout
- ✅ SPA with no page reloads
- ✅ Responsive design (desktop, tablet, mobile)
- ✅ Dark theme with database persistence
- ✅ Multi-language support (EN, RU) with editable translations

### Posts and Interactions
- ✅ Create posts with text (up to 280 characters)
- ✅ Attach images to posts (up to 4 per post)
- ✅ Attach GIFs with automatic MP4 conversion
- ✅ Attach videos with HLS conversion (360p/720p/1080p)
- ✅ Custom video player with quality selection and volume persistence
- ✅ Like posts
- ✅ Comments (replies and nested replies)
- ✅ Quote posts
- ✅ Quick reply without leaving the feed
- ✅ View counter with session deduplication (counts feed and post page views as one event)
- ✅ Dynamic feed updates
- ✅ Media lightbox with navigation

### Profiles
- ✅ User profiles with bio, location, website
- ✅ Avatar upload
- ✅ User post list
- ✅ Profile editing
- ✅ Follow/unfollow users, follower and following lists
- ✅ Account settings page (change username, country, gender, language)

### Media Processing
- ✅ Automatic thumbnail generation for images
- ✅ GIF to MP4 conversion via FFmpeg (~96% size reduction)
- ✅ HLS video transcoding in multiple qualities (360p/720p/1080p)
- ✅ Automatic cleanup of temporary files after 6 hours
- ✅ Quality selection during video playback
- ✅ Volume persistence in database
- ✅ Global media upload indicator

### Security
- ✅ Access/Refresh token system — short-lived access tokens (15 min)
- ✅ Automatic token rotation — seamless refresh without logout
- ✅ Logout from all devices — ability to revoke all active sessions
- ✅ Rate limiting on registration, login, and post creation
- ✅ IP validation — protection against SQL injection via proxy headers
- ✅ Path traversal protection — path validation via `realpath()` when deleting files
- ✅ CORS whitelist — only specified domains allowed (not `*`)
- ✅ JWT secret in .env — cryptographically secure secret not stored in Git
- ✅ MIME type verification via file content (not extension)
- ✅ File size limits (images 5MB, GIF 10MB, video 100MB)
- ✅ FFmpeg path validation against directory traversal
- ✅ Automatic media deletion when posts are deleted

## Technologies

### Frontend
- **React 18** — UI library
- **React Router** — routing for SPA
- **Vite** — fast build and dev server with alias support (`@/`)
- **Axios** — HTTP client with automatic token refresh
- **HLS.js** — video streaming library

### Backend
- **PHP 8.1** — server-side logic
- **PostgreSQL** — relational database
- **Redis** — view deduplication and other ephemeral data (future: presence/typing for chat)
- **JWT** — authentication with access/refresh tokens
- **FFmpeg** — video/GIF processing

### Web Server
- **Nginx** — web server (Linux/WSL)
- **PHP-FPM** — FastCGI process manager for PHP

## System Requirements

### Required
- Node.js 16+ and npm
- PHP 8.1+
- PostgreSQL 12+
- Redis 6+
- Nginx
- FFmpeg (for GIF and video processing)
- Linux OS (tested on WSL Ubuntu)

### PHP Extensions
```ini
extension=pdo_pgsql
extension=pgsql
extension=gd
extension=fileinfo
extension=redis
```

Allow functions in php.ini:
```ini
disable_functions = 
; Remove: exec, proc_open, proc_close, proc_get_status
```

## Installation

> **Important:** The instructions below are oriented towards a standard Linux server structure (Ubuntu/Debian with Nginx and PHP installed via apt, running under the `www-data` user). If your server is managed through a control panel (aaPanel/BT-Panel, cPanel, Plesk, ISPmanager, etc.), paths and service names will differ — at minimum: Nginx domain config locations, PHP-FPM systemd unit name, `php.ini` path, web server system user, and PHP extension installation method (via pecl instead of apt if PHP was compiled by the panel from source). Check your panel's documentation for equivalent paths.

### 1. Clone Repository and Install Dependencies

```bash
git clone <repository-url>
cd mytwit
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and **replace** `JWT_SECRET` with a unique value:

```bash
# Generate cryptographically secure secret (choose one method):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# or
openssl rand -hex 32
# or
php -r "echo bin2hex(random_bytes(32));"
```

Copy the generated value to `.env`:

```env
JWT_SECRET=your_generated_secret_here
APP_ENV=production
APP_URL=http://your-domain.com
CORS_ALLOWED_ORIGINS=http://your-domain.com,https://your-domain.com
```

⚠️ **Important:** Never commit `.env` to Git!

### 3. Database Setup

Create database and execute SQL scripts:

```bash
psql -U postgres
CREATE DATABASE your_database;
\c your_database
\i database/schema.sql
```

Then run migrations:

```bash
\i database/migrations/001_add_theme_preference.sql
\i database/migrations/002_add_language.sql
\i database/migrations/003_add_profile_fields.sql
\i database/migrations/004_posts_parent_id.sql
\i database/migrations/005_posts_quick_reply.sql
\i database/migrations/006_add_views_count.sql
\i database/migrations/007_unify_post_media.sql
\i database/migrations/008_add_media_thumbnails.sql
\i database/migrations/009_temp_uploads.sql
\i database/migrations/010_add_video_volume.sql
\i database/migrations/012_add_account_info_fields.sql
\i database/migrations/013_add_refresh_tokens.sql
```

### 4. Configure Application Settings

Edit [`config/config.php`](config/config.php) if needed. Main settings are now read from `.env`.

### 5. Install and Configure Redis

Redis is used for post view deduplication (and future presence/typing indicators for chat). Install the server and PHP extension:

```bash
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

sudo apt install php8.1-redis
sudo systemctl restart php8.1-fpm
```

Verify everything works:

```bash
redis-cli ping        # should respond PONG
php -m | grep redis   # should output "redis"
```

If PHP is not installed via system package manager (relevant for control panels like aaPanel), `php8.1-redis` via apt won't work — use `pecl install redis` for your specific PHP build and manually add `extension=redis.so` to `php.ini`.

### 6. Configure Web Server (Nginx)

Create a configuration file for your domain. On standard Ubuntu/Debian servers, domain configs are in `/etc/nginx/sites-available/` with symlinks in `/etc/nginx/sites-enabled/`; in control panels (aaPanel, cPanel, etc.), they're in a proprietary location, and configs are usually created through the panel interface rather than manually.

**Example configuration:** see the [`nginx.conf`](nginx.conf) file in the project root

After creating the config (on standard server):

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/mytwit.com /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

Ensure PHP-FPM is running (service name depends on PHP installation method — on standard server usually `php8.1-fpm`, in control panels may differ, e.g. `php-fpm-81`):

```bash
sudo systemctl status php8.1-fpm
sudo systemctl start php8.1-fpm  # if not running
```

### 7. Configure File Permissions

```bash
# Create upload directories
mkdir -p uploads/avatars uploads/posts uploads/posts/thumbs uploads/gifs uploads/videos
```

Set permissions for the user running PHP-FPM — on standard server usually `www-data`, in control panels may be a separate system user (e.g. `www` in aaPanel). Check the PHP-FPM pool config (`user` directive in `php-fpm.conf`/`www.conf`) or the owner of other project files.

```bash
# Example for standard server (Ubuntu/Debian):
sudo chown -R www-data:www-data uploads/
sudo chmod -R 755 uploads/
```

`755` permissions are sufficient if PHP-FPM runs as the same user that owns the folder. Don't use `777` permanently — that grants write access to any process on the server, not just the web server.

### 8. Configure Cron Job for Cleanup

Add to crontab to clean old temporary files:

```bash
# Edit crontab
crontab -e

# Add line (runs every 30 minutes, specify your project path):
*/30 * * * * php /path/to/project/cleanup_temp_uploads.php
```

Control panels usually have their own cron job interface (e.g. "Scheduled Tasks" in aaPanel) — it may be more convenient than `crontab -e`, as the panel automatically inserts the correct PHP binary path.

### 9. Build and Run

```bash
npm run build
```

After build, open your domain in a browser. No web server restart needed.

Run `npm run build` after each change in `src/`.

#### Development Mode (with hot reload)

For convenient development with auto-reload:

```bash
npm run dev
```

Application will be available at **http://your-domain:3333**

## Project Structure

```
your-project/
├── api/                      # Backend PHP API
│   ├── classes/              # Models (Database, User, Post, JWT, Redis)
│   ├── controllers/          # Controllers (Auth, Post, User)
│   ├── middleware/           # AuthMiddleware, RateLimitMiddleware
│   ├── Router.php            # Router
│   └── index.php             # API entry point
├── config/                   # Configuration
│   └── config.php            # Main config (reads .env)
├── database/                 # SQL schema and migrations
│   ├── schema.sql            # Initial DB schema
│   ├── migrations/           # DB migrations
├── src/                      # Frontend React
│   ├── api/                  # API client with auto-refresh tokens
│   ├── components/           # UI components (organized by features)
│   │   ├── compose/          # Post creation components
│   │   ├── layout/           # Layout, Sidebar, MobileNav
│   │   ├── post/             # Post display components
│   │   └── user/             # User components
│   ├── context/              # AuthContext, UploadContext, PostsContext
│   ├── i18n/                 # Translations (EN, RU)
│   ├── pages/                # Application pages
│   │   └── settings/         # Settings subpages
│   └── styles/               # Global CSS styles
├── uploads/                  # Uploaded files
│   ├── avatars/              # User avatars
│   ├── posts/                # Post images
│   ├── posts/thumbs/         # Image thumbnails
│   ├── gifs/                 # GIFs converted to MP4
│   └── videos/               # HLS video streams
├── .env                      # Environment variables (DO NOT commit!)
├── package.json
├── vite.config.js            # Vite config with alias @ → src/
├── nginx.conf                # Example Nginx configuration
└── cleanup_temp_uploads.php  # Cron task for temp file cleanup
```
## Documentation

- [API Endpoints](docs/api_endpoints.md)
- [Posts and Replies Architecture](docs/posts_architecture.md)

## Next Steps (TODO)

- [ ] Notifications
- [ ] Direct messages
- [ ] User and post search
- [ ] Hashtags and mentions
- [ ] Bookmarks
- [ ] Lists
- [ ] Verified accounts
- [ ] CSRF protection (form tokens)
- [ ] httpOnly cookies instead of localStorage
- [ ] "Active Sessions" page with device management

## License

All rights reserved.

---

**Note:** This project requires a Linux environment for full functionality. Windows users should use WSL (Windows Subsystem for Linux).
