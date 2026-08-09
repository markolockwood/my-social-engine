# User Hover Card

## Overview

A user hover card has been implemented, shown when hovering over a name anywhere on the site, similar to Twitter. The card shows basic user information and lets you follow/unfollow without navigating to the profile.

## Components

### 1. UserHoverCard.jsx

The hover card itself, with the user's data.

**Content:**
- Avatar (64x64px, clickable)
- Follow/Unfollow button (if not your own profile)
- User's name (display_name, large font)
- Username (@username)
- Bio (if present)
- Follower/following counters (clickable)

**Features:**
- Loads user data via the API
- Shows a loader while loading
- Follow/Unfollow button works and updates counters
- All links are clickable and lead to the corresponding pages
- Absolutely positioned using passed-in coordinates

### 2. UserLink.jsx

A wrapper around a regular `Link` that activates the hover card.

**How it works:**
- On hover: 500ms delay, then the card is shown
- On mouse leave: 300ms delay, then the card is hidden
- If the cursor moves onto the card itself, it isn't hidden
- When the cursor leaves the card, it's hidden immediately

**Positioning:**
- The card appears below the element with a 10px offset
- Coordinates are calculated relative to the viewport
- Page scroll is accounted for

**Timers:**
- `showTimeoutRef` - show timer (500ms)
- `hideTimeoutRef` - hide timer (300ms)
- `isOverCardRef` - flag indicating the cursor is over the card

### 3. Updated components

**Post.jsx:**
- The username is wrapped in `UserLink`
- Hovering over the name shows the hover card

**UserCard.jsx:**
- The username is wrapped in `UserLink`
- Hovering over the name shows the hover card

## Styles (UserHoverCard.css)

### Main container
```css
.user-hover-card {
  position: absolute;
  width: 300px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  padding: 16px;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}
```

### Appearance animation
- Fade in with a slight upward movement
- 0.2s duration

### Responsiveness
- Hidden on mobile devices (<768px)
- Hover effects aren't needed on touch devices

## API requests

Showing the card triggers a request:
```javascript
GET /api/users/:username
```

Returns:
```json
{
  "user": {
    "id": 1,
    "username": "john",
    "display_name": "John Doe",
    "avatar_url": "/uploads/avatars/...",
    "bio": "Software Developer",
    "following_count": 150,
    "followers_count": 320,
    "is_following": true
  }
}
```

## Usage

### Wrap any link to a profile

**Before:**
```jsx
<Link to={`/profile/${username}`} className="user-name">
  {displayName}
</Link>
```

**After:**
```jsx
<UserLink username={username} className="user-name">
  {displayName}
</UserLink>
```

### UserLink props

- `username` (required) - the username to load data for
- `children` - the link's content (usually display_name)
- `className` - CSS classes for the link
- `to` - custom path (defaults to `/profile/:username`)
- `...props` - any other props passed to Link

## UX details

### Delays
- **500ms** before showing - prevents accidental triggering
- **300ms** before hiding - gives time to move onto the card

### Interactivity
- The card itself is interactive - you can hover over it
- The Follow/Unfollow button works without closing the card
- All links inside the card are clickable

### Performance
- Data is loaded only when the card is shown
- No preloading on a simple hover
- The card is unmounted when hidden (no memory leaks)

## Possible improvements

- [ ] Cache user data (avoid repeat requests)
- [ ] Preload data on hover (start loading before the 500ms delay elapses)
- [ ] Smart positioning (if the card would overflow the screen edges)
