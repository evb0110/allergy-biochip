import { readFileSync, writeFileSync } from 'fs';

// Allergen mapping data
const ALLERGEN_MAPPING = [
  // Allergens 1-11 (Array indices 0-3, columns 1-11)
  { position: 1, code: "D1", name: "Клещевой аллерген домашней пыли / Dermatophagoides pteronyssinus", rows: [0, 1, 2, 3], column: 1 },
  { position: 2, code: "E1", name: "Эпителий кошки", rows: [0, 1, 2, 3], column: 2 },
  { position: 3, code: "E5", name: "Перхоть собаки", rows: [0, 1, 2, 3], column: 3 },
  { position: 4, code: "M6", name: "Alternaria alternata (Плесень)", rows: [0, 1, 2, 3], column: 4 },
  { position: 5, code: "T2", name: "Ольха серая / Alnus incana", rows: [0, 1, 2, 3], column: 5 },
  { position: 6, code: "T3", name: "Береза белая / Betula verrucosa", rows: [0, 1, 2, 3], column: 6 },
  { position: 7, code: "T4", name: "Лещина / орешник / Corylus avellana", rows: [0, 1, 2, 3], column: 7 },
  { position: 8, code: "T14", name: "Тополь / Populus deltoides", rows: [0, 1, 2, 3], column: 8 },
  { position: 9, code: "W1", name: "Амброзия полыннолистная / Ambrosia elatior", rows: [0, 1, 2, 3], column: 9 },
  { position: 10, code: "W6", name: "Полынь обыкновенная / Artemisia vulgaris", rows: [0, 1, 2, 3], column: 10 },
  { position: 11, code: "W15", name: "Лебеда / Atriplex lentiformis", rows: [0, 1, 2, 3], column: 11 },
  
  // Allergens 12-20 (Array indices 4-7, columns 1-9)
  { position: 12, code: "G3", name: "Ежа сборная / Dactylis glomerata", rows: [4, 5, 6, 7], column: 1 },
  { position: 13, code: "G4", name: "Овсянница луговая / Festuca elatior", rows: [4, 5, 6, 7], column: 2 },
  { position: 14, code: "G5", name: "Райграс пастбищный / Lolium perenne", rows: [4, 5, 6, 7], column: 3 },
  { position: 15, code: "G6", name: "Тимофеевка луговая / Phleum pratense", rows: [4, 5, 6, 7], column: 4 },
  { position: 16, code: "G8", name: "Мятлик луговой / Poa pratensis", rows: [4, 5, 6, 7], column: 5 },
  { position: 17, code: "G13", name: "Бухарник шерстистый / Holcus lanatus", rows: [4, 5, 6, 7], column: 6 },
  { position: 18, code: "Bet v1", name: "Береза, рекомбинантный компонент Bet v1", rows: [4, 5, 6, 7], column: 7 },
  { position: 19, code: "Bet v2", name: "Береза, рекомбинантный компонент Bet v2", rows: [4, 5, 6, 7], column: 8 },
  { position: 20, code: "Bet v4", name: "Береза, рекомбинантный компонент Bet v4", rows: [4, 5, 6, 7], column: 9 },
];

// Classification function
function classifyConcentration(concentration: number): { level: number; classification: string } {
  if (concentration <= 0.35) return { level: 0, classification: "Клинически не значимый" };
  if (concentration <= 0.50) return { level: 1, classification: "Очень низкий" };
  if (concentration <= 1.00) return { level: 2, classification: "Низкий" };
  if (concentration <= 5.00) return { level: 3, classification: "Средний" };
  if (concentration <= 25.00) return { level: 4, classification: "Высокий" };
  if (concentration <= 75.00) return { level: 5, classification: "Очень высокий" };
  return { level: 6, classification: "Исключительно высокий" };
}

