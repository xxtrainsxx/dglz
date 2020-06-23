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
