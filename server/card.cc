#include "card.h"

bool CompareCards(const Card card, const Card other_card) {
	if (card.value == other_card.value) {
    return card.suit < other_card.suit;
  }
  return card.value < other_card.value;
}
