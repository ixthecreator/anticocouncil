# Member-card fonts

These fonts are hosted with the app and are loaded only by the member-card
designer. A generated card uses real light outlines instead of approximating
thin type with transparency, outlines, or an operating-system fallback.

| Asset | Weights | Bytes | Use |
| --- | --- | --- | --- |
| `NotoSansSC-Variable.woff2` | Continuous 100–500 | 7,236,716 | Thin role heading, English role, regular name, light biography |
| `NotoSerifSC-Bold.woff2` | 700 | 9,025,304 | Organization footer |

Both assets retain every encoded character in the corresponding upstream
font, including supported supplementary-plane characters. `coverage.json`
contains the intersection of the two actual WOFF2 character maps as inclusive
`[first, last]` code-point ranges. The renderer checks this coverage before
export so missing characters cannot silently become fallback glyphs.

The intersection contains 30,880 characters. Compared with the previous
Sans-only BMP coverage, Serif does not encode the compatibility ideographs
U+F900, U+F921, U+F938, U+F949 and U+F9B3. Neither asset is restricted to the
default organization name; organizations remain freely editable within the
recorded character coverage.

## Provenance and license

- Upstream: [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk)
- Snapshot: `f8d157532fbfaeda587e826d4cd5b21a49186f7c`
- Sans source: [NotoSansSC-VF.ttf](https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf), version 2.004.
- Serif source: [NotoSerifSC-Bold.otf](https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf), version 2.003.
- Sans copyright: © 2014–2021 Adobe (http://www.adobe.com/), with Reserved Font Name “Source”.
- Serif copyright: © 2017–2024 Adobe (http://www.adobe.com/).
- License: SIL Open Font License 1.1, included in `OFL.txt`; original copyright and license metadata remain in the font assets.
- Exact source hashes are recorded in `source.sha256`; output hashes are recorded in `assets.sha256`.

## Rebuild

Install `fonttools[woff]==4.64.0` with Brotli 1.2.1, download the two official
sources above outside the repository, then run:

```sh
python scripts/prepare-card-fonts.py /path/to/NotoSansSC-VF.ttf /path/to/NotoSerifSC-Bold.otf public/fonts/card
```

The script rejects unexpected source checksums, restricts Sans to weights
100–500, uses the official static Serif Bold at weight 700, compresses both to WOFF2, and checks
that each compressed font retains its complete source character map.
Source timestamps are preserved to keep output reproducible. The application
build requires neither Python nor network access to font services.
