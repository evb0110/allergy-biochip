# Allergen Chip Analysis Rules

- Use the percentage-deviations method.
- Calculate the mean from 4 repeats.
- Remove candidates with deviation greater than `D=20%` from the mean.
- Rescue candidates within `d=10%` of non-candidates.
- If all candidates are removed, increase `D` by 10% and repeat.
- Use Column 11, position 22, array rows 4-7 for background with the same algorithm.
- Calibrate concentration as `(processed_mean - background_mean) * (0.35 / 90.0)`.
- Classify IU/ml values as: `<=0.35: 0`, `0.36-0.5: 1`, `0.51-1.0: 2`, `1.01-5.0: 3`, `5.01-25.0: 4`, `25.01-75.0: 5`, `>75.0: 6`.
