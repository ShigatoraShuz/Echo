"""Echo E4-C | inference for a single journal (Transformers 5.5, Windows CUDA).

COPY THIS FILE into the existing Echo_E4_Full27_GoEmotions_Multitask folder,
alongside config.py and e4_model.py. Run in PyCharm with no arguments.

- Imports PyTorch FIRST to avoid WinError 1114 c10.dll import-order errors.
- Loads a FROZEN checkpoint: runs/E4_C_fresh_roberta_large_seed42/best_model.
- Produces 8-way Plutchik softmax and 27 independent GoEmotions sigmoid scores.
- Processes long journals as overlapping token windows; no deprecated tokenizer API.
- Does not train, modify the checkpoint, or score journals against fabricated labels.
"""
import torch  # REQUIRED to stay before transformers/numpy/pandas/sklearn imports on Windows.

import argparse
from contextlib import nullcontext
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

from .config import RUNS, SEED, PLUTCHIK, GO_LABELS, MAX_LENGTH


def tokenize_windows(tokenizer, text, max_tokens=MAX_LENGTH, overlap=128):
    """Return token windows with RoBERTa BOS/EOS; does not call prepare_for_model().

    `overlap` is the number of content tokens re-used between adjacent windows.
    Each window is at most max_tokens long INCLUDING its special tokens.
    """
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Journal text cannot be empty.")
    if max_tokens < 8:
        raise ValueError("--max-tokens must be at least 8.")
    content_capacity = max_tokens - 2
    if not (0 <= overlap < content_capacity):
        raise ValueError(f"--overlap must be in [0, {content_capacity - 1}].")
    bos, eos = tokenizer.cls_token_id, tokenizer.sep_token_id
    if bos is None or eos is None:
        raise RuntimeError("Expected RoBERTa CLS and SEP special token IDs.")

    # Supported in Transformers 4.x and 5.x; do not use prepare_for_model().
    encoded = tokenizer(
        text,
        add_special_tokens=False,
        truncation=False,
        return_attention_mask=False,
    )
    ids = encoded["input_ids"]
    if ids and isinstance(ids[0], (tuple, list)):
        ids = ids[0]
    if not ids:
        raise ValueError("The journal did not yield any tokenizer content tokens.")
    stride = content_capacity - overlap
    windows = []
    for start in range(0, len(ids), stride):
        window = [int(bos)] + [int(k) for k in ids[start:start + content_capacity]] + [int(eos)]
        windows.append(window)
        if start + content_capacity >= len(ids):
            break
    return windows, len(ids)


def pad_windows(windows, pad_token_id, device):
    """Manual, safe padding and attention masks; avoids tokenizer.pad() regressions."""
    if not windows:
        raise ValueError("No windows to pad.")
    size = max(map(len, windows))
    input_ids = torch.full((len(windows), size), int(pad_token_id), dtype=torch.long)
    attention = torch.zeros((len(windows), size), dtype=torch.long)
    for row, ids in enumerate(windows):
        input_ids[row, :len(ids)] = torch.tensor(ids, dtype=torch.long)
        attention[row, :len(ids)] = 1
    return {"input_ids": input_ids.to(device), "attention_mask": attention.to(device)}


def infer_journal(model, tokenizer, device, text, *, max_tokens=MAX_LENGTH,
                  overlap=128, batch_size=2, include_go=True):
    """Single encoder pass per batch, same heads and CLS pooling as e4_model.E4Net.

    Aggregation is an unweighted mean of per-window probabilities, intentionally
    consistent with the existing E4 06_INFER_JOURNAL.py. These are not clinical scores.
    """
    if batch_size < 1:
        raise ValueError("--batch-size must be positive.")
    model.eval()
    windows, token_count = tokenize_windows(tokenizer, text, max_tokens, overlap)
    primary_parts = []
    go_parts = []
    pad_id = tokenizer.pad_token_id
    if pad_id is None:
        raise ValueError("Tokenizer has no pad_token_id.")
    bf16 = (device.type == "cuda" and torch.cuda.is_bf16_supported())
    with torch.inference_mode():
        for offset in range(0, len(windows), batch_size):
            batch = pad_windows(windows[offset:offset + batch_size], pad_id, device)
            with (torch.autocast(device_type="cuda", dtype=torch.bfloat16)
                  if bf16 else nullcontext()):
                hidden = model.encoder(**batch, return_dict=True).last_hidden_state[:, 0]
                hidden = model.dropout(hidden)  # inactive because model.eval()
                p_logits = model.plutchik(hidden)
                g_logits = model.goemotions(hidden) if include_go else None
            primary_parts.append(torch.softmax(p_logits.float(), dim=-1).cpu())
            if include_go:
                go_parts.append(torch.sigmoid(g_logits.float()).cpu())

    primary = torch.cat(primary_parts).mean(dim=0)
    primary = primary / primary.sum()
    if len(primary) != len(PLUTCHIK):
        raise RuntimeError("Checkpoint returned an unexpected Plutchik output dimension.")
    go = torch.cat(go_parts).mean(dim=0) if include_go else None
    if go is not None and len(go) != len(GO_LABELS):
        raise RuntimeError("Checkpoint returned an unexpected GoEmotions dimension.")
    return {
        "dominant_plutchik": PLUTCHIK[int(primary.argmax())],
        "plutchik_8": {label: round(float(primary[i]), 8) for i, label in enumerate(PLUTCHIK)},
        "goemotions_27": ({label: round(float(go[i]), 8) for i, label in enumerate(GO_LABELS)}
                          if go is not None else None),
        "window_count": len(windows),
        "token_count": token_count,
        "word_count": len(text.split()),
        "text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
    }


