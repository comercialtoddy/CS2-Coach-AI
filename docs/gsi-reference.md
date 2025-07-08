---
sidebar_position: 6
---

# Game State Integration (GSI) Reference

This document details the Game State Integration (GSI) data structure used by OpenHud to receive real-time game state updates from CS2.

## Configuration

OpenHud uses a GSI configuration file that must be placed in your CS2 configuration directory:

```cfg
"OpenHUD by JTMythic"
{
    "uri"       "http://localhost:1349/gsi"
    "timeout"       "0.1"
    "buffer"        "0"
    "throttle"      "0"
    "heartbeat"     "0.01"
    "data"
    {
        "provider"                  "1"
        "map"                      "1"
        "round"                    "1"
        "player_id"                "1"
        "allplayers_id"            "1"
        "player_state"             "1"
        "allplayers_state"         "1"
        "allplayers_match_stats"   "1"
        "allplayers_weapons"       "1"
        "allplayers_position"      "1"
        "phase_countdowns"         "1"
        "allgrenades"              "1"
        "map_round_wins"           "1"
        "player_position"          "1"
        "bomb"                     "1"
    }
}
```

This configuration tells CS2 to send game state updates to OpenHud's local server.

## Data Structure

The GSI data is received as JSON with the following structure:

```typescript
interface GSIDataModel {
  // Information about all players in the match
  allplayers?: {
    [steamid: string]: {
      // Team: 'CT' or 'T'
      team: string;
      
      // Player's economic state
      state?: {
        money?: number;        // Current money
        equip_value?: number;  // Value of current equipment
      };
      
      // Player's slot in the server (0-9)
      observer_slot?: number;
      
      // Player's weapons
      weapons?: {
        [slot: string]: {
          name: string;  // Weapon identifier (e.g., 'weapon_ak47')
        };
      };
      
      // Player's position as "x,y,z" string
      position?: string;
    };
  };

  // Map information
  map?: {
    round?: number;           // Current round number
    round_wins?: string[];    // Array of round win reasons
  };
}
```

## Weapon Database

OpenHud maintains detailed information about weapons for analysis:

```typescript
interface WeaponInfo {
  name: string;           // Display name
  type: string;          // Weapon category
  damagePerSecond: number;
  penetrationPower: number;
  accuracy: number;      // 0-1 scale
  range: number;         // 0-1 scale
  firerate: number;      // Rounds per minute
  reloadTime: number;    // Seconds
}
```

Example weapon data:
```typescript
{
  'weapon_ak47': {
    name: 'AK-47',
    type: 'rifle',
    damagePerSecond: 360,
    penetrationPower: 0.98,
    accuracy: 0.85,
    range: 0.9,
    firerate: 600,
    reloadTime: 2.5
  }
}
```

## Map Information

Each map includes detailed area and strategy information:

```typescript
interface MapInfo {
  name: string;
  areas: {
    [areaName: string]: {
      x: [number, number];  // Min/max X coordinates
      y: [number, number];  // Min/max Y coordinates
      z: [number, number];  // Min/max Z coordinates
    };
  };
  defaultStrategies: {
    CT: string[];  // Common CT strategies
    T: string[];   // Common T strategies
  };
  criticalPositions: {
    CT: string[];  // Important CT positions
    T: string[];   // Important T positions
  };
}
```

Example map data (Dust II):
```typescript
{
  'de_dust2': {
    name: 'Dust II',
    areas: {
      'T Spawn': { x: [-2106, -1613], y: [1192, 1719], z: [32, 68] },
      'Long A': { x: [-1192, -415], y: [1698, 2339], z: [0, 142] },
      'A Site': { x: [211, 847], y: [1781, 2621], z: [0, 142] },
      // ... more areas
    },
    defaultStrategies: {
      CT: ['2-1-2', '3-1-1', '2-2-1'],
      T: ['Long Take', 'B Rush', 'Mid to B', 'Split A']
    },
    criticalPositions: {
      CT: ['Car', 'Platform', 'Goose', 'Window', 'Door'],
      T: ['Pit', 'Long Corner', 'Short', 'Upper Tunnels']
    }
  }
}
```

