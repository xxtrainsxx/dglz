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
  Suit suit;
};

bool CompareCards(const Card card, const Card other_card);
