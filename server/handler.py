from asyncio import Lock
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler

class DglzRequestHandler(BaseHTTPRequestHandler):
  _lock = Lock()
  _game = None
  _players = []

  RESPONSE_BASE = '''
  <html>
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css" integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk" crossorigin="anonymous">
  <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js" integrity="sha384-DfXdz2htPH0lsSSs5nCTpuj/zy4C+OGpamoFVy38MVBnE+IbbVYUew+OrCXaRkfj" crossorigin="anonymous"></script>
  <body>
  {body:s}
  </body>
  </html>
  '''

  def do_GET(self):
    self.send_response(200)
    self.send_header('Content-type', 'text/html')
    self.end_headers()
    self.wfile.write(self.RESPONSE_BASE.format(body = self._get_body()).encode("utf-8"))

  def _get_body(self):
    # TODO: Check cookie.
    # TODO: Show options/controls to player one.
    if self._game is None:
      # TODO: Acquire and release lock.
      # TODO: Show player list.
      return '''
      <button id="join-as-player">Join as player</button>
      <button id="join-as-spectator">Join as spectator</button>
      '''
    return '''
    Game in progress
    <button id="spectate">Spectate game</button>
    '''

  def do_POST(self):
    # TODO: Check action and cookie.
    # TODO: Acquire and release lock.
    pass
