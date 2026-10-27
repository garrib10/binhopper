"""Deterministic checks: no network or real waits."""

import io
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch
from urllib.error import URLError

from check_deploy import app_headers, check, endpoint, main


class Response(io.BytesIO):
    status = 200


def health(commit):
    return Response(('{"status":"ok","commit":"%s"}' % commit).encode())


def urls(fetch):
    return [getattr(call.args[0], 'full_url', call.args[0]) for call in fetch.call_args_list]


class DeployCheckTests(unittest.TestCase):
    def test_waits_for_api_then_proxy_then_frontend(self):
        replies = [URLError("restarting"), Response(b'not json'), health('old'), health('new'),
                   health('new'), Response(b'html')]
        with patch('check_deploy.urlopen', side_effect=replies) as fetch, \
                patch('check_deploy.time.sleep'):
            check('https://api.test', 'https://app.test', 'new')
        self.assertEqual(urls(fetch), ['https://api.test/api/health'] * 4 + [
            'https://app.test/api/health', 'https://app.test'])

    def test_proxy_must_reach_the_same_commit(self):
        # e.g. Vercel's API_ORIGIN still points at another Railway environment.
        replies = [health('new'), health('old'), health('new'), Response(b'html')]
        with patch('check_deploy.urlopen', side_effect=replies) as fetch, \
                patch('check_deploy.time.sleep'):
            check('https://api.test', 'https://app.test', 'new')
        self.assertEqual(urls(fetch)[1:3], ['https://app.test/api/health'] * 2)

    def test_proxy_timeout_never_checks_frontend(self):
        with patch('check_deploy.time.monotonic', side_effect=[0, 1, 601]), \
                patch('check_deploy.urlopen', side_effect=[health('new')]) as fetch, \
                patch('check_deploy.time.sleep'), \
                self.assertRaisesRegex(TimeoutError, 'proxy'):
            check('https://api.test', 'https://app.test', 'new')
        self.assertEqual(fetch.call_count, 1)

    def test_timeout_never_checks_frontend(self):
        with patch('check_deploy.time.monotonic', side_effect=[0, 601]), \
                patch('check_deploy.urlopen') as fetch, self.assertRaises(TimeoutError):
            check('https://api.test', 'https://app.test', 'new')
        fetch.assert_not_called()

    def test_frontend_failure_is_not_green(self):
        failed = Response(b'failed')
        failed.status = 503
        with patch('check_deploy.urlopen', side_effect=[health('new'), health('new'), failed]), \
                self.assertRaises(RuntimeError):
            check('https://api.test', 'https://app.test', 'new')

    def test_missing_environment_variable_is_actionable(self):
        with patch.dict('os.environ', {}, clear=True), self.assertRaisesRegex(ValueError, 'API_URL'):
            endpoint('API_URL')

    def test_bypass_secret_goes_to_the_vercel_app_only(self):
        replies = [health('new'), health('new'), Response(b'html')]
        auth = app_headers({'VERCEL_AUTOMATION_BYPASS_SECRET': 's3cret'})
        with patch('check_deploy.urlopen', side_effect=replies) as fetch:
            check('https://api.test', 'https://app.test', 'new', app_auth=auth)
        sent = [(call.args[0].full_url, call.args[0].get_header('X-vercel-protection-bypass'))
                for call in fetch.call_args_list]
        self.assertEqual(sent, [('https://api.test/api/health', None),
                                ('https://app.test/api/health', 's3cret'),
                                ('https://app.test', 's3cret')])

    def test_no_bypass_header_without_a_secret(self):
        self.assertEqual(app_headers({}), {})
        self.assertEqual(app_headers({'VERCEL_AUTOMATION_BYPASS_SECRET': ''}), {})

    def test_main_passes_the_secret_from_the_environment(self):
        env = {'GITHUB_SHA': 'new', 'API_URL': 'https://api.test', 'APP_URL': 'https://app.test',
               'VERCEL_AUTOMATION_BYPASS_SECRET': 's3cret'}
        with patch.dict('os.environ', env, clear=True), patch('check_deploy.check') as run:
            main()
        self.assertEqual(run.call_args.kwargs['app_auth'], {'x-vercel-protection-bypass': 's3cret'})

    def test_skips_with_notice_when_environment_has_no_urls(self):
        out = io.StringIO()
        with patch.dict('os.environ', {'GITHUB_SHA': 'new'}, clear=True), \
                patch('check_deploy.check') as run, redirect_stdout(out):
            main()
        run.assert_not_called()
        self.assertIn('::notice title=Deploy check skipped::', out.getvalue())

    def test_one_url_without_the_other_still_fails(self):
        env = {'GITHUB_SHA': 'new', 'API_URL': 'https://api.test'}
        with patch.dict('os.environ', env, clear=True), self.assertRaisesRegex(ValueError, 'APP_URL'):
            main()


if __name__ == '__main__':
    unittest.main()
