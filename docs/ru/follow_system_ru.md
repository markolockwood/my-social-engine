# Система подписок (Follow System)

## Обзор

Реализована полноценная система подписок, аналогичная Twitter, с кнопками Follow/Unfollow на страницах профилей и отображением счетчиков подписчиков и подписок.

## База данных

Таблица `follows` уже существовала в schema.sql:

```sql
CREATE TABLE IF NOT EXISTS follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);
```

## Backend API (PHP)

### Новые методы в User.php

- `follow($followerId, $followingId)` - Подписка на пользователя
- `unfollow($followerId, $followingId)` - Отписка от пользователя
- `isFollowing($followerId, $followingId)` - Проверка статуса подписки
- `getFollowers($userId, $limit, $offset)` - Список подписчиков
- `getFollowing($userId, $limit, $offset)` - Список подписок

### Новые endpoints в UserController.php

- `POST /api/users/{username}/follow` - Подписаться на пользователя
- `DELETE /api/users/{username}/follow` - Отписаться от пользователя
- `GET /api/users/{username}/followers` - Получить список подписчиков
- `GET /api/users/{username}/following` - Получить список подписок

### Обновленные endpoints

- `GET /api/users/{username}` - Теперь возвращает `is_following` (true/false) для авторизованного пользователя

## Frontend API (React)

### Новые методы в usersAPI (src/api/api.js)

```javascript
follow: (username) => api.post(`/users/${username}/follow`)
unfollow: (username) => api.delete(`/users/${username}/follow`)
getFollowers: (username, limit, offset) => api.get(`/users/${username}/followers?limit=${limit}&offset=${offset}`)
getFollowing: (username, limit, offset) => api.get(`/users/${username}/following?limit=${limit}&offset=${offset}`)
```

## UI компоненты

### Страница профиля (Profile.jsx)

Обновлена для отображения:

1. **Кнопка Follow/Unfollow**
   - Показывается для чужих профилей (не для своего)
   - Меняет текст в зависимости от статуса подписки
   - При наведении на "Following" меняется на "Unfollow" с красным цветом
   - Автоматически обновляет счетчик подписчиков при клике

2. **Счетчики подписок**
   - `following_count` - количество подписок пользователя
   - `followers_count` - количество подписчиков
   - Автоматически обновляются при follow/unfollow

### Стили (Profile.css)

Добавлены стили для кнопки подписки:

- `.profile-follow-btn` - основная кнопка Follow (черный фон, белый текст)
- `.profile-follow-btn.following` - состояние "Подписан" (прозрачный фон, обводка)
- `.profile-follow-btn.following:hover` - при наведении показывает красный цвет для Unfollow

## Переводы

### Английский (en.json)
```json
"follow": "Follow",
"unfollow": "Unfollow",
"follow_error": "Failed to update follow status"
```

### Русский (ru.json)
```json
"follow": "Подписаться",
"unfollow": "Отписаться",
"follow_error": "Ошибка при изменении подписки"
```

## Безопасность

1. **Защита от подписки на самого себя** - проверка в `User::follow()`
2. **Проверка существования пользователей** - валидация перед созданием подписки
3. **Уникальность подписок** - constraint `UNIQUE(follower_id, following_id)` в БД
4. **Каскадное удаление** - при удалении пользователя автоматически удаляются связанные подписки
5. **Авторизация** - все endpoints требуют JWT токен через `AuthMiddleware::requireAuth()`

## Логика работы

### Подписка (Follow)
1. Пользователь нажимает "Follow" на странице профиля
2. Frontend отправляет `POST /api/users/{username}/follow`
3. Backend проверяет авторизацию, находит целевого пользователя
4. Создается запись в таблице `follows`
5. Frontend обновляет состояние: `isFollowing = true`, `followers_count + 1`

### Отписка (Unfollow)
1. Пользователь нажимает "Unfollow" (или наводит на "Following")
2. Frontend отправляет `DELETE /api/users/{username}/follow`
3. Backend удаляет запись из таблицы `follows`
4. Frontend обновляет состояние: `isFollowing = false`, `followers_count - 1`

## Будущие улучшения

Страницы списков подписчиков и подписок уже реализованы, см. [follow_list_page_ru.md](follow_list_page_ru.md).

- [ ] Фильтрация ленты по подпискам (показывать только посты от тех, на кого подписан)
- [ ] Уведомления о новых подписчиках
- [ ] Взаимные подписки (mutual follows)
- [ ] Предложения "Кого читать"
