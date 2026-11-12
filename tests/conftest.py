import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


@pytest.fixture
def page():
    return json.loads((ROOT / "tests/fixtures/projects_page.json").read_text(encoding="utf-8"))
