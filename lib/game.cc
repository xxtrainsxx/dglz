#include "game.h"

Game::Game(std::vector<Player> players) :
    players_(std::move(players)) {}
