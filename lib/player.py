class Player:
  def __init__(self, name, starting_hand):
    self.name = name
    self.hand = starting_hand

  def play(self, cards):
    for card in cards:
      self.hand.remove(card)
