# CS2 Coach AI by Toddyclipsgg

An intelligent AI coaching assistant for Counter-Strike 2 (CS2) that provides real-time feedback, analysis, and personalized coaching to help you improve your gameplay.

## Features

- **Real-time AI Coaching**: Get instant feedback on your positioning, economy management, and tactical decisions during matches.
- **Game State Integration**: Full integration with CS2's GSI system for accurate, real-time game state analysis.
- **Voice Feedback**: Natural-sounding voice feedback using Piper TTS for non-intrusive coaching.
- **Performance Analysis**: Comprehensive analysis of your gameplay using both real-time GSI data and historical statistics from Tracker.GG.
- **Minimalist Interface**: Clean, modern UI that provides essential information without cluttering your screen.
- **Task System**: Dynamic task generation based on your gameplay to help you focus on specific areas of improvement.

## Installation

1. Download the latest release from the [releases page](https://github.com/toddyamakawa/cs2-coach-ai/releases).
2. Run the installer for your platform (Windows/Mac/Linux).
3. Copy the `gamestate_integration_cs2coach.cfg` file from the installation directory to your CS2 config folder.
4. Launch CS2 in Windowed Fullscreen mode.
5. Start CS2 Coach AI and begin receiving intelligent coaching!

## Development

### Prerequisites

- Node.js v20.x or later
- npm v10.x or later
- CS2 installed and configured for GSI

### Setup

```bash
# Clone the repository
git clone https://github.com/toddyamakawa/cs2-coach-ai.git
cd cs2-coach-ai

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building

```bash
# Build for production
npm run build

# Create platform-specific installers
npm run dist:win   # Windows
npm run dist:mac   # macOS
npm run dist:linux # Linux
```

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Piper TTS](https://github.com/rhasspy/piper) for high-quality text-to-speech
- [Tracker.GG](https://tracker.gg) for player statistics
- The CS2 community for feedback and support 