# API Endpoints

## Аутентификация

- `POST /api/auth/register` — регистрация пользователя
- `POST /api/auth/login` — вход в систему (возвращает access и refresh токены)
- `POST /api/auth/refresh` — обновить access token используя refresh token
- `POST /api/auth/logout` — выход из системы (удаляет текущий refresh token)
- `POST /api/auth/logout-all` — выход со всех устройств (удаляет все refresh токены пользователя)
- `GET /api/auth/me` — получить текущего пользователя
- `PATCH /api/user/theme` — изменить тему (light/dark)
- `PATCH /api/user/language` — изменить язык (en/ru)
- `PATCH /api/user/profile` — обновить профиль
- `PATCH /api/user/video-volume` — сохранить уровень громкости видео (0.0-1.0)
- `PATCH /api/user/username` — изменить username (защита от user enumeration)
- `PATCH /api/user/country` — изменить страну
- `PATCH /api/user/gender` — изменить пол (whitelist: Male, Female, Non-binary, Other, Prefer not to say)
- `GET /api/user/account-info` — получить информацию об аккаунте (IP регистрации, GeoIP через API)
- `POST /api/upload/avatar` — загрузить аватар (с проверкой magic bytes)

### Токены

**Access Token:**
- Время жизни: 15 минут
- Передается в заголовке `Authorization: Bearer <token>`
- При истечении автоматически обновляется через refresh token

**Refresh Token:**
- Время жизни: 30 дней
- Хранится в БД `refresh_tokens`
- Привязан к user_id, IP, user-agent
- Используется для получения нового access token через `/api/auth/refresh`

## Посты

- `GET /api/posts` — лента постов
- `POST /api/posts` — создать пост (опционально: `parent_id`, `is_quick_reply`, `media_files[]`)
- `GET /api/posts/{id}` — получить пост по ID
- `DELETE /api/posts/{id}` — удалить пост
- `GET /api/posts/{id}/replies` — ответы на пост
- `GET /api/posts/{id}/counters` — только счётчики поста (лайки/комментарии/просмотры), лёгкий запрос для polling
- `POST /api/posts/{id}/view` — засчитать просмотр (дедупликация по сессии на 3 часа через Redis, см. [posts_architecture.md](posts_architecture.md)); возвращает `{ counted: true|false }`
- `POST /api/posts/{id}/like` — лайкнуть пост
- `POST /api/posts/{id}/unlike` — убрать лайк
- `GET /api/posts/{id}/comments` — список комментариев
- `POST /api/posts/{id}/comments` — добавить комментарий
- `DELETE /api/comments/{id}` — удалить комментарий
- `POST /api/upload/post-images` — загрузить изображения для поста (до 4 шт, multipart/form-data, проверка magic bytes, возвращает `[{url, thumb, type}]`)
- `POST /api/upload/post-gif` — загрузить GIF для поста (1 файл, multipart/form-data, проверка magic bytes, автоконвертация в MP4 через безопасный proc_open, возвращает `{url, type: 'gif'}`)
- `POST /api/upload/post-video` — загрузить видео для поста (1 файл до 100MB, multipart/form-data, HLS-конвертация через FFmpeg с сохранением PID, возвращает `{url, thumb, type: 'video'}`)
- `DELETE /api/upload/media` — удалить медиафайл с сервера (для cleanup при отмене поста, проверяет владельца, защита от path traversal)
- `DELETE /api/upload/cancel` — отменить загрузку по `tracking_id` (прерывает конвертацию видео через кроссплатформенное убийство процесса по PID)
- `GET /api/temp-uploads` — список временно загруженных медиа текущего пользователя (для восстановления черновика)

### Заголовки для загрузки медиа

**Обязательные заголовки:**
- `Authorization: Bearer <access_token>` — авторизация
- `X-Upload-Context: compose_main` — контекст загрузки (для temp_uploads и лимитов)
- `X-Tracking-ID: <uuid>` — ID для группировки файлов одного поста

**CSRF защита:**
- Все POST/PUT/PATCH/DELETE запросы проверяют `Origin` или `Referer` заголовок
- Разрешенные origin настраиваются в `CsrfMiddleware.php`
- Для запросов с JWT токеном проверка смягчена

### Лимиты загрузки

- **Изображения**: до 4 файлов, максимум 5MB каждый, форматы: JPEG, PNG, WEBP
- **GIF**: 1 файл, максимум 10MB
- **Видео**: 1 файл, максимум 100MB, форматы: MP4, MOV, WEBM, AVI, MPEG
- **Temp uploads лимит**: максимум 4 медиафайла одновременно (защита от переполнения)
- **Rate limiting видео**: не более 2 одновременных конвертаций на пользователя

## Пользователи

- `GET /api/users/{username}` — профиль пользователя (включает `is_following` для авторизованного пользователя)
- `GET /api/users/{username}/posts` — посты пользователя (оригинальные + быстрые ответы)
- `GET /api/users/{username}/replies` — ответы пользователя (только thread replies на чужие твиты)
- `POST /api/users/{username}/follow` — подписаться на пользователя
- `DELETE /api/users/{username}/follow` — отписаться от пользователя
- `GET /api/users/{username}/followers` — список подписчиков (поддерживает `limit`/`offset`)
- `GET /api/users/{username}/following` — список подписок (поддерживает `limit`/`offset`)

## Безопасность

### Rate Limiting
- Защита от IP spoofing через whitelist доверенных прокси
- X-Forwarded-For учитывается только от localhost (127.0.0.1, ::1)
- Валидация IP с фильтрацией приватных адресов

### CSRF Protection
- Middleware проверяет Origin/Referer для всех state-changing запросов
- Whitelist разрешенных доменов в `CsrfMiddleware.php`
- JWT токен в localStorage обеспечивает дополнительную защиту

### File Upload Security
- **Magic bytes проверка**: валидация через `FileValidator` класс
- **MIME type проверка**: через `finfo_file()`
- **Path traversal защита**: все пути проверяются через `realpath()`
- **Централизованная конфигурация**: `FileUploadConfig` для всех типов файлов

### Command Injection Protection
- FFmpeg вызывается через `proc_open()` с массивом аргументов (не строкой)
- Валидация всех входных путей
- Хардкод пути к FFmpeg бинарнику

### Кроссплатформенность
- PID процессов FFmpeg сохраняется в БД (`temp_uploads.process_pid`)
- Убийство процессов через OS-специфичные команды:
  - Windows: `taskkill /F /PID <pid>`
  - Linux: `kill -9 <pid>`

## Ошибки

Все ошибки возвращаются в формате:
```json
{
  "error": "Error message"
}
```

**Коды ответов:**
- `200` — успех
- `201` — создано
- `400` — неверный запрос
- `401` — не авторизован
- `403` — доступ запрещен (CSRF, path traversal)
- `404` — не найдено
- `429` — слишком много запросов (rate limit)
- `500` — внутренняя ошибка сервера

**Обобщенные сообщения об ошибках** (защита от user enumeration):
- `"Registration failed. Please try different credentials"` вместо `"Username already exists"`
- `"Username change failed"` вместо `"Username is already taken"`
