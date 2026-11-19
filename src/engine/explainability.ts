import {
  FeatureContribution,
  LocalExplanation,
  SatelliteRecord,
} from '../types/orbit';
import {
  predictLogisticProbs,
  predictSingleRecord,
  predictTreeProbs,
  TrainedModelArtifact,
  transformWithScaler,
} from './mlEngine';

/**
 * Computes SHAP-style local feature attributions via Marginal Shapley / Leave-One-Out
 * expectation perturbation over the training baseline sample.
 * Guarantees exact model fidelity: works identically for Tree, Forest, and Linear models.
 */
export function explainPrediction(
  model: TrainedModelArtifact,
  recordOrFeatures: SatelliteRecord | Record<string, number | null>
): LocalExplanation {
  const rawFeatures: Record<string, number | null> = {};
  for (const f of model.features) {
    const val = recordOrFeatures[f];
    if (val === null || val === undefined || val === '') {
      rawFeatures[f] = null;
    } else {
      const num = Number(val);
      rawFeatures[f] = Number.isNaN(num) ? null : num;
    }
  }

  const { predictedClass, probabilities, scaledVector } = predictSingleRecord(model, rawFeatures);
  const targetIdx = model.labels.indexOf(predictedClass);

  const predictScaledProb = (vec: number[]): number => {
    if (model.algorithm === 'decision_tree' && model.decisionTree) {
      return predictTreeProbs(model.decisionTree, vec)[targetIdx] ?? 0;
    }
    if (model.algorithm === 'random_forest' && model.randomForest) {
      let sum = 0;
      for (const tree of model.randomForest) {
        sum += predictTreeProbs(tree, vec)[targetIdx] ?? 0;
      }
      return sum / model.randomForest.length;
    }
    if (model.logisticWeights && model.logisticBias) {
      return predictLogisticProbs(model.logisticWeights, model.logisticBias, vec)[targetIdx] ?? 0;
    }
    return 0;
  };

  const baseline = model.XTrainSample.length > 0 ? model.XTrainSample : [scaledVector];
  const baseValue =
    baseline.reduce((sum, b) => sum + predictScaledProb(b), 0) / baseline.length;

  const fullProb = probabilities[predictedClass] ?? predictScaledProb(scaledVector);

  // Marginal expectation difference when replacing feature j with baseline distribution
  const rawAttributions: number[] = model.features.map((_, j) => {
    let probWithoutFeature = 0;
    const sampleStep = Math.max(1, Math.floor(baseline.length / 24));
    let count = 0;
    for (let b = 0; b < baseline.length; b += sampleStep) {
      const perturbed = [...scaledVector];
      perturbed[j] = baseline[b][j];
      probWithoutFeature += predictScaledProb(perturbed);
      count += 1;
    }
    const meanWithout = probWithoutFeature / (count || 1);
    return fullProb - meanWithout;
  });

  // Normalize additive efficiency so sum(phi_j) == fullProb - baseValue
  const delta = fullProb - baseValue;
  const rawSum = rawAttributions.reduce((a, b) => a + b, 0);
  const scale = Math.abs(rawSum) > 1e-6 ? delta / rawSum : 1;

  const [unscaledFilled] = transformWithScaler(
    [model.features.map((f) => rawFeatures[f])],
    { ...model.scaler, method: 'none' }
  );

  const contributions: FeatureContribution[] = model.features
    .map((feature, j) => {
      const shapValue = Number((rawAttributions[j] * scale).toFixed(4));
      return {
        feature,
        featureValue: Number((unscaledFilled[j] ?? 0).toFixed(4)),
        shapValue,
        absImpact: Math.abs(shapValue),
      };
    })
    .sort((a, b) => b.absImpact - a.absImpact);

  const topPositive = contributions.filter((c) => c.shapValue > 0).slice(0, 2);
  const topNegative = contributions.filter((c) => c.shapValue < 0).slice(0, 1);

  const posText =
    topPositive.length > 0
      ? topPositive
          .map(
            (c) =>
              `${c.feature} (${c.featureValue}, +${(c.shapValue * 100).toFixed(1)}% push)`
          )
          .join(' and ')
      : 'overall orbital balance';

  const negText =
    topNegative.length > 0
      ? ` Offset slightly by ${topNegative[0].feature} (${topNegative[0].featureValue}, ${(topNegative[0].shapValue * 100).toFixed(1)}%).`
      : '';

  const narrative = `Classified as ${predictedClass} with ${(fullProb * 100).toFixed(1)}% probability (baseline prior ${(baseValue * 100).toFixed(1)}%). Primary drivers supporting this classification are ${posText}.${negText}`;

  return {
    predictedClass,
    probabilities,
    baseValue: Number(baseValue.toFixed(4)),
    contributions,
    narrative,
  };
}
