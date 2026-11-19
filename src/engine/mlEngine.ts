import {
  MlTrainingConfig,
  ModelAlgorithm,
  ModelEvaluationReport,
  SatelliteRecord,
} from '../types/orbit';
import { evaluateClassificationPredictions } from './evaluation';

function createRng(seed: number) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ScalerState {
  method: 'standard' | 'minmax' | 'none';
  means: number[];
  stds: number[];
  mins: number[];
  maxs: number[];
  medians: number[];
}

export interface TreeNode {
  isLeaf: boolean;
  featureIdx?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  classCounts: number[];
  classProbs: number[];
  predictedClass: number;
  impurity: number;
  samples: number;
}

export interface TrainedModelArtifact {
  algorithm: ModelAlgorithm;
  modelName: string;
  features: string[];
  labels: string[];
  scaler: ScalerState;
  XTrainSample: number[][]; // standardized baseline sample for marginal XAI
  evaluation: ModelEvaluationReport;
  decisionTree?: TreeNode;
  randomForest?: TreeNode[];
  logisticWeights?: number[][]; // [numClasses][numFeatures]
  logisticBias?: number[]; // [numClasses]
}

function fitScalerAndImputer(
  XTrainRaw: Array<Array<number | null>>,
  method: 'standard' | 'minmax' | 'none'
): { scaler: ScalerState; XTrain: number[][] } {
  const numCols = XTrainRaw[0]?.length ?? 0;
  const medians: number[] = [];
  const means: number[] = [];
  const stds: number[] = [];
  const mins: number[] = [];
  const maxs: number[] = [];

  for (let j = 0; j < numCols; j++) {
    const valid = XTrainRaw.map((r) => r[j]).filter((v): v is number => v !== null && !Number.isNaN(v));
    const sorted = [...valid].sort((a, b) => a - b);
    const med = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
    medians.push(med);

    const filled = XTrainRaw.map((r) => (r[j] === null || Number.isNaN(r[j] as number) ? med : (r[j] as number)));
    const mean = filled.reduce((a, b) => a + b, 0) / (filled.length || 1);
    const variance = filled.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (filled.length || 1);
    const std = Math.sqrt(variance) || 1;
    const min = Math.min(...filled);
    const max = Math.max(...filled);

    means.push(mean);
    stds.push(std > 1e-12 ? std : 1);
    mins.push(min);
    maxs.push(max > min ? max : min + 1);
  }

  const scaler: ScalerState = { method, means, stds, mins, maxs, medians };
  const XTrain = transformWithScaler(XTrainRaw, scaler);
  return { scaler, XTrain };
}

export function transformWithScaler(
  XRaw: Array<Array<number | null>>,
  scaler: ScalerState
): number[][] {
  return XRaw.map((row) =>
    row.map((val, j) => {
      const num = val === null || Number.isNaN(val) ? scaler.medians[j] : val;
      if (scaler.method === 'standard') {
        return (num - scaler.means[j]) / scaler.stds[j];
      }
      if (scaler.method === 'minmax') {
        return (num - scaler.mins[j]) / (scaler.maxs[j] - scaler.mins[j]);
      }
      return num;
    })
  );
}

function giniImpurity(counts: number[], total: number): number {
  if (total === 0) return 0;
  let sumSq = 0;
  for (const c of counts) {
    const p = c / total;
    sumSq += p * p;
  }
  return 1 - sumSq;
}

