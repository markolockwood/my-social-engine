# Followers and Following List Page

## Overview

A page has been implemented for viewing a user's followers and following lists, with tabs, infinite scroll, and the ability to follow/unfollow directly from the list.

## Routing

### New route
- `GET /profile/:username/:tab` - followers/following list page
  - `:username` - the username
  - `:tab` - `followers` or `following`

### Example URLs
- `/profile/john/followers` - john's followers
- `/profile/john/following` - who john follows

## Components

### 1. FollowList.jsx (page)

The main page with followers/following lists.

**Features:**
- Tabs to switch between Followers and Following
- "Back" button to return to the profile
- Infinite scroll loaded in chunks:
  - Initial load: 40 users
  - Subsequent loads: 30 users on scroll
- Intersection Observer for automatic loading
- Handles loading, error, and empty states

**Structure:**
```jsx
<FollowList>
  - Header (username, back button)
  - Tabs (Followers / Following)
  - List of UserCard components
  - Loader for pagination
</FollowList>
```

### 2. UserCard.jsx (component)

A user card in the list.

**Content:**
- Avatar (clickable, links to profile)
- Name and username (clickable)
- Bio (if present, truncated to 2 lines)
- Follow/Unfollow button (if not your own profile)

**Features:**
- Hover effects on the whole card
- Follow button turns into Unfollow with a red tint on hover
- `onFollowChange` callback to update state in the parent

## Infinite Scroll Logic

```javascript
// Initial load when the page opens
loadUsers(true) -> limit: 40, offset: 0

// When scrolling to the end
IntersectionObserver triggers -> loadUsers(false) -> limit: 30, offset: 40

// Next load
loadUsers(false) -> limit: 30, offset: 70

// Stop loading when fewer results are returned than requested
if (newUsers.length < limit) {
  setHasMore(false);
}
```

## Updates to existing components

### Profile.jsx

Follow counters are now clickable:

```jsx
<Link to={`/profile/${username}/following`}>
  <b>{following_count}</b> Following
</Link>
<Link to={`/profile/${username}/followers`}>
  <b>{followers_count}</b> Followers
</Link>
```

### App.jsx

A new route was added:

```jsx
<Route path="/profile/:username/:tab" element={
  <PrivateRoute>
    <FollowList />
  </PrivateRoute>
} />
```

## Styles

### UserCard.css

- `.user-card` - card container with hover effect
- `.user-card-avatar` - round 48x48px avatar
- `.user-card-info` - user information
- `.user-card-follow-btn` - follow button with all states
- Responsive for mobile devices

### FollowList.css

- `.follow-list-tabs` - tabs with an active indicator
- `.back-button` - round back button
- `.load-more-trigger` - infinite scroll trigger
- Active tab underlined (blue line)

### Profile.css (updated)

- `.profile-stat-link` - clickable counters with hover effect

## Translations

### English (en.json)
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

### Russian (ru.json)
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

## Backend API (existing, reused)

- `GET /api/users/:username/followers?limit=40&offset=0`
- `GET /api/users/:username/following?limit=30&offset=40`
- `POST /api/users/:username/follow`
- `DELETE /api/users/:username/follow`

## UX details

1. **Smooth loading** - a loader appears at the bottom of the list while paginating
2. **Optimistic updates** - the UI updates immediately on Follow click
3. **Follow state** - the button reflects the current state
4. **Navigation** - easy to go back to the profile or jump to a profile from a card
5. **Responsive** - adapts to mobile devices

## Performance

- **No virtualization** - native scrolling works fine for lists of up to a few hundred users
- **Intersection Observer** - a native, efficient browser API
- **No memoization needed** - components are lightweight
- **Lazy loading** - only visible users plus a small buffer are loaded
