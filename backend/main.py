from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ml_pipeline import OrbitMinePipelineState
from schemas import (
    AnomalyRequest,
    ClusterRequest,
    DatasetUploadRequest,
    LoadModelRequest,
    MlTrainRequest,
    PredictRequest,
    SaveModelRequest,
    WranglingRequest,
)

app = FastAPI(
    title="ORBITMINE Python ML Backend",
    description="FastAPI service for satellite orbital data mining with Pandas, Scikit-learn, and SHAP.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

state = OrbitMinePipelineState()


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "version": "1.0.0",
        "libraries": ["pandas", "numpy", "scikit-learn", "shap"],
    }


@app.post("/api/dataset/upload")
def upload_dataset(payload: DatasetUploadRequest):
    return state.set_dataset(payload.records)


@app.post("/api/dataset/wrangle")
def wrangle_dataset(payload: WranglingRequest):
    try:
        return state.wrangle(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/ml/train")
def train_models(payload: MlTrainRequest):
    try:
        evaluations = state.train(payload.model_dump())
        return {"evaluations": evaluations}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/ml/predict")
def predict_object(payload: PredictRequest):
    try:
        return state.predict_and_explain(payload.algorithm, payload.features)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/ml/save")
def save_model(payload: SaveModelRequest):
    try:
        path = state.save_model(payload.algorithm, payload.model_label)
        return {"saved_path": path}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/ml/load")
def load_model(payload: LoadModelRequest):
    try:
        return state.load_model(payload.model_label)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/anomaly/detect")
def detect_anomalies(payload: AnomalyRequest):
    try:
        return state.detect_anomalies(payload.features, payload.contamination)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/cluster/kmeans")
def cluster_kmeans(payload: ClusterRequest):
    try:
        return state.cluster_kmeans(payload.features, payload.k)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
