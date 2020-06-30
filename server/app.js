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
const lobbyHtml = readFile('../client/lobby.html');
const lobbyJs = readFile('../client/src/lobby.js');
const gameHtml = readFile('../client/game.html');
const gamePlayersHtml = readFile('../client/game_players.html');
const gameCenterHtml = readFile('../client/game_center.html');
const gameHandHtml = readFile('../client/game_hand.html');
const gameJs = readFile('../client/src/game.js');
const tributeModal = readFile('../client/tribute_modal.html');
const gameInProgressHtml = readFile('../client/game_in_progress.html');
const gameOverHtml = readFile('../client/game_over.html');
const gameOverJs = readFile('../client/src/game_over.js');

const deckSize = 54;
const handSize = deckSize / 2;

const port = process.env.PORT || 8000;

var numDecks = 0;
var game = null;
var tributes = null;
var players = [];     // Player names.
var uidToPlayer = new Map();
var spectators = [];  // Spectator UIDs.

hb.registerPartial('joinModal', joinModal.toString());

app.listen(port);

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
      numDecks: numDecks,
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
      numDecks: numDecks,
      script: '',
      body: hb.compile(homeHtml.toString())(),
    }));
  }
}

function getGamePageTitle(uid) {
  let username = uidToPlayer.get(uid);
  if (tributes) {
    for (t of tributes) {
      if (t.giver === username && !t.hasOwnProperty('giverSent')) {
        return 'Send a tribute to ' + t.receiver;
      }
      if (t.receiver === username && !t.hasOwnProperty('receiverSent')) {
        return 'Send an anti-tribute to ' + t.giver;
      }
    }
    return 'Waiting for tributes';
  }
  let currentPlayerUsername = game.gamePlayers[game.currentPlayer].username;
  return currentPlayerUsername === username ? 'Your turn!' : currentPlayerUsername + '\'s turn';
}

function getPlayerObjects(uid) {
  let playerObjs = [];
  for (let i = 0; i < game.gamePlayers.length; i++) {
    let isCurrentPlayer = uidToPlayer.get(uid) === game.gamePlayers[i].username;
    let youString = isCurrentPlayer ? ' (you)' : '';
    playerObjs.push({
      username: game.gamePlayers[i].username + youString,
      handSize: game.gamePlayers[i].hand.length,
      lastPlayed: game.lastActions[i],
    });
  }
  return playerObjs;
}

