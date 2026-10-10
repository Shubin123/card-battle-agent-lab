# Wordbound Duel

A card battler made only of words, played in the browser against a rival trained by self-play.

Play it at https://shubin123.github.io/card-battle-agent-lab/

## The game

Two players race to bring the other's core from 20 to 0. You gain one more ink each turn, play units and spells, and attack with your units. There are four schools: Ember, Tide, Grove and Storm. Each deck has 30 cards, and every card is just a word with a cost, its stats and a rule. Units can have keywords: Swift, Wall, Pierce, Drain, Burst and Shield.

## The rival

- **Plays from what it can see.** It only gets `observe(state, seat)`. It fills in the hidden cards (your hand and both decks' order) with guesses consistent with what's been revealed.
- **Scores boards with a learned evaluator.** The evaluator weighs ten board features, and its weights are learned by self-play in stages:
  1. Broad self-play.
  2. Single-deck specialists trained against a frozen ladder.
  3. A round-robin arena.
- **Three levels:**
  - Novice: one-step greedy moves with noise.
  - Adept: plans the rest of its turn.
  - Master: uses the trained specialist evaluator, plans its turn with beam search, and checks your reply across guessed hands.

The training recipe follows the staged approach in the [first-place write-up](https://www.kaggle.com/competitions/pokemon-tcg-ai-battle-challenge-strategy/writeups/new-writeup-1784257142000) of a Kaggle card-battle AI competition. Its finding that deeper search added little reproduced here as well.

## Develop

```sh
npm test                    # rules and AI invariants
node tools/train.mjs        # self-play training and arena; writes js/trained.js
node tools/ladder.mjs       # difficulty ladder shown on the Arena tab
node tools/compare.mjs      # Master search variants vs Adept
```

To view it locally, serve the folder with any static server and open `index.html`. `tools/autoplay.html` plays a few turns automatically for visual checks.

The game is original: all of its cards, rules and code were made for this project. It isn't affiliated with any trading card game, Kaggle, or the competition's host or sponsor.
