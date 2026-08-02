# API Endpoints

Base URL: `/api`

Все защищённые endpoints требуют заголовка:
```
Authorization: Bearer <token>
```

---

## Авторизация

### POST /auth/register
Регистрация нового пользователя.

**Rate limit:** 3 запроса за 10 минут с одного IP.

**Тело запроса:**
```json
{
  "username": "string (3-50 символов)",
  "email": "string (valid email)",
  "password": "string (мин. 6 символов)",
  "displayName": "string"
}
```

**Ответ 201:**
```json
{
  "token": "string (JWT)",
  "user": { ...userData }
}
```

---

### POST /auth/login
Вход по логину или email.

**Rate limit:** 5 запросов за 5 минут с одного IP.

**Тело запроса:**
```json
{
  "username": "string (username или email)",
  "password": "string"
}
```

**Ответ 200:**
```json
{
  "token": "string (JWT)",
  "user": { ...userData }
}
```

---

### GET /auth/me
Получить данные текущего пользователя. 🔒

**Ответ 200:**
```json
{
  "user": { ...userData }
}
```

---

## Посты

### GET /posts
Лента постов с пагинацией.

**Query параметры:**
| Параметр | Тип    | По умолчанию | Описание         |
|----------|--------|--------------|------------------|
| limit    | int    | 20           | Количество постов |
| offset   | int    | 0            | Смещение         |

**Ответ 200:**
```json
{
  "posts": [
    {
      "id": 1,
      "content": "string",
      "user_id": 1,
      "username": "string",
      "display_name": "string",
      "avatar_url": "string|null",
      "parent_id": "int|null",
      "is_quick_reply": false,
      "likes_count": 0,
      "comments_count": 0,
      "views_count": 0,
      "is_liked": false,
      "media": "[{url, thumb, type, order}]",
      "created_at": "timestamp"
    }
  ]
}
```

---

### POST /posts
Создание нового поста или ответа. 🔒

**Rate limit:** 20 постов за 10 минут на пользователя.

**Тело запроса:**
```json
{
  "content": "string (макс. 280 символов)",
  "media_files": [
    { "url": "/uploads/posts/...", "thumb": "/uploads/posts/thumbs/...", "type": "image|gif" }
  ],
  "parent_id": "int|null",
  "is_quick_reply": "bool (default: false)"
}
```

**Ответ 201:**
```json
{
  "post": { ...postData }
}
```

---

### GET /posts/{id}
Получить пост по ID.

**Ответ 200:**
```json
{
  "post": { ...postData }
}
```

---

### DELETE /posts/{id}
Удалить пост. 🔒 Только автор.

Удаляет пост, все медиафайлы и миниатюры с диска.

**Ответ 200:**
```json
{
  "message": "Post deleted successfully"
}
```

---

### POST /posts/{id}/like
Лайкнуть пост. 🔒

**Ответ 200:**
```json
{
  "message": "Post liked successfully"
}
```

---

### POST /posts/{id}/unlike
Убрать лайк. 🔒

**Ответ 200:**
```json
{
  "message": "Post unliked successfully"
}
```

---

### GET /posts/{id}/replies
Получить ответы на пост.

**Ответ 200:**
```json
{
  "posts": [ ...postData ]
}
```

---

### POST /posts/{id}/view
Увеличить счётчик просмотров. Вызывается при открытии детальной страницы поста.

**Ответ 200:**
```json
{
  "message": "View counted"
}
```

---

### GET /posts/{id}/comments
Получить комментарии к посту.

**Ответ 200:**
```json
{
  "comments": [ ...commentData ]
}
```

---

### POST /posts/{id}/comments
Добавить комментарий к посту. 🔒

**Тело запроса:**
```json
{
  "content": "string"
}
```

**Ответ 201:**
```json
{
  "comment": { ...commentData }
}
```

---

### DELETE /comments/{id}
Удалить комментарий. 🔒 Только автор.

**Ответ 200:**
```json
{
  "message": "Comment deleted successfully"
}
```

---

## Загрузка медиа

### POST /upload/post-images
Загрузить изображения для поста (до 4 штук). 🔒

**Тип запроса:** `multipart/form-data`

**Поля:**
| Поле     | Тип   | Описание                               |
|----------|-------|----------------------------------------|
| images[] | file  | Изображения (JPEG, PNG, WEBP, макс. 5MB) |

**Валидация:**
- Тип файла проверяется через `finfo_file()` (не через `$_FILES['type']`)
- Допустимые расширения: `.jpg`, `.jpeg`, `.png`, `.webp`
- Автоматически создаётся миниатюра 600px в `/uploads/posts/thumbs/`

