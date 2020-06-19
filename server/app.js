const app = require('http').createServer(handler)
const io = require('socket.io')(app);
const _ = require('lodash');
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
const gameHtml = readFile('../client/game.html');
const gameJs = readFile('../client/src/game.js');
const gameInProgressHtml = readFile('../client/game_in_progress.html');

const deckSize = 54;
const handSize = deckSize / 2;

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
        playersHeight: 7 + (players.length * 1.5),
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

function doGetGame(uid, req, res) {
  if (isPlayer(uid) || isSpectator(uid)) {
    let playerObjs = [];
    let hand = null;
    for (let i = 0; i < game.gamePlayers.length; i++) {
      if (uidToPlayer.get(uid) === game.gamePlayers[i].username) {
        hand = game.gamePlayers[i].hand;
      } else {
        playerObjs.push({
          username: game.gamePlayers[i].username,
          handSize: game.gamePlayers[i].hand.length,
          lastPlayed: game.lastActions[i],
        });
      }
    }
    res.writeHead(200);
    res.end(hb.compile(
      indexHtml.toString(),
      {noEscape: true},
    )({
      script: gameJs,
      body: hb.compile(gameHtml.toString())({
        players: playerObjs,
        hand: hand,
      }),
    }));
  } else {
    res.writeHead(200);
    res.end(hb.compile(
      indexHtml.toString(),
      {noEscape: true},
    )({
      script: '',
      body: gameInProgressHtml.toString(),
    }));
  }
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
  try {
    game = createGame();
  } catch (err) {
    res.writeHead(500);
    res.end(err.message);
    return;
  }
  res.setHeader('Location', '/');
  res.writeHead(303);
  res.end();
  io.send('game started');
}

///////////////
// UID UTILS //
///////////////

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

////////////////
// GAME UTILS //
////////////////

const value = {
  THREE: 1,
  FOUR: 2,
  FIVE: 3,
  SIX: 4,
  SEVEN: 5,
  EIGHT: 6,
  NINE: 7,
  TEN: 8,
  JACK: 9,
  QUEEN: 10,
  KING: 11,
  ACE: 12,
  TWO: 13,
  BLACK_JOKER: 14,
  RED_JOKER: 15,
};

const suit = {
  CLUBS: 1,
  DIAMONDS: 2,
  HEARTS: 3,
  SPADES : 4,
};

const play = {
  PASS: 1,
  HIGH_CARD: 2,
  PAIR: 3,
  TRIPLET: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  FIVE_OF_A_KIND: 10,
};

function playToString(playType) {
  switch (playType) {
    case PASS:
      return 'pass';
    case HIGH_CARD:
      return 'high card';
    case PAIR:
      return 'pair';
    case TRIPLET:
      return 'triplet';
    case STRAIGHT:
      return 'straight';
    case FLUSH:
      return 'flush';
    case FULL_HOUSE:
      return 'full house';
    case FOUR_OF_A_KIND:
      return 'four of a kind';
    case STRAIGHT_FLUSH:
      return 'straight flush';
    case FIVE_OF_A_KIND:
      return 'five of a kind';
  }
}

function createCard(v, s = undefined, isStartingThreeOfClubs = false) {
  return {
    value: v,
    suit: s,
    isStartingThreeOfClubs: isStartingThreeOfClubs,
  };
}

function createAndShuffleDeck(numDecks) {
  let deck = [];
  for (let i = 0; i < numDecks; i++) {
    // Add threes.
    let isStartingThreeOfClubs = i == 0;
    deck.push(createCard(value.THREE, suit.CLUBS, isStartingThreeOfClubs));
    for (s of [suit.DIAMONDS, suit.HEARTS, suit.SPADES]) {
      deck.push(createCard(value.THREE, s));
    }
    // Add fours through twos.
    for (v of [value.FOUR, value.FIVE, value.SIX, value.SEVEN, value.EIGHT, value.NINE, value.TEN, value.JACK, value.QUEEN, value.KING, value.ACE, value.TWO]) {
      for (s of [suit.CLUBS, suit.DIAMONDS, suit.HEARTS, suit.SPADES]) {
        deck.push(createCard(v, s))
      }
    }
    // Add jokers.
    deck.push(createCard(value.BLACK_JOKER));
    deck.push(createCard(value.RED_JOKER));
  }
  return _.shuffle(deck);
}

