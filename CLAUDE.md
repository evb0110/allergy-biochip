# Allergen Chip Analysis Project - CLAUDE Instructions

## Data Processing Requirements

### Source Data Files
- **Primary CSV**: `input/13_09_2025_Входные_данные_без_нормировки.csv` - Raw data without normalization
- **Documentation**: `docs/Детальная_методика_расчетов_финальная_в2.docx` - Complete methodology

### Processing Algorithm - PERCENTAGE DEVIATIONS METHOD
1. Calculate initial mean from 4 measurement repeats
2. Identify removal candidates (deviation > D=20% from mean)
3. Check "rescue" conditions (candidate differs from non-candidates by < d=10% from mean)
4. Remove unrescued candidates
5. If all values removed, increase D by 10% and repeat
6. Calculate final mean from remaining values

### Data Structure (8 rows × 13 columns)
**Array Indexing:**
- **Column 0**: Marker БСА-Cy5 (position 23) - EXCLUDE
- **Columns 1-11**: Allergens 1-11 (D1-W15) in ARRAY INDICES 0-3 (CSV rows 2-5) - PROCESS ALL 4 REPEATS
- **Columns 1-9**: Allergens 12-20 (G3-Bet v4) in ARRAY INDICES 4-7 (CSV rows 6-9) - PROCESS ALL 4 REPEATS
- **Column 11**: Background (position 22) in ARRAY INDICES 4-7 - FOR BACKGROUND
- **Column 12**: Marker - EXCLUDE

### Allergen Coverage - ALL 20 ALLERGENS
- **Allergens 1-11**: Array rows 0-3 (CSV rows 2-5), Columns 1-11 (D1, E1, E5, M6, T2, T3, T4, T14, W1, W6, W15)
- **Allergens 12-20**: Array rows 4-7 (CSV rows 6-9), Columns 1-9 (G3, G4, G5, G6, G8, G13, Bet v1, Bet v2, Bet v4)
- **Total**: 20 allergen positions × 4 repeats each = 80 measurements

### Background Calculation
- **Source**: Column 11 (index 11, position 22 - empty cells)
- **Array Rows**: 4-7 (CSV rows 6-9)
- **Method**: Percentage deviation algorithm on 4 background values
- **Expected Value**: ~347.58 units

### Calibration and Concentration
- **Calibration**: 0.35 IU/ml = 90 signal units (without normalization)
- **Formula**: `concentration = (processed_mean - background_mean) × (0.35 / 90.0)`

### Classification Thresholds
- **≤ 0.35**: Клинически не значимый (Level 0)
- **0.36-0.5**: Очень низкий (Level 1)
- **0.51-1.0**: Низкий (Level 2)
- **1.01-5.0**: Средний (Level 3)
- **5.01-25.0**: Высокий (Level 4)
- **25.01-75.0**: Очень высокий (Level 5)
- **>75.0**: Исключительно высокий (Level 6)

### TypeScript Implementation
- **Main File**: `processor/allergen_processor_v3.ts`
- **Execution**: `bun run processor/allergen_processor_v3.ts`
- **Output**: `results/allergen_results_final.csv`
- **Gold Standard**: `gold_standard/` - Contains verified correct results

### Expected Gold Standard Results
**Top Allergens:**
1. **G3** (Ежа сборная): 100.19 МЕ/мл - Исключительно высокий
2. **G8** (Мятлик луговой): 81.06 МЕ/мл - Исключительно высокий
3. **G5** (Райграс пастбищный): 80.42 МЕ/мл - Исключительно высокий
4. **G4** (Овсянница луговая): 57.10 МЕ/мл - Очень высокий
5. **E1** (Эпителий кошки): 50.52 МЕ/мл - Очень высокий

**Statistics:**
- Total allergens: 20/20 (100%)
- Clinically significant (>0.35): 16/20 (80%)
- Background: 347.58 units

## Implementation Notes
- Use percentage deviation algorithm exclusively
- Process raw data without normalization
- Maintain full audit trail of all calculations
- Results must match gold standard values
- Export functions for potential reuse