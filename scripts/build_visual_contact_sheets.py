#!/usr/bin/env python3
"""Build visual-regression contact sheets comparing mockups with current screenshots."""

from __future__ import annotations

import argparse
import json
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CURRENT_DIR = ROOT / "docs" / "design-system-visual-regression" / "current"
OUTPUT_DIR = ROOT / "docs" / "design-system-visual-regression" / "contact-sheets"
NOTES_PATH = ROOT / "docs" / "design-system-visual-regression" / "notes.json"

COMPARISONS = [
    {
        "title": "Operational map · day",
        "mock": ROOT / "docs" / "mockups" / "day-mode" / "operational-map-day-v2.png",
        "current": CURRENT_DIR / "operational-map-day.png",
        "output": "operational-map-day-contact-sheet.png",
    },
    {
        "title": "Operational map · night",
        "mock": ROOT / "docs" / "mockups" / "screens" / "operational-map.png",
        "current": CURRENT_DIR / "operational-map-night.png",
        "output": "operational-map-night-contact-sheet.png",
    },
    {
        "title": "Selected center · day",
        "mock": ROOT / "docs" / "mockups" / "day-mode" / "selected-center-panel-day-v2.png",
        "current": CURRENT_DIR / "selected-center-day.png",
        "output": "selected-center-day-contact-sheet.png",
    },
    {
        "title": "Selected center · night",
        "mock": ROOT / "docs" / "mockups" / "screens" / "selected-center-panel.png",
        "current": CURRENT_DIR / "selected-center-night.png",
        "output": "selected-center-night-contact-sheet.png",
    },
    {
        "title": "SOS and outbox · day",
        "mock": ROOT / "docs" / "mockups" / "day-mode" / "sos-and-outbox-day-v2.png",
        "current": CURRENT_DIR / "sos-outbox-day.png",
        "output": "sos-outbox-day-contact-sheet.png",
    },
    {
        "title": "SOS and outbox · night",
        "mock": ROOT / "docs" / "mockups" / "screens" / "sos-and-outbox.png",
        "current": CURRENT_DIR / "sos-outbox-night.png",
        "output": "sos-outbox-night-contact-sheet.png",
    },
]

DEFAULT_NOTE = "Review radius, spacing, card/background separation, state colors, and map/panel proportion."


def font(size: int) -> ImageFont.ImageFont:
    for path in [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def read_notes() -> dict[str, str]:
    if not NOTES_PATH.exists():
        return {}
    return json.loads(NOTES_PATH.read_text())


def fit_image(path: Path, height: int) -> Image.Image:
    image = Image.open(path).convert("RGB")
    ratio = height / image.height
    width = int(image.width * ratio)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int], max_width: int, line_height: int, fill: str, image_font: ImageFont.ImageFont) -> None:
    x, y = xy
    for paragraph in text.split("\n"):
        lines = textwrap.wrap(paragraph, width=max(24, max_width // 9)) or [""]
        for line in lines:
            draw.text((x, y), line, fill=fill, font=image_font)
            y += line_height
        y += 4


def build_sheet(comparison: dict[str, object], note: str, *, height: int) -> Path:
    mock = fit_image(comparison["mock"], height)  # type: ignore[arg-type]
    current = fit_image(comparison["current"], height)  # type: ignore[arg-type]
    gap = 48
    margin = 48
    title_h = 70
    labels_h = 34
    notes_h = 130
    width = margin * 2 + mock.width + gap + current.width
    canvas = Image.new("RGB", (width, margin + title_h + labels_h + height + notes_h + margin), "#F8FAFC")
    draw = ImageDraw.Draw(canvas)
    title_font = font(28)
    label_font = font(18)
    note_font = font(16)

    title = str(comparison["title"])
    draw.text((margin, margin), title, fill="#0F172A", font=title_font)
    y = margin + title_h
    draw.text((margin, y), "Mock reference", fill="#334155", font=label_font)
    current_x = margin + mock.width + gap
    draw.text((current_x, y), "Current app", fill="#334155", font=label_font)

    image_y = y + labels_h
    canvas.paste(mock, (margin, image_y))
    canvas.paste(current, (current_x, image_y))

    note_y = image_y + height + 24
    draw.text((margin, note_y), "Audit notes", fill="#0F172A", font=label_font)
    draw_wrapped(draw, note, (margin, note_y + 30), width - margin * 2, 21, "#334155", note_font)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_DIR / str(comparison["output"])
    canvas.save(output)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Build mock/current visual contact sheets.")
    parser.add_argument("--height", type=int, default=980, help="Rendered height for each compared screen.")
    args = parser.parse_args()

    missing = [str(path.relative_to(ROOT)) for item in COMPARISONS for path in (item["mock"], item["current"]) if not path.exists()]
    if missing:
        print("Missing required images:")
        for path in missing:
            print(f"- {path}")
        print("\nRun `pnpm visual:audit:capture` before building contact sheets.")
        return 1

    notes = read_notes()
    for comparison in COMPARISONS:
        key = Path(str(comparison["output"])).stem.replace("-contact-sheet", "")
        output = build_sheet(comparison, notes.get(key, DEFAULT_NOTE), height=args.height)
        print(f"created: {output.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
