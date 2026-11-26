#!/usr/bin/env python3
"""Import puzzle diagrams and recorded solutions into the Phase 2 shop."""

import argparse
import csv
from hashlib import sha256
import json
from pathlib import Path
import re
from shutil import copyfile


def read_archive(source, rated=False):
    rows = {}
    with (source / "solutions.csv").open(newline="", encoding="utf-8-sig") as stream:
        for row in csv.DictReader(stream):
            number = row["puzzle_no"].strip()
            image = row["image"].strip()
            fen = row["position_fen_epd"].split()
            side = row["side_to_move"].strip().lower()
            mate = int(row["mate_in"])
            moves = row["solution_uci"].split()
            if not re.fullmatch(r"[0-9]{3,}", number) or number in rows:
                raise ValueError(f"Missing or repeated puzzle number: {number}")
            if not re.fullmatch(r"[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)", image, flags=re.I):
                raise ValueError(f"Invalid image name for puzzle {number}")
            if not (source / image).is_file():
                raise ValueError(f"Image missing for puzzle {number}: {image}")
            ranks = fen[0].split("/") if fen else []
            if len(fen) < 4 or len(ranks) != 8 or any(
                not re.fullmatch(r"[1-8prnbqkPRNBQK]+", rank)
                or sum(int(char) if char.isdigit() else 1 for char in rank) != 8
                for rank in ranks
            ):
                raise ValueError(f"Invalid starting position for puzzle {number}")
            if side not in ("white", "black") or fen[1] != side[0]:
                raise ValueError(f"Side to move disagrees with the position for puzzle {number}")
            if mate < 1 or len(moves) != 2 * mate - 1 or any(
                not re.fullmatch(r"[a-h][1-8][a-h][1-8][qrbn]?", move) for move in moves
            ):
                raise ValueError(f"Invalid recorded solution for puzzle {number}")
            record = [number, f"{side.title()} to move · mate in {mate}", image, fen[0]]
            if rated:
                difficulty = row["difficulty"].strip()
                if difficulty not in {"Easy", "Medium", "Hard"}:
                    raise ValueError(f"Invalid difficulty for puzzle {number}: {difficulty}")
            rows[number] = (record, [" ".join(fen), " ".join(moves)])
    if not rows:
        raise ValueError("The archive contains no puzzles")
    return dict(sorted(rows.items(), key=lambda entry: int(entry[0])))


def position_map(fen):
    pieces = {}
    files = "abcdefgh"
    for rank, row in enumerate(fen.split("/"), start=1):
        file = 0
        for symbol in row:
            if symbol.isdigit():
                file += int(symbol)
            else:
                pieces[files[file] + str(9 - rank)] = symbol
                file += 1
    return pieces


def validate_setups(site, rows, rated=False):
    path = site / ("puzzle-batch-2-setups.js" if rated else "puzzle-setups.js")
    text = path.read_text()
    setups, _ = json.JSONDecoder().raw_decode(text[text.index("{"):])
    standard = position_map("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")
    for number, (record, _) in rows.items():
        key = f"b2-{number}" if rated else number
        setup = setups.get(key)
        if not setup or not setup["moves"].strip():
            raise ValueError(f"Puzzle {key} needs a setup plan before import")
        board = {square: standard[square] for square in setup["keep"].split()}
        for move in setup["moves"].split():
            source, target = move[:2], move[2:4]
            if not re.fullmatch(r"[a-h][1-8][a-h][1-8][qrbn]?", move) or source not in board or target in board:
                raise ValueError(f"Invalid setup move for puzzle {key}: {move}")
            piece = board.pop(source)
            if len(move) == 5:
                if piece.lower() != "p" or target[1] != ("8" if piece.isupper() else "1"):
                    raise ValueError(f"Invalid setup promotion for puzzle {key}: {move}")
                piece = move[4].upper() if piece.isupper() else move[4]
            board[target] = piece
        if board != position_map(record[3]):
            raise ValueError(f"Setup for puzzle {key} does not reach its printed position")


def import_archive(source, site):
    rows = read_archive(source)
    validate_setups(site, rows)
    catalogue_path = site / "catalog.js"
    catalogue = catalogue_path.read_text()
    products = json.loads(re.search(r"window\.catalog = (\[.*?\]);", catalogue, re.S)[1])
    featured = json.loads(re.search(r"window\.ledgerCollection = (\[.*?\]);", catalogue, re.S)[1])
    required = {product[5] for product in products} | {number for number, _ in featured}
    if absent := required - rows.keys():
        raise ValueError("Archive is missing puzzles currently used in the shop: " + ", ".join(sorted(absent)))
    images = site / "assets" / "puzzles"
    images.mkdir(parents=True, exist_ok=True)
    for (_, _, image, _), _ in rows.values():
        copyfile(source / image, images / image)
    print_rows = ",\n".join("  " + json.dumps(record[0], ensure_ascii=False) for record in rows.values())
    positions = ",\n".join(
        f"  {json.dumps(number)}: {json.dumps(record[1])}" for number, record in rows.items()
    )
    (site / "puzzle-positions.js").write_text(f"window.puzzlePositions = {{\n{positions}\n}};\n")
    catalogue = re.sub(
        r"window\.puzzlePrints = \[.*?\];",
        lambda _: f"window.puzzlePrints = [\n{print_rows}\n];",
        catalogue,
        count=1,
        flags=re.S,
    )
    catalogue_path.write_text(catalogue)
    print(f"Imported {len(rows)} playable puzzles")


def import_rated_archive(source, site):
    rows = read_archive(source, rated=True)
    validate_setups(site, rows, rated=True)
    images = site / "assets" / "puzzles" / "batch-2"
    images.mkdir(parents=True, exist_ok=True)
    prints = []
    positions = {}
    # Give the batch a repeatable shuffle while keeping the source keys for saved items.
    shuffled = sorted(rows, key=lambda number: sha256(f"offtheboardclub-batch-2:{number}".encode()).digest())
    for index, number in enumerate(shuffled, start=1):
        record, position = rows[number]
        key = f"b2-{number}"
        source_image = record[2]
        image = f"puzzle-{number}{Path(source_image).suffix.lower()}"
        copyfile(source / source_image, images / image)
        prints.append([key, record[1], f"batch-2/{image}", record[3], f"{index:03}"])
        positions[key] = position

    print_rows = ",\n".join("  " + json.dumps(record, ensure_ascii=False) for record in prints)
    position_rows = ",\n".join(f"  {json.dumps(key)}: {json.dumps(value)}" for key, value in positions.items())
    (site / "puzzle-batch-2.js").write_text(
        f"window.puzzlePrints.push(\n{print_rows}\n);\n"
        f"window.puzzlePositions = {{ ...window.puzzlePositions,\n{position_rows}\n}};\n"
    )
    print(f"Imported {len(prints)} shuffled puzzles into Batch 2")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Directory containing solutions.csv and its diagram images")
    parser.add_argument("--batch", choices=("1", "2"), default="1")
    args = parser.parse_args()
    try:
        importer = import_rated_archive if args.batch == "2" else import_archive
        importer(args.directory, Path(__file__).resolve().parent)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
