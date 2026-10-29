"""Write the API's OpenAPI schema and the frontend's TypeScript types made from it (#68).

Run from backend/:  python -m scripts.export_openapi
tests/test_api_contract.py fails (in the required `backend` check) when either committed
file is out of date, so a model can't change without the frontend's types changing too.

openapi-typescript would do this, but it needs TypeScript 5 and the frontend is on 7, so
this converts the schemas our models produce: objects, arrays, enums, unions with null,
refs and the JSON primitives.
"""

import json
import sys
from pathlib import Path

from app.main import app

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / "backend" / "openapi.json"
TYPES = ROOT / "frontend" / "src" / "api-types.ts"
PRIMITIVES = {"string": "string", "integer": "number", "number": "number", "boolean": "boolean", "null": "null"}


def ts(schema: dict) -> str:
    """The TypeScript type for one JSON schema."""
    if "$ref" in schema:
        return schema["$ref"].rsplit("/", 1)[-1]
    if "enum" in schema:
        return " | ".join(json.dumps(v) for v in schema["enum"])
    if "const" in schema:
        return json.dumps(schema["const"])
    for key in ("anyOf", "oneOf"):
        if key in schema:
            return " | ".join(dict.fromkeys(ts(s) for s in schema[key]))
    kind = schema.get("type")
    if kind == "array":
        item = ts(schema.get("items", {}))
        return f"({item})[]" if " | " in item else f"{item}[]"
    if kind == "object" or "properties" in schema:
        if "properties" not in schema:
            return "Record<string, unknown>"
        return "{ " + " ".join(field(name, prop, name in schema.get("required", []))
                               for name, prop in schema["properties"].items()) + " }"
    return PRIMITIVES.get(kind, "unknown")


def field(name: str, schema: dict, required: bool) -> str:
    return f"{name}{'' if required else '?'}: {ts(schema)};"


def interfaces(spec: dict) -> str:
    lines = ["// Generated from backend/openapi.json by backend/scripts/export_openapi.py (#68).",
             "// Do not edit: change the Pydantic models, then run `python -m scripts.export_openapi`.", ""]
    for name, schema in sorted(spec["components"]["schemas"].items()):
        if schema.get("type") == "object" or "properties" in schema:
            lines.append(f"export interface {name} {{")
            for prop, sub in schema.get("properties", {}).items():
                lines.append(f"  {field(prop, sub, prop in schema.get('required', []))}")
            lines.append("}")
        else:
            lines.append(f"export type {name} = {ts(schema)};")
        lines.append("")
    return "\n".join(lines)


def rendered() -> tuple[str, str]:
    """The schema file and the TypeScript file, as they should be committed."""
    spec = app.openapi()
    return json.dumps(spec, indent=2, sort_keys=True) + "\n", interfaces(spec)


def main() -> None:
    schema, types = rendered()
    SCHEMA.write_text(schema)
    TYPES.write_text(types)
    print(f"Wrote {SCHEMA.relative_to(ROOT)} and {TYPES.relative_to(ROOT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
