# API Endpoints

## Аутентификация

- `POST /api/auth/register` — регистрация пользователя
- `POST /api/auth/login` — вход в систему
- `GET /api/auth/me` — получить текущего пользователя
- `PATCH /api/user/theme` — изменить тему (light/dark)
- `PATCH /api/user/language` — изменить язык (en/ru)
- `PATCH /api/user/profile` — обновить профиль
- `PATCH /api/user/video-volume` — сохранить уровень громкости видео (0.0-1.0)
- `POST /api/upload/avatar` — загрузить аватар

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
- `POST /api/upload/post-images` — загрузить изображения для поста (до 4 шт, multipart/form-data, возвращает `[{url, thumb, type}]`)
- `POST /api/upload/post-gif` — загрузить GIF для поста (1 файл, multipart/form-data, автоконвертация в MP4, возвращает `{url, type: 'gif'}`)
- `POST /api/upload/post-video` — загрузить видео для поста (1 файл до 100MB, multipart/form-data, HLS-конвертация через FFmpeg, возвращает `{url, thumb, type: 'video'}`)
- `DELETE /api/upload/media` — удалить медиафайл с сервера (для cleanup при отмене поста, проверяет владельца)
- `DELETE /api/upload/cancel` — отменить загрузку по `tracking_id` (например, прервать конвертацию видео)
- `GET /api/temp-uploads` — список временно загруженных медиа текущего пользователя (для восстановления черновика)

## Пользователи

- `GET /api/users/{username}` — профиль пользователя (включает `is_following` для авторизованного пользователя)
- `GET /api/users/{username}/posts` — посты пользователя (оригинальные + быстрые ответы)
- `GET /api/users/{username}/replies` — ответы пользователя (только thread replies на чужие твиты)
- `POST /api/users/{username}/follow` — подписаться на пользователя
- `DELETE /api/users/{username}/follow` — отписаться от пользователя
- `GET /api/users/{username}/followers` — список подписчиков (поддерживает `limit`/`offset`)
- `GET /api/users/{username}/following` — список подписок (поддерживает `limit`/`offset`)
