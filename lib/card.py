from enum import Enum

class Value(Enum):
  THREE = 1
  FOUR = 2
  FIVE = 3
  SIX = 4
  SEVEN = 5
  EIGHT = 6
  NINE = 7
  TEN = 8
  JACK = 9
  QUEEN = 10
  KING = 11
  ACE = 12
  TWO = 13
  BLACK_JOKER = 14
  RED_JOKER = 15

class Suit(Enum):
  CLUBS = 1
  DIAMONDS = 2
  HEARTS = 3
  SPADES  = 4

class Card:
  def __init__(self, value, suit = None, is_starting_three_of_clubs = False):
    self.value = value
    self.suit = suit
    self.is_starting_three_of_clubs = is_starting_three_of_clubs

  def __eq__(self, other):
    if not isinstance(other, Card):
      return NotImplemented
    return self.value == other.value && self.suit == other.suit && self.is_starting_three_of_clubs == other.is_starting_three_of_clubs
