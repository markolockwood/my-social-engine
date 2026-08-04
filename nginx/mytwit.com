server {
    listen 80;
    server_name mytwit.com www.mytwit.com;
    root /var/www/mytwit.com;

    charset utf-8;

    # ── Заблокировать доступ к служебным файлам ───────────────────────────────
    location ~* ^/(cleanup_temp_uploads\.php|composer\.json|package\.json|\.env)$ {
        return 404;
    }

    # ── API ───────────────────────────────────────────────────────────────────
    # Все /api/* маршруты идут в index.php (реальные файлы/директории раздаются напрямую)
    location /api/ {
        try_files $uri /api/index.php?$query_string;

        include snippets/security_headers.conf;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma        "no-cache"                            always;
        expires 0;
    }

    location ~ ^/api/index\.php$ {
        fastcgi_pass              unix:/run/php/php8.1-fpm.sock;
        fastcgi_index             index.php;
        include                   fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_read_timeout      600;  # совпадает с set_time_limit(600)

        include snippets/security_headers.conf;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma        "no-cache"                            always;
        expires 0;
    }

    # ── HLS видео ─────────────────────────────────────────────────────────────
    location ~* /uploads/videos/.*\.m3u8$ {
        include snippets/security_headers.conf;
        add_header Content-Type  "application/vnd.apple.mpegurl" always;
        add_header Cache-Control "no-cache"                      always;
    }

    location ~* /uploads/videos/.*\.ts$ {
        include snippets/security_headers.conf;
        add_header Content-Type  "video/mp2t"               always;
        add_header Cache-Control "public, max-age=31536000"  always;
    }

    # ── Статические ассеты (агрессивное кэширование) ─────────────────────────
    location ~* \.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$ {
        include snippets/security_headers.conf;
        expires    1y;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    # ── /assets/ → /dist/assets/ ─────────────────────────────────────────────
    location /assets/ {
        alias /var/www/mytwit.com/dist/assets/;
        include snippets/security_headers.conf;
        expires    1y;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    # ── HTML — без кэша ───────────────────────────────────────────────────────
    location ~* \.html$ {
        include snippets/security_headers.conf;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma        "no-cache"                            always;
        expires 0;
    }

    # ── SPA fallback — все остальные маршруты на dist/index.html ─────────────
    location / {
        include snippets/security_headers.conf;
        try_files $uri $uri/ /dist/index.html;
    }
}
