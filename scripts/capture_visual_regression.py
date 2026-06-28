#!/usr/bin/env python3
"""Capture Zona Cero visual-regression screenshots from iOS Simulator.

Preconditions:
- Expo dev server is running at exp://127.0.0.1:8081.
- iOS Simulator is booted with Expo Go available.
- Maestro and xcrun are available on PATH.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "docs" / "design-system-visual-regression" / "current"
BASE_URL = "exp://127.0.0.1:8081/--/visual-audit"

SCENARIOS = [
    ("operational-map", "day", "Available"),
    ("operational-map", "night", "Available"),
    ("selected-center", "day", "Escuela Norte"),
    ("selected-center", "night", "Escuela Norte"),
    ("sos-outbox", "day", "SOS raised"),
    ("sos-outbox", "night", "SOS raised"),
]


def run(command: list[str], *, cwd: Path = ROOT) -> None:
    print("$", " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def assert_booted_simulator() -> None:
    subprocess.run(["xcrun", "simctl", "list", "devices", "booted"], check=True, stdout=subprocess.PIPE, text=True)


def build_flow(screen: str, theme: str, expected_text: str) -> str:
    url = f"{BASE_URL}?screen={screen}&theme={theme}"
    return textwrap.dedent(
        f"""
        appId: host.exp.Exponent
        name: Visual audit {screen} {theme}
        tags:
          - visual-audit
          - ios
        ---
        - openLink: "{url}"
        - assertVisible: "{expected_text}"
        """
    ).strip() + "\n"


def capture_scenario(screen: str, theme: str, expected_text: str, *, skip_maestro: bool) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_DIR / f"{screen}-{theme}.png"

    if not skip_maestro:
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as flow_file:
            flow_file.write(build_flow(screen, theme, expected_text))
            flow_path = Path(flow_file.name)
        try:
            run(["maestro", "test", str(flow_path)])
        finally:
            flow_path.unlink(missing_ok=True)

    run(["xcrun", "simctl", "io", "booted", "screenshot", str(output)])
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Capture visual-regression screenshots from iOS Simulator.")
    parser.add_argument("--skip-maestro", action="store_true", help="Only capture screenshots; do not open/assert routes with Maestro.")
    args = parser.parse_args()

    try:
        assert_booted_simulator()
        for screen, theme, expected_text in SCENARIOS:
            output = capture_scenario(screen, theme, expected_text, skip_maestro=args.skip_maestro)
            print(f"captured: {output.relative_to(ROOT)}")
    except subprocess.CalledProcessError as exc:
        print("\nVisual capture failed.", file=sys.stderr)
        print("Check that Simulator is open, Expo is running, Expo Go can open exp://127.0.0.1:8081, and Maestro can see the device.", file=sys.stderr)
        return exc.returncode or 1

    print(f"\nScreenshots saved in {OUTPUT_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
