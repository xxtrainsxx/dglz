$('#play-again').click(function() {
  socket.send('play again');
});

$('#back-to-lobby').click(function() {
  socket.send('back to lobby');
});

socket.on('message', (msg) => {
  if (msg === 'reload') {
    location.reload();
  }
});

socket.on('game error', (data) => {
  $('body').html(
    '<div class="center" style="text-align:center">' +
    '<h1>Error</h1>' +
    '<br>' +
    data.err +
    '</div>'
  );
});
