"""Run real shared protocol code on the host; requires g++ and installed PIO libs."""
from pathlib import Path
import os
import subprocess

root = Path(__file__).resolve().parents[1]
json_include = root / ".pio/libdeps/esp32dev/ArduinoJson/src"
if not json_include.is_dir():
    raise SystemExit("Install dependencies first: python -m platformio pkg install")
for name in ("protocol", "command"):
    output = root / (f"native_{name}.exe" if os.name == "nt" else f"native_{name}")
    subprocess.run([
        "g++", "-std=c++14", "-Wall", "-Wextra", "-pedantic",
        "-I", str(root / "include"), "-I", str(json_include),
        str(root / "test" / f"native_{name}.cpp"), "-o", str(output),
    ], check=True)
    subprocess.run([str(output)], check=True)
