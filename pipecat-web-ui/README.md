# Pipecat Web UI

A production-ready web interface for Pipecat voice AI applications built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🎤 **Microphone Controls**: Select and toggle microphone with real-time device detection
- 🚀 **Start/Stop Controls**: Easy connection management with visual feedback
- 📊 **Latency Monitoring**: Real-time latency badge with color-coded indicators
- 📝 **Live Transcript**: Real-time transcript display with interim and final results
- 🔧 **Settings Drawer**: Configure AI model, transport, sample rate, and RTL text
- 🌐 **WebSocket Connection**: Robust WebSocket client with automatic retry and backoff
- 🎨 **Modern UI**: Clean interface built with shadcn/ui components
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🌍 **RTL Support**: Right-to-left text support for international users

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   cd pipecat-web-ui
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your settings
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Required: WebSocket and API URLs
NEXT_PUBLIC_PIPECAT_WS_URL=ws://localhost:8765/ws
NEXT_PUBLIC_PIPECAT_API_URL=http://localhost:8000

# Optional: API Keys (keep these secure)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

## Architecture

### Components

- **MicrophoneSelect**: Microphone device selection and mute/unmute controls
- **TranscriptDisplay**: Real-time transcript with speaker identification
- **SettingsDrawer**: Configuration panel for AI model, transport, and preferences
- **StatusIndicator**: Connection status with visual indicators
- **LatencyBadge**: Real-time latency monitoring with color coding

### WebSocket Transport

The application includes a custom WebSocket transport (`WebSocketTransport`) that:

- Implements the Pipecat Transport interface
- Provides automatic reconnection with exponential backoff
- Handles device management (microphone, camera, speakers)
- Manages audio/video tracks
- Includes ping/pong for connection health monitoring

### State Management

- React hooks for local state management
- Toast notifications for user feedback
- Real-time updates for connection status and latency
- Persistent settings configuration

## Deployment

### Vercel (Recommended)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Connect your GitHub repository to Vercel
   - Add environment variables in Vercel dashboard
   - Deploy automatically on push

### Docker

1. **Build the image:**
   ```bash
   docker build -t pipecat-web-ui .
   ```

2. **Run the container:**
   ```bash
   docker run -p 3000:3000 --env-file .env.local pipecat-web-ui
   ```

### Static Export

For static hosting (Netlify, GitHub Pages, etc.):

```bash
npm run build
npm run export
```

## Server Requirements

This web UI connects to a Pipecat server via WebSocket. Your server should:

1. **Accept WebSocket connections** on the configured endpoint
2. **Implement RTVI protocol** for message handling
3. **Handle audio streaming** for voice processing
4. **Support the following message types:**
   - `client-ready`: Client initialization
   - `user-transcription`: User speech-to-text
   - `bot-llm-text`: Bot text responses
   - `ping`/`pong`: Connection health checks

## Customization

### Styling

The UI uses Tailwind CSS with shadcn/ui components. Customize the theme in:
- `src/app/globals.css`: CSS variables and base styles
- `tailwind.config.ts`: Tailwind configuration
- `components.json`: shadcn/ui configuration

### Adding Features

1. **New Components**: Add to `src/components/`
2. **WebSocket Messages**: Extend `WebSocketTransport` class
3. **Settings**: Update `SettingsConfig` interface
4. **Transcript Types**: Extend `TranscriptEntry` interface

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check `NEXT_PUBLIC_PIPECAT_WS_URL` in `.env.local`
   - Ensure Pipecat server is running
   - Check browser console for detailed errors

2. **Microphone Not Working**
   - Grant microphone permissions in browser
   - Check device selection in microphone dropdown
   - Verify HTTPS is used in production (required for microphone access)

3. **No Transcript Appearing**
   - Verify WebSocket connection is established
   - Check server logs for message handling
   - Ensure proper RTVI message format

### Debug Mode

Enable debug logging by adding to `.env.local`:
```env
NEXT_PUBLIC_DEBUG=true
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and test thoroughly
4. Commit with descriptive messages
5. Push and create a pull request

## License

This project is licensed under the BSD-2-Clause License - see the LICENSE file for details.

## Support

- 📖 [Pipecat Documentation](https://docs.pipecat.ai)
- 💬 [Discord Community](https://discord.gg/pipecat)
- 🐛 [Report Issues](https://github.com/pipecat-ai/pipecat-client-web/issues)