# MyTwit - Социальная сеть

Полнофункциональная социальная сеть в стиле Twitter с использованием React, PHP 8.0 и PostgreSQL.

## Возможности

- ✅ Регистрация и авторизация пользователей
- ✅ Создание постов (до 280 символов)
- ✅ Лента новостей
- ✅ Лайки постов
- ✅ Профили пользователей
- ✅ Удаление собственных постов
- ✅ JWT аутентификация
- ✅ SPA без перезагрузки страницы
- ✅ **Адаптивный дизайн** (десктоп, планшет, мобильный)
- ✅ **Тёмная тема** с сохранением в БД
- ✅ **Мультиязычность** (EN, RU) с редактируемыми переводами

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
- PHP 8.0
- PostgreSQL
- JWT для аутентификации
- REST API

## Установка

### 1. Установка зависимостей Node.js

```bash
npm install
```

### 2. Настройка базы данных PostgreSQL

Создайте базу данных и выполните SQL скрипты:

```bash
psql -U postgres
CREATE DATABASE mytwit;
\c mytwit
\i database/schema.sql
\i database/migrations/001_add_theme_preference.sql
\i database/migrations/002_add_language.sql
```

Или можете выполнить SQL из файлов вручную в pgAdmin.

### 3. Настройка конфигурации

Отредактируйте файл `config/config.php`:

```php
return [
    'database' => [
        'host' => 'localhost',
        'port' => '5432',
        'dbname' => 'mytwit',
        'username' => 'postgres',
        'password' => 'ваш_пароль',  // Измените на ваш пароль
        'charset' => 'utf8'
    ],
    'jwt' => [
        'secret' => 'измените_этот_секретный_ключ',  // Измените в продакшене
        'expiration' => 86400 * 7 // 7 дней
    ]
];
```

### 4. Настройка веб-сервера

#### Apache (.htaccess уже настроен)

Убедитесь, что mod_rewrite включен:

```apache
a2enmod rewrite
service apache2 restart
```

#### Nginx

Добавьте в конфигурацию:

```nginx
location /api/ {
    try_files $uri $uri/ /api/index.php?$query_string;
}
```

### 5. Запуск приложения

#### Режим разработки

```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:3000

#### Режим продакшен

```bash
npm run build
```

Соберёт приложение в папку `dist/`. Настройте веб-сервер на использование этой папки.

## Структура проекта

```
mytwit.com/
├── api/                      # Backend PHP API
│   ├── classes/
│   │   ├── Database.php      # Класс подключения к БД
│   │   ├── User.php          # Модель пользователя
│   │   ├── Post.php          # Модель постов
│   │   └── JWT.php           # JWT аутентификация
│   ├── index.php             # Главный файл API
│   └── .htaccess             # Настройки Apache
├── config/
│   └── config.php            # Конфигурация приложения
├── database/
│   ├── schema.sql            # SQL схема базы данных
│   └── migrations/           # Миграции БД
│       ├── 001_add_theme_preference.sql
│       └── 002_add_language.sql
├── src/                      # Frontend React
│   ├── api/
│   │   └── api.js            # API клиент
│   ├── components/
│   │   ├── ComposePost.jsx   # Форма создания поста
│   │   ├── Post.jsx          # Компонент поста
│   │   ├── Sidebar.jsx       # Боковая панель навигации
│   │   └── MobileNav.jsx     # Нижняя навигация для мобильных
│   ├── context/
│   │   └── AuthContext.jsx   # Контекст аутентификации + i18n
│   ├── i18n/                 # Переводы интерфейса
│   │   ├── en.json           # Английский (редактируемый)
│   │   └── ru.json           # Русский (редактируемый)
│   ├── pages/
│   │   ├── Home.jsx          # Главная страница
│   │   ├── Login.jsx         # Страница входа
│   │   ├── Register.jsx      # Страница регистрации
│   │   └── Profile.jsx       # Страница профиля
│   ├── styles/               # CSS стили (CSS-переменные для тем)
│   ├── App.jsx               # Главный компонент
│   └── main.jsx              # Точка входа
├── package.json
├── vite.config.js
└── README.md
```

## API Endpoints

### Аутентификация

- `POST /api/auth/register` - Регистрация пользователя
- `POST /api/auth/login` - Вход в систему
- `GET /api/auth/me` - Получить текущего пользователя

### Посты

- `GET /api/posts` - Получить ленту постов
- `POST /api/posts` - Создать пост
- `GET /api/posts/{id}` - Получить пост по ID
- `DELETE /api/posts/{id}` - Удалить пост
- `POST /api/posts/{id}/like` - Лайкнуть пост
- `POST /api/posts/{id}/unlike` - Убрать лайк

### Пользователи

- `GET /api/users/{username}` - Получить профиль пользователя
- `GET /api/users/{username}/posts` - Получить посты пользователя

## Использование

1. Откройте приложение в браузере
2. Зарегистрируйтесь с помощью формы регистрации
3. После успешной регистрации вы будете автоматически авторизованы
4. Создавайте посты, лайкайте, просматривайте профили

## Следующие шаги (TODO)

- [ ] Прикрепление медиафайлов к постам
- [ ] Комментарии к постам
- [ ] Система подписок (follow/unfollow)
- [ ] Ретвиты
- [ ] Уведомления
- [ ] Личные сообщения
- [ ] Поиск пользователей и постов
- [ ] Редактирование профиля
- [ ] Хэштеги и упоминания

## Лицензия

Все права защищены.