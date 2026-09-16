# Role Credits Broker

Self-hosted PeerJS signaling broker for the **Role Credits** TTRPG companion app.

## What it does

This service handles PeerJS signaling so Role Credits players can join a Director's online table using the short room-code flow. Game state still travels over WebRTC data channels between clients.

## Runtime settings

- PeerJS path: `/peerjs`
- PeerJS key: `rolecredits`
- Health endpoint: `/health`
- Render uses the injected `PORT` environment variable automatically.

## Render

`render.yaml` contains the intended service configuration.

If attaching this repository to the already-live Role Credits broker manually, use:

- Runtime: Node
- Build command: `npm install --omit=dev`
- Start command: `npm start`
- Health check: `/health`
- Region: Ohio
- `PEER_PATH=/peerjs`
- `PEER_KEY=rolecredits`

The existing Role Credits standalone client is already configured to use:

`https://role-credits-broker.onrender.com`

## Local check

```bash
npm install
npm run check
npm start
```

Then open:

`http://localhost:10000/health`