## Game Constants

### Team Formations
```typescript
const TEAM_FORMATIONS = {
  DEFAULT: 'default',      // Standard 2-1-2 setup
  STACKED_A: 'stacked_a', // Heavy A presence (3+ players)
  STACKED_B: 'stacked_b', // Heavy B presence (3+ players)
  SPREAD: 'spread',       // Players spread across map
  MID_CONTROL: 'mid',     // Focus on mid control
  RETAKE: 'retake'       // Setup for retake
};
```

### Team Strategies
```typescript
const TEAM_STRATEGIES = {
  DEFAULT: 'default',     // Standard play
  RUSH: 'rush',          // Fast execute
  SLOW: 'slow',          // Slow, methodical play
  SPLIT: 'split',        // Split site attack
  FAKE: 'fake',          // Fake execute
  ECO: 'eco',           // Economy round
  FORCE: 'force'        // Force buy round
};
```

### Round Types
```typescript
const ROUND_TYPES = {
  PISTOL: 'pistol',      // Pistol round
  ECO: 'eco',           // Economy round
  FORCE: 'force',       // Force buy
  HALF_BUY: 'half',     // Partial equipment
  FULL_BUY: 'full'      // Full equipment
};
```

### Risk Levels
```typescript
const RISK_LEVELS = {
  LOW: 'low',           // Safe situation
  MEDIUM: 'medium',     // Some risk
  HIGH: 'high',         // Dangerous situation
  CRITICAL: 'critical'  // Extremely dangerous
};
```

### Player Behaviors
```typescript
const PLAYER_BEHAVIORS = {
  AGGRESSIVE: 'aggressive',    // Pushing/taking fights
  PASSIVE: 'passive',         // Holding/defensive
  SUPPORTIVE: 'supportive',   // Using utility/supporting
  FLANKING: 'flanking',      // Moving for flank
  LURKING: 'lurking'         // Sneaking/lurking
};
```

### Opportunity Types
```typescript
const OPPORTUNITY_TYPES = {
  FLANK: 'flank',            // Flank opportunity
  TRADE: 'trade',            // Trade kill opportunity
  UTILITY: 'utility',        // Utility usage
  INFORMATION: 'info',       // Information gathering
  ECONOMY: 'economy'         // Economic advantage
};
```

## Processing Flow

1. CS2 sends GSI updates to `http://localhost:1349/gsi`
2. OpenHud's Express server receives and parses the JSON data
3. Data is processed and normalized into the `GSIDataModel` format
4. Updates are broadcast via WebSocket to connected clients
5. AI analysis tools process the data for:
   - Position analysis
   - Economy recommendations
   - Strategy suggestions
   - Risk assessment

## Example Usage

Here's how to handle GSI data in your code:

```typescript
import { GSIDataModel } from './types';

// WebSocket event handler
socket.on('gsi:update', (data: GSIDataModel) => {
  // Access player information
  const players = data.allplayers || {};
  
  // Get player positions
  const positions = Object.entries(players).map(([steamid, player]) => ({
    steamid,
    position: player.position?.split(',').map(Number) || [0, 0, 0],
    team: player.team
  }));

  // Check player equipment
  const playerWeapons = Object.values(players).map(player => 
    Object.values(player.weapons || {}).map(w => w.name)
  ).flat();

  // Process round information
  const currentRound = data.map?.round || 0;
  const roundWins = data.map?.round_wins || [];
});
```

## Common Issues

### Missing Data
Some fields might be undefined if:
- Player is dead
- Information is not available
- GSI update is partial

Always use optional chaining and provide defaults:
```typescript
const money = player.state?.money ?? 0;
const weapons = player.weapons ?? {};
```

### Position Format
Position strings are comma-separated coordinates:
```typescript
const [x, y, z] = player.position?.split(',').map(Number) || [0, 0, 0];
```

### Team Identification
Team strings are either 'CT' or 'T':
```typescript
const isCT = player.team === 'CT';
const isT = player.team === 'T';
``` 