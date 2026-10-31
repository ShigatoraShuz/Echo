"""Isolated CPU face inference; accepts only a transient image file."""

import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path


def predict(root, image):
    root = Path(root)
    manifest = json.loads((root / "model_manifest.json").read_text())
    for name, digest in manifest.items():
        path = (root / name).resolve()
        if (
            not path.is_relative_to(root.resolve())
            or hashlib.sha256(path.read_bytes()).hexdigest() != digest
        ):
            raise ValueError("Face package integrity failure")
    provenance = {
        "modelFingerprint": manifest["selected_development_model.joblib"],
        "inferenceVersion": "facemesh-1.6.0:echo-"
        + hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:16],
        "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }
    sys.path.insert(0, str(root))
    from echoface_local_runtime import ImageQualityError, predict_raw_image
    from PIL import Image

    Image.MAX_IMAGE_PIXELS = 4_000_000
    with Image.open(image) as im:
        if im.format not in ("JPEG", "PNG", "WEBP") or max(im.size) > 2048 or min(im.size) < 32:
            raise ValueError("Unsupported image dimensions or format")
        im.verify()
    try:
        result = predict_raw_image(image, root / "selected_development_model.joblib")
    except ImageQualityError:
        return {
            "schemaVersion": "echo-face-expression-v1",
            "status": "unavailable",
            "reason": "no_usable_face",
            **provenance,
        }
    return {
        "schemaVersion": "echo-face-expression-v1",
        "status": "available",
        "experimental": True,
        "prediction": result["prediction"],
        "scoreType": result["score_type"],
        "classProbabilities": result["class_probabilities"],
        "quality": result["quality"],
        **provenance,
    }


if __name__ == "__main__":
    Path(sys.argv[3]).write_text(
        json.dumps(predict(Path(sys.argv[1]), sys.argv[2]), allow_nan=False)
    )
