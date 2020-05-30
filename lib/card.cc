#include "card.h"

#include <string>

bool Card::operator==(const Card& other) {
  return value == other.value && suit == other.suit;
}

std::string GetNonJokerValueString(const Value value) {
  switch (value) {
    case Value::kThree:
      return "Three";
    case Value::kFour:
      return "Four";
    case Value::kFive:
      return "Five";
    case Value::kSix:
      return "Six";
    case Value::kSeven:
      return "Seven";
    case Value::kEight:
      return "Eight";
    case Value::kNine:
      return "Nine";
    case Value::kTen:
      return "Ten";
    case Value::kJack:
      return "Jack";
    case Value::kQueen:
      return "Queen";
    case Value::kKing:
      return "King";
    case Value::kAce:
      return "Ace";
    case Value::kTwo:
      return "Two";
    default:
      return "";
  }
}

std::string GetSuitString(const Suit suit) {
  switch (suit) {
    case Suit::kClubs:
      return "clubs";
    case Suit::kDiamonds:
      return "diamonds";
    case Suit::kHearts:
      return "hearts";
    case Suit::kSpades:
      return "spades";
    default:
      return "";
  }
}

std::ostream& operator<<(std::ostream& os, const Card& card) {
  switch (card.value) {
    case Value::kBlackJoker:
      os << "Black joker";
      break;
    case Value::kRedJoker:
      os << "Red joker";
      break;
    default:
      os << GetNonJokerValueString(card.value)
         << " of "
         << GetSuitString(card.suit);
  }
  return os;
}

bool CompareCards(const Card card, const Card other_card) {
	if (card.value == other_card.value) {
    return card.suit < other_card.suit;
  }
  return card.value < other_card.value;
}
