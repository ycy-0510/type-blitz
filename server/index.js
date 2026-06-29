import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { execSync } from 'node:child_process';

// Server build identifier, mirroring the client's. Format: YYMMDD.NN
//   YYMMDD = commit date, NN = number of commits on that day.
// Computed from git so it matches the client built from the same commit; CI sets
// BUILD explicitly (its Docker context has no .git) to the very same value.
// Sent to each client on connect (see 'server_info') and exposed at GET /version.
function buildId() {
  if (process.env.BUILD) return process.env.BUILD;
  try {
    const day = execSync('git show -s --format=%cd --date=format:%y%m%d HEAD').toString().trim();
    const full = execSync('git show -s --format=%cd --date=format:%Y-%m-%d HEAD').toString().trim();
    const n = execSync('git log --pretty=%cd --date=format:%Y-%m-%d').toString().trim()
      .split('\n').filter((d) => d === full).length;
    return `${day}.${String(n).padStart(2, '0')}`;
  } catch {
    const d = new Date();
    const day = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `${day}.00`; // .00 = local/unstamped build (no git history available)
  }
}
const BUILD = buildId();

const app = express();
app.use(cors());

// Lightweight version/health endpoint.
app.get('/version', (req, res) => {
  res.json({ build: BUILD });
});

// --- Cloudflare Turnstile verification ---
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;
if (!TURNSTILE_SECRET) {
  console.warn('[Turnstile] TURNSTILE_SECRET_KEY not set — human verification is DISABLED.');
}

async function verifyTurnstile(token, ip) {
  // No secret configured => verification disabled (local/dev convenience)
  if (!TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const form = new URLSearchParams();
    form.append('secret', TURNSTILE_SECRET);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error('[Turnstile] verify error:', e);
    return false;
  }
}