// Percentage deviation algorithm - CORRECTED VERSION
function calculateMeanWithPercentageDeviations(values: number[]): { mean: number; usedValues: number[]; iterations: number } {
  if (values.length === 0) return { mean: 0, usedValues: [], iterations: 0 };
  
  console.log(`  Starting values: [${values.join(', ')}]`);
  
  let D = 20; // Initial threshold percentage
  const d = 10; // Rescue threshold percentage
  let iterations = 0;
  
  while (D <= 100) {
    iterations++;
    console.log(`  Iteration ${iterations}: D=${D}%`);
    
    // Calculate initial mean
    const initialMean = values.reduce((sum, val) => sum + val, 0) / values.length;
    console.log(`  Initial mean: ${initialMean.toFixed(6)}`);
    
    // Find removal candidates
    const thresholdRemoval = initialMean * (D / 100.0);
    console.log(`  Removal threshold: ${thresholdRemoval.toFixed(6)}`);
    
    const candidates: number[] = [];
    const nonCandidates: number[] = [];
    
    values.forEach(val => {
      if (Math.abs(val - initialMean) > thresholdRemoval) {
        candidates.push(val);
      } else {
        nonCandidates.push(val);
      }
    });
    
    console.log(`  Removal candidates: [${candidates.join(', ')}]`);
    console.log(`  Non-candidates: [${nonCandidates.join(', ')}]`);
    
    // Apply rescue logic
    const thresholdSave = initialMean * (d / 100.0);
    const rescued: number[] = [];
    const toRemove: number[] = [];
    
    candidates.forEach(candidate => {
      let isRescued = false;
      for (const nonCandidate of nonCandidates) {
        if (Math.abs(candidate - nonCandidate) < thresholdSave) {
          isRescued = true;
          break;
        }
      }
      
      if (isRescued) {
        rescued.push(candidate);
      } else {
        toRemove.push(candidate);
      }
    });
    
    console.log(`  Rescued: [${rescued.join(', ')}]`);
    console.log(`  To remove: [${toRemove.join(', ')}]`);
    
    // Calculate remaining values
    const remaining = [...nonCandidates, ...rescued];
    console.log(`  Remaining values: [${remaining.join(', ')}]`);
    
    if (remaining.length > 0) {
      const finalMean = remaining.reduce((sum, val) => sum + val, 0) / remaining.length;
      console.log(`  Final mean: ${finalMean.toFixed(6)} (from ${remaining.length} values)`);
      return { mean: finalMean, usedValues: remaining, iterations };
    }
    
    // If all values would be removed, increase D and try again
    console.log(`  All values removed, increasing D to ${D + 10}%`);
    D += 10;
  }
  
  // Fallback: use all values
  const fallbackMean = values.reduce((sum, val) => sum + val, 0) / values.length;
  console.log(`  Fallback: using all values, mean = ${fallbackMean.toFixed(6)}`);
  return { mean: fallbackMean, usedValues: values, iterations };
}

// Background calculation with CORRECTED indexing
function calculateBackground(dataArray: number[][]): { value: number; values: number[] } {
  console.log("\n=== BACKGROUND CALCULATION ===");
  console.log("CRITICAL CORRECTION: Using array indices 4-7 (CSV rows 6-9), column index 11");
  
  const backgroundValues: number[] = [];
  
  // CORRECTED: Use array rows 4-7 (not 5-8), column index 11 (not 10)
  for (let row = 4; row < 8; row++) {
    if (dataArray[row] && dataArray[row][11] !== undefined) {
      backgroundValues.push(dataArray[row][11]);
      console.log(`Array row ${row} (CSV row ${row + 2}), column 11: ${dataArray[row][11]}`);
    }
  }
  
  if (backgroundValues.length === 0) {
    console.error("ERROR: No background values found!");
    return { value: 0, values: [] };
  }
  
  console.log(`Background raw values: [${backgroundValues.join(', ')}]`);
  
  // Apply percentage deviation algorithm to background
  const result = calculateMeanWithPercentageDeviations(backgroundValues);
  
  console.log(`Background final value: ${result.mean.toFixed(6)} (used ${result.usedValues.length} of ${backgroundValues.length} values)`);
  console.log("===============================\n");
  
  return { value: result.mean, values: backgroundValues };
}

function parseCSVData(csvContent: string): number[][] {
  console.log("\n=== CSV PARSING ===");
  
  const lines = csvContent.trim().split('\n');
  console.log(`Found ${lines.length} lines in CSV`);
  
  // Skip header line and empty lines, take data rows 2-9
  const dataLines = lines.slice(1, 9); // Lines 2-9 from CSV
  console.log(`Processing ${dataLines.length} data lines`);
  
  const dataArray: number[][] = [];
  
  dataLines.forEach((line, index) => {
    if (line.trim()) {
      const values = line.split(';').map(val => {
        const cleaned = val.replace(',', '.');
        return parseFloat(cleaned);
      });
      
      dataArray.push(values);
      console.log(`Array row ${index} (CSV row ${index + 2}): ${values.length} columns`);
    }
  });
  
  console.log(`Final data array: ${dataArray.length} rows × ${dataArray[0]?.length || 0} columns`);
  console.log("===================\n");
  
  return dataArray;
}

function processAllergen(dataArray: number[][], allergen: any): any {
  console.log(`\n--- Processing ${allergen.code} (${allergen.name}) ---`);
  console.log(`Position ${allergen.position}, Array rows [${allergen.rows.join(', ')}], Column ${allergen.column}`);
  
  const values: number[] = [];
  
  // CORRECTED: Use the proper row indices from mapping
  allergen.rows.forEach((rowIndex: number) => {
    if (dataArray[rowIndex] && dataArray[rowIndex][allergen.column] !== undefined) {
      const value = dataArray[rowIndex][allergen.column];
      values.push(value);
      console.log(`  Array row ${rowIndex} (CSV row ${rowIndex + 2}): ${value}`);
    }
  });
  
  if (values.length === 0) {
    console.log("  ERROR: No values found for this allergen");
    return null;
  }
  
  console.log(`  Raw values: [${values.join('; ')}]`);
  
  // Apply percentage deviation algorithm
  const result = calculateMeanWithPercentageDeviations(values);
  
  return {
    position: allergen.position,
    allergen: allergen.name,
    code: allergen.code,
    rawValues: values.join(';'),
    processedMean: result.mean,
    usedValues: result.usedValues,
    iterations: result.iterations
  };
}

