---
sidebar_position: 2
---

# Overlay Configuration

Learn how to customize and configure OpenHud's in-game overlays.

## HUD Overlay

The main HUD overlay displays real-time game information and AI feedback.

### Position and Size

1. Open Settings > Overlays > HUD
2. Choose position:
   - Top (recommended for most users)
   - Bottom
   - Left
   - Right
   - Custom (drag to any position)

![HUD Positions](../img/hud-positions.png)

### Information Display

Configure which information to show:

- **Basic Stats**
  - K/D Ratio
  - ADR (Average Damage per Round)
  - Headshot Percentage
  - Economy Status

- **Advanced Stats**
  - Utility Usage
  - Position Analysis
  - Team Economy
  - Round Win Probability

- **AI Feedback**
  - Real-time Suggestions
  - Performance Alerts
  - Strategy Tips

### Appearance

Customize the HUD's look:

1. **Theme**
   - Light
   - Dark
   - High Contrast
   - Custom Colors

2. **Opacity**
   - Adjust transparency (20-100%)
   - Auto-fade when inactive

3. **Size**
   - Compact
   - Normal
   - Expanded
   - Custom Scale

![HUD Themes](../img/hud-themes.png)

## Media Player Overlay

Configure how captured media is displayed during gameplay.

### Display Settings

1. **Position**
   - Corner placement
   - Screen edge
   - Custom position

2. **Size**
   - Thumbnail
   - Medium
   - Large
   - Auto (based on content)

3. **Behavior**
   - Auto-show duration
   - Fade animation
   - Mouse interaction

![Media Player Settings](../img/media-settings.png)

### Playback Controls

Customize media player controls:

- **Navigation**
  - Previous/Next buttons
  - Timeline scrubbing
  - Playback speed

- **Display**
  - Show timestamps
  - File information
  - Quick actions

### Auto-Hide Rules

Set when the media player should hide:

1. **Time-based**
   - After playback
   - After fixed duration
   - When inactive

2. **Event-based**
   - During combat
   - On key rounds
   - Manual control

## Task Overlay

Configure the task and objective display.

### Layout Options

1. **Style**
   - Minimal
   - Detailed
   - Compact
   - Custom

2. **Information**
   - Progress bar
   - Time remaining
   - Rewards
   - Subtasks

![Task Layout](../img/task-layout.png)

### Progress Display

Customize progress indicators:

- **Bar Style**
  - Linear
  - Circular
  - Segmented
  - Custom

- **Colors**
  - Progress
  - Completion
  - Warning
  - Custom scheme

### Notification Settings

Configure task notifications:

1. **Visual**
   - Pop-up style
   - Duration
   - Animation
   - Position

2. **Audio**
   - Sound effects
   - Voice alerts
   - Volume levels

## Global Settings

Settings that apply to all overlays:

### Performance

1. **Quality**
   - Animation quality
   - Effect detail
   - Update frequency

2. **Optimization**
   - GPU acceleration
   - Memory usage
   - Cache settings

### Interaction

1. **Mouse**
   - Click-through
   - Drag zones
   - Resize handles

2. **Keyboard**
   - Global shortcuts
   - Toggle keys
   - Quick actions

### Visibility Rules

Set when overlays should show/hide:

1. **Game States**
   - During freezetime
   - While spectating
   - Post-round
   - Menu screens

2. **Custom Rules**
   - Based on events
   - Time triggers
   - Performance thresholds

## Best Practices

### For Performance

1. **Optimize Settings**
   - Lower animation quality if needed
   - Reduce update frequency
   - Use compact layouts

2. **Position Carefully**
   - Avoid blocking important game areas
   - Consider screen resolution
   - Account for aspect ratio

### For Gameplay

1. **Information Priority**
   - Show most important stats
   - Hide unnecessary details
   - Use minimal notifications

2. **Focus Areas**
   - Keep critical info visible
   - Auto-hide secondary displays
   - Use sound cues effectively

## Troubleshooting

### Common Issues

1. **Overlay Not Showing**
   - Check visibility settings
   - Verify game resolution
   - Restart overlays

2. **Performance Impact**
   - Lower quality settings
   - Reduce active overlays
   - Update graphics drivers

3. **Display Glitches**
   - Reset positions
   - Clear cache
   - Update resolution

## Advanced Configuration

### Custom Themes

Create your own overlay themes:

```css
.custom-theme {
  --primary-color: #ff5500;
  --secondary-color: #00ff55;
  --background: rgba(0, 0, 0, 0.8);
  --text-color: #ffffff;
}
```

### Layout Templates

Save and load custom layouts:

1. Export current layout
2. Share with team
3. Import presets
4. Create situations

### Event Triggers

Set up conditional displays:

```json
{
  "trigger": "lowHealth",
  "condition": "health < 20",
  "action": {
    "show": ["healthWarning"],
    "hide": ["secondaryInfo"],
    "style": "urgent"
  }
}
``` 