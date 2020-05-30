#include "player.h"

class Game {
 public:
  bool Create(std::vector<std::string> player_names,
              Game* game, std::string* error_message);

  std::string GetCurrentPlayerName() const;

  bool Advance(const std::string& player,
               std::vector<Card> cards,
               std::string* error_message);

  bool IsGameComplete() const;

 private:
  Game(std::vector<Player> players);

  std::vector<Player> players_;
  int current_player_;
};
