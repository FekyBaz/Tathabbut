from typing import Literal

from pydantic import BaseModel, Field, field_validator

Category = Literal["harassment", "hate", "threats", "spam"]


class ClassifyRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    enabled_categories: list[Category] = Field(
        default_factory=lambda: ["harassment", "hate", "threats", "spam"],
        max_length=4,
    )

    @field_validator("text")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must contain non-whitespace characters")
        return value


class LabelScore(BaseModel):
    category: Category
    score: float = Field(ge=0, le=1)


class ClassifyResponse(BaseModel):
    labels: list[LabelScore]
    provider: str
