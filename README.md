# pokemon-bot

An agent for the Kaggle PTCG AI Battle Challenge Playground, plus its training and evaluation tooling. This repository is private. The public demo site is published from a separate repository that contains only the static site.

## Rules this repo follows

- Competition Data stays out of git. That covers the simulator binaries, the `cg` SDK, card CSVs and PDFs, decks, game logs and trained weights. All of it lives under the ignored `data/`, `artifacts/`, `build/` and `.tools/` folders.
- Code is not shared privately with anyone outside the team. If it's ever shared publicly, it has to go through Kaggle forums or notebooks, as the rules require.
- Public pages contain no Pokémon Elements: no names, art, card text or card data. They show only aggregate local results.

## Components

| File | Purpose |
| --- | --- |
| `policy.py`, `model.json` | Hand-written linear option ranking (baseline) |
| `tactical.py` | Heuristic that reads only public board information, using the simulator's card metadata |
| `neural.py` | Small MLP option scorer with numpy-only inference, blended with the tactical prior |
| `search.py` | One-turn lookahead through the simulator's search API, guessing hidden cards from visible ones only |
| `training.py` | Match runner, deck checks, summary statistics and evolutionary weight search |
| `scripts/collect_games.py` | Records decision menus and teacher scores from real simulator games |
| `scripts/train_gpu.py` | Trains the MLP on DirectML (AMD), CUDA or CPU, with a game-level validation split |
| `scripts/evaluate_*.py` | Head-to-head evaluation on held-out deck variants |
| `scripts/build_submission.py` | Builds `build/submission.tar.gz` with `main.py` and `deck.csv` at the top level |
| `scripts/export_site_results.py` | Writes aggregate-only numbers to `docs/results.json` |

## Workflow

Run these from the repo root with the `cg` SDK on `PYTHONPATH`. The SDK comes from the competition data or the `kaggle-environments` cabt environment.

```powershell
$env:PYTHONPATH = "$PWD\data\official-sdk"
python scripts/collect_games.py --deck data/train.csv --deck data/dev.csv --games 1200 --output artifacts/v2-data.jsonl
python scripts/train_gpu.py --data artifacts/v2-data.jsonl --device directml --output artifacts/neural-v2/model.json
python scripts/evaluate_neural.py --model artifacts/neural-v2/model.json --dev-deck data/dev.csv --holdout-deck data/holdout.csv
python scripts/evaluate_search.py --model artifacts/neural-v2/model.json --deck data/holdout.csv --games 100 --output artifacts/search-v1-eval.json
python scripts/build_submission.py --model artifacts/neural-v2/model.json --deck data/train.csv --blend 0.5
python scripts/export_site_results.py
```

Validate the bundle with the official `kaggle-environments` cabt harness from GitHub master. The v2 engine plays best-of-three. PyPI release 1.18.0 still ships the v1 engine, which rejects current card IDs. Kaggle loads `main.py` with `exec` and no `__file__`, and puts the agent directory on `sys.path` only while the module is loading. The generated entrypoint handles both.

Training dependencies are listed in `requirements-train.txt`. The submission needs only numpy at runtime.

## Tests

```powershell
python -m unittest discover -s tests -v
```
