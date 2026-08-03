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
- `POST /api/posts/{id}/view` — увеличить счётчик просмотров
- `POST /api/posts/{id}/like` — лайкнуть пост
- `POST /api/posts/{id}/unlike` — убрать лайк
- `POST /api/posts/{id}/retweet` — ретвитнуть пост
- `POST /api/posts/{id}/unretweet` — отменить ретвит
- `GET /api/posts/{id}/comments` — список комментариев
- `POST /api/posts/{id}/comments` — добавить комментарий
- `DELETE /api/comments/{id}` — удалить комментарий
- `POST /api/upload/post-images` — загрузить изображения для поста (до 4 шт, multipart/form-data, возвращает `[{url, thumb, type}]`)
- `POST /api/upload/post-gif` — загрузить GIF для поста (1 файл, multipart/form-data, автоконвертация в MP4, возвращает `{url, type: 'gif'}`)
- `POST /api/upload/post-video` — загрузить видео для поста (1 файл до 100MB, multipart/form-data, HLS-конвертация через FFmpeg, возвращает `{url, thumb, type: 'video'}`)
- `DELETE /api/media/delete` — удалить медиафайл с сервера (для cleanup при отмене поста)

## Пользователи

- `GET /api/users/{username}` — профиль пользователя
- `GET /api/users/{username}/posts` — посты пользователя (оригинальные + быстрые ответы + ретвиты)
- `GET /api/users/{username}/replies` — ответы пользователя (только thread replies на чужие твиты)
