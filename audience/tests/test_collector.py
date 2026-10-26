"""The collector's shape validation (src/app/api/tests/[id]/responses), over HTTP against the
dev server. Only bodies the collector must refuse are sent, so nothing reaches DynamoDB.
Skips when the dev server is not up."""

import datetime as dt
import json
import os

import pytest
import requests

BASE = os.environ.get("AUDIENCE_DEV_SERVER", "http://localhost:3000")
URL = f"{BASE}/api/tests/open-primaries-1/responses"


@pytest.fixture(scope="module", autouse=True)
def server():
    try:
        requests.get(BASE, timeout=5)
    except requests.RequestException:
        pytest.skip(f"no dev server at {BASE}")


def now():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def record(**over):
    r = {"test": "open-primaries-1", "status": "complete", "pid": "pytest", "arm": "placebo",
         "src": "https://assets.mixkit.co/videos/40700/40700-720.mp4", "startedAt": now(),
         "completedAt": now(), "comprehensionCorrect": True, "watched": 0.95, "code": "ABCDEF12",
         "answers": {"ideology": "moderate", "party": "democrat", "education": "some-college",
                     "vote2024": "democrat", "mediaTrust": "tv-broadcast", "ballot": "yes",
                     "comprehension": "one-primary-top-two"}}
    r.update(over)
    return {k: v for k, v in r.items() if v is not ...}


def post(body, url=URL, raw=None):
    data = raw if raw is not None else json.dumps(body)
    return requests.post(url, data=data, headers={"Content-Type": "application/json"}, timeout=30)


@pytest.mark.parametrize("over, message", [
    ({"arm": "px-not-an-arm"}, "arm is not one of"),
    ({"ip": "1.2.3.4"}, "unknown fields: ip"),
    ({"code": ...}, "missing fields: code"),
    ({"status": "abandoned"}, "status must be"),
    ({"pid": "x" * 129}, "pid must be"),
    ({"watched": 1.5}, "watched must be"),
    ({"comprehensionCorrect": False}, "does not match"),
    ({"startedAt": "2099-01-01T00:00:00.000Z"}, "not in the future"),
    ({"src": "javascript:alert(1)"}, "src must be"),
    ({"test": "another-test"}, "test does not match"),
])
def test_bad_records_are_refused(over, message):
    r = post(record(**over))
    assert r.status_code == 400 and message in r.json()["error"]


def test_bad_answers_are_refused():
    bad = record()
    bad["answers"] = {**bad["answers"], "ideology": "anarchist"}
    assert "answer ideology" in post(bad).json()["error"]
    extra = record()
    extra["answers"] = {**extra["answers"], "favoriteColor": "red"}
    assert "unknown answers" in post(extra).json()["error"]
    short = record()
    del short["answers"]["ballot"]
    assert post(short).status_code == 400


def test_a_screenout_may_stop_early_but_not_lie():
    r = post(record(status="screenout", answers={"ideology": "moderate", "party": "democrat"},
                    src=..., comprehensionCorrect=..., watched=..., code=..., arm="px-nope"))
    assert r.status_code == 400 and "arm" in r.json()["error"]   # a valid one would be written


def test_unknown_test_size_and_json():
    assert post(record(), url=f"{BASE}/api/tests/no-such-test/responses").status_code == 404
    assert post(None, raw="{" + '"pad": "' + "x" * 25_000 + '"}').status_code == 413
    assert post(None, raw="not json").status_code == 400
    assert post(None, raw="[1, 2]").status_code == 400


def test_the_monitor_needs_its_test():
    assert requests.get(f"{BASE}/api/tests/no-such-test/monitor", timeout=30).status_code == 404
