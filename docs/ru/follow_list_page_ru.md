# Страница просмотра подписчиков и подписок

## Обзор

Реализована страница для просмотра списков подписчиков и подписок пользователя с табами, infinite scroll и возможностью подписки/отписки прямо из списка.

## Маршрутизация

### Новый роут
- `GET /profile/:username/:tab` - страница списка подписчиков/подписок
  - `:username` - имя пользователя
  - `:tab` - `followers` или `following`

### Примеры URL
- `/profile/john/followers` - подписчики пользователя john
- `/profile/john/following` - подписки пользователя john

## Компоненты

### 1. FollowList.jsx (страница)

Основная страница со списками подписчиков/подписок.

**Возможности:**
- Табы для переключения между Followers и Following
- Кнопка "Назад" для возврата к профилю
- Infinite scroll с загрузкой по частям:
  - Первая загрузка: 40 пользователей
  - Последующие: по 30 пользователей при скролле
- Intersection Observer для автоматической подгрузки
- Обработка состояний: loading, error, empty

**Структура:**
```jsx
<FollowList>
  - Header (имя пользователя, кнопка назад)
  - Tabs (Followers / Following)
  - Список UserCard компонентов
  - Loader для подгрузки
</FollowList>
```

### 2. UserCard.jsx (компонент)

Карточка пользователя в списке.

**Содержимое:**
- Аватар (кликабельный, ведет на профиль)
- Имя и username (кликабельные)
- Bio (если есть, обрезается до 2 строк)
- Кнопка Follow/Unfollow (если не свой профиль)

**Возможности:**
- Hover эффекты на всей карточке
- Кнопка Follow меняется на Unfollow с красным оттенком при наведении
- Callback `onFollowChange` для обновления состояния в родителе

## Логика Infinite Scroll

```javascript
// Первая загрузка при открытии страницы
loadUsers(true) -> limit: 40, offset: 0

// При скролле до конца
IntersectionObserver triggers -> loadUsers(false) -> limit: 30, offset: 40

// Следующая загрузка
loadUsers(false) -> limit: 30, offset: 70

// Прекращение загрузки когда получено меньше чем запрошено
if (newUsers.length < limit) {
  setHasMore(false);
}
```

## Обновления в существующих компонентах

### Profile.jsx

Счетчики подписчиков теперь кликабельные:

```jsx
<Link to={`/profile/${username}/following`}>
  <b>{following_count}</b> читаемых
</Link>
<Link to={`/profile/${username}/followers`}>
  <b>{followers_count}</b> читателей
</Link>
```

### App.jsx

Добавлен новый роут:

```jsx
<Route path="/profile/:username/:tab" element={
  <PrivateRoute>
    <FollowList />
  </PrivateRoute>
} />
```

## Стили

### UserCard.css

- `.user-card` - контейнер карточки с hover эффектом
- `.user-card-avatar` - круглый аватар 48x48px
- `.user-card-info` - информация о пользователе
- `.user-card-follow-btn` - кнопка подписки со всеми состояниями
- Адаптивность для мобильных устройств

### FollowList.css

- `.follow-list-tabs` - табы с индикатором активного
- `.back-button` - круглая кнопка возврата
- `.load-more-trigger` - триггер для infinite scroll
- Активный таб с подчеркиванием снизу (синяя линия)

### Profile.css (обновлено)

- `.profile-stat-link` - кликабельные счетчики с hover эффектом

## Переводы

### Английский (en.json)
```json
{
  "follow_list": {
    "loading": "Loading...",
    "loading_more": "Loading more...",
    "error": "Error loading users",
    "followers": "Followers",
    "following": "Following",
    "no_followers": "No followers yet",
    "no_following": "Not following anyone yet"
  }
}
```

### Русский (ru.json)
```json
{
  "follow_list": {
    "loading": "Загрузка...",
    "loading_more": "Загружаем ещё...",
    "error": "Ошибка при загрузке пользователей",
    "followers": "Читатели",
    "following": "Читаемые",
    "no_followers": "Пока нет читателей",
    "no_following": "Пока не читает никого"
  }
}
```

## Backend API (используется существующий)

- `GET /api/users/:username/followers?limit=40&offset=0`
- `GET /api/users/:username/following?limit=30&offset=40`
- `POST /api/users/:username/follow`
- `DELETE /api/users/:username/follow`

## UX особенности

1. **Плавная загрузка** - loader появляется внизу списка при подгрузке
2. **Оптимистичные обновления** - UI обновляется сразу при клике на Follow
3. **Состояние подписки** - кнопка отражает текущее состояние
4. **Навигация** - легко вернуться к профилю или перейти на профиль из карточки
5. **Responsive** - адаптируется под мобильные устройства

## Производительность

- **Virtualization не используется** - для списков до нескольких сотен пользователей нативный скролл работает хорошо
- **Intersection Observer** - нативный API браузера, эффективный
- **Мемоизация не требуется** - компоненты легковесные
- **Ленивая загрузка** - загружаются только видимые пользователи + небольшой буфер