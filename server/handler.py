from cgi import FieldStorage
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler
from threading import Lock
from urllib.parse import urlparse

class DglzRequestHandler(BaseHTTPRequestHandler):
  _lock = Lock()
  _game = None
  _players = []
  _base_response = open('server/html/index.html').read()

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
    username = ""
    if parse_result.path == "/join":
      username = self._do_join()

    self.send_response(200)
    self.send_header('Content-type', 'text/html')
    self.end_headers()
    self.wfile.write(self._base_response.format(body = username).encode("utf-16"))

  def _do_join(self):
    form = FieldStorage(
      fp=self.rfile,
      headers=self.headers, 
      environ={
        'REQUEST_METHOD': 'POST', 
        'CONTENT_TYPE': self.headers['Content-Type'],
      }
    )
    username = form["username"].value
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
    self._lock.release()
    return username
