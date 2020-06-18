const app = require('http').createServer(handler)
const io = require('socket.io')(app);
const cookie = require('cookie');
const fs = require('fs');
const hb = require('handlebars');
const path = require('path');
const qs = require('querystring');

function readFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath));
}

const indexHtml = readFile('../client/index.html');
const joinModal = readFile('../client/join_modal.html');
const homeHtml = readFile('../client/home.html');
const homeJs = readFile('../client/src/home.js');
const lobbyHtml = readFile('../client/lobby.html');
const lobbyJs = readFile('../client/src/lobby.js');
const gameInProgressHtml = readFile('../client/game_in_progress.html');

var game = null;
var players = [];     // Player names.
var uidToPlayer = new Map();
var spectators = [];  // Spectator UIDs.

hb.registerPartial('joinModal', joinModal.toString());

app.listen(8000);

function handler(req, res) {
  var cookies = cookie.parse(req.headers.cookie || '');
  var uid = cookies.uid ? parseInt(cookies.uid) : -1;
  if (isNaN(uid)) {
    res.writeHead(500);
    res.end('Failed to parse uid');
    return;
  }
  if (req.method === 'GET') {
    doGet(uid, req, res);
  } else if (req.method === 'POST') {
    doPost(uid, req, res);
  } else {
    res.writeHead(405);
    res.end('Method not supported');
  }
}

function doGet(uid, req, res) {
  if (req.url === '/') {
    if (game == null) {
      doGetHome(uid, req, res);
    } else {
      doGetGame(uid, req, res);
    }
  } else {
    res.writeHead(404);
    res.end('Page not found');
  }
}

function doGetHome(uid, req, res) {
  if (isPlayer(uid) || isSpectator(uid)) {
    res.writeHead(200);
    res.end(hb.compile(
      indexHtml.toString(),
      {noEscape: true},
    )({
      script: lobbyJs,
      body: hb.compile(lobbyHtml.toString())({
        playerOne: isPlayerOne(uid),
        playersHeight: 6.5 + (players.length * 1.5),
        players: players,
        spectators: spectators.length,
        isSpectator: isSpectator(uid),
      }),
    }));
  } else {
    res.writeHead(200);
    res.end(hb.compile(
      indexHtml.toString(),
      {noEscape: true},
    )({
      script: homeJs,
      body: hb.compile(homeHtml.toString())(),
    }));
  }
}

// TODO: Create in-game view.
function doGetGame(uid, req, res) {
  res.writeHead(200);
  res.end(hb.compile(
    indexHtml.toString(),
    {noEscape: true},
  )({
    script: '',
    body: gameInProgressHtml.toString(),
  }));
}

function doPost(uid, req, res) {
  if (req.url === '/join') {
    doJoin(uid, req, res);
  } else if (req.url === '/spectate') {
    doSpectate(uid, req, res);
  } else if (req.url === '/start') {
    doStart(uid, req, res);
  } else {
    res.writeHead(404);
    res.end('Action not found');
  }
}

function doJoin(uid, req, res) {
  if (game != null) {
    res.writeHead(403);
    res.end('Cannot join a game in progress');
    return;
  }
  if (isPlayer(uid)) {
    res.writeHead(400);
    res.end('Player already in game');
    return;
  }
  let newUid = -1;
  if (isSpectator(uid)) {
    const i = spectators.indexOf(uid);
    if (i < 0) {
      res.writeHead(500);
      res.end('Could not remove spectator');
      return;
    }
    spectators.splice(i, 1);
    io.emit('num spectators', {numSpectators: spectators.length});
    newUid = uid;
  } else {
    newUid = createUid();
  }
  if (newUid < 0) {
    res.writeHead(500);
    res.end('Invalid user ID');
    return;
  }
  var username = 'user';
  req.on('data', chunk => {
    let data = qs.parse(String(chunk));
    if (data.username) {
      username = data.username;
    }
  });
  req.on('end', () => {
    if (players.includes(username)) {
      let suffix = 1;
      while (players.includes(username + suffix)) {
        suffix++;
      }
      username += suffix;
    }
    players.push(username);
    uidToPlayer.set(newUid, username);
    res.setHeader('Set-Cookie', cookie.serialize('uid', newUid));
    res.setHeader('Location', '/');
    res.writeHead(303);
    res.end();
    io.emit('new player', {username: username});
  })
}

function doSpectate(uid, req, res) {
  if (isSpectator(uid)) {
    res.writeHead(400);
    res.end('Already spectating game');
    return;
  }
  let newUid = -1;
  if (isPlayer(uid)) {
    let username = uidToPlayer.get(uid);
    const i = players.indexOf(username);
    if (i < 0) {
      res.writeHead(500);
      res.end('Could not remove player');
      return;
    }
    players.splice(i, 1);
    uidToPlayer.delete(uid);
    io.emit('player left', {username: username});
    newUid = uid;
  } else {
    newUid = createUid();
  }
  if (newUid < 0) {
    res.writeHead(500);
    res.end('Invalid user ID');
    return;
  }
  spectators.push(newUid);
  res.setHeader('Set-Cookie', cookie.serialize('uid', newUid));
  res.setHeader('Location', '/');
  res.writeHead(303);
  res.end();
  io.emit('num spectators', {numSpectators: spectators.length});
}

function doStart(uid, req, res) {
  if (game != null) {
    res.writeHead(400);
    res.end('Game already in progress');
    return;
  }
  if (!isPlayerOne(uid)) {
    res.writeHead(403);
    res.end('Only player 1 can start the game');
    return;
  }
  // TODO: Create game.
  res.setHeader('Location', '/');
  res.writeHead(303);
  res.end();
  // TODO: io.emit();
}

function isSpectator(uid) {
  return spectators.includes(uid);
}

function isPlayer(uid) {
  return uidToPlayer.has(uid);
}

function isPlayerOne(uid) {
  return isPlayer(uid) && uidToPlayer.get(uid) === players[0];
}

function createUid() {
  let uid = 0;
  do {
    uid = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  } while (isPlayer(uid) || isSpectator(uid));
  return uid;
}
