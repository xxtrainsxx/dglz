const app = require('http').createServer(handler)
const io = require('socket.io')(app);
const fs = require('fs');
const path = require('path');
const hb = require('handlebars');

const indexHtml = fs.readFileSync(path.join(__dirname, '../client/index.html'));
const joinModal = fs.readFileSync(path.join(__dirname, '../client/join_modal.html'));
const homeHtml = fs.readFileSync(path.join(__dirname, '../client/home.html'));
const homeJs = fs.readFileSync(path.join(__dirname, '../client/src/home.js'));

var game = null;
var players = [];     // Player names.
var uidToPlayer = new Map();
var spectators = [];  // Spectator UIDs.

hb.registerPartial('joinModal', joinModal.toString());

app.listen(8000);

function handler(req, res) {
  res.writeHead(200);
  res.end(hb.compile(
    indexHtml.toString(),
    {noEscape: true},
  )({
    script: homeJs,
    body: hb.compile(homeHtml.toString())(),
  }));
}

function isSpectator(uid) {
  return spectators.includes(uid);
}

function isPlayer(uid) {
  return uidToPlayer.has(uid);
}

function isPlayerOne(uid) {
  return isPlayer(uid) && uidToPlayer[uid] === players[0];
}

function createUid() {
  let uid = 0;
  do {
    uid = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  } while (isPlayer(uid) || isSpectator(uid));
  return uid;
}

io.on('connection', (socket) => {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', (data) => {
    console.log(data);
  });
});
