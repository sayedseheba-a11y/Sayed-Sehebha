# ORBITMINE — Satellite Orbital Data Mining & Machine Learning Platform

**ORBITMINE** is a full-stack satellite orbital data analysis platform built for cleaning, exploring, classifying, explaining, anomaly-scanning, and clustering Earth-orbiting object catalogues.

## Key Modules

1. **Landing & Overview Dashboard**: Animated Earth orbit showcase, KPI telemetry, object category breakdown, orbital regime counts, altitude histograms, and interactive filters.
2. **Data Management**: Drag-and-drop CSV ingestion, schema & missingness profiling, duplicate detection, sortable/searchable preview table, and illustrative 420-object orbital sample catalogue.
3. **Data Wrangling**: Missing-value imputation (Median/Mean/Mode/Drop), deduplication, IQR/Z-score outlier handling, categorical encoding, and before/after delta reporting.
4. **Exploratory Data Analysis (EDA)**: Dynamic histograms, bivariate orbital scatter plots (Altitude vs. Inclination, Eccentricity vs. Mean Motion), and Pearson correlation heatmaps filtered by object class.
5. **Machine Learning Lab & Model Evaluation**: Leakage-free stratified train-test splits (fitting scalers/imputers strictly on training partitions and excluding identifiers), Decision Tree (CART), Random Forest, and Multinomial Logistic Regression with Stratified K-Fold CV, Macro/Weighted/Per-Class reports, ROC-AUC, and Confusion Matrix heatmaps.
6. **Explainable AI (SHAP)**: Global feature importance and local SHAP-style feature contribution plots with plain-language explanations and methodological caveats.
7. **Smart Anomaly Detection**: Isolation Forest outlier scoring, score histograms, feature deviation z-score attribution, and CSV export.
8. **Orbital Pattern Discovery**: K-Means++ clustering with 2D PCA projection, Silhouette Score evaluation, and cluster characteristic summaries.
9. **Satellite Prediction & Report Generation**: Unseen object inference with class probabilities, SHAP explanation, and downloadable PDF & CSV reports.

---

## Running Locally

### 1. Frontend (React + TypeScript + Vite)

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. ORBITMINE includes a complete **Local Browser ML Engine** so every data mining, training, SHAP explanation, Isolation Forest, and K-Means workflow operates directly out of the box without fabricated metrics.

### 2. Optional Python FastAPI Backend (Pandas, NumPy, Scikit-learn, SHAP)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Then open **Settings** inside ORBITMINE and click **Test Backend Health** to connect to `http://localhost:8000`.
