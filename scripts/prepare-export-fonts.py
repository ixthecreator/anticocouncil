"""Rebuild bundled PDF fonts from the upstream Noto Sans SC variable TTF.

Requires fonttools 4.64.0. Run with the upstream TTF and output directory as
arguments. This is a maintainer tool; neither app builds nor browsers need Python.
"""
import hashlib
import json
from pathlib import Path
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def ranges(values):
    result = []
    for value in sorted(values):
        if result and value == result[-1][1] + 1:
            result[-1][1] = value
        else:
            result.append([value, value])
    return result


source, destination = Path(sys.argv[1]), Path(sys.argv[2])
destination.mkdir(parents=True, exist_ok=True)
coverage = None
for style, weight in [("Regular", 400), ("Bold", 700)]:
    original = TTFont(source)
    axes = {axis.axisTag: axis.defaultValue for axis in original["fvar"].axes}
    axes["wght"] = weight
    font = instantiateVariableFont(original, axes, inplace=True, updateFontNames=True)
    # jsPDF text currently uses UTF-16 code units: reject supplementary-plane
    # input in the renderer instead of pretending those characters are supported.
    supported = {code for code in font.getBestCmap() if code <= 0xFFFF}
    coverage = supported if coverage is None else coverage & supported
    font.save(destination / f"NotoSansSC-{style}.ttf")
    print(f"Prepared {style}")
(destination / "coverage.json").write_text(json.dumps(ranges(coverage), separators=(",", ":")))
(destination / "source.sha256").write_text(hashlib.sha256(source.read_bytes()).hexdigest() + "  NotoSansSC-VF.ttf\n")
