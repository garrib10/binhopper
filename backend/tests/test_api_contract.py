"""The frontend's API types match the API's models (#68).

If this fails, a Pydantic model changed: run `python -m scripts.export_openapi` from backend/,
fix any TypeScript errors it causes in the frontend, and commit both generated files.
"""

from scripts.export_openapi import SCHEMA, TYPES, rendered


def test_committed_openapi_schema_is_current():
    assert SCHEMA.read_text() == rendered()[0], "backend/openapi.json is stale: run python -m scripts.export_openapi"


def test_committed_typescript_types_are_current():
    assert TYPES.read_text() == rendered()[1], "frontend/src/api-types.ts is stale: run python -m scripts.export_openapi"


def test_types_cover_the_nearby_stock_response():
    types = TYPES.read_text()
    assert "export interface NearbyStockResponse {" in types
    assert 'export type Freshness = "verified" | "current" | "out_of_date" | "reported_missing";' in types
