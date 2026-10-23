"""Prepare locally hosted, full-coverage WOFF2 fonts for member cards.

Requires Python 3.10+, fonttools[woff]==4.64.0 (Brotli 1.2.1).
Usage: python scripts/prepare-card-fonts.py /path/to/NotoSansSC-VF.ttf
       /path/to/NotoSerifSC-Bold.otf public/fonts/card

Sources must match the checked hashes below. No download or conversion is
performed by application builds or browsers. Every encoded source character
is retained; this is compression and weight selection, not a Chinese subset.
"""

import argparse
import hashlib
import json
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


SOURCES = {
    "NotoSansSC-VF.ttf": "d68bafcb48a2707749396aa12bbbd833cb70401f3a9a689fd2902c7e0d295964",
    "NotoSerifSC-Bold.otf": "24693d48bdb9152f0a06b02af625638a1097abd6de4010ebba027f6e82710527",
}


def ranges(values):
    result = []
    for value in sorted(values):
        if result and value == result[-1][1] + 1:
            result[-1][1] = value
        else:
            result.append([value, value])
    return result


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepare(source, expected_name, output, weight):
    if sha256(source) != SOURCES[expected_name]:
        raise ValueError(f"Source checksum mismatch: {source}")
    original = TTFont(source, recalcTimestamp=False)
    original_coverage = set(original.getBestCmap())
    font = instantiateVariableFont(original, {"wght": weight}, inplace=True) if weight is not None else original
    font.recalcTimestamp = False
    font.flavor = "woff2"
    font.save(output)
    # Inspect the actual compressed asset, not only the in-memory font.
    with TTFont(output, recalcTimestamp=False) as compressed:
        coverage = set(compressed.getBestCmap())
        if coverage != original_coverage:
            raise ValueError(f"Unexpected character coverage change: {output}")
    print(f"Prepared {output.name}: {output.stat().st_size:,} bytes, {len(coverage):,} characters", flush=True)
    return coverage


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sans_source", type=Path)
    parser.add_argument("serif_source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    args.destination.mkdir(parents=True, exist_ok=True)
    sans_path = args.destination / "NotoSansSC-Variable.woff2"
    serif_path = args.destination / "NotoSerifSC-Bold.woff2"
    sans = prepare(args.sans_source, "NotoSansSC-VF.ttf", sans_path, (100, 100, 500))
    serif = prepare(args.serif_source, "NotoSerifSC-Bold.otf", serif_path, None)
    intersection = sans & serif
    (args.destination / "coverage.json").write_text(
        json.dumps(ranges(intersection), separators=(",", ":")) + "\n", encoding="utf-8"
    )
    (args.destination / "source.sha256").write_text(
        "".join(f"{digest}  {name}\n" for name, digest in SOURCES.items()), encoding="utf-8"
    )
    (args.destination / "assets.sha256").write_text(
        "".join(f"{sha256(path)}  {path.name}\n" for path in (sans_path, serif_path)), encoding="utf-8"
    )
    print(f"Common character coverage: {len(intersection):,}", flush=True)


if __name__ == "__main__":
    main()
