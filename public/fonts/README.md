# PDF export fonts

Noto Sans SC is bundled for browser-side PDF exports. The website does not
request Google Fonts or an external font CDN during document generation.

- Upstream: https://github.com/notofonts/noto-cjk
- Source: https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/Variable/TTF/Subset/NotoSansSC-VF.ttf
- License: SIL Open Font License 1.1, included in `OFL.txt`.
- The exact downloaded source checksum is recorded in `source.sha256`.
- Static weights: Regular 400 and Bold 700, generated with fonttools 4.64.0.

To reproduce, download the source TTF, verify the checksum, then run
`python scripts/prepare-export-fonts.py /path/to/NotoSansSC-VF.ttf public/fonts`.
The application and its build do not need Python or a font download step.

`coverage.json` records the intersection of supported BMP codepoints in both
fonts. PDF generation checks all document text before rendering and reports
missing glyphs, including supplementary-plane characters unsupported by the
current PDF text pipeline. Word export preserves these characters.

The fonts load only when a PDF is requested and are cached for later exports.
