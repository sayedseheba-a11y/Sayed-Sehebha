import { ClassMetrics, ModelAlgorithm, ModelEvaluationReport } from '../types/orbit';

/**
 * Exact One-vs-Rest trapezoidal ROC-AUC computation from predicted class probabilities.
 */
function computeBinaryRocAuc(yTrueBinary: number[], yScores: number[]): number | null {
  const positives = yTrueBinary.filter((v) => v === 1).length;
  const negatives = yTrueBinary.length - positives;
  if (positives === 0 || negatives === 0) return null;

  const paired = yScores
    .map((score, idx) => ({ score, label: yTrueBinary[idx] }))
    .sort((a, b) => b.score - a.score);

  let tp = 0;
  let fp = 0;
  let prevTpr = 0;
  let prevFpr = 0;
  let auc = 0;

  for (let i = 0; i < paired.length; i++) {
    if (paired[i].label === 1) tp += 1;
    else fp += 1;

    const isLastOrChanged = i === paired.length - 1 || paired[i].score !== paired[i + 1].score;
    if (isLastOrChanged) {
      const tpr = tp / positives;
      const fpr = fp / negatives;
      auc += ((fpr - prevFpr) * (tpr + prevTpr)) / 2;
      prevTpr = tpr;
      prevFpr = fpr;
    }
  }

  return Number(auc.toFixed(4));
}

export function evaluateClassificationPredictions(params: {
  modelId: ModelAlgorithm;
  modelName: string;
  labels: string[];
  yTrue: number[];
  yPred: number[];
  yProbs: number[][];
  cvScores: number[];
  trainCount: number;
  testCount: number;
  trainingTimeMs: number;
  featureImportances: Array<{ feature: string; importance: number }>;
}): ModelEvaluationReport {
  const {
    modelId,
    modelName,
    labels,
    yTrue,
    yPred,
    yProbs,
    cvScores,
    trainCount,
    testCount,
    trainingTimeMs,
    featureImportances,
  } = params;

  const k = labels.length;
  const cm: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  let correct = 0;

  for (let i = 0; i < yTrue.length; i++) {
    const t = yTrue[i];
    const p = yPred[i];
    if (t >= 0 && t < k && p >= 0 && p < k) {
      cm[t][p] += 1;
      if (t === p) correct += 1;
    }
  }

  const accuracy = yTrue.length > 0 ? Number((correct / yTrue.length).toFixed(4)) : 0;

  const classMetrics: ClassMetrics[] = labels.map((label, c) => {
    const tp = cm[c][c];
    let fp = 0;
    let fn = 0;
    let support = 0;
    for (let r = 0; r < k; r++) {
      support += cm[c][r];
      if (r !== c) {
        fp += cm[r][c];
        fn += cm[c][r];
      }
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    const yBinary = yTrue.map((t) => (t === c ? 1 : 0));
    const yScores = yProbs.map((row) => row[c] ?? 0);
    const rocAuc = computeBinaryRocAuc(yBinary, yScores);

    return {
      label,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1Score: Number(f1Score.toFixed(4)),
      support,
      rocAuc,
    };
  });

  const macroAvg = {
    precision: Number((classMetrics.reduce((s, c) => s + c.precision, 0) / k).toFixed(4)),
    recall: Number((classMetrics.reduce((s, c) => s + c.recall, 0) / k).toFixed(4)),
    f1Score: Number((classMetrics.reduce((s, c) => s + c.f1Score, 0) / k).toFixed(4)),
  };

  const totalSupport = classMetrics.reduce((s, c) => s + c.support, 0) || 1;
  const weightedAvg = {
    precision: Number((classMetrics.reduce((s, c) => s + c.precision * c.support, 0) / totalSupport).toFixed(4)),
    recall: Number((classMetrics.reduce((s, c) => s + c.recall * c.support, 0) / totalSupport).toFixed(4)),
    f1Score: Number((classMetrics.reduce((s, c) => s + c.f1Score * c.support, 0) / totalSupport).toFixed(4)),
  };

  const validAucs = classMetrics.map((c) => c.rocAuc).filter((a): a is number => a !== null);
  const rocAucMacro = validAucs.length > 0
    ? Number((validAucs.reduce((s, a) => s + a, 0) / validAucs.length).toFixed(4))
    : null;

  const cvMean = cvScores.length > 0
    ? Number((cvScores.reduce((s, v) => s + v, 0) / cvScores.length).toFixed(4))
    : 0;
  const cvStd = cvScores.length > 0
    ? Number(Math.sqrt(cvScores.reduce((s, v) => s + Math.pow(v - cvMean, 2), 0) / cvScores.length).toFixed(4))
    : 0;

  return {
    modelId,
    modelName,
    accuracy,
    macroAvg,
    weightedAvg,
    rocAucMacro,
    classMetrics,
    labels,
    confusionMatrix: cm,
    cvScores,
    cvMean,
    cvStd,
    trainCount,
    testCount,
    trainingTimeMs,
    featureImportances,
    trainedAt: new Date().toISOString(),
  };
}