function createPlayer(username, startingHand) {
  return {
    username: username,
    hand: startingHand,
    playHand: function(playedHand) {
      for (card of playedHand) {
        const i = _.findIndex(hand, function(o) {
          return _.isEqual(o, card);
        });
        if (i < 0) {
          throw 'Cannot play card not in hand';
        }
        hand.splice(i, 1);
      }
    },
  };
}

function isJoker(card) {
  return card.value === value.BLACK_JOKER || card.value === value.RED_JOKER;
}

function getPlay(playedHand) {
  if (playedHand.length === 0) {
    return { play: play.PASS }; 
  }
  if (playedHand.length == 1) {
    return {
      play: play.HIGH_CARD,
      value: playedHand[0].value,
    };
  }
  if (playedHand.length == 2) {
    if (isJoker(playedHand[0]) || isJoker(playedHand[1])) {
      return {
        play: play.PAIR,
        value: _.min(playedHand),
      };
    }
    if (playedHand[0].value === playedHand[1].value) {
      return {
        play: play.PAIR,
        value: playedHand[0].value,
      };
    }
    throw 'Invalid pair';
  }
  if (playedHand.length == 3) {
    let nonJokerValue = null;
    let blackJokerUsed = false;
    for (card of playedHand) {
      if (isJoker(card)) {
        if (card.value == value.BLACK_JOKER) {
          blackJokerUsed = true;
        }
        continue;
      }
      if (nonJokerValue == null) {
        nonJokerValue = card.value;
        continue;
      }
      if (card.value !== nonJokerValue) {
        throw 'Invalid triplet';
      }
    }
    if (nonJokerValue == null) {
      return {
        play: play.TRIPLET,
        value: blackJokerUsed ? value.BLACK_JOKER : value.RED_JOKER,
      };
    }
    return {
      play: play.TRIPLET,
      value: nonJokerValue,
    };
  }
  if (playedHand.length == 5) {
    let numBlackJokers = 0;
    let numRedJokers = 0;
    let nonJokerValues = [];
    let s = null;
    let flushFound = true;
    for (card of playedHand) {
      if (card.value == value.BLACK_JOKER) {
        numBlackJokers++;
        continue;
      }
      if (card.value == value.RED_JOKER) {
        numRedJokers++;
        continue;
      }
      if (s == null) {
        s = card.suit;
      } else if (card.suit !== s) {
        flushFound = false;
      }
      nonJokerValues.push(card.value == value.TWO ? 0 : card.value);
    }
    nonJokerValues.sort();
    let uniqueNonJokerValues = _.uniq(nonJokerValues);
    // Five of a kind.
    if (uniqueNonJokerValues.length == 0) {
      return {
        play: play.FIVE_OF_A_KIND,
        value: numBlackJokers > 0 ? value.BLACK_JOKER : value.RED_JOKER,
      };
    }
    if (uniqueNonJokerValues.length == 1) {
      return {
        play: play.FIVE_OF_A_KIND,
        value: uniqueNonJokerValues[0],
      };
    }
    // Straight flush.
    let jokersUsed = 0;
    for (let i = 1; i < nonJokerValues.length; i++) {
      jokersUsed += (nonJokerValues[i] - nonJokerValues[i - 1]) - 1;
    }
    let leftoverJokers = numBlackJokers + numRedJokers - jokersUsed;
    let straightFound = leftoverJokers >= 0;
    let straightHighCard = null;
    if (straightFound) {
      straightHighCard = Math.max(value.ACE, nonJokerValues[nonJokerValues.length - 1] + leftoverJokers);
      if (flushFound) {
        return {
          play: play.STRAIGHT_FLUSH,
          value: straightHighCard,
        };
      }
    }
    if (uniqueNonJokerValues.length == 2) {
      let firstValue = nonJokerValues[0];
      let numFirstValues = 1;
      let secondValue = null;
      let numSecondValues = 0;
      for (let i = 1; i < nonJokerValues.length; i++) {
        if (nonJokerValues[i] != firstValue) {
          secondValue = nonJokerValues[i];
          numSecondValues = nonJokerValues.length - numFirstValues;
          break;
        }
        numFirstValues++;
      }
      // Four of a kind.
      if (numFirstValues == 1) {
        if (numSecondValues == 1) {
          return {
            play: play.FOUR_OF_A_KIND,
            four_value: _.max(nonJokerValues),
            one_value: _.min(nonJokerValues),
          };
        }
        return {
          play: play.FOUR_OF_A_KIND,
          four_value: secondValue,
          one_value: firstValue,
        };
      }
      if (numSecondValues == 1) {
        return {
          play: play.FOUR_OF_A_KIND,
          four_value: firstValue,
          one_value: secondValue,
        };
      }
      // Full house.
      if (numFirstValues == 2) {
        if (numSecondValues == 2) {
          return {
            play: play.FULL_HOUSE,
            triplet_value: _.max(nonJokerValues),
            pair_value: _.min(nonJokerValues),
          };
        }
        return {
          play: play.FULL_HOUSE,
          triplet_value: secondValue,
          pair_value: firstValue,
        };
      }
      return {
        play: play.FULL_HOUSE,
        triplet_value: firstValue,
        pair_value: secondValue,
      };
    }
    // Flush.
    if (flushFound) {
      let values = [];
      for (v of nonJokerValues) {
        values.push(v);
      }
      for (let i = 0; i < numBlackJokers + numRedJokers; i++) {
        values.push(value.ACE);
      }
      return {
        play: play.FLUSH,
        values: values,
      };
    }
    // Straight.
    if (straightFound) {
      return {
        play: play.STRAIGHT,
        value: straightHighCard,
      };
    }
    throw 'Invalid poker hand';
  }
  throw 'Hand length not valid: ' + playedHand.length;
}

