#include "game.h"

#include <algorithm>
#include <random>
#include <sstream>
#include <vector>

Game::Game(std::vector<Player> players) :
    players_(std::move(players)) {}

constexpr int kDeckSize = 54;
constexpr int kHandSize = 27;

std::vector<Card> CreateDeck(const int num_decks) {
  std::vector<Card> deck;
  deck.reserve(num_decks * kDeckSize);
  for (int i = 0; i < num_decks; ++i) {
    // Add threes.
    deck.push_back(Card{
      .value = Value::kThree,
      .suit = Suit::kClubs,
      .starting_three_of_clubs = i == 0,
    });
    for (const Suit suit : {
      Suit::kDiamonds,
      Suit::kHearts,
      Suit::kSpades,
    }) {
      deck.push_back(Card{
        .value = Value::kThree,
        .suit = suit,
      });
    }
    // Add fours through twos.
    for (const Value value : {
      Value::kThree,
      Value::kFour,
      Value::kFive,
      Value::kSix,
      Value::kSeven,
      Value::kEight,
      Value::kNine,
      Value::kTen,
      Value::kJack,
      Value::kQueen,
      Value::kKing,
      Value::kAce,
      Value::kTwo,
    }) {
      for (const Suit suit : {
        Suit::kClubs,
        Suit::kDiamonds,
        Suit::kHearts,
        Suit::kSpades,
      }) {
        deck.push_back(Card{
          .value = value,
          .suit = suit,
        });
      }
    }
    // Add jokers.
    deck.push_back(Card{.value = Value::kBlackJoker});
    deck.push_back(Card{.value = Value::kRedJoker});
  }
  return deck;
}

bool Game::Create(std::vector<std::string> player_names,
                  Game* game, std::string* error_message) {
  if (player_names.size() % 2 != 0) {
    *error_message = "Must have an even number of players";
    return false;
  }
  std::vector<Card> deck = CreateDeck(player_names.size() / 2);
  std::random_device rd;
  std::mt19937 g(rd());
  std::shuffle(deck.begin(), deck.end(), g);
  std::vector<Player> players;
  players.reserve(player_names.size());
  for (int p = 0; p < player_names.size(); ++p) {
    std::vector<Card> starting_hand;
    starting_hand.reserve(kHandSize);
    for (int i = p * kHandSize; i < (p + 1) * kHandSize; ++i) {
      starting_hand.push_back(std::move(deck[i]));
    }
    players.emplace_back(std::move(player_names[p]),
                         std::move(starting_hand));
  }
  *game = Game(std::move(players));
  return true;
}

std::string Game::GetCurrentPlayerName() const {
  return players_[current_player_].name();
}

bool Game::Advance(const std::string& player,
                   std::vector<Card> cards,
                   std::string* error_message) {
  if (player != players_[current_player_].name()) {
    std::ostringstream oss;
    oss << "Expected "
        << players_[current_player_].name()
        << " to play";
    *error_message = oss.str();
    return false;
  }
  return players_[current_player_].Play(
      std::move(cards), error_message);
}

bool Game::IsGameComplete() const {
  bool team_one_has_cards = false;
  bool team_two_has_cards = false;
  for (int p = 0; p < players_.size(); ++p) {
    if (players_[p].hand().size() != 0) {
      if (p % 2 == 0) {
        team_one_has_cards = true;
      } else {
        team_two_has_cards = true;
      }
    }
  }
  return team_one_has_cards && team_two_has_cards;
}
