#include <iostream>

enum class Value {
  kThree,
  kFour,
  kFive,
  kSix,
  kSeven,
  kEight,
  kNine,
  kTen,
  kJack,
  kQueen,
  kKing,
  kAce,
  kTwo,
  kBlackJoker,
  kRedJoker,
};

enum class Suit {
  kNoSuit,
  kClubs,
  kDiamonds,
  kHearts,
  kSpades,
};

struct Card {
	Value value;
  Suit suit = Suit::kNoSuit;
  bool is_starting_three_of_clubs = false;

  bool operator==(const Card& other);
};

std::ostream& operator<<(std::ostream& os, const Card& card);

bool CompareCards(const Card card, const Card other_card);
