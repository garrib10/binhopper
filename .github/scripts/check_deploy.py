"""Read-only deployment verification; URLs are GitHub environment variables."""

import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def endpoint(name: str) -> str:
    value = os.environ.get(name, "").rstrip("/")
    parsed = urlsplit(value)
    if parsed.scheme not in {"https", "http"} or not parsed.netloc:
        raise ValueError(f"Set the {name} GitHub environment variable to an HTTP(S) URL")
    return value


def app_headers(environ=os.environ) -> dict[str, str]:
    """Vercel Protection Bypass for Automation; sent to the Vercel app only, never the API."""
    secret = environ.get("VERCEL_AUTOMATION_BYPASS_SECRET", "")
    return {"x-vercel-protection-bypass": secret} if secret else {}


def wait_for_commit(health_url: str, commit: str, deadline: float, interval: float, label: str,
                    headers: dict[str, str] | None = None) -> None:
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(f"{label} did not report expected commit {commit} in time")
        try:
            request = Request(health_url, headers={"Cache-Control": "no-cache", **(headers or {})})
            with urlopen(request, timeout=min(20, remaining)) as response:
                body = json.load(response)
                if (response.status == 200 and isinstance(body, dict)
                        and body.get("status") == "ok" and body.get("commit") == commit):
                    return
        except (URLError, OSError, ValueError):
            pass  # A restarting server or a non-JSON response is not ready yet.
        time.sleep(min(interval, max(0, deadline - time.monotonic())))


def wait_for_proxied_api(app_url: str, deadline: float, interval: float,
                         headers: dict[str, str] | None = None) -> None:
    """A protected endpoint through the proxy: 403 means Vercel's and Railway's
    ORIGIN_SECRET don't match (#122). /api/health is exempt, so it can't catch that."""
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("The app's /api proxy did not answer /api/search with HTTP 200 in time")
        try:
            request = Request(f"{app_url}/api/search", headers={"Cache-Control": "no-cache", **(headers or {})})
            with urlopen(request, timeout=min(20, remaining)) as response:
                if response.status == 200:
                    return
        except HTTPError as error:
            if error.code == 403:
                raise RuntimeError("The API rejected the app's /api proxy (HTTP 403): set the same "
                                   "ORIGIN_SECRET on Vercel and Railway for this environment") from error
        except (URLError, OSError, ValueError):
            pass  # Waking or restarting; retry until the deadline.
        time.sleep(min(interval, max(0, deadline - time.monotonic())))


def check(api_url: str, app_url: str, commit: str, *, timeout: float = 600,
          interval: float = 10, app_auth: dict[str, str] | None = None) -> None:
    deadline = time.monotonic() + timeout
    wait_for_commit(f"{api_url}/api/health", commit, deadline, interval, "API")
    # The browser only talks to the app origin; Vercel's proxy must reach the same API.
    wait_for_commit(f"{app_url}/api/health", commit, deadline, interval,
                    "API through the Vercel /api proxy", app_auth)
    wait_for_proxied_api(app_url, deadline, interval, app_auth)
    with urlopen(Request(app_url, headers=app_auth or {}), timeout=20) as response:
        if response.status != 200:
            raise RuntimeError(f"Frontend returned HTTP {response.status}, expected 200")
    print(f"Verified API commit {commit} directly and through the app's /api proxy, "
          "the proxy is accepted by the API, and frontend HTTP 200")


def main(environ=os.environ) -> None:
    if not environ.get("API_URL") and not environ.get("APP_URL"):
        # Pre-launch, production has no hosting yet (docs/DEPLOY.md › Pre-launch hosting mode).
        print("::notice title=Deploy check skipped::API_URL and APP_URL are not set for this "
              "GitHub environment, so there is no deployment to verify yet.")
        return
    check(endpoint("API_URL"), endpoint("APP_URL"), environ["GITHUB_SHA"], app_auth=app_headers(environ))


if __name__ == "__main__":
    main()
