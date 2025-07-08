---
sidebar_position: 3
---

# API Reference

This document provides detailed information about the OpenHud REST API endpoints and WebSocket events.

## REST API Endpoints

### Players

#### Get Player Profile
```http
GET /api/players/:id
```

**Parameters:**
- `id` (string, required) - Player's Steam ID

**Response:**
```json
{
  "id": "76561198012345678",
  "name": "Player1",
  "level": 10,
  "experience": 1500,
  "stats": {
    "matches": 100,
    "wins": 60,
    "kdRatio": 1.5,
    "headshotPercentage": 45.5
  }
}
```

#### Update Player Profile
```http
PUT /api/players/:id
```

**Parameters:**
- `id` (string, required) - Player's Steam ID

**Request Body:**
```json
{
  "name": "NewName",
  "settings": {
    "overlayPosition": "top-right",
    "audioEnabled": true
  }
}
```

### Matches

#### Get Match History
```http
GET /api/matches
```

**Query Parameters:**
- `playerId` (string, optional) - Filter by player
- `limit` (number, optional) - Number of matches to return
- `offset` (number, optional) - Pagination offset

**Response:**
```json
{
  "matches": [
    {
      "id": "match123",
      "map": "de_dust2",
      "date": "2024-03-15T20:00:00Z",
      "score": {
        "team1": 16,
        "team2": 14
      },
      "playerStats": {
        "kills": 25,
        "deaths": 20,
        "assists": 5
      }
    }
  ],
  "total": 50
}
```

### Settings

#### Get Settings
```http
GET /api/settings
```

**Response:**
```json
{
  "overlays": {
    "hud": {
      "position": "top-right",
      "opacity": 0.8
    },
    "mediaPlayer": {
      "position": "bottom-right",
      "size": "medium"
    }
  },
  "audio": {
    "enabled": true,
    "volume": 0.7
  }
}
```

#### Update Settings
```http
PUT /api/settings
```

**Request Body:**
```json
{
  "overlays": {
    "hud": {
      "position": "top-left"
    }
  }
}
```

## WebSocket Events

### Game State Events

#### `gsi:update`
Emitted when new game state data is received from CS2.

```typescript
interface GSIUpdate {
  player: {
    steamid: string;
    name: string;
    team: string;
    state: {
      health: number;
      armor: number;
      helmet: boolean;
      flashed: number;
      burning: number;
      money: number;
      round_kills: number;
      round_killhs: number;
    };
    weapons: {
      [key: string]: {
        name: string;
        paintkit: string;
        type: string;
        ammo_clip: number;
        ammo_clip_max: number;
        ammo_reserve: number;
      };
    };
    position: string;
    forward: string;
  };
  map: {
    mode: string;
    name: string;
    phase: string;
    round: number;
    team_ct: {
      score: number;
      consecutive_round_losses: number;
      timeouts_remaining: number;
      matches_won_this_series: number;
    };
    team_t: {
      score: number;
      consecutive_round_losses: number;
      timeouts_remaining: number;
      matches_won_this_series: number;
    };
  };
  round: {
    phase: string;
    bomb: string;
    win_team: string;
  };
}
```

#### `task:update`
Emitted when a player's task status changes.

```typescript
interface TaskUpdate {
  taskId: string;
  status: 'pending' | 'in-progress' | 'completed';
  progress: number;
  reward?: {
    type: string;
    amount: number;
  };
}
```

### Media Events

#### `media:new`
Emitted when a new screenshot or clip is captured.

```typescript
interface MediaEvent {
  type: 'screenshot' | 'clip';
  path: string;
  timestamp: number;
  metadata?: {
    duration?: number;
    size?: number;
  };
}
```

### Error Handling

All API endpoints follow this error response format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {} // Optional additional error details
  }
}
```

Common error codes:
- `INVALID_REQUEST`: Invalid request parameters
- `NOT_FOUND`: Requested resource not found
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Permission denied
- `INTERNAL_ERROR`: Server error

## Rate Limiting

API endpoints are rate limited to:
- 100 requests per minute per IP for authenticated endpoints
- 30 requests per minute per IP for unauthenticated endpoints

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1583859600
```

## Authentication

Some endpoints require authentication using a Bearer token:

```http
Authorization: Bearer <token>
```

Tokens can be obtained through the `/api/auth/token` endpoint. 