"""Independent stage payloads; unknown PHQ-8 items are never coerced to zero."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StrictInt

PHQ8_ITEMS = (
    "anhedonia",
    "depressed_mood",
    "sleep",
    "fatigue",
    "appetite",
    "worthlessness_guilt",
    "concentration",
    "psychomotor",
)
Item = Annotated[StrictInt, Field(ge=0, le=3)] | None


class Phq8Items(BaseModel):
    model_config = ConfigDict(extra="forbid")
    anhedonia: Item
    depressed_mood: Item
    sleep: Item
    fatigue: Item
    appetite: Item
    worthlessness_guilt: Item
    concentration: Item
    psychomotor: Item

    def result(self):
        items = self.model_dump()
        values = [v for v in items.values() if v is not None]
        return {
            "items": items,
            "scored_symptom_count": len(values),
            "subtotal": sum(values),
            "complete": len(values) == 8,
            "total": sum(values) if len(values) == 8 else None,
            "timeFrame": "Text does not establish the PHQ-8 two-week symptom frequency.",
            "experimental": True,
        }
