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
- ✅ Likes and retweets
- ✅ Comments (replies and nested replies)
- ✅ Quote posts
- ✅ Quick reply without leaving feed
- ✅ View counter
- ✅ Dynamic feed updates
- ✅ Media lightbox with navigation

### Profiles
- ✅ User profiles with bio, location, website
- ✅ Avatar upload
- ✅ User posts list
- ✅ Edit profile

### Media Processing
- ✅ Automatic thumbnail generation for images
- ✅ GIF to MP4 conversion via FFmpeg (~96% size savings)
- ✅ Video HLS transcoding in multiple qualities (360p/720p/1080p)
- ✅ Automatic temp file cleanup after 48 hours
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
- Nginx
- FFmpeg (for GIF and video processing)
- Linux OS (tested on WSL Ubuntu)

### PHP Extensions
```ini
extension=pdo_pgsql
extension=pgsql
extension=gd
extension=fileinfo
```

Enable functions in php.ini:
```ini
disable_functions = 
; Remove: exec, proc_open, proc_close, proc_get_status
```

## Installation

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
\i database/migrations/007_add_post_media.sql
\i database/migrations/008_add_media_thumbnails.sql
\i database/migrations/009_temp_uploads.sql
\i database/migrations/010_add_video_volume.sql
\i database/migrations/011_add_tracking_id_to_temp_uploads.sql
```

### 3. Configuration

Edit `config/config.php` file:

```php
return [
    'database' => [
        'host' => 'localhost',
        'port' => '5432',
        'dbname' => 'your_database',
        'username' => 'postgres',
        'password' => 'your_password',
        'charset' => 'utf8'
    ],
    'jwt' => [
        'secret' => 'create_a_strong_secret_key',
        'expiration' => 86400 * 7 // 7 days
    ],
    'ffmpeg' => [
        'binary' => '/usr/bin/ffmpeg',
        'ffprobe' => '/usr/bin/ffprobe'
    ]
];
```

### 4. Web Server Setup (Nginx)

Project runs through Nginx on Linux (WSL). Create configuration file for your domain.

Example Nginx config (e.g., `/etc/nginx/sites-available/mytwit.com`):

```nginx
server {
    listen 80;
    server_name mytwit.com www.mytwit.com;
    root /www/wwwroot/mytwit.com;
    index index.html index.php;

    # Logs
    access_log /var/log/nginx/mytwit.access.log;
    error_log /var/log/nginx/mytwit.error.log;

    # API requests to PHP
    location ^~ /api/ {
        location ~ \.php$ {
            fastcgi_pass unix:/tmp/php-cgi-81.sock;
            fastcgi_index index.php;
            fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
            include fastcgi_params;

            # Pass custom headers to PHP
            fastcgi_param HTTP_X_TRACKING_ID $http_x_tracking_id;

            # No caching for API
            add_header Cache-Control "no-cache, no-store, must-revalidate" always;
            add_header Pragma "no-cache" always;
            add_header Expires "0" always;
        }

        try_files $uri $uri/ /api/index.php?$query_string;
    }

    # Uploaded files
    location ^~ /uploads/ {
        alias /www/wwwroot/mytwit.com/uploads/;

        # HLS manifests
        location ~* \.m3u8$ {
            add_header Content-Type "application/vnd.apple.mpegurl";
            add_header Cache-Control "no-cache";
            add_header Access-Control-Allow-Origin "*";
        }

        # HLS segments
        location ~* \.ts$ {
            add_header Content-Type "video/mp2t";
            add_header Cache-Control "public, max-age=31536000";
            add_header Access-Control-Allow-Origin "*";
        }

        # Other files
        expires 30d;
        add_header Cache-Control "public";
    }

    # Deny access to service files
    location ~ ^/(cleanup_temp_uploads\.php|composer\.json|package\.json|\.env|\.git|\.gitignore|\.htaccess|nginx\.conf) {
        deny all;
        return 404;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        return 404;
    }

    # Root path and all SPA routes serve dist/index.html
    location / {
        index /dist/index.html;
        try_files /dist$uri /dist$uri/ /dist/index.html;

        # No caching for HTML
        location ~* \.html$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

After creating configuration:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/mytwit.com /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

Ensure PHP-FPM is running:

```bash
sudo systemctl status php8.1-fpm
sudo systemctl start php8.1-fpm  # if not running
```

### 5. Set File Permissions

```bash
# Create uploads directories
mkdir -p uploads/avatars uploads/posts uploads/posts/thumbs uploads/gifs uploads/videos

# Set permissions (for production use www-data:www-data with 755)
chmod -R 777 uploads/

# For production:
# sudo chown -R www-data:www-data uploads/
# sudo chmod -R 755 uploads/
```

### 6. Setup Cleanup Cron Task

Add to crontab to clean old temporary files:

```bash
# Edit crontab
crontab -e

# Add line (runs every 30 minutes):
*/30 * * * * php /www/wwwroot/mytwit.com/cleanup_temp_uploads.php
```

### 7. Build and Run

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

## Troubleshooting

### Video upload doesn't work
- Check FFmpeg is installed: `ffmpeg -version`
- Check PHP functions are enabled: `proc_open`, `proc_close`, `exec`
- Check file permissions on `uploads/videos/` directory
- Check PHP error logs: `/var/log/php8.1-fpm.log`

### Images not displaying
- Check file permissions on `uploads/` directory
- Check Nginx configuration for `/uploads/` location
- Check PHP GD extension is enabled: `php -m | grep gd`

### Video has no sound
- Issue was fixed in version 1.5.2
- Make sure you're running latest code version
- Check `getVideoInfo()` function correctly detects audio tracks

### Tracking ID not saved
- Make sure Nginx passes `X-Tracking-ID` header to PHP
- Add to nginx.conf: `fastcgi_param HTTP_X_TRACKING_ID $http_x_tracking_id;`
- Restart Nginx: `sudo systemctl restart nginx`

## Next Steps (TODO)

- [ ] Follow/unfollow system
- [ ] Notifications
- [ ] Direct messages
- [ ] User and post search
- [ ] Hashtags and mentions
- [ ] Bookmarks
- [ ] Lists
- [ ] Verified accounts

## License

This project is open source and available for personal and commercial use.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- Create an issue on GitHub
- Check documentation in `/docs/` folder
- Review CHANGELOG.md for recent changes

---

**Note:** This project requires Linux environment for full functionality. Windows users should use WSL (Windows Subsystem for Linux).