function buildDecisionTree(
  X: number[][],
  y: number[],
  numClasses: number,
  maxDepth: number,
  minSamplesSplit: number,
  featureSubsetSize: number | null,
  rng: () => number,
  importancesAccum: number[],
  depth = 0
): TreeNode {
  const counts = Array(numClasses).fill(0);
  for (const label of y) counts[label] += 1;
  const n = y.length;
  const probs = counts.map((c) => (n > 0 ? c / n : 1 / numClasses));
  const predictedClass = probs.indexOf(Math.max(...probs));
  const impurity = giniImpurity(counts, n);

  if (depth >= maxDepth || n < minSamplesSplit || impurity === 0) {
    return {
      isLeaf: true,
      classCounts: counts,
      classProbs: probs,
      predictedClass,
      impurity,
      samples: n,
    };
  }

  const numFeatures = X[0].length;
  let candidateFeatures = Array.from({ length: numFeatures }, (_, i) => i);
  if (featureSubsetSize && featureSubsetSize < numFeatures) {
    // Fisher-Yates shuffle partial
    for (let i = candidateFeatures.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidateFeatures[i], candidateFeatures[j]] = [candidateFeatures[j], candidateFeatures[i]];
    }
    candidateFeatures = candidateFeatures.slice(0, featureSubsetSize);
  }

  let bestGain = 0;
  let bestFeature = -1;
  let bestThreshold = 0;
  let bestLeftIdx: number[] = [];
  let bestRightIdx: number[] = [];

  for (const fIdx of candidateFeatures) {
    // Sort indices by feature value for fast exact threshold scan
    const indices = Array.from({ length: n }, (_, i) => i).sort((a, b) => X[a][fIdx] - X[b][fIdx]);
    const leftCounts = Array(numClasses).fill(0);
    const rightCounts = [...counts];

    // Sample candidate split points if n is large to keep training crisp (< 150ms)
    const step = n > 240 ? Math.floor(n / 60) : 1;

    for (let pos = 0; pos < n - 1; pos++) {
      const idx = indices[pos];
      const c = y[idx];
      leftCounts[c] += 1;
      rightCounts[c] -= 1;

      if (pos % step !== 0 && pos !== n - 2) continue;
      const val = X[idx][fIdx];
      const nextVal = X[indices[pos + 1]][fIdx];
      if (val === nextVal) continue;

      const leftN = pos + 1;
      const rightN = n - leftN;
      const leftImp = giniImpurity(leftCounts, leftN);
      const rightImp = giniImpurity(rightCounts, rightN);
      const weightedImp = (leftN / n) * leftImp + (rightN / n) * rightImp;
      const gain = impurity - weightedImp;

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = fIdx;
        bestThreshold = (val + nextVal) / 2;
      }
    }
  }

  if (bestFeature === -1 || bestGain <= 1e-7) {
    return {
      isLeaf: true,
      classCounts: counts,
      classProbs: probs,
      predictedClass,
      impurity,
      samples: n,
    };
  }

  for (let i = 0; i < n; i++) {
    if (X[i][bestFeature] <= bestThreshold) bestLeftIdx.push(i);
    else bestRightIdx.push(i);
  }

  if (bestLeftIdx.length === 0 || bestRightIdx.length === 0) {
    return {
      isLeaf: true,
      classCounts: counts,
      classProbs: probs,
      predictedClass,
      impurity,
      samples: n,
    };
  }

  importancesAccum[bestFeature] += bestGain * n;

  const leftNode = buildDecisionTree(
    bestLeftIdx.map((i) => X[i]),
    bestLeftIdx.map((i) => y[i]),
    numClasses,
    maxDepth,
    minSamplesSplit,
    featureSubsetSize,
    rng,
    importancesAccum,
    depth + 1
  );

  const rightNode = buildDecisionTree(
    bestRightIdx.map((i) => X[i]),
    bestRightIdx.map((i) => y[i]),
    numClasses,
    maxDepth,
    minSamplesSplit,
    featureSubsetSize,
    rng,
    importancesAccum,
    depth + 1
  );

  return {
    isLeaf: false,
    featureIdx: bestFeature,
    threshold: bestThreshold,
    left: leftNode,
    right: rightNode,
    classCounts: counts,
    classProbs: probs,
    predictedClass,
    impurity,
    samples: n,
  };
}

export function predictTreeProbs(node: TreeNode, x: number[]): number[] {
  let curr: TreeNode = node;
  while (!curr.isLeaf && curr.featureIdx !== undefined && curr.threshold !== undefined) {
    if (x[curr.featureIdx] <= curr.threshold) {
      curr = curr.left!;
    } else {
      curr = curr.right!;
    }
  }
  return curr.classProbs;
}

function trainLogisticRegression(
  X: number[][],
  y: number[],
  numClasses: number,
  maxIter: number
): { weights: number[][]; bias: number[] } {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  const weights: number[][] = Array.from({ length: numClasses }, () => Array(p).fill(0));
  const bias: number[] = Array(numClasses).fill(0);
  const lr = 0.25;
  const l2 = 0.01;

  for (let iter = 0; iter < maxIter; iter++) {
    const gradW: number[][] = Array.from({ length: numClasses }, () => Array(p).fill(0));
    const gradB: number[] = Array(numClasses).fill(0);

    for (let i = 0; i < n; i++) {
      const logits = Array(numClasses).fill(0);
      for (let c = 0; c < numClasses; c++) {
        let z = bias[c];
        for (let j = 0; j < p; j++) {
          z += weights[c][j] * X[i][j];
        }
        logits[c] = z;
      }
      const maxLogit = Math.max(...logits);
      const exps = logits.map((l) => Math.exp(Math.max(-30, Math.min(30, l - maxLogit))));
      const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
      const probs = exps.map((e) => e / sumExp);

      for (let c = 0; c < numClasses; c++) {
        const err = probs[c] - (y[i] === c ? 1 : 0);
        gradB[c] += err;
        for (let j = 0; j < p; j++) {
          gradW[c][j] += err * X[i][j];
        }
      }
    }

    for (let c = 0; c < numClasses; c++) {
      bias[c] -= lr * (gradB[c] / n);
      for (let j = 0; j < p; j++) {
        weights[c][j] -= lr * (gradW[c][j] / n + l2 * weights[c][j]);
      }
    }
  }

  return { weights, bias };
}

