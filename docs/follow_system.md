# Follow System

## Overview

A full-featured follow system has been implemented, similar to Twitter, with Follow/Unfollow buttons on profile pages and display of follower/following counts.

## Database

The `follows` table already existed in schema.sql:

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

### New methods in User.php

- `follow($followerId, $followingId)` - Follow a user
- `unfollow($followerId, $followingId)` - Unfollow a user
- `isFollowing($followerId, $followingId)` - Check follow status
- `getFollowers($userId, $limit, $offset)` - List of followers
- `getFollowing($userId, $limit, $offset)` - List of who the user follows

### New endpoints in UserController.php

- `POST /api/users/{username}/follow` - Follow a user
- `DELETE /api/users/{username}/follow` - Unfollow a user
- `GET /api/users/{username}/followers` - Get the list of followers
- `GET /api/users/{username}/following` - Get the list of following

### Updated endpoints

- `GET /api/users/{username}` - Now returns `is_following` (true/false) for the authenticated user

## Frontend API (React)

### New methods in usersAPI (src/api/api.js)

```javascript
follow: (username) => api.post(`/users/${username}/follow`)
unfollow: (username) => api.delete(`/users/${username}/follow`)
getFollowers: (username, limit, offset) => api.get(`/users/${username}/followers?limit=${limit}&offset=${offset}`)
getFollowing: (username, limit, offset) => api.get(`/users/${username}/following?limit=${limit}&offset=${offset}`)
```

## UI Components

### Profile page (Profile.jsx)

Updated to display:

1. **Follow/Unfollow button**
   - Shown on other users' profiles (not on your own)
   - Text changes depending on follow status
   - Hovering over "Following" changes it to "Unfollow" with red styling
   - Automatically updates the follower count on click

2. **Follow counters**
   - `following_count` - number of accounts the user follows
   - `followers_count` - number of followers
   - Automatically updated on follow/unfollow

### Styles (Profile.css)

Styles added for the follow button:

- `.profile-follow-btn` - main Follow button (black background, white text)
- `.profile-follow-btn.following` - "Following" state (transparent background, outline)
- `.profile-follow-btn.following:hover` - shows red color for Unfollow on hover

## Translations

### English (en.json)
```json
"follow": "Follow",
"unfollow": "Unfollow",
"follow_error": "Failed to update follow status"
```

### Russian (ru.json)
```json
"follow": "Подписаться",
"unfollow": "Отписаться",
"follow_error": "Ошибка при изменении подписки"
```

## Security

1. **Protection against self-following** - checked in `User::follow()`
2. **User existence check** - validated before creating a follow relationship
3. **Follow uniqueness** - `UNIQUE(follower_id, following_id)` constraint in the DB
4. **Cascading delete** - deleting a user automatically removes related follow records
5. **Authorization** - all endpoints require a JWT token via `AuthMiddleware::requireAuth()`

## How it works

### Follow
1. The user clicks "Follow" on a profile page
2. The frontend sends `POST /api/users/{username}/follow`
3. The backend checks authorization and looks up the target user
4. A record is created in the `follows` table
5. The frontend updates state: `isFollowing = true`, `followers_count + 1`

### Unfollow
1. The user clicks "Unfollow" (or hovers over "Following")
2. The frontend sends `DELETE /api/users/{username}/follow`
3. The backend removes the record from the `follows` table
4. The frontend updates state: `isFollowing = false`, `followers_count - 1`

## Future improvements

Follower/following list pages have already been implemented, see [follow_list_page.md](follow_list_page.md).

- [ ] Filter the feed by follows (show only posts from accounts you follow)
- [ ] Notifications for new followers
- [ ] Mutual follows
- [ ] "Who to follow" suggestions
