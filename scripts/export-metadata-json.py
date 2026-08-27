#!/usr/bin/env python3
"""Export each catalog item to data/revealed or data/unrevealed JSON."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "slash206-zei-6-metadata.json"
REVEALED_DIR = ROOT / "data" / "revealed"
UNREVEALED_DIR = ROOT / "data" / "unrevealed"


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text())
    for directory in (REVEALED_DIR, UNREVEALED_DIR):
        if directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True)

    revealed = 0
    unrevealed = 0
    for item in catalog["items"]:
        metadata = item["metadata"]
        dest_dir = REVEALED_DIR if item["isRevealed"] else UNREVEALED_DIR
        path = dest_dir / f"{item['metadataId']}.json"
        path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
        if item["isRevealed"]:
            revealed += 1
        else:
            unrevealed += 1

    print(f"revealed {revealed} -> {REVEALED_DIR}")
    print(f"unrevealed {unrevealed} -> {UNREVEALED_DIR}")


if __name__ == "__main__":
    main()
