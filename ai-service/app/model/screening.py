"""Experimental nullable journal estimates. Missing is never zero."""

import json
from datetime import datetime, timezone

ITEMS = (
    "anhedonia",
    "depressed_mood",
    "sleep",
    "fatigue",
    "appetite",
    "worthlessness_guilt",
    "concentration",
    "psychomotor",
)
VERSION = "journal-nullable-v1"


def validate_items(items):
    if not isinstance(items, dict) or set(items) != set(ITEMS):
        raise ValueError("Expected all eight criteria")
    if any(v is not None and (type(v) is not int or v not in range(4)) for v in items.values()):
        raise ValueError("Expected integer 0..3 or JSON null")
    numeric = [v for v in items.values() if v is not None]
    return dict(
        items=items,
        coverage=len(numeric),
        subtotal=sum(numeric) if numeric else None,
        total=sum(numeric) if len(numeric) == 8 else None,
    )


def infer(model, tokenizer, text):
    import torch

    prompt = (
        "Estimate the eight PHQ-8 criteria from this journal reflection. This is experimental, not questionnaire scoring. Each criterion must be an integer 0,1,2,3 or JSON null. Numeric estimates use the PHQ-8 frequency scale: 0=not at all, 1=several days, 2=more than half the days, 3=nearly every day. Do not invent a two-week history from a single event. Use null when not evidenced; never assume zero from absence. Return exactly one JSON object with these keys: "
        + ",".join(ITEMS)
        + "\nJournal reflection:\n"
        + text
    )
    ids = tokenizer.apply_chat_template(
        [{"role": "user", "content": prompt}],
        tokenize=True,
        add_generation_prompt=True,
        return_dict=False,
    )
    original = len(ids)
    if original > 1700:
        ids = ids[:400] + ids[-1300:]
    inputs = torch.tensor([ids], device=model.device)
    with torch.inference_mode():
        out = model.generate(
            input_ids=inputs,
            attention_mask=torch.ones_like(inputs),
            max_new_tokens=300,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )
    decoded = tokenizer.decode(out[0, len(ids) :], skip_special_tokens=True).strip()
    result = validate_items(json.loads(decoded))
    return dict(
        status="available",
        generatedAt=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        experimental=True,
        inferenceVersion=VERSION,
        truncated=original > 1700,
        inputTokens=original,
        retainedTokens=len(ids),
        **result,
    )
