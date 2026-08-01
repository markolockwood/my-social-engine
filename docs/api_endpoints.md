# API Endpoints

## Аутентификация

- `POST /api/auth/register` — регистрация пользователя
- `POST /api/auth/login` — вход в систему
- `GET /api/auth/me` — получить текущего пользователя
- `PATCH /api/user/theme` — изменить тему (light/dark)
- `PATCH /api/user/language` — изменить язык (en/ru)
- `PATCH /api/user/profile` — обновить профиль
- `POST /api/upload/avatar` — загрузить аватар

## Посты

- `GET /api/posts` — лента постов
- `POST /api/posts` — создать пост (опционально: `parent_id`, `is_quick_reply`)
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

## Пользователи

- `GET /api/users/{username}` — профиль пользователя
- `GET /api/users/{username}/posts` — посты пользователя (оригинальные + быстрые ответы + ретвиты)
- `GET /api/users/{username}/replies` — ответы пользователя (только thread replies на чужие твиты)
