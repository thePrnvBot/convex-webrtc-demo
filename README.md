# WebRTC Video Chat

A real-time video chat application built with TanStack Start, WebRTC, and Convex for peer-to-peer video communication.

<img width="1324" height="1197" alt="image" src="https://github.com/user-attachments/assets/e9939142-11f2-45f8-8964-b8abacb8e062" />

## Features

- Real-time video chat using WebRTC
- Peer-to-peer connection with signaling via Convex
- Responsive design with Tailwind CSS
- Built on TanStack Start for optimal performance
- Simple call creation and joining system

## Tech Stack

- Frontend: TanStack Start, React 19, TypeScript
- Backend: Convex (real-time database & functions)
- Styling: Tailwind CSS, Radix UI components
- Build Tool: Vite
- Real-time: WebRTC for video streaming

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun
- Convex account (free tier available)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd tanstack-start-submission
```

2. Install dependencies:

```bash
npm install
```

3. Set up Convex:

```bash
npx convex dev
```

4. Start the development server:

```bash
npm run dev
```

The application will be available at `https://localhost:3000`.

## Usage

### Starting a Video Call

1. Click "Start Webcam" to enable your camera and microphone
2. Choose to either:
   - **Create New Call**: Generate a unique call ID to share
   - **Join Existing Call**: Enter a call ID from someone else

### Joining a Call

1. Start your webcam first
2. Enter the call ID provided by the other person
3. Click "Join" then "Answer" to establish the connection

### Call Controls

- **Hang Up**: End the current call
- **Status Indicator**: Shows connection state (connecting, connected, etc.)

## Project Structure

```
├── src/
│   ├── routes/
│   │   └── index.tsx          # Main video chat component
│   ├── components/
│   │   └── ui/
│   │       └── button.tsx     # Reusable button component
│   ├── lib/
│   │   └── utils.ts          # Utility functions
│   └── styles/
│       └── app.css           # Global styles
├── convex/
│   ├── schema.ts             # Database schema
│   └── webrtc.ts             # Convex functions for signaling
└── public/                   # Static assets
```

## How It Works

### WebRTC Signaling Flow

1. **Call Creation**: Caller generates a unique call ID via Convex
2. **Offer Exchange**: Caller creates WebRTC offer and stores it in Convex
3. **Answer Exchange**: Answerer retrieves offer, creates answer, stores it
4. **ICE Candidates**: Both parties exchange ICE candidates for connection
5. **P2P Connection**: Direct peer-to-peer video stream established

### Convex Integration

- Real-time synchronization of call data
- Signaling server for WebRTC connection establishment
- Automatic cleanup and management of call sessions

## Development Scripts

- `npm run dev` - Start development server with Convex
- `npm run dev:web` - Start Vite dev server only
- `npm run dev:convex` - Start Convex dev server only
- `npm run build` - Build for production
- `npm run lint` - Run ESLint and TypeScript checks
- `npm run format` - Format code with Prettier

## Deployment

### Docker

A Dockerfile is included for containerized deployment:

```bash
docker build -t tanstack-webrtc .
docker run -p 3000:3000 tanstack-webrtc
```

### Production

1. Build the application:

```bash
npm run build
```

2. Deploy to Convex:

```bash
npx convex deploy
```

3. Start the production server:

```bash
npm start
```

## Browser Compatibility

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## HTTPS Requirements

WebRTC requires HTTPS in production environments. For local development, you can use:

- `localhost` (automatically secure)
- Self-signed certificates
- Services like ngrok for tunneling

When deploying, ensure your hosting provider provides HTTPS certificates.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For issues or questions:

- Check the [Convex documentation](https://docs.convex.dev/)
- Review [TanStack Start docs](https://tanstack.com/start/latest)
- Open an issue in the repository
