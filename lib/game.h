#include "player.h"

class Game {
 public:
  Game(std::vector<Player> players);

 private:
  std::vector<Player> players_;
};
