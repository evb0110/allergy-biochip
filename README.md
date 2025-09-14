# Allergen Chip Analysis Project

## 🧬 Overview
This project processes allergen chip fluorescence data using a sophisticated percentage deviation algorithm to calculate accurate allergen concentrations.

## 📁 Project Structure
```
/
├── input/                    # Raw CSV data files
├── processor/               # TypeScript processing script
├── results/                 # Final processed results
├── gold_standard/           # Verified correct results for validation
├── docs/                    # Documentation and methodology
├── archived_old_versions/   # Historical versions and old results
├── CLAUDE.md               # Project configuration
└── README.md               # This file
```

## 🚀 Quick Start

### Run Analysis
```bash
bun run processor/allergen_processor_v3.ts
```

### View Results
Results are saved to `results/allergen_results_final.csv`

## 📊 Data Processing

### Input Data
- **File**: `input/13_09_2025_Входные_данные_без_нормировки.csv`
- **Structure**: 8 rows × 13 columns (raw fluorescence data)
- **Coverage**: 20 allergen positions with 4 measurement repeats each

### Algorithm
**Percentage Deviation Method**:
1. Calculate initial mean from 4 measurement repeats
2. Identify removal candidates (deviation > D=20% from mean)
3. Apply rescue logic (candidate differs from non-candidates by < d=10%)
4. Remove unrescued outliers
5. If all values removed, increase D by 10% and repeat
6. Calculate final mean from remaining values

### Background Correction
- **Source**: Column 11, rows 6-9 (position 22 - empty wells)
- **Method**: Same percentage deviation algorithm
- **Typical Value**: ~347.58 units

### Concentration Conversion
```
Concentration (IU/ml) = (processed_mean - background) × (0.35/90.0)
```

## 🎯 Results Summary

### Classification Levels
- **Level 0**: ≤ 0.35 IU/ml (Clinically insignificant)
- **Level 1**: 0.36-0.50 IU/ml (Very low)
- **Level 2**: 0.51-1.00 IU/ml (Low)
- **Level 3**: 1.01-5.00 IU/ml (Medium)
- **Level 4**: 5.01-25.00 IU/ml (High)
- **Level 5**: 25.01-75.00 IU/ml (Very high)
- **Level 6**: >75.00 IU/ml (Extremely high)

### Top Allergens (Latest Results)
1. **G3** (Ежа сборная): 100.19 IU/ml - Extremely high
2. **G8** (Мятлик луговой): 81.06 IU/ml - Extremely high
3. **G5** (Райграс пастбищный): 80.42 IU/ml - Extremely high

## 🔧 Technical Details

### Dependencies
- **Runtime**: Bun (recommended) or Node.js
- **Language**: TypeScript
- **Input Format**: CSV with semicolon separators

### Key Features
- ✅ Processes all 20 allergen positions
- ✅ Uses all 4 measurement repeats (corrected indexing)
- ✅ Sophisticated outlier detection and rescue logic
- ✅ Detailed step-by-step processing logs
- ✅ Background correction with same algorithm
- ✅ Automatic concentration conversion and classification

## 📋 Allergen Coverage

### Tree Allergens (T1-T14)
T2 (Ольха), T3 (Береза), T4 (Лещина), T14 (Тополь)

### Grass Allergens (G3-G13)
G3 (Ежа), G4 (Овсянница), G5 (Райграс), G6 (Тимофеевка), G8 (Мятлик), G13 (Бухарник)

### Weed Allergens (W1-W15)
W1 (Амброзия), W6 (Полынь), W15 (Лебеда)

### Animal Allergens (E1-E5)
E1 (Эпителий кошки), E5 (Перхоть собаки)

### Mold Allergens (M6)
M6 (Alternaria alternata)

### Dust Mite Allergens (D1)
D1 (Клещевой аллерген)

### Birch Components (Bet v1-v4)
Bet v1, Bet v2, Bet v4 (Рекомбинантные компоненты березы)

## 🏆 Gold Standard Results
The `gold_standard/` folder contains verified correct results that all future runs should match:

### Expected Top Allergens
1. **G3** (Ежа сборная): 100.19 МЕ/мл - Исключительно высокий
2. **G8** (Мятлик луговой): 81.06 МЕ/мл - Исключительно высокий
3. **G5** (Райграс пастбищный): 80.42 МЕ/мл - Исключительно высокий
4. **G4** (Овсянница луговая): 57.10 МЕ/мл - Очень высокий
5. **E1** (Эпителий кошки): 50.52 МЕ/мл - Очень высокий

### Quality Metrics
- **Total allergens**: 20/20 (100% coverage)
- **Clinically significant** (>0.35 МЕ/мл): 16/20 (80%)
- **Background**: 347.58 units (stable)
- **Array indexing**: 0-3 for allergens 1-11, 4-7 for allergens 12-20

## 🔧 Final Implementation
- **Processor**: `processor/allergen_processor_v3.ts` (gold standard)
- **Algorithm**: Percentage deviation method with D=20%, d=10%
- **Data structure**: 8 rows × 13 columns, all 4 repeats processed
- **Background calculation**: Column 11, rows 4-7 (CSV rows 6-9)
- **Project structure**: Clean, organized, production-ready

---
*Generated: September 14, 2025*
*Version: Gold Standard - Final*