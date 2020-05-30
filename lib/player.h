#include "card.h"

#include <string>
#include <vector>

class Player {
 public:
  Player(std::string name, std::vector<Card> starting_hand);

  // Remove `cards` from the player's current hand. Returns
  // true iff success and populates `error_message` on failure.
  bool Play(std::vector<Card> cards, std::string* error_message);

  const std::string& name() const {
    return name_;
  }

  const std::vector<Card>& hand() const {
    return hand_;
  }

 private:
  std::string name_;
  std::vector<Card> hand_;
};
