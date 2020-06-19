function setStartButtonEnable() {
  if ($('#player-list').children('li').length % 2 != 0) {
    $('#start-game').prop('disabled', true);
    $('#start-game').prop('title', 'Must have an even number of players');
  } else {
    $('#start-game').prop('disabled', false);
    $('#start-game').removeProp('title');
  }
}

function changePlayerAndOptionsHeight() {
  let numPlayers = $('#player-list').children('li').length;
  $('#player-div').css('height', 6.5 + (numPlayers * 1.5) + 'rem');
  $('#options-div').css('height', 6.5 + (numPlayers * 1.5) + 'rem');
}

setStartButtonEnable();

socket.on('new player', (data) => {
  $('#player-list').append('<li style="font-size:medium;height:1.5rem">' + data.username + '</li>');
  setStartButtonEnable();
  changePlayerAndOptionsHeight();
});

socket.on('player left', (data) => {
  $('#player-list').children('li').each(function (index) {
    if ($(this).text() === data.username) {
      $(this).remove();
      return false;
    }
  });
  setStartButtonEnable();
  changePlayerAndOptionsHeight();
});

socket.on('num spectators', (data) => {
  $('#spectators').text('Spectators: ' + data.numSpectators);
});

socket.on('message', (msg) => {
  if (msg === 'game started') {
    location.reload();
  }
});
