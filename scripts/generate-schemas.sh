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
  target_file="${SCHEMAS_DEST}/${module_name}.py"

  echo "  - Compiling ${filename} -> app/schemas/${module_name}.py"

  uvx datamodel-code-generator \
    --input "${schema}" \
    --input-file-type jsonschema \
    --output "${target_file}" \
    --output-model-type pydantic_v2.BaseModel \
    --target-python-version 3.12 \
    --use-standard-collections \
    --use-schema-description \
    --field-constraints \
    --disable-timestamp
done

echo "==> Updating ${SCHEMAS_DEST}/__init__.py..."
cat << 'EOF' > "${SCHEMAS_DEST}/__init__.py"
from .analysis_request import *  # noqa: F403
from .analysis_response import *  # noqa: F403
from .model_info_response import *  # noqa: F403
from .readiness_response import *  # noqa: F403

__all__ = [
    "AnalysisRequest",
    "AnalysisResponse",
    "ModelInfoResponse",
    "ReadinessResponse",
]
EOF

echo "==> Contract sync complete."
