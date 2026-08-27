#!/usr/bin/env python3
"""Fill unrevealed catalog entries from ROG Metadata_proofreading.csv via metadataId."""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "ROG Metadata_proofreading.csv"
CATALOG_PATH = ROOT / "data" / "slash206-zei-6-metadata.json"
ORIGIN_PATH = ROOT / "data" / "origin-metadata.json"
IMAGE_BASE = (
    "https://peach-fiscal-dog-336.mypinata.cloud/ipfs/"
    "bafybeigofkrjkw6i7ichhrwwdosljezdubnwa35b3yh6mq7w7voyvrbloq"
)
BOX_TYPE_ID = {"gold": 0, "red": 1, "blue": 2, "public": 3}
TRAIT_ORDER = ("Box", "Color", "Occupation", "Rarity", "Species")


def row_to_metadata(row: dict[str, str], description: str) -> dict:
    image_id = int(row["Image"])
    attributes = []
    for trait in TRAIT_ORDER:
        value = (row.get(trait) or "").strip()
        if value:
            attributes.append({"trait_type": trait, "value": value})
    return {
        "name": row["Name"],
        "description": description,
        "image": f"{IMAGE_BASE}/{image_id}.jpg",
        "attributes": attributes,
    }


def main() -> None:
    rows = list(csv.DictReader(CSV_PATH.open(newline="", encoding="utf-8-sig")))
    by_image = {int(row["Image"]): row for row in rows}
    if len(by_image) != 6020:
        raise SystemExit(f"expected 6020 CSV rows, got {len(by_image)}")

    catalog = json.loads(CATALOG_PATH.read_text())
    description = ""
    for item in catalog["items"]:
        if item.get("metadata", {}).get("description"):
            description = item["metadata"]["description"]
            break

    origin = {
        str(image_id): row_to_metadata(row, description)
        for image_id, row in sorted(by_image.items())
    }
    ORIGIN_PATH.write_text(json.dumps(origin, ensure_ascii=False, indent=2))

    filled = 0
    missing = []
    for item in catalog["items"]:
        if item.get("isRevealed"):
            continue
        metadata_id = item["metadataId"]
        row = by_image.get(metadata_id)
        if not row:
            missing.append(metadata_id)
            continue
        item["metadata"] = row_to_metadata(row, description)
        item["boxTypeId"] = BOX_TYPE_ID[row["Box"].strip().lower()]
        item["isRevealed"] = True
        filled += 1

    if missing:
        raise SystemExit(f"CSV missing metadataId rows: {missing[:20]}")

    revealed = sum(1 for item in catalog["items"] if item["isRevealed"])
    catalog["revealedCount"] = revealed
    catalog["unrevealedCount"] = catalog["count"] - revealed
    catalog["source"] = (
        "https://opensea.io/collection/slash206-zei-6 + data/ROG Metadata_proofreading.csv"
    )
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2))
    print(f"wrote {ORIGIN_PATH} ({len(origin)} origins)")
    print(f"filled {filled} unrevealed tokens in {CATALOG_PATH}")
    print(f"revealedCount={catalog['revealedCount']} unrevealedCount={catalog['unrevealedCount']}")


if __name__ == "__main__":
    main()
