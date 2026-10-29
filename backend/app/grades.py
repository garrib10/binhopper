"""Goldmine record grades, shared by the wishlist and the collection (SPEC.md › Collection rule 2)."""

# Worst to best. A sealed "New" copy counts as Mint.
GRADES = ["P", "G", "G+", "VG", "VG+", "NM", "M"]


def grade_rank(condition: str) -> int | None:
    """Position in GRADES (higher is better), or None for anything that isn't a grade."""
    condition = condition.strip().upper()
    return GRADES.index("M") if condition == "NEW" else (
        GRADES.index(condition) if condition in GRADES else None)
