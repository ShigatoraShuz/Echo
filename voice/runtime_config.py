"""Optional environment overrides; never downloads or reads .env files."""
import os
from pathlib import Path
CBT_PYTHON=os.environ.get('BUDDY_CBT_PYTHON','C:/Users/tolen/miniconda3/envs/Thesis2_VENV/python.exe')
WHISPER_DIR=os.environ.get('BUDDY_WHISPER_DIR','E:/Python Project/CODEX/models/voice/whisper')
CBT_ADAPTER=Path(os.environ.get('BUDDY_CBT_ADAPTER','E:/Python Project/PROJECTS/Thesis2/CBT_RESPONSE/CBT_BASE_MODEL/outputs/quality_tuning/mixed_epochs_2/final_adapter'))