function doGetGame(uid, req, res) {
  if (isPlayer(uid) || isSpectator(uid)) {
    let currentGameState = game.getGameState();
    if (currentGameState === gameState.IN_PROGRESS) {
      let hand = null;
      for (let i = 0; i < game.gamePlayers.length; i++) {
        if (uidToPlayer.get(uid) === game.gamePlayers[i].username) {
          hand = game.gamePlayers[i].hand;
          break;
        }
      }
      res.writeHead(200);
      res.end(hb.compile(
        indexHtml.toString(),
        {noEscape: true},
      )({
        numDecks: numDecks,
        script: gameJs,
        body: hb.compile(
          gameHtml.toString(),
          {noEscape: true},
        )({
          title: getGamePageTitle(uid),
          gamePlayers: hb.compile(
            gamePlayersHtml.toString(),
            {noEscape: true},
          )({
            players: getPlayerObjects(uid),
          }),
          spectators: spectators.length,
          gameCenter: hb.compile(gameCenterHtml.toString())(),
          isPlayer: isPlayer(uid),
          gameHand: hb.compile(gameHandHtml.toString())({
            hand: hand,
          }),
          tributing: tributes !== null,
        }),
      }));
    } else {
      let playersByTeam = game.getPlayersByTeam();
      let winningTeamList = currentGameState === gameState.TEAM_ONE_WON ? playersByTeam.teamOne : playersByTeam.teamTwo;
      res.writeHead(200);
      res.end(hb.compile(
        indexHtml.toString(),
        {noEscape: true},
      )({
        numDecks: numDecks,
        script: gameOverJs,
        body: hb.compile(gameOverHtml.toString())({
          message: getUsernameWinString(winningTeamList),
          playerOne: isPlayerOne(uid),
        }),
      }));
    }
  } else {
    res.writeHead(200);
    res.end(hb.compile(
      indexHtml.toString(),
      {noEscape: true},
    )({
      numDecks: numDecks,
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
      username = _.escape(data.username);
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

const gameState = {
  IN_PROGRESS: 1,
  TEAM_ONE_WON: 2,
  TEAM_TWO_WON: 3,
}

function getUnicodePlayingCard(card) {
  // The first of the block (a card back).
  // https://en.wikipedia.org/wiki/Playing_cards_in_Unicode
  let unicode = 56480;
  switch (card.value) {
    case value.ACE:
      unicode += 1;
      break;
    case value.TWO:
      unicode += 2;
      break;
    case value.THREE:
      unicode += 3;
      break;
    case value.FOUR:
      unicode += 4;
      break;
    case value.FIVE:
      unicode += 5;
      break;
    case value.SIX:
      unicode += 6;
      break;
    case value.SEVEN:
      unicode += 7;
      break;
    case value.EIGHT:
      unicode += 8;
      break;
    case value.NINE:
      unicode += 9;
      break;
    case value.TEN:
      unicode += 10;
      break;
    case value.JACK:
      unicode += 11;
      break;
    // 12 is the Knight.
    case value.QUEEN:
      unicode += 13;
      break;
    case value.KING:
      unicode += 14;
      break;
  }
  switch (card.suit) {
    // Spades come first in the block.
    case suit.HEARTS:
      unicode += 16;
      break;
    case suit.DIAMONDS:
      unicode += 16 * 2;
      break;
    case suit.CLUBS:
      unicode += 16 * 3;
      break;
  }
  return '\ud83c' + String.fromCharCode(unicode);
}

function playToString(playedHand) {
  let cardString = '';
  for (card of playedHand) {
    let makeRed = false;
    let unicode = '';
    if (isJoker(card)) {
      unicode = '🃟';
      makeRed = card.value == value.RED_JOKER;
    } else {
      unicode = getUnicodePlayingCard(card);
      makeRed = card.suit == suit.DIAMONDS || card.suit == suit.HEARTS;
    }
    cardString += '<span style="font-size:50px;' +
                  (makeRed ? 'color:red' : '') +
                  '">' +
                  unicode +
                  '</span>';
  }
  return cardString;
}

function createCard(i, v, s = undefined) {
  return {
    deckIndex: i,
    value: v,
    suit: s,
  };
}

function createAndShuffleDeck(n) {
  numDecks = n;
  let deck = [];
  for (let i = 0; i < n; i++) {
    // Add threes through twos.
    for (v of [value.THREE, value.FOUR, value.FIVE, value.SIX, value.SEVEN, value.EIGHT, value.NINE, value.TEN, value.JACK, value.QUEEN, value.KING, value.ACE, value.TWO]) {
      for (s of [suit.CLUBS, suit.DIAMONDS, suit.HEARTS, suit.SPADES]) {
        deck.push(createCard(i, v, s))
      }
    }
    // Add jokers.
    deck.push(createCard(i, value.BLACK_JOKER));
    deck.push(createCard(i, value.RED_JOKER));
  }
  return _.shuffle(deck);
}

function createPlayer(username, startingHand) {
  return {
    username: username,
    hand: startingHand,
    playHand: function(playedHand) {
      if (playedHand == null) {
        return;
      }
      for (card of playedHand) {
        const i = _.findIndex(this.hand, function(o) {
          return o.value === card.value && o.suit === card.suit;
        });
        if (i < 0) {
          throw {message: 'Cannot play card not in hand'};
        }
        this.hand.splice(i, 1);
      }
    },
  };
}

function isJoker(card) {
  return card.value === value.BLACK_JOKER || card.value === value.RED_JOKER;
}

function getPlay(playedHand) {
  if (playedHand == null) {
    return {play: play.PASS};
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
    throw {message: 'Invalid pair'};
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
        throw {message: 'Invalid triplet'};
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
      jokersUsed += Math.max(0, (nonJokerValues[i] - nonJokerValues[i - 1]) - 1);
    }
    let leftoverJokers = numBlackJokers + numRedJokers - jokersUsed;
    let straightFound = leftoverJokers >= 0;
    let straightHighCard = null;
    if (straightFound) {
      straightHighCard = Math.min(value.ACE, nonJokerValues[nonJokerValues.length - 1] + leftoverJokers);
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
    throw {message: 'Invalid poker hand'};
  }
  throw {message: 'Hand length not valid: ' + playedHand.length};
}

function checkSequence(currentPlay, previousPlay) {
  if (currentPlay.play == play.PASS || previousPlay.play == play.PASS) {
    return;
  }
  if (previousPlay.play == play.HIGH_CARD) {
    if (currentPlay.play != play.HIGH_CARD) {
      throw {message: 'Must play a high card on a high card'};
    }
    if (currentPlay.value <= previousPlay.value) {
      throw {message: 'Must play a strictly higher high card'};
    }
    return;
  }
  if (previousPlay.play == play.PAIR) {
    if (currentPlay.play != play.PAIR) {
      throw {message: 'Must play a pair on a pair'};
    }
    if (currentPlay.value <= previousPlay.value) {
      throw {message: 'Must play a strictly higher pair'};
    }
    return;
  }
  if (previousPlay.play == play.TRIPLET) {
    if (currentPlay.play != play.TRIPLET) {
      throw {message: 'Must play a triplet on a triplet'};
    }
    if (currentPlay.value <= previousPlay.value) {
      throw {message: 'Must play a strictly higher triplet'};
    }
    return;
  }
  if (currentPlay.play > previousPlay.play) {
    return;
  }
  if (currentPlay.play < previousPlay.play) {
    throw {message: 'Must not play a worse hand type than the previous'};
  }
  // Straight.
  if (currentPlay.play == play.STRAIGHT) {
    if (currentPlay.value > previousPlay.value) {
      return;
    }
    throw {message: 'Must play a strictly higher straight or a better poker hand'};
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
    throw {message: 'Must play a strictly higher flush or a better poker hand'};
  }
  // Full house.
  if (currentPlay.play == play.FULL_HOUSE) {
    if (currentPlay.triplet_value > previousPlay.triplet_value || (currentPlay.triplet_value === previousPlay.triplet_value && currentPlay.pair_value > previousPlay.pair_value)) {
      return;
    }
    throw {message: 'Must play a strictly higher full house or a better poker hand'};
  }
  // Four of a kind.
  if (currentPlay.play == play.FOUR_OF_A_KIND) {
    if (currentPlay.four_value > previousPlay.four_value || (currentPlay.four_value === previousPlay.four_value && currentPlay.one_value > previousPlay.one_value)) {
      return;
    }
    throw {message: 'Must play a strictly higher four-of-a-kind or a better poker hand'};
  }
  // Straight flush.
  if (currentPlay.play == play.STRAIGHT_FLUSH) {
    if (currentPlay.value > previousPlay.value) {
      return;
    }
    throw {message: 'Must play a strictly higher straight flush or a better poker hand'};
  }
  // Five of a kind.
  if (currentPlay.play == play.FIVE_OF_A_KIND) {
    if (currentPlay.value > previousPlay.value) {
      return;
    }
    throw {message: 'Must play a strictly higher five-of-a-kind'};
  }
  throw {message: 'Unrecognized play'};
}

function createGame() {
  if (players.length % 2 != 0) {
    throw {message: 'Must have an even number of players'};
  }
  let deck = createAndShuffleDeck(players.length / 2);
  if (deck.length != players.length * handSize) {
    throw {err: 'Created bad deck'};
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
      return _.isEqual(o, createCard(0, value.THREE, suit.CLUBS));
    }) >= 0) {
      if (firstPlayer >= 0) {
        throw {message: 'Multiple first players found'};
      }
      firstPlayer = p;
    }
    gamePlayers.push(createPlayer(players[p], hand));
    lastActions.push('');
  }
  if (firstPlayer < 0) {
    throw {message: 'Could not find starting player'};
  }
  return {
    gamePlayers: gamePlayers,
    currentPlayer: firstPlayer, // Index.
    roundStarter: firstPlayer,  // Index.
    lastPlayer: -1,             // Index.
    previousPlay: {play: play.PASS},
    lastActions: lastActions,   // Reset every round.
    gameState: gameState.IN_PROGRESS,
    teamOneOut: [],
    teamTwoOut: [],
    getPlayersByTeam: function() {
      let teamOne = [];
      let teamTwo = [];
      for (let p = 0; p < this.gamePlayers.length; p++) {
        if (p % 2 === 0) {
          teamOne.push(this.gamePlayers[p]);
        } else {
          teamTwo.push(this.gamePlayers[p]);
        }
      }
      return {
        teamOne: teamOne,
        teamTwo: teamTwo,
      };
    },
    getGameState: function() {
      if (this.gameState !== gameState.IN_PROGRESS) {
        return this.gameState;
      }
      let playersByTeam = this.getPlayersByTeam();
      let teamOneHasCards = false;
      let teamTwoHasCards = false;
      for (p of playersByTeam.teamOne) {
        if (p.hand.length > 0) {
          teamOneHasCards = true;
          break;
        }
      }
      for (p of playersByTeam.teamTwo) {
        if (p.hand.length > 0) {
          if (teamOneHasCards) {
            return gameState.IN_PROGRESS;
          }
          teamTwoHasCards = true;
          break;
        }
      }
      let newGameState = teamOneHasCards ? gameState.TEAM_TWO_WON : gameState.TEAM_ONE_WON;
      this.gameState = newGameState;
      return newGameState;
    },
    getTributes: function() {
      let tributes = [];
      let receivers = this.getGameState() === gameState.TEAM_ONE_WON ? this.teamOneOut : this.teamTwoOut;
      let receiversIndex = 0;
      for (p of this.gamePlayers) {
        if (p.hand.length > 0) {
          tributes.push({
            giver: p.username,
            receiver: receivers[receiversIndex],
          });
          receiversIndex++;
        }
      }
      return tributes;
    },  // Should only be called once the game is over.
    validateTribute: function(username, selectedCards) {
      if (!selectedCards) {
        throw {message: 'Select a card'};
      }
      let player = null;
      for (p of this.gamePlayers) {
        if (p.username === username) {
          player = p;
          break;
        }
      }
      if (player == null) {
        throw {message: 'Could not find player'};
      }
      for (t of tributes) {
        if (t.giver === username) {
          if (selectedCards.length !== 1) {
            throw {message: 'Must select exactly one card'};
          }
          if (t.hasOwnProperty('giverSent')) {
            throw {message: 'Already sent a card'};
          }
          let sortedHand = _.sortBy(player.hand, [function(o) {
            return o.value;
          }]);
          if (selectedCards[0].value != sortedHand[sortedHand.length - 1].value) {
            throw {message: 'Must select highest card in hand'};
          }
          return;
        }
        if (t.receiver === username) {
          if (selectedCards.length !== 1) {
            throw {message: 'Must select exactly one card'};
          }
          if (t.hasOwnProperty('receiverSent')) {
            throw {message: 'Already sent a card'};
          }
          return;
        }
      }
      throw {message: 'Waiting for tributes'};
    },
    validate: function(username, playedHand) {
      if (username !== this.gamePlayers[this.currentPlayer].username) {
        throw {message: 'Not your turn'};
      }
      let currentPlay = getPlay(playedHand);
      checkSequence(
        currentPlay,
        this.currentPlayer === this.lastPlayer ? {play: play.PASS} : this.previousPlay
      );
      return currentPlay;
    },
    sendTribute: function(username, selectedCards) {
      this.validateTribute(username, selectedCards);
      let newHand = null;
      for (p of this.gamePlayers) {
        if (p.username === username) {
          p.playHand(selectedCards);
          newHand = p.hand;
          break;
        }
      }
      let receiver = null;
      for (t of tributes) {
        if (t.giver === username) {
          receiver = t.receiver;
          t.giverSent = selectedCards[0];
          break;
        }
        if (t.receiver === username) {
          receiver = t.giver;
          t.receiverSent = selectedCards[0];
          break;
        }
      }
      if (receiver == null) {
        throw {message: 'Could not find recipient'};
      }
      for (p of this.gamePlayers) {
        if (p.username === receiver) {
          p.hand.push(selectedCards[0]);
          p.hand = _.sortBy(p.hand, [function(o) {
            return o.value;
          }]);
          break;
        }
      }
      for (let [k, v] of uidToPlayer) {
        if (v === receiver) {
          return {
            receiverUid: k,
            newHand: newHand,
          };
        }
      }
    },
    advance: function(username, playedHand) {
      let currentPlay = this.validate(username, playedHand);
      this.gamePlayers[this.currentPlayer].playHand(playedHand);
      let newHand = this.gamePlayers[this.currentPlayer].hand;
      if (newHand.length === 0) {
        if (this.currentPlayer % 2 === 0) {
          this.teamOneOut.push(this.gamePlayers[this.currentPlayer].username);
        } else {
          this.teamTwoOut.push(this.gamePlayers[this.currentPlayer].username);
        }
      }
      let currentGameState = this.getGameState();
      if (currentGameState != gameState.IN_PROGRESS) {
        return {state: currentGameState};
      }
      if (this.currentPlayer === this.lastPlayer) {
        this.roundStarter = this.currentPlayer;
        for (let i = 0; i < this.lastActions.length; i++) {
          this.lastActions[i] = '';
        }
      }
      if (currentPlay.play !== play.PASS) {
        this.lastPlayer = this.currentPlayer;
        this.previousPlay = currentPlay;
        io.emit('update', {
          requestUpdate: false,
          gameCenter: hb.compile(gameCenterHtml.toString())({
            lastPlay: playedHand,
          }),
        });
      }
      let actionString = '';
      if (currentPlay.play === play.PASS) {
        actionString = 'PASS';
      } else {
        actionString = '<br>' + playToString(playedHand);
      }
      this.lastActions[this.currentPlayer] = actionString;
      let newCurrentPlayer = this.currentPlayer;
      do {
        newCurrentPlayer = (newCurrentPlayer + 1) % this.gamePlayers.length;
      } while (this.gamePlayers[newCurrentPlayer].hand.length === 0);
      this.currentPlayer = newCurrentPlayer;
      return {
        state: gameState.IN_PROGRESS,
        newHand: newHand,
      };
    },
  };
}

function resetAllState() {
  game = null;
  tributes = null;
  players = [];
  uidToPlayer = new Map();
  spectators = [];
}

function sendErrorAndDeleteGame(errMessage) {
  resetAllState();
  io.emit('game error', {err: errMessage});
}

function getUsernameWinString(playerList) {
  if (playerList.length === 0) {
    return '';
  }
  if (playerList.length === 1) {
    return playerList[0].username + ' wins!';
  }
  if (playerList.length === 2) {
    return playerList[0].username + ' and ' + playerList[1].username + ' win!';
  }
  let usernameString = '';
  for (let p = 0; p < playerList.length; p++) {
    if (p === playerList.length - 1) {
      usernameString += ' and ' + playerList[p].username;
    } else {
      usernameString += playerList[p].username + ', ';
    }
  }
  return usernameString + ' win!';
}

io.on('connection', (socket) => {
  socket.on('check', (uid, playedHand) => {
    if (!isPlayer(uid)) {
      socket.emit('check error', {err: 'Invalid user ID'});
    }
    let username = uidToPlayer.get(uid);
    if (tributes) {
      try {
        game.validateTribute(username, playedHand);
        socket.emit('check ok', {});
      } catch (err) {
        socket.emit('check error', {err: err.message});
      }
    } else {
      try {
        let currentPlay = game.validate(username, playedHand);
        socket.emit('check ok', {pass: currentPlay.play === play.PASS});
      } catch (err) {
        socket.emit('check error', {err: err.message});
      }
    }
  });

  socket.on('send card', (uid, selectedCards) => {
    if (!isPlayer(uid)) {
      sendErrorAndDeleteGame('User with invalid ID attempted to send card');
      return;
    }
    try {
      let result = game.sendTribute(uidToPlayer.get(uid), selectedCards);
      socket.emit('update', {
        requestUpdate: true,
        gameHand: hb.compile(gameHandHtml.toString())({
          hand: result.newHand,
        }),
      });
      socket.broadcast.emit('update', {
        requestUpdate: true,
      });
    } catch (err) {
      sendErrorAndDeleteGame(err.message);
    }
    let tributesDone = false;
    let tributeStrings = [];
    if (tributes) {
      tributesDone = true;
      for (t of tributes) {
        if (!t.hasOwnProperty('giverSent') || !t.hasOwnProperty('receiverSent')) {
          tributesDone = false;
          break;
        }
        tributeStrings.push(t.giver + ' sent ' + t.receiver + ' ' + playToString([t.giverSent]));
        tributeStrings.push(t.receiver + ' returned ' + t.giver + ' ' + playToString([t.receiverSent]));
      }
      if (tributesDone) {
        tributes = null;
        io.emit('tribute summary', {
          tributeModalHtml: hb.compile(
            tributeModal.toString(),
            {noEscape: true},
          )({
            tributes: tributeStrings,
          }),
        });
      }
    }
  });

  socket.on('play', (uid, playedHand) => {
    if (!isPlayer(uid)) {
      sendErrorAndDeleteGame('User with invalid ID attempted to play');
      return;
    }
    try {
      let result = game.advance(uidToPlayer.get(uid), playedHand);
      if (result.state !== gameState.IN_PROGRESS) {
        io.send('game over');
        return;
      }
      socket.emit('update', {
        requestUpdate: false,
        title: getGamePageTitle(uid),
        gamePlayers: hb.compile(
          gamePlayersHtml.toString(),
          {noEscape: true},
        )({
          players: getPlayerObjects(uid),
        }),
        gameHand: hb.compile(gameHandHtml.toString())({
          hand: result.newHand,
        }),
      });
      socket.broadcast.emit('update', {
        requestUpdate: true,
      });
    } catch (err) {
      sendErrorAndDeleteGame(err.message);
    }
  });

  socket.on('get update', (uid) => {
    if (isPlayer(uid) || isSpectator(uid)) {
      let hand = [];
      for (p of game.gamePlayers) {
        if (p.username === uidToPlayer.get(uid)) {
          hand = p.hand;
          break;
        }
      }
      socket.emit('update', {
        requestUpdate: false,
        title: getGamePageTitle(uid),
        gamePlayers: hb.compile(
          gamePlayersHtml.toString(),
          {noEscape: true},
        )({
          players: getPlayerObjects(uid),
        }),
        gameHand: hb.compile(gameHandHtml.toString())({
          hand: hand,
        }),
      });
    }
  });

  socket.on('message', (msg) => {
    if (msg === 'play again') {
      try {
        tributes = game.getTributes();
        game = createGame();
        io.send('reload');
      } catch (err) {
        io.emit('game error', {err: err.message});
      }
      return;
    }
    if (msg === 'exit') {
      resetAllState();
      io.send('reload');
    }
  });
});
