# MyTwit - Social Network

Ready-to-use Twitter-style social network script built with React, PHP 8.1 and PostgreSQL. Deploys on any local or production server with Nginx. Currently no installer available, manual setup required.

**🇷🇺 [Russian version / Русскоязычная версия](README_RU.md)**

**📋 [Changelog](CHANGELOG.md)** | **[Changelog русскоязычный](CHANGELOG_RU.md)**

## Features

### Core Functions
- ✅ User registration and authorization
- ✅ JWT authentication
- ✅ SPA without page reloads
- ✅ Responsive design (desktop, tablet, mobile)
- ✅ Dark theme with database persistence
- ✅ Multi-language support (EN, RU) with editable translations

### Posts and Interaction
- ✅ Create posts with text (up to 280 characters)
- ✅ Attach images to posts (up to 4 per post)
- ✅ Attach GIFs with automatic MP4 conversion
- ✅ Attach videos with HLS conversion (360p/720p/1080p)
- ✅ Custom video player with quality selection and volume persistence
- ✅ Likes
- ✅ Comments (replies and nested replies)
- ✅ Quote posts
- ✅ Quick reply without leaving feed
- ✅ View counter with session-based deduplication (feed and post-detail views count as one event, via Redis)
- ✅ Dynamic feed updates
- ✅ Media lightbox with navigation

### Profiles
- ✅ User profiles with bio, location, website
- ✅ Avatar upload
- ✅ User posts list
- ✅ Edit profile
- ✅ Follow/unfollow users, followers/following lists

### Media Processing
- ✅ Automatic thumbnail generation for images
- ✅ GIF to MP4 conversion via FFmpeg (~96% size savings)
- ✅ Video HLS transcoding in multiple qualities (360p/720p/1080p)
- ✅ Automatic temp file cleanup after 6 hours
- ✅ Quality selection during video playback
- ✅ Volume persistence in database

### Security
- ✅ Rate limiting on registration, login, and post creation
- ✅ MIME type validation via file content (not extension)
- ✅ CSP headers for XSS protection
- ✅ File size limits (images 5MB, GIFs 10MB, videos 100MB)
- ✅ FFmpeg path validation against directory traversal
- ✅ Automatic media deletion when posts are deleted

## Tech Stack

### Frontend
- **React 18** — UI library
- **React Router** — SPA routing
- **Vite** — fast build tool and dev server
- **Axios** — HTTP client
- **HLS.js** — video streaming library

### Backend
- **PHP 8.1** — server-side logic
- **PostgreSQL** — relational database
- **Redis** — view deduplication and other ephemeral data (future: presence/typing indicators for chat)
- **JWT** — authentication
- **FFmpeg** — video/GIF processing

### Web Server
- **Nginx** — web server (Linux/WSL)
- **PHP-FPM** — PHP FastCGI Process Manager

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

Enable functions in php.ini:
```ini
disable_functions = 
; Remove: exec, proc_open, proc_close, proc_get_status
```

## Installation

> **Important:** the instructions below assume a standard Linux server layout (Ubuntu/Debian with Nginx and PHP installed via apt, running as the `www-data` user). If your server is managed through a control panel (aaPanel/BT-Panel, cPanel, Plesk, ISPmanager, etc.), paths and service names will differ — at minimum: where domain Nginx configs live, the PHP-FPM systemd unit name, the `php.ini` path, the web server's system user, and how PHP extensions are installed (via pecl instead of apt if the panel compiled PHP from source). Check your panel's documentation for the equivalent paths.

### 1. Clone repository and install dependencies

```bash
git clone <repository-url>
cd mytwit
npm install
```

### 2. Database setup

Create database and run SQL scripts:

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
\i database/migrations/011_add_tracking_id_to_temp_uploads.sql
```

### 3. Install and configure Redis

Redis is used to deduplicate post views (and in the future for chat presence/typing indicators). Install the server and PHP extension:

```bash
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

