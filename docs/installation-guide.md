---
sidebar_position: 8
---

# Installation Guide

This guide will help you install and configure OpenHud on your system.

## System Requirements

Before installing OpenHud, make sure your system meets these requirements:

- Windows 10/11 64-bit
- Counter-Strike 2 installed via Steam
- 4GB RAM minimum
- 500MB free disk space
- DirectX 11 compatible graphics card

## Download and Installation

### Step 1: Download OpenHud

1. Go to the [OpenHud Releases](https://github.com/your-github-username/OpenHud/releases) page
2. Download the latest version:
   - For Windows: `OpenHud-Setup-x64.exe`

![Download Page](./img/download-page.png)

### Step 2: Install OpenHud

1. Run the installer file (`OpenHud-Setup-x64.exe`)
2. Follow the installation wizard:
   - Choose installation location
   - Create desktop shortcut (recommended)
   - Allow the installer to finish

![Installation Wizard](./img/install-wizard.png)

### Step 3: Configure CS2

1. Open Steam
2. Right-click Counter-Strike 2 in your library
3. Select "Properties"
4. Add the following to Launch Options:
   ```
   -allow_third_party_software
   ```

![Steam Launch Options](./img/launch-options.png)

### Step 4: Configure Game State Integration

1. Open File Explorer
2. Navigate to your CS2 config folder:
   ```
   C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg
   ```
3. Copy the GSI configuration file:
   - From: `%PROGRAMFILES%\OpenHud\gamestate_integration_openhud.cfg`
   - To: Your CS2 config folder

![GSI Config](./img/gsi-config.png)

## First Launch

### Step 1: Start OpenHud

1. Launch OpenHud from:
   - Desktop shortcut, or
   - Start menu

![OpenHud Icon](./img/openhud-icon.png)

### Step 2: Initial Setup

1. When OpenHud starts for the first time:
   - Accept the terms of service
   - Choose your preferred theme
   - Configure overlay positions

![Initial Setup](./img/initial-setup.png)

### Step 3: Verify Installation

1. Launch CS2
2. Start a game (offline with bots is fine)
3. Check that the HUD overlay appears
4. Test the screenshot/clip capture (F5/F6 by default)

![Verify Installation](./img/verify-install.png)

## Overlay Configuration

### HUD Overlay

1. Open OpenHud settings
2. Go to "Overlay Settings"
3. Adjust:
   - Position
   - Opacity
   - Information density
   - Color scheme

![HUD Settings](./img/hud-settings.png)

### Media Player Overlay

1. In Overlay Settings
2. Configure:
   - Auto-hide duration
   - Default position
   - Preview size

![Media Settings](./img/media-settings.png)

### Task Overlay

1. In Overlay Settings
2. Set:
   - Display duration
   - Animation style
   - Progress bar style

![Task Settings](./img/task-settings.png)

## Audio Configuration

1. Open Settings
2. Go to "Audio Settings"
3. Configure:
   - Voice feedback volume
   - Alert sounds
   - Notification volume

![Audio Settings](./img/audio-settings.png)

## Performance Settings

### Graphics Settings

1. In Settings > Performance
2. Adjust:
   - Animation quality
   - Overlay resolution
   - Effect quality

![Graphics Settings](./img/graphics-settings.png)

### System Settings

1. In Settings > Performance
2. Configure:
   - Process priority
   - Memory usage
   - Cache size

![System Settings](./img/system-settings.png)

## Troubleshooting

### Overlay Not Showing

1. Verify CS2 launch options
2. Check GSI config file location
3. Restart both CS2 and OpenHud
4. Run OpenHud as administrator

### Performance Issues

1. Lower animation quality
2. Reduce overlay resolution
3. Clear application cache
4. Update graphics drivers

### GSI Not Working

1. Check config file location
2. Verify file contents
3. Restart CS2
4. Check Windows firewall

## Updating OpenHud

### Automatic Updates

1. OpenHud checks for updates on startup
2. When available:
   - Click "Update Now"
   - Wait for download
   - Restart OpenHud

![Update Available](./img/update-available.png)

### Manual Updates

1. Download new version
2. Run installer
3. Previous version will be updated automatically

## Uninstallation

If you need to remove OpenHud:

1. Open Windows Settings
2. Go to Apps & Features
3. Find OpenHud
4. Click Uninstall
5. Follow the prompts

Optional cleanup:
1. Delete GSI config from CS2
2. Remove launch options
3. Delete user data (if desired)

## Getting Help

If you encounter issues:

1. Check our [FAQ](./faq.md)
2. Visit our [GitHub Issues](https://github.com/your-github-username/OpenHud/issues)
3. Join our community:
   - Discord server
   - Steam community
   - GitHub discussions

## Next Steps

After installation:
1. Read the [User Guide](./user-guide.md)
2. Configure your overlays
3. Set up keyboard shortcuts
4. Start playing! 