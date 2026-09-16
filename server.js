const http = require("http");
const express = require("express");
const { ExpressPeerServer } = require("peer");

const PORT = Number(process.env.PORT || 10000);
const PEER_PATH = process.env.PEER_PATH || "/peerjs";
const PEER_KEY = process.env.PEER_KEY || "rolecredits";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.get("/", (_req, res) => {
  res.json({
    service: "Role Credits Broker",
    status: "ok",
    peerPath: PEER_PATH,
    peerKey: PEER_KEY
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

const server = http.createServer(app);

const peerServer = ExpressPeerServer(server, {
  path: "/",
  key: PEER_KEY,
  proxied: true,
  allow_discovery: false,
  debug: false
});

app.use(PEER_PATH, peerServer);

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Role Credits PeerServer listening on 0.0.0.0:${PORT}${PEER_PATH} with key ${PEER_KEY}`
  );
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
