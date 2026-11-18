"""Create a stable, deterministic ZIP from the verified dist directory."""
from hashlib import sha256
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

EXT = Path(__file__).resolve().parents[1]
ROOT = EXT.parent
DIST = EXT / "dist"
OUT = ROOT / "release"
NAME = "tathabbut-local-rc1-0.1.0.zip"

files = sorted(path for path in DIST.rglob("*") if path.is_file())
if not files:
    raise SystemExit("package-release: dist is empty")

OUT.mkdir(parents=True, exist_ok=True)
archive = OUT / NAME
with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=9) as bundle:
    for path in files:
        rel = path.relative_to(DIST).as_posix()
        item = ZipInfo(rel, date_time=(1980, 1, 1, 0, 0, 0))
        item.compress_type = ZIP_DEFLATED
        item.external_attr = 0o100644 << 16
        bundle.writestr(item, path.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)

digest = sha256(archive.read_bytes()).hexdigest()
(OUT / (NAME + ".sha256")).write_text(f"{digest}  {NAME}\n", encoding="ascii")
inventory = [
    "Tathabbut local-only Release Candidate 1 package inventory",
    f"Archive: {NAME}",
    f"SHA-256: {digest}",
    "",
    *[f"{path.relative_to(DIST).as_posix()}  {path.stat().st_size} bytes" for path in files],
    "",
    "Build label: rc1; manifest version remains 0.1.0.",
]
(OUT / "INVENTORY.txt").write_text("\n".join(inventory) + "\n", encoding="utf-8")
print(f"package-release: {archive}")
print(f"sha256: {digest}")
print(f"files: {len(files)}")
