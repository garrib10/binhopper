"""Deterministic checks: no network or real waits."""

import io
import unittest
from unittest.mock import patch
from urllib.error import URLError

from check_deploy import check, endpoint


class Response(io.BytesIO):
    status = 200


class DeployCheckTests(unittest.TestCase):
    def test_waits_for_expected_commit_before_frontend(self):
        replies = [URLError("restarting"), Response(b'not json'),
                   Response(b'{"status":"ok","commit":"old"}'),
                   Response(b'{"status":"ok","commit":"new"}'), Response(b'html')]
        with patch('check_deploy.urlopen', side_effect=replies) as fetch, \
                patch('check_deploy.time.sleep'):
            check('https://api.test', 'https://app.test', 'new')
        self.assertEqual(fetch.call_count, 5)
        self.assertEqual(fetch.call_args.args[0], 'https://app.test')

    def test_timeout_never_checks_frontend(self):
        with patch('check_deploy.time.monotonic', side_effect=[0, 601]), \
                patch('check_deploy.urlopen') as fetch, self.assertRaises(TimeoutError):
            check('https://api.test', 'https://app.test', 'new')
        fetch.assert_not_called()

    def test_frontend_failure_is_not_green(self):
        failed = Response(b'failed')
        failed.status = 503
        with patch('check_deploy.urlopen', side_effect=[
            Response(b'{"status":"ok","commit":"new"}'), failed,
        ]), self.assertRaises(RuntimeError):
            check('https://api.test', 'https://app.test', 'new')

    def test_missing_environment_variable_is_actionable(self):
        with patch.dict('os.environ', {}, clear=True), self.assertRaisesRegex(ValueError, 'API_URL'):
            endpoint('API_URL')


if __name__ == '__main__':
    unittest.main()