function clientIp(socket) {
  return (
    socket.handshake.headers['cf-connecting-ip'] ||
    (socket.handshake.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    socket.handshake.address
  );
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

const PORT = process.env.PORT || 3001;

// Number of typing passages the client bundles (public/quotes.json). Used to
// pick a valid random index. Override with QUOTE_COUNT if the list size changes.
const QUOTE_COUNT = parseInt(process.env.QUOTE_COUNT || '3000', 10);
function randomQuoteIndex() {
  return Math.floor(Math.random() * QUOTE_COUNT);
}

// Generate 16 char random ID
function generateId() {
  return Array.from({length: 16}, () => Math.random().toString(36)[2]).join('').toUpperCase();
}

const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Let the client display the running server build (e.g. in "What's New").
  socket.emit('server_info', { build: BUILD });

  const updateRoom = (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      io.to(roomId).emit('room_update', room);
    }
  };

  socket.on('create_room', async (payload) => {
    // Backwards compatible: payload may be a plain nickname string or { nickname, token }
    const nickname = typeof payload === 'string' ? payload : payload?.nickname;
    const token = typeof payload === 'object' && payload ? payload.token : undefined;

    const verified = await verifyTurnstile(token, clientIp(socket));
    if (!verified) {
      socket.emit('room_error', 'Verification failed. Please complete the challenge and try again.');
      return;
    }

    const roomId = generateId();
    const newRoom = {
      id: roomId,
      status: 'waiting',
      quoteIndex: randomQuoteIndex(),
      players: {
        [socket.id]: {
          id: socket.id,
          nickname: nickname || 'Host',
          isHost: true,
          progress: 0,
          wpm: 0,
          isReady: true,
          finished: false
        }
      }
    };
    rooms.set(roomId, newRoom);
    socket.join(roomId);
    socket.emit('room_created', roomId);
    updateRoom(roomId);
    console.log(`Room created: ${roomId} by ${nickname}`);
  });

  socket.on('join_room', async ({ roomId, nickname, token }) => {
    const verified = await verifyTurnstile(token, clientIp(socket));
    if (!verified) {
      socket.emit('room_error', 'Verification failed. Please complete the challenge and try again.');
      return;
    }

    roomId = roomId.toUpperCase();
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit('room_error', 'Room not found');
      return;
    }
    
    if (Object.keys(room.players).length >= 40) {
      socket.emit('room_error', 'Room is full (max 40 players)');
      return;
    }
    
    if (room.status !== 'waiting') {
      socket.emit('room_error', 'Match already in progress');
      return;
    }

    room.players[socket.id] = {
      id: socket.id,
      nickname: nickname || `Player ${Object.keys(room.players).length + 1}`,
      isHost: false,
      progress: 0,
      wpm: 0,
      isReady: true,
      finished: false
    };
    
    socket.join(roomId);
    socket.emit('room_joined', roomId);
    updateRoom(roomId);
    console.log(`User ${nickname} joined room ${roomId}`);
  });

  socket.on('host_start', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.players[socket.id]?.isHost) {
      // Coming from a finished match: anyone who didn't hit PLAY AGAIN is
      // considered to have left the group, so drop them before starting.
      if (room.status === 'finished') {
        for (const id of Object.keys(room.players)) {
          if (!room.players[id].rematch) {
            const s = io.sockets.sockets.get(id);
            if (s) {
              s.emit('removed_from_room');
              s.leave(roomId);
            }
            delete room.players[id];
          }
        }
      }

      room.status = 'playing';
      // Assign new quote
      room.quoteIndex = randomQuoteIndex();

      // Reset all players
      Object.values(room.players).forEach(p => {
        p.progress = 0;
        p.wpm = 0;
        p.finished = false;
        p.accuracy = undefined;
        p.rematch = false;
      });

      // Shared countdown anchor: everyone counts down to the same wall-clock
      // moment instead of each client running its own independent 10s timer.
      const startAt = Date.now() + 10000;
      room.startAt = startAt;

      updateRoom(roomId);
      io.to(roomId).emit('match_starting', { startAt });
    }
  });

  socket.on('progress', ({ roomId, progress, wpm }) => {
    const room = rooms.get(roomId);
    if (room && room.players[socket.id]) {
      room.players[socket.id].progress = progress;
      room.players[socket.id].wpm = wpm;
      // We throttle updateRoom on client side or just emit here
      // For 40 players, emitting too often is bad, but for this scale we can just emit
      updateRoom(roomId);
    }
  });

  socket.on('finish', ({ roomId, wpm, accuracy }) => {
    const room = rooms.get(roomId);
    if (room && room.players[socket.id]) {
      room.players[socket.id].progress = 100;
      room.players[socket.id].wpm = wpm;
      room.players[socket.id].accuracy = accuracy;
      room.players[socket.id].finished = true;
      
      // Check if everyone is finished
      const allFinished = Object.values(room.players).every(p => p.finished);
      if (allFinished) {
        room.status = 'finished';
      }

      updateRoom(roomId);
    }
  });

  // Timed out (20-WPM clock). Mark finished but KEEP current progress so the
  // player's car stays where it stopped instead of jumping to the finish line.
  socket.on('force_stop', ({ roomId, wpm, accuracy }) => {
    const room = rooms.get(roomId);
    if (room && room.players[socket.id]) {
      room.players[socket.id].wpm = wpm;
      room.players[socket.id].accuracy = accuracy;
      room.players[socket.id].finished = true;

      const allFinished = Object.values(room.players).every(p => p.finished);
      if (allFinished) {
        room.status = 'finished';
      }

      updateRoom(roomId);
    }
  });

  // A player opts into the next match. Only valid once the match is fully over.
  // Players who never opt in are dropped when the host starts (see host_start).
  socket.on('play_again', (roomId) => {
    const room = rooms.get(roomId);
    if (!room || !room.players[socket.id]) return;
    if (room.status !== 'finished') return; // must wait for everyone to finish

    room.players[socket.id].rematch = true;

    // Ensure exactly one opted-in player is host, so START stays available even
    // if the previous host didn't opt back in.
    const optedIn = Object.keys(room.players).filter(id => room.players[id].rematch);
    const hasHost = optedIn.some(id => room.players[id].isHost);
    if (!hasHost) {
      Object.values(room.players).forEach(p => { p.isHost = false; });
      room.players[socket.id].isHost = true;
    }

    updateRoom(roomId);
  });

  socket.on('leave_room', (roomId) => {
    handleLeaveRoom(socket, roomId);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const [roomId, room] of rooms.entries()) {
      if (room.players[socket.id]) {
        handleLeaveRoom(socket, roomId);
      }
    }
  });

  function handleLeaveRoom(socket, roomId) {
    socket.leave(roomId);
    const room = rooms.get(roomId);
    if (room && room.players[socket.id]) {
      const wasHost = room.players[socket.id].isHost;
      delete room.players[socket.id];
      
      if (Object.keys(room.players).length === 0) {
        rooms.delete(roomId);
      } else {
        if (wasHost) {
          // Assign new host
          const nextPlayer = Object.values(room.players)[0];
          if (nextPlayer) nextPlayer.isHost = true;
        }
        updateRoom(roomId);
      }
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`TypeBlitz server — Build ${BUILD}`);
  console.log(`Server listening on port ${PORT}`);
});
