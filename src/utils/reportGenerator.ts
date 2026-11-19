import { jsPDF } from 'jspdf';
import {
  AnomalyDetectionResult,
  ClusteringResult,
  DatasetValidationSummary,
  LocalExplanation,
  ModelEvaluationReport,
  WranglingResult,
} from '../types/orbit';

export interface FullReportPayload {
  datasetName: string;
  isDemoData: boolean;
  validation: DatasetValidationSummary;
  wrangling: WranglingResult | null;
  evaluations: ModelEvaluationReport[];
  selectedModel: ModelEvaluationReport | null;
  anomalyResult: AnomalyDetectionResult | null;
  clusteringResult: ClusteringResult | null;
}

export function exportFullReportPdf(payload: FullReportPayload): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  let y = 52;

  const ensureSpace = (needed = 80) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 48) {
      doc.addPage();
      y = 52;
    }
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 6;
    doc.setDrawColor(6, 182, 212);
    doc.setLineWidth(1.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;
  };

  const addLine = (text: string, bold = false, indent = 0) => {
    ensureSpace(22);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const wrapped = doc.splitTextToSize(text, pageWidth - margin * 2 - indent);
    doc.text(wrapped, margin + indent, y);
    y += wrapped.length * 14 + 2;
  };

  // Header
  doc.setFillColor(6, 9, 19);
  doc.rect(0, 0, pageWidth, 88, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  doc.text('ORBITMINE — Orbital Data Mining Analysis Report', margin, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Dataset: ${payload.datasetName}${payload.isDemoData ? ' (Illustrative Sample Catalogue)' : ''}  |  Generated: ${new Date().toLocaleString()}`,
    margin,
    60
  );
  y = 114;

  // 1. Dataset Summary
  addSectionTitle('1. Dataset Overview & Validation Summary');
  addLine(`Total Records: ${payload.validation.rowCount}  |  Columns: ${payload.validation.columnCount}  |  Completeness: ${payload.validation.completenessPct}%`);
  addLine(`Missing Cells: ${payload.validation.totalMissingCells}  |  Duplicate Rows: ${payload.validation.duplicateCount}`);
  addLine(`Target Column: ${payload.validation.targetColumn ?? 'Not detected'}  |  Excluded Identifiers: ${payload.validation.identifierColumns.join(', ') || 'None'}`);
  addLine(`Numeric Features (${payload.validation.numericFeatures.length}): ${payload.validation.numericFeatures.join(', ')}`);

  // 2. Data Wrangling Summary
  addSectionTitle('2. Data Wrangling & Preprocessing Summary');
  if (payload.wrangling) {
    addLine(`Before Cleaning: ${payload.wrangling.beforeStats.rowCount} rows, ${payload.wrangling.beforeStats.missingCells} missing cells, ${payload.wrangling.beforeStats.duplicateRows} duplicates.`);
    addLine(`After Cleaning: ${payload.wrangling.afterStats.rowCount} rows, ${payload.wrangling.afterStats.missingCells} missing cells, ${payload.wrangling.afterStats.duplicateRows} duplicates (${payload.wrangling.afterStats.completenessPct}% completeness).`);
    addLine(`Transformations: ${payload.wrangling.duplicatesRemoved} duplicates removed, ${payload.wrangling.missingImputed} missing values imputed, ${payload.wrangling.outliersDetected} outliers handled.`);
  } else {
    addLine('No wrangling pipeline has been executed yet on the active dataset.');
  }

  // 3. Supervised Model Comparison & Evaluation
  addSectionTitle('3. Machine Learning Model Comparison & Evaluation');
  if (payload.evaluations.length > 0) {
    payload.evaluations.forEach((ev) => {
      addLine(
        `${ev.modelName}: Accuracy ${(ev.accuracy * 100).toFixed(2)}% | Macro F1 ${(ev.macroAvg.f1Score * 100).toFixed(2)}% | Weighted F1 ${(ev.weightedAvg.f1Score * 100).toFixed(2)}% | CV Mean ${(ev.cvMean * 100).toFixed(2)}% (+/- ${(ev.cvStd * 100).toFixed(2)}%) | ROC-AUC ${ev.rocAucMacro !== null ? ev.rocAucMacro.toFixed(4) : 'N/A'}`,
        ev.modelId === payload.selectedModel?.modelId
      );
    });

    if (payload.selectedModel) {
      y += 6;
      addLine(`Detailed Per-Class Report — ${payload.selectedModel.modelName}:`, true);
      payload.selectedModel.classMetrics.forEach((cm) => {
        addLine(
          `${cm.label}: Precision ${(cm.precision * 100).toFixed(1)}%  |  Recall ${(cm.recall * 100).toFixed(1)}%  |  F1 ${(cm.f1Score * 100).toFixed(1)}%  |  Support ${cm.support}`,
          false,
          12
        );
      });
      y += 4;
      addLine('Confusion Matrix (Rows = True, Cols = Predicted):', true);
      addLine(`Labels: [${payload.selectedModel.labels.join(', ')}]`, false, 12);
      payload.selectedModel.confusionMatrix.forEach((row, idx) => {
        addLine(`${payload.selectedModel!.labels[idx]}: [${row.join(', ')}]`, false, 12);
      });
    }
  } else {
    addLine('No supervised models have been trained yet. Run training in the Machine Learning Lab.');
  }

  // 4. Anomaly Detection Summary
  addSectionTitle('4. Isolation Forest Anomaly Detection Summary');
  if (payload.anomalyResult) {
    addLine(
      `Evaluated Objects: ${payload.anomalyResult.totalCount}  |  Flagged Anomalies: ${payload.anomalyResult.anomalyCount} (${(payload.anomalyResult.contaminationRate * 100).toFixed(1)}% contamination target)  |  Threshold Score: ${payload.anomalyResult.thresholdScore}`
    );
    const topAnoms = payload.anomalyResult.records
      .filter((r) => r.isAnomaly)
      .sort((a, b) => b.anomalyScore - a.anomalyScore)
      .slice(0, 5);
    topAnoms.forEach((a) => {
      addLine(
        `• ${a.object_name} (NORAD ${a.norad_id}, ${a.object_type}): Score ${a.anomalyScore.toFixed(4)} — ${a.reasonSummary}`,
        false,
        8
      );
    });
  } else {
    addLine('Isolation Forest anomaly detection has not been executed yet.');
  }

  // 5. Clustering Summary
  addSectionTitle('5. K-Means Orbital Pattern Discovery Summary');
  if (payload.clusteringResult) {
    addLine(
      `Clusters (k): ${payload.clusteringResult.k}  |  Silhouette Score: ${payload.clusteringResult.silhouetteScore}  |  PCA Variance Explained: PC1 ${payload.clusteringResult.explainedVariance[0]}%, PC2 ${payload.clusteringResult.explainedVariance[1]}%`
    );
    payload.clusteringResult.summaries.forEach((cs) => {
      addLine(
        `• Cluster ${cs.clusterId + 1} (${cs.size} objects, ${cs.sharePct}%): ${cs.interpretation}`,
        false,
        8
      );
    });
  } else {
    addLine('K-Means clustering has not been executed yet.');
  }

  doc.save(`orbitmine_analysis_report_${Date.now()}.pdf`);
}

export function exportPredictionPdf(
  modelName: string,
  inputs: Record<string, number>,
  explanation: LocalExplanation
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 44;
  let y = 54;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('ORBITMINE — Single Satellite Classification Report', margin, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Model: ${modelName}  |  Timestamp: ${new Date().toLocaleString()}`, margin, y);
  y += 26;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(8, 145, 178);
  doc.text(`Predicted Category: ${explanation.predictedClass}`, margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const probText = Object.entries(explanation.probabilities)
    .map(([k, v]) => `${k}: ${(v * 100).toFixed(2)}%`)
    .join('   |   ');
  doc.text(`Class Probabilities: ${probText}`, margin, y);
  y += 24;

  const narrativeLines = doc.splitTextToSize(`Explanation: ${explanation.narrative}`, 500);
  doc.text(narrativeLines, margin, y);
  y += narrativeLines.length * 14 + 16;

  doc.setFont('helvetica', 'bold');
  doc.text('Input Orbital Parameters:', margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  Object.entries(inputs).forEach(([k, v]) => {
    doc.text(`• ${k}: ${v}`, margin + 10, y);
    y += 14;
  });

  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.text('SHAP Feature Contributions:', margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  explanation.contributions.forEach((c) => {
    const sign = c.shapValue >= 0 ? '+' : '';
    doc.text(`• ${c.feature} (${c.featureValue}): ${sign}${(c.shapValue * 100).toFixed(2)}%`, margin + 10, y);
    y += 14;
  });

  doc.save(`orbitmine_prediction_${Date.now()}.pdf`);
}
