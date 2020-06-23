$('#play-again').click(function() {
  socket.send('play again');
});
$('#back-to-lobby').click(function() {
  socket.send('back to lobby');
});