function checkSequence(currentPlay, previousPlay) {
  if (currentPlay.play == play.PASS || previousPlay.play == play.PASS) {
    return;
  }
  if (currentPlay.play < previousPlay.play) {
    throw 'Must not play a worse hand type than the previous';
  }
  if (previousPlay.play == play.HIGH_CARD) {
    if (currentPlay.play != play.HIGH_CARD) {
      throw 'Must play a high card on a high card';
    }
    if (currentPlay.value <= previousPlay.value) {
      throw 'Must play a strictly higher high card';
    }
    return;
  }
  if (previousPlay.play == play.PAIR) {
    if (currentPlay.play != play.PAIR) {
      throw 'Must play a pair on a pair';
    }
    if (currentPlay.value <= previousPlay.value) {
      throw 'Must play a strictly higher pair';
    }
    return;
  }
  if (previousPlay.play == play.TRIPLET) {
    if (currentPlay.play != play.TRIPLET) {
      throw 'Must play a triplet on a triplet';
    }
    if (currentPlay.value <= previousPlay.value) {
      throw 'Must play a strictly higher triplet';
    }
    return;
  }
  if (currentPlay.play > previousPlay.play) {
    return;
  }
  // Straight.
  if (currentPlay.play == play.STRAIGHT) {
    if (currentPlay.value > previousPlay.value) {
      return;
    }
    throw 'Must play a strictly higher straight';
  }
  // Flush.
  if (currentPlay.play == play.FLUSH) {
    for (let i = currentPlay.values.length - 1; i >= 0; i--) {
      if (currentPlay.values[i] > previousPlay.values[i]) {
        return;
      }
      if (currentPlay.values[i] < previousPlay.values[i]) {
        break;
      }
    }
    throw 'Must play a strictly higher flush';
  }
  // Full house.
  if (currentPlay.play == play.FULL_HOUSE) {
    if (currentPlay.triplet_value > previousPlay.triplet_value || (currentPlay.triplet_value === previousPlay.triplet_value && currentPlay.pair_value > previousPlay.pair_value)) {
      return;
    }
    throw 'Must play a strictly higher full house';
  }
  // Four of a kind.
  if (currentPlay.play == play.FOUR_OF_A_KIND) {
    if (currentPlay.four_value > previousPlay.four_value || (currentPlay.four_value === previousPlay.four_value && currentPlay.one_value > previousPlay.one_value)) {
      return;
    }
    throw 'Must play a strictly higher four-of-a-kind';
  }
  // Straight flush.
  if (currentPlay.play == play.STRAIGHT_FLUSH) {
    if (currentPlay.value > previousPlay.value) {
      return;
    }
    throw 'Must play a strictly higher straight flush';
  }
  // Five of a kind.
  if (currentPlay.play == play.FIVE_OF_A_KIND) {
    if (currentPlay.value > previousPlay.value) {
      return;
    }
    throw 'Must play a strictly higher five-of-a-kind';
  }
  throw 'Unrecognized play';
}

