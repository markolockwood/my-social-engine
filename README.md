# MyTwit - Социальная сеть

Готовый скрипт социальной сети в стиле Twitter на React, PHP 8.1 и PostgreSQL. Разворачивается на любом локальном или боевом сервере с Nginx. На данный момент установщика нет, всё полностью вручную.

## Changelog
[Changelog](CHANGELOG.md)

## Возможности

### Основные функции
- ✅ Регистрация и авторизация пользователей
- ✅ JWT аутентификация
- ✅ SPA без перезагрузки страницы
- ✅ Адаптивный дизайн (десктоп, планшет, мобильный)
- ✅ Тёмная тема с сохранением в БД
- ✅ Мультиязычность (EN, RU) с редактируемыми переводами

### Посты и взаимодействие
- ✅ Создание постов (до 280 символов)
- ✅ Прикрепление медиа к постам (4 шт. максимум): картинки, GIF, видео
- ✅ Собственный видео-плеер (видео через hls, конвертация в разные разрешения при загрузке, выбор качества при просмотре)
- ✅ Лента новостей — оригинальные посты + быстрые ответы с цитатами
- ✅ Ответы на посты (комментарии как вложенные посты)
  - Быстрые ответы через модал (💬) — отображаются в табе "Посты" с цитатой родителя
  - Ответы в треде (на странице поста) — отображаются в табе "Ответы"
- ✅ Цитируемые посты (quoted posts) — кликабельные карточки внутри твитов
- ✅ Ретвиты — отображаются в табе "Посты" с индикатором "Вы ретвитнули"
- ✅ Лайки постов
- ✅ Счётчик просмотров — увеличивается при открытии детальной страницы поста
- ✅ Кнопка закладок (UI готов, функционал в разработке)
- ✅ Удаление собственных постов
- ✅ Детальная страница поста — крупный формат с метаданными, сортировкой ответов (UI), ссылкой на цитаты

### Профили
- ✅ Профили пользователей с баннером и аватаром
- ✅ Редактирование профиля (имя, био, локация, дата рождения, аватар)
- ✅ Табы профиля:
  - Посты — оригинальные твиты, быстрые ответы (с цитатой), ретвиты
  - Ответы — ответы на чужие твиты (с полным тредом: родитель + ответ)
  - Медиа (в разработке)
  - Нравится (в разработке)
- ✅ Статистика: количество постов, подписок, подписчиков

## Технологии

### Frontend
- React 18
- React Router для маршрутизации
- Axios для HTTP запросов
- Vite для сборки
- CSS переменные для тёмной темы
- Адаптивная вёрстка (breakpoints: 1200px, 900px, 640px)
- Система i18n без внешних библиотек

### Backend
- PHP 8.1
- PostgreSQL 14+
- JWT для аутентификации
- REST API
- Nginx веб-сервер

## Установка

### 1. Установка зависимостей Node.js

```bash
npm install
```

### 2. Настройка базы данных PostgreSQL

Создайте базу данных и выполните SQL скрипты:

```bash
psql -U postgres
CREATE DATABASE ваша_база;
\c ваша_база
\i database/schema.sql
```

Затем выполните миграции:

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

### 3. Настройка конфигурации

Отредактируйте файл `config/config.php` под свои параметры:

```php
return [
    'database' => [
        'host' => 'localhost',
        'port' => '5432',
        'dbname' => 'ваша_база',
        'username' => 'postgres',
        'password' => 'ваш_пароль',
        'charset' => 'utf8'
    ],
    'jwt' => [
        'secret' => 'придумайте_надёжный_секретный_ключ',
        'expiration' => 86400 * 7 // 7 дней
    ]
];
```

### 4. Настройка веб-сервера (Nginx)

Проект работает через Nginx на Linux (WSL). Создайте конфигурационный файл для вашего домена.

Пример конфигурации Nginx (например, `/etc/nginx/sites-available/mytwit.com`):

```nginx
server {
    listen 80;
    server_name mytwit.com www.mytwit.com;
    root /www/wwwroot/mytwit.com;
    index index.html index.php;

    # Логи
    access_log /var/log/nginx/mytwit.access.log;
    error_log /var/log/nginx/mytwit.error.log;

    # API запросы к PHP
    location /api/ {
        try_files $uri $uri/ /api/index.php?$query_string;
        
        location ~ \.php$ {
            fastcgi_pass unix:/run/php/php8.1-fpm.sock;
            fastcgi_index index.php;
            fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
            include fastcgi_params;
        }
    }

    # Статические ассеты из dist/assets/
    location /assets/ {
        alias /www/wwwroot/mytwit.com/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Загруженные файлы
    location /uploads/ {
        alias /www/wwwroot/mytwit.com/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # SPA роутинг — все остальные пути возвращают dist/index.html
    location / {
        try_files $uri $uri/ /dist/index.html;
    }

    # Запретить доступ к служебным файлам
    location ~ /\. {
        deny all;
    }
}
```

После создания конфигурации:

```bash
# Создайте символическую ссылку
sudo ln -s /etc/nginx/sites-available/mytwit.com /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Перезапустите Nginx
sudo systemctl restart nginx
```

Убедитесь, что PHP-FPM запущен:

```bash
sudo systemctl status php8.1-fpm
sudo systemctl start php8.1-fpm  # если не запущен
```

### 5. Сборка и запуск

```bash
npm run build
```

После сборки откройте ваш домен в браузере. Перезапуск веб-сервера не требуется.

Запускайте `npm run build` после каждого изменения файлов в `src/`.

#### Режим разработки (с hot reload)

Для удобной разработки с автоперезагрузкой:

```bash
npm run dev
```

Приложение будет доступно по адресу **http://ваш-домен:3333**

## Структура проекта

```
your-project/
├── api/                      # Backend PHP API
│   ├── classes/              # Модели (Database, User, Post, JWT)
│   ├── controllers/          # Контроллеры (Auth, Post, User)
│   ├── middleware/           # AuthMiddleware
│   ├── Router.php            # Роутер
│   └── index.php             # Точка входа API
├── config/                   # Конфигурация
├── database/                 # SQL схема и миграции
├── src/                      # Frontend React
│   ├── api/                  # API клиент
│   ├── components/           # UI компоненты
│   ├── context/              # AuthContext + i18n
│   ├── i18n/                 # Переводы (EN, RU)
│   ├── pages/                # Страницы приложения
│   └── styles/               # CSS стили
├── uploads/                  # Загруженные файлы
├── package.json
├── vite.config.js
└── README.md
```

## Документация

- [API Endpoints](docs/api_endpoints.md)
- [Архитектура постов и ответов](docs/posts_architecture.md)

## Следующие шаги (TODO)

- [ ] Система подписок (follow/unfollow)
- [ ] Уведомления
- [ ] Личные сообщения
- [ ] Поиск пользователей и постов
- [ ] Хэштеги и упоминания
- [ ] Таб "Медиа" (посты с изображениями)
- [ ] Таб "Нравится" (лайкнутые посты)
- [ ] Закреплённые посты
- [ ] Списки пользователей

## Лицензия

Все права защищены.
