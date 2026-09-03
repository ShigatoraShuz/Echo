#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SCHEMAS_SRC="${REPO_ROOT}/packages/contracts/schemas"
SCHEMAS_DEST="${REPO_ROOT}/ai-service/app/schemas"

echo "==> Generating Pydantic V2 models from JSON contracts..."
mkdir -p "${SCHEMAS_DEST}"

for schema in "${SCHEMAS_SRC}"/*.schema.json; do
  [ -e "${schema}" ] || continue
  filename=$(basename "${schema}")
  module_name=$(echo "${filename}" | sed 's/\.schema\.json$//' | tr '-' '_')
  class_name=""
  IFS='_' read -ra module_parts <<< "${module_name}"
  for part in "${module_parts[@]}"; do
    class_name+="${part^}"
  done
  target_file="${SCHEMAS_DEST}/${module_name}.py"

  echo "  - Compiling ${filename} -> app/schemas/${module_name}.py"

  uv run --project "${REPO_ROOT}/ai-service" --locked datamodel-codegen \
    --input "${schema}" \
    --input-file-type jsonschema \
    --output "${target_file}" \
    --class-name "${class_name}" \
    --output-model-type pydantic_v2.BaseModel \
    --target-python-version 3.12 \
    --use-standard-collections \
    --use-schema-description \
    --field-constraints \
    --disable-timestamp
done

echo "==> Updating ${SCHEMAS_DEST}/__init__.py..."
cat << 'EOF' > "${SCHEMAS_DEST}/__init__.py"
from .analysis_request import AnalysisRequest
from .analysis_response import AnalysisResponse
from .model_info_response import ModelInfoResponse
from .readiness_response import ReadinessResponse

__all__ = [
    "AnalysisRequest",
    "AnalysisResponse",
    "ModelInfoResponse",
    "ReadinessResponse",
]
EOF

echo "==> Contract sync complete."
