from datetime import datetime, timezone
from pathlib import Path
import time
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
    silhouette_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, MinMaxScaler, StandardScaler
from sklearn.tree import DecisionTreeClassifier

IDENTIFIER_HINTS = ("norad", "id", "name", "object_name", "catalog", "cospar")
MODELS_DIR = Path(__file__).parent / "saved_models"
MODELS_DIR.mkdir(exist_ok=True)


class OrbitMinePipelineState:
    def __init__(self) -> None:
        self.raw_df: Optional[pd.DataFrame] = None
        self.active_df: Optional[pd.DataFrame] = None
        self.trained_models: Dict[str, Dict[str, Any]] = {}
        self.label_encoder: Optional[LabelEncoder] = None
        self.feature_names: List[str] = []

    def set_dataset(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        df = pd.DataFrame(records)
        self.raw_df = df.copy()
        self.active_df = df.copy()
        self.trained_models.clear()
        return {
            "rows": int(len(df)),
            "columns": list(df.columns),
            "missing_cells": int(df.isna().sum().sum()),
            "duplicates": int(df.duplicated().sum()),
        }

    def wrangle(self, cfg: Dict[str, Any]) -> Dict[str, Any]:
        if self.raw_df is None:
            raise ValueError("No dataset uploaded yet.")
        df = self.raw_df.copy()
        logs: List[str] = []

        if cfg.get("removeDuplicates", True):
            before = len(df)
            df = df.drop_duplicates()
            logs.append(f"Removed {before - len(df)} duplicate rows.")

        strategy = cfg.get("missingStrategy", "median")
        if strategy == "drop":
            before = len(df)
            df = df.dropna()
            logs.append(f"Dropped {before - len(df)} incomplete rows.")
        else:
            num_cols = df.select_dtypes(include=[np.number]).columns
            for col in num_cols:
                if df[col].isna().any():
                    val = (
                        df[col].median()
                        if strategy == "median"
                        else df[col].mean()
                        if strategy == "mean"
                        else df[col].mode().iloc[0]
                    )
                    df[col] = df[col].fillna(val)
                    logs.append(f"Imputed '{col}' using {strategy}.")

        self.active_df = df.reset_index(drop=True)
        return {
            "rowCount": int(len(self.active_df)),
            "missingCells": int(self.active_df.isna().sum().sum()),
            "logs": logs,
        }

    def train(self, cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
        if self.active_df is None:
            raise ValueError("No dataset loaded.")
        df = self.active_df.dropna(subset=["object_type"]).copy()

        # Strictly exclude identifier columns and target label
        features = [
            f
            for f in cfg["selectedFeatures"]
            if f in df.columns
            and f != "object_type"
            and not any(h in f.lower() for h in IDENTIFIER_HINTS)
        ]
        if len(features) < 2:
            raise ValueError("At least 2 valid numeric features are required.")

        X = df[features].apply(pd.to_numeric, errors="coerce")
        le = LabelEncoder()
        y = le.fit_transform(df["object_type"].astype(str))
        self.label_encoder = le
        self.feature_names = features

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=cfg["testSize"],
            stratify=y if cfg.get("stratify", True) else None,
            random_state=cfg.get("randomSeed", 42),
        )

        scaler_step = (
            StandardScaler()
            if cfg["scalingInPipeline"] == "standard"
            else MinMaxScaler()
            if cfg["scalingInPipeline"] == "minmax"
            else "passthrough"
        )

        evaluations = []
        for algo in cfg["algorithms"]:
            t0 = time.perf_counter()
            if algo == "decision_tree":
                clf = DecisionTreeClassifier(
                    max_depth=cfg.get("decisionTreeMaxDepth", 6),
                    random_state=cfg.get("randomSeed", 42),
                )
                name = "Decision Tree (CART)"
            elif algo == "random_forest":
                clf = RandomForestClassifier(
                    n_estimators=cfg.get("randomForestTrees", 100),
                    max_depth=cfg.get("decisionTreeMaxDepth", 6) + 2,
                    random_state=cfg.get("randomSeed", 42),
                )
                name = f"Random Forest ({cfg.get('randomForestTrees', 100)} trees)"
            else:
                clf = LogisticRegression(
                    max_iter=cfg.get("logisticMaxIter", 400),
                    random_state=cfg.get("randomSeed", 42),
                )
                name = "Logistic Regression (L2)"

            pipe = Pipeline(
                [
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", scaler_step),
                    ("clf", clf),
                ]
            )
            pipe.fit(X_train, y_train)
            y_pred = pipe.predict(X_test)
            y_prob = pipe.predict_proba(X_test)

            cv = StratifiedKFold(
                n_splits=cfg.get("cvFolds", 5),
                shuffle=True,
                random_state=cfg.get("randomSeed", 42),
            )
            cv_scores = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="accuracy")

            report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
            cm = confusion_matrix(y_test, y_pred).tolist()
            roc_auc = None
            try:
                if len(le.classes_) > 2:
                    roc_auc = float(roc_auc_score(y_test, y_prob, multi_class="ovr", average="macro"))
                else:
                    roc_auc = float(roc_auc_score(y_test, y_prob[:, 1]))
            except Exception:
                roc_auc = None

            self.trained_models[algo] = {
                "pipeline": pipe,
                "features": features,
                "classes": le.classes_.tolist(),
                "X_train_bg": X_train.fillna(X_train.median()).iloc[:60],
            }

            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            evaluations.append(
                {
                    "modelId": algo,
                    "modelName": name,
                    "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
                    "macroAvg": {
                        "precision": round(report["macro avg"]["precision"], 4),
                        "recall": round(report["macro avg"]["recall"], 4),
                        "f1Score": round(report["macro avg"]["f1-score"], 4),
                    },
                    "weightedAvg": {
                        "precision": round(report["weighted avg"]["precision"], 4),
                        "recall": round(report["weighted avg"]["recall"], 4),
                        "f1Score": round(report["weighted avg"]["f1-score"], 4),
                    },
                    "rocAucMacro": round(roc_auc, 4) if roc_auc is not None else None,
                    "labels": le.classes_.tolist(),
                    "confusionMatrix": cm,
                    "cvScores": [round(float(s), 4) for s in cv_scores],
                    "cvMean": round(float(np.mean(cv_scores)), 4),
                    "cvStd": round(float(np.std(cv_scores)), 4),
                    "trainCount": int(len(X_train)),
                    "testCount": int(len(X_test)),
                    "trainingTimeMs": elapsed_ms,
                    "trainedAt": datetime.now(timezone.utc).isoformat(),
                }
            )

        return evaluations

    def predict_and_explain(self, algo: str, feature_values: Dict[str, float]) -> Dict[str, Any]:
        if algo not in self.trained_models:
            raise ValueError(f"Model '{algo}' is not trained.")
        bundle = self.trained_models[algo]
        pipe: Pipeline = bundle["pipeline"]
        features: List[str] = bundle["features"]
        classes: List[str] = bundle["classes"]

        row_df = pd.DataFrame([[feature_values.get(f, 0.0) for f in features]], columns=features)
        probs = pipe.predict_proba(row_df)[0]
        pred_idx = int(np.argmax(probs))

        # SHAP explanation using KernelExplainer / TreeExplainer on pipeline output
        bg_df = bundle["X_train_bg"]
        explainer = shap.Explainer(lambda x: pipe.predict_proba(pd.DataFrame(x, columns=features)), bg_df)
        shap_vals = explainer(row_df)
        vals_for_class = shap_vals.values[0, :, pred_idx]

        contributions = [
            {
                "feature": f,
                "featureValue": float(row_df.iloc[0][f]),
                "shapValue": round(float(vals_for_class[i]), 4),
                "absImpact": round(abs(float(vals_for_class[i])), 4),
            }
            for i, f in enumerate(features)
        ]
        contributions.sort(key=lambda c: c["absImpact"], reverse=True)

        return {
            "predictedClass": classes[pred_idx],
            "probabilities": {c: round(float(probs[i]), 4) for i, c in enumerate(classes)},
            "contributions": contributions,
        }

    def detect_anomalies(self, features: List[str], contamination: float) -> Dict[str, Any]:
        if self.active_df is None:
            raise ValueError("No dataset loaded.")
        X = SimpleImputer(strategy="median").fit_transform(
            self.active_df[features].apply(pd.to_numeric, errors="coerce")
        )
        X_scaled = StandardScaler().fit_transform(X)
        iso = IsolationForest(contamination=contamination, random_state=42)
        preds = iso.fit_predict(X_scaled)
        raw_scores = -iso.score_samples(X_scaled)
        return {
            "totalCount": int(len(self.active_df)),
            "anomalyCount": int(np.sum(preds == -1)),
            "scores": [round(float(s), 4) for s in raw_scores],
            "isAnomaly": [bool(p == -1) for p in preds],
        }

    def cluster_kmeans(self, features: List[str], k: int) -> Dict[str, Any]:
        if self.active_df is None:
            raise ValueError("No dataset loaded.")
        X = SimpleImputer(strategy="median").fit_transform(
            self.active_df[features].apply(pd.to_numeric, errors="coerce")
        )
        X_scaled = StandardScaler().fit_transform(X)
        km = KMeans(n_clusters=k, n_init="auto", random_state=42)
        labels = km.fit_predict(X_scaled)
        sil = float(silhouette_score(X_scaled, labels))
        pca = PCA(n_components=2)
        coords = pca.fit_transform(X_scaled)
        return {
            "k": k,
            "silhouetteScore": round(sil, 4),
            "inertia": round(float(km.inertia_), 2),
            "explainedVariance": [round(float(v * 100), 1) for v in pca.explained_variance_ratio_],
            "labels": labels.tolist(),
            "pcaCoords": [[round(float(x), 4), round(float(y), 4)] for x, y in coords],
        }

    def save_model(self, algo: str, label: Optional[str] = None) -> str:
        if algo not in self.trained_models:
            raise ValueError(f"Model '{algo}' not trained.")
        filename = f"{label or algo}.joblib"
        path = MODELS_DIR / filename
        joblib.dump(self.trained_models[algo], path)
        return str(path)

    def load_model(self, label: str) -> Dict[str, Any]:
        path = MODELS_DIR / (label if label.endswith(".joblib") else f"{label}.joblib")
        if not path.exists():
            raise FileNotFoundError(f"Model artifact '{path.name}' not found.")
        bundle = joblib.load(path)
        self.trained_models[label] = bundle
        return {"loaded": label, "features": bundle["features"], "classes": bundle["classes"]}
