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

hb.registerPartial('joinModal', joinModal.toString());

app.listen(8000);

function handler (req, res) {
  res.writeHead(200);
  res.end(hb.compile(
    indexHtml.toString(),
    {noEscape: true},
  )({
    script: homeJs,
    body: hb.compile(homeHtml.toString())(),
  }));
}

io.on('connection', (socket) => {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', (data) => {
    console.log(data);
  });
});
