from random import shuffle

class Game:
  def __init__(self, players, current_player):
    self.players = players
    self.current_player = current_player

  def get_current_player_name(self):
    return self.players[self.current_player].name

  def advance(self, player_name, cards):
    if get_current_player_name() != player_name:
      raise Exception("Player is not the current player")
    self.players[self.current_player].play(cards)
    while True:
      self.current_player = (self.current_player + 1) % size(self.players)
      if size(self.players[self.current_player].hand) > 0:
        break

  def is_game_complete(self):
    team_one_has_cards = False
    team_two_has_cards = False
    for p in range(len(self.players)):
      if size(p.hand) == 0:
        continue
      if p % 2 == 0:
        team_one_has_cards = True
      else:
        team_two_has_cards = True
    return not team_one_has_cards or not team_two_has_cards

  # Should only be called once the game is complete.
  def num_tributes(self):
    return size(filter(lambda p: size(p.hand) > 0, self.players))

def create_and_shuffle_deck(num_decks):
  deck = []
  for i in range(num_decks):
    # Add threes.
    make_starting_three_of_clubs = i == 0
    deck.append(Card(THREE, CLUBS, is_starting_three_of_clubs=make_starting_three_of_clubs))
    for suit in [DIAMONDS, HEARTS, SPADES]:
      deck.append(Card(THREE, suit))
    # Add fours through twos.
    for value in [FOUR, FIVE, SIX, SEVEN, EIGHT, NINE, TEN, JACK, QUEEN, KING, ACE, TWO]:
      for suit in [CLUBS, DIAMONDS, HEARTS, SPADES]:
        deck.append(Card(value, suit))
    # Add jokers.
    deck.append(Card(BLACK_JOKER))
    deck.append(Card(RED_JOKER))
  deck.shuffle()
  return deck

DECK_SIZE = 54
HAND_SIZE = DECK_SIZE / 2

def create_game(player_names):
  if player_names % 2 != 0:
    raise Exception("Must have an even number of players")
  deck = create_and_shuffle_deck(size(player_names) / 2)
  if size(deck) != size(player_names) * HAND_SIZE:
    raise Exception("Bad deck created")
  players = []
  first_player = -1
  first_player_found = False
  for p in range(len(player_names)):
    hand = deck[p * HAND_SIZE:(p + 1) * HAND_SIZE]
    if Card(THREE, CLUBS, is_starting_three_of_clubs=True) in hand:
      if first_player_found:
        raise Exception("Multiple first players found")
      first_player = p
      first_player_found = True
    players.append(Player(player_names[p], hand))
  if first_player < 0:
    raise Exception("Could not find starting three of clubs")
  return Game(players, current_player)
