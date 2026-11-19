from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class DatasetUploadRequest(BaseModel):
    records: List[Dict[str, Any]]


class WranglingRequest(BaseModel):
    missingStrategy: Literal["drop", "mean", "median", "mode"] = "median"
    removeDuplicates: bool = True
    outlierMethod: Literal["none", "iqr_cap", "iqr_remove", "zscore_remove"] = "none"
    outlierThreshold: float = 3.0
    encodeCategorical: bool = True
    scalingMethod: Literal["none", "standard", "minmax"] = "standard"
    selectedFeatures: List[str] = Field(default_factory=list)


class MlTrainRequest(BaseModel):
    testSize: float = 0.2
    stratify: bool = True
    randomSeed: int = 42
    cvFolds: int = 5
    selectedFeatures: List[str]
    algorithms: List[Literal["decision_tree", "random_forest", "logistic_regression"]]
    scalingInPipeline: Literal["standard", "minmax", "none"] = "standard"
    decisionTreeMaxDepth: int = 6
    randomForestTrees: int = 100
    logisticMaxIter: int = 400


class PredictRequest(BaseModel):
    algorithm: Literal["decision_tree", "random_forest", "logistic_regression"]
    features: Dict[str, float]


class AnomalyRequest(BaseModel):
    features: List[str]
    contamination: float = 0.05


class ClusterRequest(BaseModel):
    features: List[str]
    k: int = 4


class SaveModelRequest(BaseModel):
    algorithm: Literal["decision_tree", "random_forest", "logistic_regression"]
    model_label: Optional[str] = None


class LoadModelRequest(BaseModel):
    model_label: str
