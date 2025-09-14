import pandas as pd
import numpy as np
from pathlib import Path

INPUT_XLSX = Path("01.09.2025 Входные данные аллергочип.xlsx")
OUTPUT_XLSX = Path("Результаты аллерго-чип.xlsx")
OUTPUT_CSV = Path("Результаты аллерго-чип.csv")

SHEET = 0

# Parameters of the numeric grid from the corrections doc: 13 columns × 8 rows
NUM_COLS = 13
NUM_ROWS = 8

# Read sheet
sh = pd.read_excel(INPUT_XLSX, sheet_name=SHEET, header=None)

# Extract mapping rows: rows around 25..47 contain index, code, name
mapping_rows = []
for r in range(sh.shape[0]):
    v0 = sh.iat[r,0]
    v1 = sh.iat[r,1]
    v2 = sh.iat[r,2]
    if pd.isna(v0) or pd.isna(v1) or pd.isna(v2):
        continue
    s0 = str(v0).strip()
    s1 = str(v1).strip()
    s2 = str(v2).strip()
    if s0.replace('.', '').isdigit() and len(s1) <= 5 and len(s2) > 0:
        try:
            idx = int(str(s0).replace('.', '').strip())
        except ValueError:
            continue
        if 1 <= idx <= 23:
            mapping_rows.append((idx, s1, s2))

mapping_df = pd.DataFrame(mapping_rows, columns=["position", "code", "name"]).drop_duplicates("position").sort_values("position")

## Extract numeric grid (13×8) anchored at the instruction line "Первое значение ..."
# Find anchor row index
anchor_row = None
for r in range(sh.shape[0]):
    row_text = " ".join(str(x) for x in sh.iloc[r].tolist() if pd.notna(x)).lower()
    if "первое значение" in row_text and "ячейке" in row_text:
        anchor_row = r
        break

if anchor_row is None:
    anchor_row = 0

# Collect rows of numeric values; stop after 8 rows having at least 13 numbers
grid = []
skipped_180_once = False
for r in range(anchor_row, sh.shape[0]):
    nums = []
    for c in range(sh.shape[1]):
        v = sh.iat[r, c]
        if pd.isna(v):
            continue
        if isinstance(v, (int, float, np.integer, np.floating)):
            x = float(v)
            if (not skipped_180_once) and abs(x - 180.0) < 1e-6:
                skipped_180_once = True
                continue
            nums.append(x)
    if len(nums) >= NUM_COLS:
        grid.append(nums[:NUM_COLS])
    if len(grid) >= NUM_ROWS:
        break

if len(grid) != NUM_ROWS:
    raise RuntimeError(f"Expected {NUM_ROWS} rows of numeric data, got {len(grid)}")

# Build DataFrame for convenience (rows 0..7, cols 0..12)
grid_df = pd.DataFrame(grid)

# Trim rule: drop min and max, average the remaining two

def trimmed_mean(values):
    values = np.array(values, dtype=float)
    if len(values) < 2:
        return float(np.mean(values))
    min_idx = np.argmin(values)
    max_idx = np.argmax(values)
    keep = [i for i in range(len(values)) if i not in (min_idx, max_idx)]
    if not keep:  # all equal or length==2
        return float(np.mean(values))
    return float(np.mean(values[keep]))

allergen_records = []

# Background is fixed: column 11 (index 10), rows 5–8 (indices 4..7)
bg_col_idx = 10
bg_vals = [grid_df.iat[r, bg_col_idx] for r in range(4, 8)]
bg_trimmed = trimmed_mean(bg_vals)

# Compute class boundaries (from typical IgE classes); instruction hints example rows but not full table.
# We'll use a conventional 0..6 class scale based on concentration (kU/L ~ ME/ml here), example thresholds:
# <0.1: 0, 0.1-0.35: 0/1 equivalent, 0.35-0.7: 1, 0.7-3.5: 2, 3.5-17.5: 3, 17.5-50: 4, 50-100:5, >100:6

class_thresholds = [
    (0.0, 0.10, 0),
    (0.10, 0.35, 0),
    (0.35, 0.70, 1),
    (0.70, 3.50, 2),
    (3.50, 17.50, 3),
    (17.50, 50.0, 4),
    (50.0, 100.0, 5),
    (100.0, float('inf'), 6),
]


def classify(conc):
    for lo, hi, cl in class_thresholds:
        if lo <= conc < hi:
            return cl
    return 0

# Conversion: 90 signal units == 0.35 ME/ml → conc = signal_corrected * (0.35 / 90)
K = 0.35 / 90.0

for pos in range(1, 21):
    if 1 <= pos <= 11:
        col_idx = pos  # columns 2..12 → indices 1..11 map to allergens 1..11
        rows_idx = range(0, 4)  # rows 1..4 → indices 0..3
    else:
        col_idx = pos - 11  # allergens 12..20 → columns 2..10 → indices 1..9
        rows_idx = range(4, 8)  # rows 5..8 → indices 4..7

    vals_pos = [grid_df.iat[r, col_idx] for r in rows_idx]
    mean_trim = trimmed_mean(vals_pos)
    corrected = mean_trim - bg_trimmed
    conc = max(corrected * K, 0.0)
    cl = classify(conc)
    code = mapping_df.loc[mapping_df["position"] == pos, "code"].iloc[0] if (mapping_df["position"] == pos).any() else f"pos{pos}"
    name = mapping_df.loc[mapping_df["position"] == pos, "name"].iloc[0] if (mapping_df["position"] == pos).any() else ""
    allergen_records.append({
        "position": pos,
        "group": code,
        "name": name,
        "mean_signal": round(mean_trim, 2),
        "background_mean": round(bg_trimmed, 2),
        "signal_minus_bg": round(corrected, 2),
        "concentration_ME_per_ml": round(conc, 3),
        "class": cl,
    })

res = pd.DataFrame(allergen_records).sort_values("position")

# Save
res_cols = ["position","group","name","mean_signal","background_mean","signal_minus_bg","concentration_ME_per_ml","class"]
res = res[res_cols]
res.to_excel(OUTPUT_XLSX, index=False)
res.to_csv(OUTPUT_CSV, index=False)

# Print a quick preview
with pd.option_context('display.max_rows', 25, 'display.max_columns', None, 'display.width', 180):
    print(res.head(25).to_string(index=False))
