from cgi import FieldStorage
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler
from random import randint
from sys import maxsize
from threading import Lock
from urllib.parse import urlparse

class DglzRequestHandler(BaseHTTPRequestHandler):
  _base_response = open('server/html/index.html').read()
  _game = None
  _lock = Lock()
  _players = []
  _uid_to_player = dict()

  def do_GET(self):
    self.send_response(200)
    self.send_header('Content-type', 'text/html')
    self.end_headers()
    self.wfile.write(self._base_response.format(body = self._get_body()).encode("utf-16"))

  def _get_body(self):
    # TODO: Check cookie.
    # TODO: Show options/controls to player one.
    if self._game is None:
      # TODO: Acquire and release lock.
      # TODO: Show player list.
      return open('server/html/home.html').read()
    return '''
    Game in progress
    <form method="post" action="spectate">
      <button type="submit" class="btn btn-primary" id="spectate">Spectate game</button>
    </form>
    '''

  def do_POST(self):
    parse_result = urlparse(self.path)
    if parse_result.path == '/join':
      self._do_join()

  def _do_join(self):
    if not self._game is None:
      self.send_response(400)
      self.send_header('Content-type', 'text/html')
      self.end_headers()
      self.wfile.write(self._base_response.format(body = 'Cannot join a game already in progress').encode("utf-16"))
      return

    form = FieldStorage(
      fp=self.rfile,
      headers=self.headers, 
      environ={
        'REQUEST_METHOD': 'POST', 
        'CONTENT_TYPE': self.headers['Content-Type'],
      }
    )
    username = form['username'].value
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
    uid = randint(0, maxsize)
    while uid in self._uid_to_player:
      uid = randint(0, maxsize)
    self._uid_to_player[uid] = username
    self._lock.release()

    cookie = SimpleCookie()
    cookie['uid'] = uid
    self.send_response(200)
    self.send_header('Content-type', 'text/html')
    self.send_header('Set-Cookie', cookie['uid'].OutputString())
    self.end_headers()
    self.wfile.write(self._base_response.format(body = str(uid)).encode("utf-16"))
