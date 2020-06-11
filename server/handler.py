from cgi import FieldStorage
from html import escape
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler
from random import randint
from sys import maxsize
from threading import Lock
from urllib.parse import urlparse

class DglzRequestHandler(BaseHTTPRequestHandler):
  BASE_RESPONSE = open('server/html/index.html').read()
  SPECTATE_BUTTON = '<form method="post" action="spectate" style="margin:0;position:absolute;bottom:0"><button type="submit" class="btn btn-secondary">Become spectator</button></form>'
  JOIN_GAME_BUTTON = '<form method="post" action="join" style="margin:0;position:absolute;bottom:0"><button type="submit" class="btn btn-primary">Join game</button></form>'

  _lock = Lock()
  _game = None
  _players = []  # Player names
  _uid_to_player = dict()
  _spectators = []  # Spectator uids

  def _game_started(self):
    self._lock.acquire()
    started = not self._game is None
    self._lock.release()
    return started

  def _create_uid_unsafe(self):
    uid = randint(0, maxsize)
    while uid in self._uid_to_player or uid in self._spectators:
      uid = randint(0, maxsize)
    return uid

  def _uid_is_player(self, uid):
    self._lock.acquire()
    exists = uid in self._uid_to_player
    self._lock.release()
    return exists

  def _uid_is_spectator(self, uid):
    self._lock.acquire()
    exists = uid in self._spectators
    self._lock.release()
    return exists

  def _get_player_by_uid(self, uid):
    self._lock.acquire()
    player = self._uid_to_player[uid]
    self._lock.release()
    return player

  def _get_player_list_html(self, uid):
    player_list = ''
    self._lock.acquire()
    for p in self._players:
      player_list += '<li style="font-size:medium;height:1.5rem">' + p
      if uid in self._uid_to_player and self._uid_to_player[uid] == p:
        player_list += ' (you)'
      player_list += '</li>'
    self._lock.release()
    return player_list

  def _num_players(self):
    self._lock.acquire()
    num = len(self._players)
    self._lock.release()
    return num

  def _num_spectators(self):
    self._lock.acquire()
    num = len(self._spectators)
    self._lock.release()
    return num

  def _is_spectator(self, uid):
    self._lock.acquire()
    is_spectator = uid in self._spectators
    self._lock.release()
    return is_spectator

  def do_GET(self):
    self.send_response(200)
    self.send_header('Content-type', 'text/html')
    self.end_headers()
    self.wfile.write(self.BASE_RESPONSE.format(body = self._get_body()).encode("utf-16"))

  def _get_body(self):
    # TODO: Create in-game view.
    if self._game_started():
      # TODO: Move this to a file.
      return '''
      Game in progress
      <form method="post" action="spectate">
        <button type="submit" class="btn btn-primary">Spectate game</button>
      </form>
      '''
    cookie = SimpleCookie(self.headers.get('Cookie'))
    if 'uid' in cookie:
      uid = int(cookie['uid'].value)
      is_player = self._uid_is_player(uid)
      is_spectator = self._uid_is_spectator(uid)
      if is_player or is_spectator:
        lobby_html = open('server/html/lobby.html').read()
        height = 6.5 + (self._num_players() * 1.5)
        player_list = self._get_player_list_html(uid)
        username = self._get_player_by_uid(uid) if is_player else ''
        if username == self._players[0]:
          game_options_html = open('server/html/game_options.html').read()
          return lobby_html.format(
            title = 'Waiting for players',
            padding = 30,
            width = 50,
            height = height,
            players = player_list,
            spectators = self._num_spectators(),
            button = self.SPECTATE_BUTTON,
            options = game_options_html.format(height = height),
          )
        return lobby_html.format(
          title = 'Waiting for Player 1',
          padding = 45,
          width = 100,
          height = height,
          players = player_list,
          spectators = self._num_spectators(),
          button = self.SPECTATE_BUTTON if is_player else self.JOIN_GAME_BUTTON,
          options = '',
        )
    return open('server/html/home.html').read()

  def do_POST(self):
    parse_result = urlparse(self.path)
    if parse_result.path == '/join':
      self._do_join()
    if parse_result.path == '/spectate':
      self._do_spectate()
    # TODO: /start

  # TODO: Remove player from spectators if necessary.
  def _do_join(self):
    if self._game_started():
      self.send_response(400)
      self.send_header('Content-type', 'text/html')
      self.end_headers()
      self.wfile.write(self.BASE_RESPONSE.format(body = 'Cannot join a game already in progress').encode("utf-16"))
      return

    form = FieldStorage(
      fp=self.rfile,
      headers=self.headers, 
      environ={
        'REQUEST_METHOD': 'POST', 
        'CONTENT_TYPE': self.headers['Content-Type'],
      }
    )
    username = escape(form['username'].value)
    if username == '':
      username = '[empty string]'
    # Create a unique username.
    self._lock.acquire()
    if username in self._players:
      suffix = 1
      while True:
        username += str(suffix)
        suffix += 1
        if not username in self._players:
          break
    self._players.append(username)
    uid = self._create_uid_unsafe()
    self._uid_to_player[uid] = username
    self._lock.release()

    cookie = SimpleCookie()
    cookie['uid'] = uid
    self.send_response(303)
    self.send_header('Content-type', 'text/html')
    self.send_header('Location', '/')
    self.send_header('Set-Cookie', cookie['uid'].OutputString())
    self.end_headers()

  def _do_spectate(self):
    cookie = SimpleCookie(self.headers.get('Cookie'))
    uid = -1
    if 'uid' in cookie:
      uid = int(cookie['uid'].value)
      if self._uid_is_player(uid):
        self._lock.acquire()
        self._players.remove(self._uid_to_player[uid])
        self._lock.release()
    else:
      self._lock.acquire()
      uid = self._create_uid_unsafe()
      self._lock.release()
    self._lock.acquire()
    self._spectators.append(uid)
    self._lock.release()

    cookie = SimpleCookie()
    cookie['uid'] = uid
    self.send_response(303)
    self.send_header('Content-type', 'text/html')
    self.send_header('Location', '/')
    self.send_header('Set-Cookie', cookie['uid'].OutputString())
    self.end_headers()
