"""Read-only deployment verification; URLs are GitHub environment variables."""

import json
import os
import time
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def endpoint(name: str) -> str:
    value = os.environ.get(name, "").rstrip("/")
    parsed = urlsplit(value)
    if parsed.scheme not in {"https", "http"} or not parsed.netloc:
        raise ValueError(f"Set the {name} GitHub environment variable to an HTTP(S) URL")
    return value


def check(api_url: str, app_url: str, commit: str, *, timeout: float = 600,
          interval: float = 10) -> None:
    deadline = time.monotonic() + timeout
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(f"API did not report expected commit {commit} within {timeout}s")
        try:
            request = Request(f"{api_url}/api/health", headers={"Cache-Control": "no-cache"})
            with urlopen(request, timeout=min(20, remaining)) as response:
                body = json.load(response)
                if (response.status == 200 and isinstance(body, dict)
                        and body.get("status") == "ok" and body.get("commit") == commit):
                    break
        except (URLError, OSError, ValueError):
            pass  # A restarting server or a non-JSON response is not ready yet.
        time.sleep(min(interval, max(0, deadline - time.monotonic())))
    with urlopen(app_url, timeout=20) as response:
        if response.status != 200:
            raise RuntimeError(f"Frontend returned HTTP {response.status}, expected 200")
    print(f"Verified API commit {commit} and frontend HTTP 200")


if __name__ == "__main__":
    check(endpoint("API_URL"), endpoint("APP_URL"), os.environ["GITHUB_SHA"])
