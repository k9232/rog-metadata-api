#!/usr/bin/env python3
"""Recover SLASH206 - ZEI-6 metadata from OpenSea GraphQL."""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

SLUG = "slash206-zei-6"
CONTRACT = "0x471c2c840b69eb92523b1de0eea791ae1359afd7"
GQL = "https://gql.opensea.io/graphql"
PAGE_SIZE = 100
EXPECTED_SUPPLY = 2197
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data"
RAW_PATH = OUT_DIR / "slash206-zei-6-opensea-raw.json"
METADATA_PATH = OUT_DIR / "slash206-zei-6-metadata.json"

BOX_TYPE_BY_TRAIT = {
    "gold": 0,
    "金": 0,
    "金盒": 0,
    "red": 1,
    "紅": 1,
    "红": 1,
    "紅盒": 1,
    "红盒": 1,
    "blue": 2,
    "藍": 2,
    "蓝": 2,
    "藍盒": 2,
    "蓝盒": 2,
    "public": 3,
    "公售": 3,
    "公售盒": 3,
}

ITEM_QUERY = """
query CollectionItems(
  $slug: String!
  $limit: Int!
  $offset: Int!
  $direction: SortDirection!
) {
  collectionItems(
    collectionSlug: $slug
    sort: { by: CREATED_DATE, direction: $direction }
    limit: $limit
    offset: $offset
  ) {
    items {
      tokenId
      name
      tokenUri
      description
      imageUrl
      originalImageUrl
      animationUrl
      originalAnimationUrl
      standard
      contractAddress
      attributes {
        traitType
        value
      }
      rarity {
        rank
        category
        totalSupply
      }
      collection {
        slug
        name
        description
      }
    }
  }
}
"""


def gql(query: str, variables: dict | None = None, retries: int = 6) -> dict:
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    body = json.dumps(payload).encode()
    last_error: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(
            GQL,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Origin": "https://opensea.io",
                "Referer": f"https://opensea.io/collection/{SLUG}",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "x-app-id": "os2-web",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                data = json.loads(response.read().decode())
            if data.get("errors"):
                raise RuntimeError(data["errors"][0].get("message", str(data["errors"])))
            return data
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, RuntimeError) as exc:
            last_error = exc
            wait = min(2 ** attempt, 30)
            print(f"retry {attempt + 1}/{retries} after {wait}s: {exc}")
            time.sleep(wait)
    raise RuntimeError(f"GraphQL failed after retries: {last_error}")


def parse_metadata_id(token_uri: str | None) -> int | None:
    if not token_uri:
        return None
    match = re.search(r"/metadata/revealed/(\d+)", token_uri)
    if match:
        return int(match.group(1))
    match = re.search(r"/metadata/(\d+)", token_uri)
    if match:
        return int(match.group(1))
    return None


def box_type_id(attributes: list | None) -> int | None:
    if not attributes:
        return None
    for attr in attributes:
        if str(attr.get("traitType", "")).lower() != "box":
            continue
        return BOX_TYPE_BY_TRAIT.get(str(attr.get("value", "")).strip().lower())
    return None


def to_erc721(item: dict, collection_description: str) -> dict:
    attributes = item.get("attributes") or []
    image = item.get("originalImageUrl") or item.get("imageUrl")
    animation = item.get("originalAnimationUrl") or item.get("animationUrl")
    metadata = {
        "name": item.get("name"),
        "description": item.get("description") or collection_description,
        "image": image,
        "external_url": f"https://opensea.io/item/ethereum/{CONTRACT}/{item.get('tokenId')}",
        "attributes": [
            {"trait_type": attr.get("traitType"), "value": attr.get("value")}
            for attr in attributes
            if attr.get("traitType") is not None
        ],
    }
    if animation:
        metadata["animation_url"] = animation
    return metadata


def fetch_direction(direction: str) -> list[dict]:
    items: list[dict] = []
    offset = 0
    while offset <= 1000:
        data = gql(
            ITEM_QUERY,
            {
                "slug": SLUG,
                "limit": PAGE_SIZE,
                "offset": offset,
                "direction": direction,
            },
        )
        page = data["data"]["collectionItems"]["items"] or []
        items.extend(page)
        print(f"fetched {direction} offset={offset} page={len(page)} collected={len(items)}")
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.2)
    return items


def fetch_all() -> list[dict]:
    # offset max is 1000, so one direction only covers 1100 items.
    merged: dict[str, dict] = {}
    for direction in ("ASC", "DESC"):
        for item in fetch_direction(direction):
            merged[str(item["tokenId"])] = item
    return list(merged.values())


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw_items = fetch_all()
    by_token: dict[str, dict] = {}
    for item in raw_items:
        token_id = str(item.get("tokenId"))
        by_token[token_id] = item
    items = [by_token[key] for key in sorted(by_token, key=lambda value: int(value))]

    collection_description = ""
    if items:
        collection_description = (items[0].get("collection") or {}).get("description") or ""

    records = []
    revealed = 0
    for item in items:
        token_id = int(item["tokenId"])
        metadata_id = parse_metadata_id(item.get("tokenUri"))
        attrs = item.get("attributes") or []
        is_revealed = bool(attrs) and not str(item.get("name") or "").endswith("Cryopod")
        if str(item.get("name") or "").startswith("ZEI-6-"):
            is_revealed = True
        if is_revealed:
            revealed += 1
        records.append(
            {
                "tokenId": token_id,
                "metadataId": metadata_id,
                "boxTypeId": box_type_id(attrs),
                "isRevealed": is_revealed,
                "tokenUri": item.get("tokenUri"),
                "openseaUrl": f"https://opensea.io/item/ethereum/{CONTRACT}/{token_id}",
                "rarity": item.get("rarity"),
                "metadata": to_erc721(item, collection_description),
            }
        )

    RAW_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=2))
    METADATA_PATH.write_text(
        json.dumps(
            {
                "collection": SLUG,
                "contract": CONTRACT,
                "source": "https://opensea.io/collection/slash206-zei-6",
                "expectedSupply": EXPECTED_SUPPLY,
                "count": len(records),
                "revealedCount": revealed,
                "unrevealedCount": len(records) - revealed,
                "items": records,
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    token_ids = [row["tokenId"] for row in records]
    print(f"saved {len(records)} items to {METADATA_PATH}")
    print(f"revealed={revealed} unrevealed={len(records) - revealed}")
    print(f"tokenId range {min(token_ids)}-{max(token_ids)}")
    if len(records) != EXPECTED_SUPPLY:
        print(f"WARNING expected {EXPECTED_SUPPLY} got {len(records)}")


if __name__ == "__main__":
    main()
