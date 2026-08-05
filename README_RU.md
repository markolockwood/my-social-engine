# MyTwit - Социальная сеть

Готовый скрипт социальной сети в стиле Twitter на React, PHP 8.1 и PostgreSQL. Разворачивается на любом локальном или боевом сервере с Nginx. На данный момент установщика нет, всё полностью вручную.

**🇬🇧 [English version / Английская версия](README.md)**

**📋 [Changelog](CHANGELOG_RU.md)** | **[Changelog EN](CHANGELOG.md)**

## Возможности

### Основные функции
- ✅ Регистрация и авторизация пользователей
- ✅ JWT аутентификация
- ✅ SPA без перезагрузки страницы
- ✅ Адаптивный дизайн (десктоп, планшет, мобильный)
- ✅ Тёмная тема с сохранением в БД
- ✅ Мультиязычность (EN, RU) с редактируемыми переводами

### Посты и взаимодействие
- ✅ Создание постов с текстом (до 280 символов)
- ✅ Прикрепление картинок к постам (до 4 на пост)
- ✅ Прикрепление GIF с автоматической конвертацией в MP4
- ✅ Прикрепление видео с HLS-конвертацией (360p/720p/1080p)
- ✅ Кастомный видеоплеер с выбором качества и сохранением громкости
- ✅ Лайки и ретвиты
- ✅ Комментарии (ответы и вложенные ответы)
- ✅ Цитирование постов
- ✅ Быстрый ответ без ухода из ленты
- ✅ Счётчик просмотров
- ✅ Динамическое обновление ленты
- ✅ Лайтбокс для медиа с навигацией

### Профили
- ✅ Профили пользователей с био, локацией, сайтом
- ✅ Загрузка аватара
- ✅ Список постов пользователя
- ✅ Редактирование профиля

### Обработка медиа
- ✅ Автоматическая генерация миниатюр для картинок
- ✅ Конвертация GIF в MP4 через FFmpeg (~96% экономии размера)
- ✅ HLS-транскодинг видео в нескольких качествах (360p/720p/1080p)
- ✅ Автоматическая очистка временных файлов через 48 часов
- ✅ Выбор качества при воспроизведении видео
- ✅ Сохранение громкости в базе данных

### Безопасность
- ✅ Rate limiting на регистрацию, вход и создание постов
- ✅ Проверка MIME типа через содержимое файла (не расширение)
- ✅ CSP заголовки для защиты от XSS
- ✅ Ограничения размера файлов (картинки 5МБ, GIF 10МБ, видео 100МБ)
- ✅ Валидация путей FFmpeg против directory traversal
- ✅ Автоматическое удаление медиа при удалении постов

## Технологии

### Frontend
- **React 18** — библиотека UI
- **React Router** — роутинг для SPA
- **Vite** — быстрая сборка и dev-сервер
- **Axios** — HTTP клиент
- **HLS.js** — библиотека для видеостриминга

### Backend
- **PHP 8.1** — серверная логика
- **PostgreSQL** — реляционная база данных
- **JWT** — аутентификация
- **FFmpeg** — обработка видео/GIF

### Веб-сервер
- **Nginx** — веб-сервер (Linux/WSL)
- **PHP-FPM** — FastCGI менеджер процессов PHP

## Системные требования

### Обязательно
- Node.js 16+ и npm
- PHP 8.1+
- PostgreSQL 12+
- Nginx
- FFmpeg (для обработки GIF и видео)
- Linux OS (протестировано на WSL Ubuntu)

### PHP расширения
```ini
extension=pdo_pgsql
extension=pgsql
extension=gd
extension=fileinfo
```

Разрешите функции в php.ini:
```ini
disable_functions = 
; Удалите: exec, proc_open, proc_close, proc_get_status
```

## Установка

### 1. Клонирование репозитория и установка зависимостей

```bash
git clone <url-репозитория>
cd mytwit
npm install
```

### 2. Настройка базы данных

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

Отредактируйте файл `config/config.php`:

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
    ],
    'ffmpeg' => [
        'binary' => '/usr/bin/ffmpeg',
        'ffprobe' => '/usr/bin/ffprobe'
    ]
];
```

### 4. Настройка веб-сервера (Nginx)

Проект работает через Nginx на Linux (WSL). Создайте конфигурационный файл для вашего домена.

**Пример конфигурации:** см. файл [`nginx.conf`](nginx.conf) в корне проекта

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

### 5. Настройка прав доступа к файлам

```bash
# Создайте директории для загрузок
mkdir -p uploads/avatars uploads/posts uploads/posts/thumbs uploads/gifs uploads/videos

# Установите права (для продакшена используйте www-data:www-data с 755)
chmod -R 777 uploads/

# Для продакшена:
# sudo chown -R www-data:www-data uploads/
# sudo chmod -R 755 uploads/
```

### 6. Настройка cron-задачи для очистки

Добавьте в crontab для очистки старых временных файлов:

```bash
# Редактируйте crontab
crontab -e

# Добавьте строку (выполняется каждые 30 минут):
*/30 * * * * php /www/wwwroot/mytwit.com/cleanup_temp_uploads.php
```

### 7. Сборка и запуск

```bash
npm run build
```

После сборки откройте ваш домен в браузере. Перезапуск веб-сервера не требуется.

Запускайте `npm run build` после каждого изменения в `src/`.

#### Режим разработки (с hot reload)

Для удобной разработки с авто-перезагрузкой:

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
│   ├── middleware/           # AuthMiddleware, RateLimitMiddleware
│   ├── Router.php            # Роутер
│   └── index.php             # Точка входа API
├── config/                   # Конфигурация
├── database/                 # SQL схема и миграции
├── src/                      # Frontend React
│   ├── api/                  # API клиент
│   ├── components/           # UI компоненты
│   ├── context/              # AuthContext, UploadContext + i18n
│   ├── i18n/                 # Переводы (EN, RU)
│   ├── pages/                # Страницы приложения
│   └── styles/               # CSS стили
├── uploads/                  # Загруженные файлы
│   ├── avatars/              # Аватары пользователей
│   ├── posts/                # Картинки постов
│   ├── posts/thumbs/         # Миниатюры картинок
│   ├── gifs/                 # GIF сконвертированные в MP4
│   └── videos/               # HLS видеопотоки
├── package.json
├── vite.config.js
├── nginx.conf                # Пример конфигурации Nginx
├── cleanup_temp_uploads.php  # Cron-задача для очистки временных файлов
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
- [ ] Закладки
- [ ] Списки
- [ ] Верифицированные аккаунты

## Лицензия

Все права защищены.

---

**Примечание:** Этот проект требует Linux окружение для полной функциональности. Пользователям Windows следует использовать WSL (Windows Subsystem for Linux).
