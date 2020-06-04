from handler import DglzRequestHandler
from http.server import HTTPServer

if __name__ == '__main__':
  try:
    server_name = ''
    server_port = 8000
    server = HTTPServer((server_name, server_port), DglzRequestHandler)
    print("DGLZ server running on port {port:d}".format(port = server_port))
    server.serve_forever()
  except KeyboardInterrupt:
    print("Stopping web server")
    server.socket.close()