def print_inference(result, threshold=0.5):
    print("\n" + "=" * 62)
    print("ECHO E4-C — JOURNAL EMOTION INFERENCE")
    print("=" * 62)
    print(f"Journal length: {result['word_count']} words / {result['token_count']} tokens")
    print(f"Token windows:  {result['window_count']}")
    print(f"Dominant Plutchik emotion: {result['dominant_plutchik'].upper()}")
    print("\nPLUTCHIK — 8-WAY RELATIVE SOFTMAX PROBABILITIES")
    for label, prob in sorted(result['plutchik_8'].items(), key=lambda x: -x[1]):
        print(f"  {label:16s} {100 * prob:7.2f}%")
    if result["goemotions_27"] is not None:
        print("\nGOEMOTIONS — 27 INDEPENDENT SIGMOID SCORES")
        for label, prob in sorted(result["goemotions_27"].items(), key=lambda x: -x[1]):
            mark = " *" if prob >= threshold else ""
            print(f"  {label:16s} {100 * prob:7.2f}%{mark}")
        print(f"  * indicates >= {threshold:.2f}; default threshold was not optimized per label.")
    print("\nNOTE: Eight-way Plutchik always selects an emotion, even for neutral text.")
    print("Probabilities are model outputs, not clinical certainty, diagnosis, or PHQ-8 estimates.")
    print("Filipino, Taglish, and long-journal generalization require separate validation.")


def read_interactive():
    print("Paste your journal text below. Type END on its own line when finished:", flush=True)
    parts = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip().upper() == "END":
            break
        parts.append(line)
    journal = "\n".join(parts).strip()
    if not journal:
        raise SystemExit("No journal text supplied.")
    return journal


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--journal-file", type=Path, default=None,
                        help="UTF-8 file containing one journal; omit for interactive input")
    parser.add_argument("--model-dir", type=Path,
                        default=RUNS / f"E4_C_fresh_roberta_large_seed{SEED}" / "best_model",
                        help="Optional location of an existing frozen E4-C best_model directory")
    parser.add_argument("--json-out", type=Path, default=None,
                        help="Optional JSON result destination; input journal text is never saved")
    parser.add_argument("--max-tokens", type=int, default=MAX_LENGTH)
    parser.add_argument("--overlap", type=int, default=128)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--go-threshold", type=float, default=0.5)
    parser.add_argument("--no-go", action="store_true", help="Skip the 27-label auxiliary head")
    parser.add_argument("--device", choices=("auto", "cuda", "cpu"), default="auto")
    args = parser.parse_args(argv)

    if not (0 <= args.go_threshold <= 1):
        parser.error("--go-threshold must be between 0 and 1")
    if not args.model_dir.is_dir():
        parser.error(f"E4-C checkpoint directory does not exist: {args.model_dir}")
    if not (args.model_dir / "e4_config.json").is_file():
        parser.error(f"E4-C checkpoint missing e4_config.json: {args.model_dir}")
    text = args.journal_file.read_text(encoding="utf-8-sig").strip() if args.journal_file else read_interactive()
    if not text:
        parser.error("Journal text is empty")

    # Windows safety: import torch above all external ML dependencies.
    from e4_model import load_model
    device_override = None if args.device == "auto" else args.device
    model, tokenizer, metadata, device = load_model(args.model_dir, device=device_override)
    if metadata.get("arm") != "C":
        raise SystemExit(f"Expected frozen E4-C checkpoint, found arm={metadata.get('arm')!r}")
    print(f"Loaded existing E4-C epoch {metadata.get('epoch', '?')} checkpoint | device={device}")
    result = infer_journal(model, tokenizer, device, text, max_tokens=args.max_tokens,
                           overlap=args.overlap, batch_size=args.batch_size,
                           include_go=not args.no_go)
    result.update({
        "model": "Echo E4-C RoBERTa-large Plutchik-8 + GoEmotions-27",
        "checkpoint": str(args.model_dir.resolve()),
        "checkpoint_epoch": metadata.get("epoch"),
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "go_threshold_display": args.go_threshold,
        "aggregation": "arithmetic mean of probabilities across overlapping windows",
        "reference_labels": "none; prediction only",
    })
    print_inference(result, args.go_threshold)
    if args.json_out is not None:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nSaved result (without source journal text): {args.json_out.resolve()}")
    return result


if __name__ == "__main__":
    main()