**Ответ 201:**
```json
{
  "urls": [
    { "url": "/uploads/posts/post_img_xxx.jpg", "thumb": "/uploads/posts/thumbs/post_img_xxx.jpg" }
  ]
}
```

---

### POST /upload/post-gif
Загрузить GIF для поста (один файл). 🔒

**Тип запроса:** `multipart/form-data`

**Поля:**
| Поле | Тип  | Описание               |
|------|------|------------------------|
| gif  | file | GIF файл (макс. 10MB)  |

**Валидация:**
- Тип файла проверяется через `finfo_file()`
- Если доступен FFmpeg — GIF автоматически конвертируется в MP4 (экономия ~96% размера)
- Оригинальный GIF удаляется после успешной конвертации
- Если конвертация не удалась — сохраняется оригинальный GIF

**Ответ 201:**
```json
{
  "url": "/uploads/gifs/post_gif_xxx.mp4"
}
```

---

### POST /upload/avatar
Загрузить аватар пользователя. 🔒

**Тип запроса:** `multipart/form-data`

**Поля:**
| Поле   | Тип  | Описание                                   |
|--------|------|--------------------------------------------|
| avatar | file | Изображение (JPEG, PNG, GIF, WEBP, макс. 5MB) |

**Валидация:**
- Тип файла проверяется через `finfo_file()`
- Допустимые расширения: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

**Ответ 201:**
```json
{
  "url": "/uploads/avatars/avatar_1_xxx.jpg"
}
```

---

## Пользователи

### GET /users/{username}
Получить профиль пользователя.

**Ответ 200:**
```json
{
  "user": {
    "id": 1,
    "username": "string",
    "display_name": "string",
    "bio": "string|null",
    "avatar_url": "string|null",
    "location": "string|null",
    "birth_date": "string|null",
    "created_at": "timestamp",
    "followers_count": 0,
    "following_count": 0
  }
}
```

---

### GET /users/{username}/posts
Получить посты пользователя для таба "Посты".

**Query параметры:**
| Параметр | Тип | По умолчанию | Описание          |
|----------|-----|--------------|-------------------|
| limit    | int | 20           | Количество постов |
| offset   | int | 0            | Смещение          |

**Ответ 200:**
```json
{
  "posts": [ ...postData ]
}
```

---

### GET /users/{username}/replies
Получить ответы пользователя на чужие твиты для таба "Ответы".

Возвращает пары `[reply, parent]` для отображения контекста треда.

**Ответ 200:**
```json
{
  "replies": [
    {
      "reply": { ...postData },
      "parent": { ...postData }
    }
  ]
}
```

---

### PATCH /user/theme
Обновить тему оформления. 🔒

**Тело запроса:**
```json
{
  "theme": "light|dark"
}
```

**Ответ 200:**
```json
{
  "theme": "dark"
}
```

---

### PATCH /user/language
Обновить язык интерфейса. 🔒

**Тело запроса:**
```json
{
  "language": "en|ru"
}
```

**Ответ 200:**
```json
{
  "language": "ru"
}
```

---

### PATCH /user/profile
Обновить данные профиля. 🔒

**Тело запроса** (все поля опциональны):
```json
{
  "display_name": "string (1-100 символов)",
  "bio": "string|null",
  "location": "string|null",
  "birth_date": "string|null",
  "avatar_url": "string|null (/uploads/avatars/ только)"
}
```

**Валидация:**
- `avatar_url` принимается только из `/uploads/avatars/` (защита от SSRF)

**Ответ 200:**
```json
{
  "user": { ...userData }
}
```

---

## Коды ошибок

| Код | Описание                               |
|-----|----------------------------------------|
| 400 | Неверный запрос (ошибки валидации)     |
| 401 | Не авторизован (нет/невалидный токен)  |
| 403 | Нет прав доступа                       |
| 404 | Ресурс не найден                       |
| 429 | Превышен лимит запросов                |
| 500 | Внутренняя ошибка сервера              |

**Формат ошибки:**
```json
{
  "error": "Описание ошибки"
}
```

**Ответ 429 (Rate Limit):**
```json
{
  "error": "Too many requests. Please try again later.",
  "retry_after": 300
}
```

---

## Структура медиа объекта

```json
{
  "url": "/uploads/posts/post_img_xxx.jpg",
  "thumb": "/uploads/posts/thumbs/post_img_xxx.jpg",
  "type": "image|gif|video",
  "order": 0
}
```

- `url` — оригинальный файл (используется в лайтбоксе)
- `thumb` — миниатюра 600px (используется в ленте, может быть `null` для GIF)
- `type` — тип медиа
- `order` — порядок отображения в сетке (0-3)