export function predictLogisticProbs(
  weights: number[][],
  bias: number[],
  x: number[]
): number[] {
  const numClasses = weights.length;
  const logits = Array(numClasses).fill(0);
  for (let c = 0; c < numClasses; c++) {
    let z = bias[c];
    for (let j = 0; j < x.length; j++) {
      z += weights[c][j] * x[j];
    }
    logits[c] = z;
  }
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(Math.max(-30, Math.min(30, l - maxLogit))));
  const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sumExp);
}

function normalizeImportances(raw: number[], features: string[]) {
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return features
    .map((feature, idx) => ({
      feature,
      importance: Number((raw[idx] / total).toFixed(4)),
    }))
    .sort((a, b) => b.importance - a.importance);
}

function stratifiedTrainTestSplit(
  indices: number[],
  y: number[],
  testSize: number,
  stratify: boolean,
  rng: () => number
): { trainIdx: number[]; testIdx: number[] } {
  const shuffle = (arr: number[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  if (!stratify) {
    const shuffled = shuffle(indices);
    const split = Math.max(1, Math.floor(shuffled.length * (1 - testSize)));
    return {
      trainIdx: shuffled.slice(0, split),
      testIdx: shuffled.slice(split),
    };
  }

  const byClass = new Map<number, number[]>();
  for (const idx of indices) {
    const label = y[idx];
    if (!byClass.has(label)) byClass.set(label, []);
    byClass.get(label)!.push(idx);
  }

  const trainIdx: number[] = [];
  const testIdx: number[] = [];
  for (const classIndices of byClass.values()) {
    const shuffled = shuffle(classIndices);
    const nTest = Math.max(1, Math.round(shuffled.length * testSize));
    const nTrain = Math.max(1, shuffled.length - nTest);
    trainIdx.push(...shuffled.slice(0, nTrain));
    testIdx.push(...shuffled.slice(nTrain));
  }

  return { trainIdx: shuffle(trainIdx), testIdx: shuffle(testIdx) };
}

function makeStratifiedKFold(
  indices: number[],
  y: number[],
  k: number,
  rng: () => number
): number[][] {
  const folds: number[][] = Array.from({ length: k }, () => []);
  const byClass = new Map<number, number[]>();
  for (const idx of indices) {
    const c = y[idx];
    if (!byClass.has(c)) byClass.set(c, []);
    byClass.get(c)!.push(idx);
  }
  for (const group of byClass.values()) {
    const shuffled = [...group];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.forEach((idx, pos) => {
      folds[pos % k].push(idx);
    });
  }
  return folds;
}

export function trainAndEvaluateModels(
  records: SatelliteRecord[],
  targetColumn: string,
  config: MlTrainingConfig
): TrainedModelArtifact[] {
  const validRecords = records.filter(
    (r) => r[targetColumn] !== null && r[targetColumn] !== undefined && r[targetColumn] !== ''
  );

  const labels = Array.from(new Set(validRecords.map((r) => String(r[targetColumn])))).sort();
  const labelMap = new Map<string, number>();
  labels.forEach((l, i) => labelMap.set(l, i));

  const features = config.selectedFeatures;
  const XRawAll: Array<Array<number | null>> = validRecords.map((r) =>
    features.map((f) => {
      const val = r[f];
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return Number.isNaN(num) ? null : num;
    })
  );
  const yAll = validRecords.map((r) => labelMap.get(String(r[targetColumn])) ?? 0);

  const rng = createRng(config.randomSeed);
  const allIndices = Array.from({ length: validRecords.length }, (_, i) => i);
  const { trainIdx, testIdx } = stratifiedTrainTestSplit(
    allIndices,
    yAll,
    config.testSize,
    config.stratify,
    rng
  );

  const XTrainRaw = trainIdx.map((i) => XRawAll[i]);
  const yTrain = trainIdx.map((i) => yAll[i]);
  const XTestRaw = testIdx.map((i) => XRawAll[i]);
  const yTest = testIdx.map((i) => yAll[i]);

  // Fit scaler strictly on training split to prevent data leakage
  const scalerMethod = config.scalingInPipeline;
  const { scaler, XTrain } = fitScalerAndImputer(XTrainRaw, scalerMethod);
  const XTest = transformWithScaler(XTestRaw, scaler);

  const numClasses = labels.length;
  const artifacts: TrainedModelArtifact[] = [];

  for (const algo of config.algorithms) {
    const startTime = performance.now();
    const modelRng = createRng(config.randomSeed + algo.length * 97);

    let yProbs: number[][] = [];
    let yPred: number[] = [];
    let featureImportances: Array<{ feature: string; importance: number }> = [];
    let decisionTree: TreeNode | undefined;
    let randomForest: TreeNode[] | undefined;
    let logisticWeights: number[][] | undefined;
    let logisticBias: number[] | undefined;

    if (algo === 'decision_tree') {
      const impAccum = Array(features.length).fill(0);
      decisionTree = buildDecisionTree(
        XTrain,
        yTrain,
        numClasses,
        config.decisionTreeMaxDepth,
        4,
        null,
        modelRng,
        impAccum
      );
      yProbs = XTest.map((x) => predictTreeProbs(decisionTree!, x));
      yPred = yProbs.map((p) => p.indexOf(Math.max(...p)));
      featureImportances = normalizeImportances(impAccum, features);
    } else if (algo === 'random_forest') {
      const impAccum = Array(features.length).fill(0);
      const nTrees = config.randomForestTrees;
      const mTry = Math.max(1, Math.round(Math.sqrt(features.length)));
      const trees: TreeNode[] = [];

      for (let t = 0; t < nTrees; t++) {
        const bootX: number[][] = [];
        const bootY: number[] = [];
        for (let i = 0; i < XTrain.length; i++) {
          const rIdx = Math.floor(modelRng() * XTrain.length);
          bootX.push(XTrain[rIdx]);
          bootY.push(yTrain[rIdx]);
        }
        trees.push(
          buildDecisionTree(
            bootX,
            bootY,
            numClasses,
            config.decisionTreeMaxDepth + 1,
            3,
            mTry,
            modelRng,
            impAccum
          )
        );
      }
      randomForest = trees;
      yProbs = XTest.map((x) => {
        const avg = Array(numClasses).fill(0);
        for (const tree of trees) {
          const tp = predictTreeProbs(tree, x);
          for (let c = 0; c < numClasses; c++) avg[c] += tp[c] / trees.length;
        }
        return avg;
      });
      yPred = yProbs.map((p) => p.indexOf(Math.max(...p)));
      featureImportances = normalizeImportances(impAccum, features);
    } else {
      // Logistic Regression always benefits from standardized inputs even if pipeline says 'none'
      const { weights, bias } = trainLogisticRegression(
        XTrain,
        yTrain,
        numClasses,
        config.logisticMaxIter
      );
      logisticWeights = weights;
      logisticBias = bias;
      yProbs = XTest.map((x) => predictLogisticProbs(weights, bias, x));
      yPred = yProbs.map((p) => p.indexOf(Math.max(...p)));
      const weightMags = features.map((_, j) =>
        weights.reduce((s, row) => s + Math.abs(row[j]), 0)
      );
      featureImportances = normalizeImportances(weightMags, features);
    }

    // Real Stratified K-Fold Cross-Validation on training partition (zero leakage per fold)
    const folds = makeStratifiedKFold(
      Array.from({ length: XTrainRaw.length }, (_, i) => i),
      yTrain,
      config.cvFolds,
      createRng(config.randomSeed + 404)
    );

    const cvScores: number[] = folds.map((valFoldIndices, fIdx) => {
      const valSet = new Set(valFoldIndices);
      const trXRaw: Array<Array<number | null>> = [];
      const trY: number[] = [];
      const vaXRaw: Array<Array<number | null>> = [];
      const vaY: number[] = [];

      XTrainRaw.forEach((row, idx) => {
        if (valSet.has(idx)) {
          vaXRaw.push(row);
          vaY.push(yTrain[idx]);
        } else {
          trXRaw.push(row);
          trY.push(yTrain[idx]);
        }
      });

      const { scaler: foldScaler, XTrain: fXTr } = fitScalerAndImputer(trXRaw, scalerMethod);
      const fXVa = transformWithScaler(vaXRaw, foldScaler);
      const fRng = createRng(config.randomSeed + fIdx * 31);

      let foldPreds: number[] = [];
      if (algo === 'decision_tree') {
        const tree = buildDecisionTree(fXTr, trY, numClasses, config.decisionTreeMaxDepth, 4, null, fRng, Array(features.length).fill(0));
        foldPreds = fXVa.map((x) => {
          const p = predictTreeProbs(tree, x);
          return p.indexOf(Math.max(...p));
        });
      } else if (algo === 'random_forest') {
        const nTrees = Math.min(18, config.randomForestTrees);
        const mTry = Math.max(1, Math.round(Math.sqrt(features.length)));
        const trees: TreeNode[] = [];
        for (let t = 0; t < nTrees; t++) {
          const bx: number[][] = [];
          const by: number[] = [];
          for (let i = 0; i < fXTr.length; i++) {
            const ri = Math.floor(fRng() * fXTr.length);
            bx.push(fXTr[ri]);
            by.push(trY[ri]);
          }
          trees.push(buildDecisionTree(bx, by, numClasses, config.decisionTreeMaxDepth + 1, 3, mTry, fRng, Array(features.length).fill(0)));
        }
        foldPreds = fXVa.map((x) => {
          const avg = Array(numClasses).fill(0);
          for (const tr of trees) {
            const p = predictTreeProbs(tr, x);
            for (let c = 0; c < numClasses; c++) avg[c] += p[c] / trees.length;
          }
          return avg.indexOf(Math.max(...avg));
        });
      } else {
        const { weights, bias } = trainLogisticRegression(fXTr, trY, numClasses, Math.min(180, config.logisticMaxIter));
        foldPreds = fXVa.map((x) => {
          const p = predictLogisticProbs(weights, bias, x);
          return p.indexOf(Math.max(...p));
        });
      }

      const foldCorrect = foldPreds.reduce((s, p, idx) => s + (p === vaY[idx] ? 1 : 0), 0);
      return Number((foldCorrect / (vaY.length || 1)).toFixed(4));
    });

    const elapsed = Math.max(4, Math.round(performance.now() - startTime));
    const modelName =
      algo === 'decision_tree'
        ? 'Decision Tree (CART)'
        : algo === 'random_forest'
        ? `Random Forest (${config.randomForestTrees} trees)`
        : 'Logistic Regression (L2)';

    const evaluation = evaluateClassificationPredictions({
      modelId: algo,
      modelName,
      labels,
      yTrue: yTest,
      yPred,
      yProbs,
      cvScores,
      trainCount: XTrain.length,
      testCount: XTest.length,
      trainingTimeMs: elapsed,
      featureImportances,
    });

    artifacts.push({
      algorithm: algo,
      modelName,
      features,
      labels,
      scaler,
      XTrainSample: XTrain.slice(0, 80),
      evaluation,
      decisionTree,
      randomForest,
      logisticWeights,
      logisticBias,
    });
  }

  return artifacts;
}

export function predictSingleRecord(
  model: TrainedModelArtifact,
  rawFeatureValues: Record<string, number | null>
): { predictedClass: string; probabilities: Record<string, number>; scaledVector: number[] } {
  const rowRaw = [model.features.map((f) => rawFeatureValues[f] ?? null)];
  const [scaled] = transformWithScaler(rowRaw, model.scaler);

  let probs: number[] = [];
  if (model.algorithm === 'decision_tree' && model.decisionTree) {
    probs = predictTreeProbs(model.decisionTree, scaled);
  } else if (model.algorithm === 'random_forest' && model.randomForest) {
    probs = Array(model.labels.length).fill(0);
    for (const tree of model.randomForest) {
      const tp = predictTreeProbs(tree, scaled);
      for (let c = 0; c < model.labels.length; c++) {
        probs[c] += tp[c] / model.randomForest.length;
      }
    }
  } else if (model.logisticWeights && model.logisticBias) {
    probs = predictLogisticProbs(model.logisticWeights, model.logisticBias, scaled);
  }

  const bestIdx = probs.indexOf(Math.max(...probs));
  const probabilities: Record<string, number> = {};
  model.labels.forEach((lbl, idx) => {
    probabilities[lbl] = Number((probs[idx] ?? 0).toFixed(4));
  });

  return {
    predictedClass: model.labels[bestIdx] ?? model.labels[0],
    probabilities,
    scaledVector: scaled,
  };
}
