# Competition agent (archived)

This folder records the agent built for the Kaggle PTCG AI Battle Challenge Playground, which has now ended. It was merged in from the private `pokemon-bot` repository.

## What was built

1. Hand-written baselines: a linear ranking of option types, then a tactical heuristic that reads only public board information.
2. 1,200 games on the competition simulator, recording every decision menu along with the heuristic's score for each option.
3. A small neural scorer trained on a Radeon RX 580 through DirectML, with games split into training and validation sets.
4. A one-turn lookahead built on the simulator's search API. Hidden cards were guessed from visible cards only.

Held-out results from local single games (not leaderboard numbers), 100 games per opponent:

| Opponent | Lookahead agent's win rate |
| --- | --- |
| GPU-trained network | 80% |
| Tactical heuristic | 78% |
| Random play | 95% |

The lab page in `docs/` shows these numbers in full. You can view it at https://shubin123.github.io/card-battle-agent-lab/competition/docs/

## What isn't here, and why

The competition rules allow competition code to be shared publicly only on Kaggle, and they forbid publishing Competition Data or Pokémon Elements. So this public repository leaves out:

- the agent and training code;
- the simulator SDK and binaries;
- card data, decks, game logs and trained weights.

That code stays in the private, archived `pokemon-bot` repository. Only the docs, this summary and a generic tool installer (`scripts/bootstrap.ps1`) were merged in, and the filtered history contains nothing else.

The ideas carried forward into Wordbound Duel, the original game at the root of this repository:

- The AI plays only from what its seat can observe.
- It searches over guessed versions of the hidden cards.
- It's trained in stages, following the first-place write-up.
