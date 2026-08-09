# Инструкция по применению миграции 012

Миграция добавляет новые поля в таблицу `users` для раздела Account Information:
- `verified` — статус верификации (boolean)
- `registration_ip` — IP-адрес регистрации (varchar(45))
- `country` — код страны пользователя (varchar(2))
- `gender` — пол пользователя (varchar(16))

## Применение миграции

### Через psql в WSL:

```bash
# Войти в PostgreSQL
psql -U postgres -d mytwit

# Применить миграцию
\i /www/wwwroot/mytwit.com/database/migrations/012_add_account_info_fields.sql

# Проверить, что поля добавлены
\d users
```

### Или одной командой:

```bash
psql -U postgres -d mytwit -f /www/wwwroot/mytwit.com/database/migrations/012_add_account_info_fields.sql
```

### Или через DBeaver / pgAdmin:

1. Открыть файл `database/migrations/012_add_account_info_fields.sql`
2. Скопировать содержимое
3. Выполнить SQL в интерфейсе DBeaver/pgAdmin

## Проверка

После применения миграции проверить, что поля добавлены:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('verified', 'registration_ip', 'country', 'gender');
```

## Откат миграции (если нужно)

```sql
ALTER TABLE users DROP COLUMN IF EXISTS verified;
ALTER TABLE users DROP COLUMN IF EXISTS registration_ip;
ALTER TABLE users DROP COLUMN IF EXISTS country;
ALTER TABLE users DROP COLUMN IF EXISTS gender;
```
