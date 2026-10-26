# NexMeet

Real-time multi-user video conferencing platform built on **WebRTC** (peer-to-peer mesh) with **Socket.IO** signaling.

**Live demo:** <your-vercel-url>

## Features

- Multi-user video rooms with an adaptive video grid
- Live in-room chat with unread counts
- Screen sharing (track swap, no renegotiation)
- Mic / camera toggles with state synced to all participants
- Participant list with muted, camera-off, and "sharing" indicators
- Connection recovery: ICE restart, then full peer-connection rebuild, and automatic re-join if the signaling socket drops
- STUN + TURN fallback for peers behind strict NATs
- Built-in metrics endpoint to measure setup failures and recovery rate

## Tech stack

React.js · JavaScript · WebRTC · Socket.IO · Node.js · Express.js

## Architecture

```
Browser A ──┐                         ┌── Browser B
            │   offer/answer/ICE      │
            └──►  Signaling server  ◄─┘     (Node + Express + Socket.IO)
            
Browser A ◄════ audio/video (direct P2P, or relayed via TURN) ════► Browser B
```

- **Signaling server** only exchanges offers, answers, ICE candidates, chat, and room state. It never carries media.
- **Mesh topology:** every participant connects to every other one. Works well for roughly 2-5 users; an SFU (LiveKit, mediasoup) would be the path to scale further.
- **Glare avoidance:** the newcomer always sends the offers, and only the original offerer performs ICE restarts.

## Connection recovery

| Event | Action |
|---|---|
| ICE `disconnected` | Wait 3 s, then ICE restart |
| ICE `failed` | ICE restart immediately (up to 3 times) |
| Restarts exhausted | Rebuild the peer connection (up to 2 times) |
| Signaling socket drops | Reconnect and re-join the room |

## Getting started

```bash
git clone https://github.com/<your-username>/nexmeet.git
cd nexmeet

# server
cd server && npm install && npm start

# client (new terminal)
cd client && npm install && npm run dev
```

Create `client/.env.local`:

```
VITE_SERVER_URL=http://localhost:5000
VITE_TURN_USERNAME=<your-turn-username>
VITE_TURN_PASSWORD=<your-turn-password>
```

TURN credentials are optional; without them the app uses STUN only. Free TURN: metered.ca.

Open two tabs at `http://localhost:5173/room/test`.

## Testing flags

| URL suffix | Effect |
|---|---|
| `?relay=1` | Force all media through TURN |
| `?turn=0` | Disable TURN |
| `?recovery=0` | Disable recovery logic (baseline) |

## Results

<fill in after Phase 11>

| Config | Setup failure rate | Unrecovered disruptions |
|---|---|---|
| Baseline | X% (n=) | X% (n=) |
| Recovery + TURN | Y% (n=) | Y% (n=) |

## Deployment

- Client: Vercel
- Server: Render
- TURN: Metered

## Limitations / future work

- Mesh does not scale past ~5 participants (SFU would fix this)
- No authentication or room passwords
- Metrics are stored in memory only