#include "player.h"

#include <sstream>

Player::Player(std::string name,
			         std::vector<Card> starting_hand)
    : name_(std::move(name)),
      hand_(std::move(starting_hand)) {}

bool RemoveCardFromHand(const Card& card,
                        std::vector<Card>* hand) {
  for (auto it = hand->begin(); it != hand->end(); ++it) {
    if (*it == card) {
      hand->erase(it);
      return true;
    }
  }
  return false;
}

bool Player::Play(std::vector<Card> cards,
                  std::string* error_message) {
  for (const Card& card : cards) {
    const bool removed = RemoveCardFromHand(card, &hand_);
    if (!removed) {
      std::ostringstream oss;
      oss << card << " played but not found in hand";
      *error_message = oss.str();
      return false;
    }
  }
  return true;
}