sudo apt install php8.1-redis
sudo systemctl restart php8.1-fpm
```

Verify it works:

```bash
redis-cli ping        # should reply PONG
php -m | grep redis   # should print "redis"
```

If PHP was not installed through your system's package manager (common with control panels like aaPanel), `php8.1-redis` via apt won't install — use `pecl install redis` for that specific PHP build and manually add `extension=redis.so` to `php.ini`.

### 4. Application Configuration

Edit [`config/config.php`](config/config.php) file:

### 5. Web Server Setup (Nginx)

Create a configuration file for your domain. On a standard Ubuntu/Debian server, domain configs live in `/etc/nginx/sites-available/` with a symlink in `/etc/nginx/sites-enabled/`; on control panels (aaPanel, cPanel, etc.) they live wherever the panel keeps them and are usually created and enabled through the panel's UI rather than by hand.

**Example configuration:** see [`nginx.conf`](nginx.conf) file in the project root

After creating configuration (standard server):

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/mytwit.com /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

Ensure PHP-FPM is running (the service name depends on how PHP was installed — typically `php8.1-fpm` on a standard server, but it can differ on control panels, e.g. `php-fpm-81`):

```bash
sudo systemctl status php8.1-fpm
sudo systemctl start php8.1-fpm  # if not running
```

### 6. Set File Permissions

```bash
# Create uploads directories
mkdir -p uploads/avatars uploads/posts uploads/posts/thumbs uploads/gifs uploads/videos
```

Permissions need to match the user PHP-FPM runs as — typically `www-data` on a standard server, but control panels often use a dedicated system user instead (e.g. `www` in aaPanel). You can find it in the PHP-FPM pool config (the `user` directive in `php-fpm.conf`/`www.conf`) or from the ownership of the rest of the project's files.

```bash
# Example for a standard server (Ubuntu/Debian):
sudo chown -R www-data:www-data uploads/
sudo chmod -R 755 uploads/
```

`755` is enough as long as PHP-FPM runs as the same user that owns the folder. Avoid leaving `777` permanently — that grants write access to any process on the server, not just the web server.

### 7. Setup Cleanup Cron Task

Add to crontab to clean old temporary files:

```bash
# Edit crontab
crontab -e

# Add line (runs every 30 minutes, use your actual project path):
*/30 * * * * php /path/to/project/cleanup_temp_uploads.php
```

Control panels usually have their own cron UI (e.g. "Cron Jobs" in aaPanel) — using that can be more convenient than `crontab -e` since the panel fills in the correct PHP binary path for you.

### 8. Build and Run

```bash
npm run build
```

After build, open your domain in browser. Web server restart not required.

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
│   ├── classes/              # Models (Database, User, Post, JWT)
│   ├── controllers/          # Controllers (Auth, Post, User)
│   ├── middleware/           # AuthMiddleware, RateLimitMiddleware
│   ├── Router.php            # Router
│   └── index.php             # API entry point
├── config/                   # Configuration
├── database/                 # SQL schema and migrations
├── src/                      # Frontend React
│   ├── api/                  # API client
│   ├── components/           # UI components
│   ├── context/              # AuthContext, UploadContext + i18n
│   ├── i18n/                 # Translations (EN, RU)
│   ├── pages/                # Application pages
│   └── styles/               # CSS styles
├── uploads/                  # Uploaded files
│   ├── avatars/              # User avatars
│   ├── posts/                # Post images
│   ├── posts/thumbs/         # Image thumbnails
│   ├── gifs/                 # GIFs converted to MP4
│   └── videos/               # HLS video streams
├── package.json
├── vite.config.js
├── nginx.conf                # Nginx configuration example
├── cleanup_temp_uploads.php  # Cron task for temp file cleanup
└── README.md
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

## License

All rights reserved.

---

**Note:** This project requires Linux environment for full functionality. Windows users should use WSL (Windows Subsystem for Linux).
