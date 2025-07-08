---
sidebar_position: 1
---

# Getting Started

Welcome to OpenHud! This guide will help you get started with installing and configuring OpenHud for CS2.

## Prerequisites

Before installing OpenHud, make sure you have:

- Counter-Strike 2 installed
- Node.js 18 or higher installed
- Git installed (for development)

## Installation

### For Users

1. Download the latest release from our [GitHub Releases](https://github.com/your-github-username/OpenHud/releases) page
2. Run the installer and follow the prompts
3. Launch CS2
4. Copy the GSI configuration file:
   ```bash
   # Windows
   copy "%PROGRAMFILES%\OpenHud\gamestate_integration_openhud.cfg" "%PROGRAMFILES(x86)%\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\"
   ```
5. Launch OpenHud

### For Developers

1. Clone the repository:
   ```bash
   git clone https://github.com/your-github-username/OpenHud.git
   cd OpenHud
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Copy the GSI configuration file:
   ```bash
   # Windows
   copy "src\assets\gamestate_integration_openhud.cfg" "%PROGRAMFILES(x86)%\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\"
   ```

## Configuration

After installation, you'll need to:

1. Configure your CS2 launch options to allow the overlay:
   - Add `-allow_third_party_software` to your CS2 launch options in Steam

2. Configure OpenHud settings:
   - Open OpenHud
   - Go to Settings
   - Adjust overlay positions and other preferences

## Next Steps

- Read the [User Guide](./user-guide.md) to learn about all features
- Check out the [API Reference](./api-reference.md) if you're a developer
- Join our community on [GitHub](https://github.com/your-github-username/OpenHud) 