function main() {
  console.log("🧬 CORRECTED ALLERGEN PROCESSOR - CRITICAL INDEXING FIX");
  console.log("========================================================");
  
  try {
    // Read CSV data
    const csvPath = '/Users/evb/Desktop/victor/Rinat/input/13_09_2025_Входные_данные_без_нормировки.csv';
    console.log(`Reading: ${csvPath}`);
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    // Parse data
    const dataArray = parseCSVData(csvContent);
    
    if (dataArray.length !== 8) {
      throw new Error(`Expected 8 data rows, got ${dataArray.length}`);
    }
    
    // Calculate background with CORRECTED indexing
    const background = calculateBackground(dataArray);
    
    // Process all 20 allergens
    console.log("\n🔬 PROCESSING ALL 20 ALLERGENS WITH CORRECTED INDEXING:");
    console.log("======================================================");
    
    const results: any[] = [];
    
    ALLERGEN_MAPPING.forEach(allergen => {
      const result = processAllergen(dataArray, allergen);
      
      if (result) {
        // Calculate corrected signal (subtract background)
        const correctedSignal = Math.max(0, result.processedMean - background.value);
        
        // Convert to concentration (0.35 IU/ml = 90 signal units)
        const concentration = correctedSignal * (0.35 / 90.0);
        
        // Classify
        const classification = classifyConcentration(concentration);
        
        console.log(`  ${result.code}: ${result.processedMean.toFixed(6)} - ${background.value.toFixed(6)} = ${correctedSignal.toFixed(6)} → ${concentration.toFixed(6)} МЕ/мл (${classification.classification})`);
        
        results.push({
          ...result,
          correctedSignal,
          concentration_IU_ml: concentration,
          units: 'МЕ/мл',
          level: classification.level,
          classification: classification.classification
        });
      }
    });
    
    // Generate CSV output
    console.log(`\n✅ Successfully processed ${results.length} allergens`);
    
    const csvHeader = 'Position,Allergen,Code,Raw_Values,Processed_Mean,Corrected_Signal,Concentration_IU_ml,Units,Level,Classification\n';
    
    const csvRows = results.map(r => 
      `${r.position},"${r.allergen}",${r.code},"${r.rawValues}",${r.processedMean.toFixed(8)},${r.correctedSignal.toFixed(8)},${r.concentration_IU_ml.toFixed(6)},${r.units},${r.level},${r.classification}`
    );
    
    const csvOutput = csvHeader + csvRows.join('\n');
    
    // Write corrected results
    const outputPath = '/Users/evb/Desktop/victor/Rinat/results/allergen_results_final.csv';
    writeFileSync(outputPath, '\uFEFF' + csvOutput);
    
    console.log(`\n💾 Results saved to: ${outputPath}`);
    
    // Summary statistics
    const stats = {
      total: results.length,
      significant: results.filter(r => r.concentration_IU_ml > 0.35).length,
      high: results.filter(r => r.level >= 5).length,
      maxConcentration: Math.max(...results.map(r => r.concentration_IU_ml)),
      background: background.value
    };
    
    console.log('\n📊 SUMMARY STATISTICS:');
    console.log('======================');
    console.log(`Total allergens processed: ${stats.total}`);
    console.log(`Clinically significant (>0.35): ${stats.significant} (${(stats.significant/stats.total*100).toFixed(1)}%)`);
    console.log(`Very/Extremely high (≥25): ${stats.high} (${(stats.high/stats.total*100).toFixed(1)}%)`);
    console.log(`Maximum concentration: ${stats.maxConcentration.toFixed(2)} МЕ/мл`);
    console.log(`Background: ${stats.background.toFixed(2)} units`);
    
    // Top allergens
    const topAllergens = results
      .filter(r => r.concentration_IU_ml > 0.35)
      .sort((a, b) => b.concentration_IU_ml - a.concentration_IU_ml)
      .slice(0, 10);
    
    console.log('\n🔥 TOP ALLERGENS:');
    console.log('=================');
    topAllergens.forEach((allergen, index) => {
      console.log(`${index + 1}. ${allergen.code}: ${allergen.concentration_IU_ml.toFixed(2)} МЕ/мл (${allergen.classification})`);
    });
    
    console.log('\n✅ CORRECTED PROCESSING COMPLETE!');
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
}

main();