function createGame() {
  if (players.length % 2 != 0) {
    throw 'Must have an even number of players';
  }
  let deck = createAndShuffleDeck(players.length / 2);
  if (deck.length != players.length * handSize) {
    throw 'Created bad deck';
  }
  let gamePlayers = [];
  let firstPlayer = -1;
  let lastActions = [];
  for (let p = 0; p < players.length; p++) {
    let hand = deck.splice(0, handSize);
    hand.sort(function(a, b) {
      return a.value - b.value;
    });
    if (_.findIndex(hand, function(o) {
      return _.isEqual(o, createCard(value.THREE, suit.CLUBS, true));
    }) >= 0) {
      if (firstPlayer >= 0) {
        throw 'Multiple first players found';
      }
      firstPlayer = p;
    }
    gamePlayers.push(createPlayer(players[p], hand));
    lastActions.push('');
  }
  if (firstPlayer < 0) {
    throw 'Could not find starting player';
  }
  return {
    gamePlayers: gamePlayers,
    currentPlayer: firstPlayer, // Index.
    roundStarter: firstPlayer,  // Index.
    lastPlayer: -1,             // Index.
    previousPlay: { play: play.PASS },
    lastActions: lastActions,   // Reset every round.
    advance: function(username, playedHand) {
      if (username !== gamePlayers[currentPlayer].username) {
        throw 'Invalid play by ' + username + '; only the current player (' + gamePlayers[currentPlayer].username + ') can play';
      }
      let currentPlay = getPlay(playedHand);
      checkSequence(
        currentPlay,
        currentPlayer === lastPlayer ? { play: play.PASS } : previousPlay
      );
      gamePlayers[currentPlayer].playHand(playedHand);
      let newHand = gamePlayers[currentPlayer].hand;
      if (currentPlayer === lastPlayer) {
        roundStarter = currentPlayer;
        for (let i = 0; i < lastActions.length; i++) {
          lastActions[i] = '';
        }
      }
      lastPlayer = currentPlayer;
      previousPlay = currentPlay;
      let actionString = '';
      if (currentPlay.play === play.PASS) {
        actionString = 'passed';
      } else {
        actionString = 'played a ' + playToString(currentPlay.play);
      }
      lastActions[currentPlayer] = actionString;
      let newCurrentPlayer = currentPlayer;
      do {
        newCurrentPlayer++;
        if (newCurrentPlayer === currentPlayer) {
          // TODO: Game over.
          break;
        }
      } while (gamePlayers[newCurrentPlayer].hand.length === 0);
      return newHand;
    },
  };
}

io.on('connection', (socket) => {
  socket.on('play', (uid, playedHand) => {
    if (!isPlayer(uid)) {
      socket.emit('play error', {err: 'Invalid user ID'});
    }
    try {
      let newHand = game.advance(uidToPlayer.get(uid), playedHand);
      if (playedHand.length > 0) {
        socket.emit('new hand', {hand: newHand});
      }
      // TODO: Broadcast play.
    } catch (err) {
      socket.emit('play error', {err: err.message});
    }
  });
});
