cc_library(
  name = "card",
  hdrs = ["card.h"],
  srcs = ["card.cc"],
)

cc_library(
  name = "game",
  hdrs = ["game.h"],
  srcs = ["game.cc"],
  deps = [
  	":player",
  ],
)

cc_library(
  name = "player",
  hdrs = ["player.h"],
  srcs = ["player.cc"],
  deps = [
  	":card",
  ],
)
