"""Bounded, robots-aware own-site prefill. Never imported by the application."""
from datetime import UTC, datetime
import hashlib
from html.parser import HTMLParser
import ipaddress
import json
from pathlib import Path
import re
import socket
import time
from urllib.parse import parse_qs, unquote, urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import httpx

USER_AGENT = 'Binhopper/0.1 (+https://github.com/garrib10/binhopper)'


def public_url(url):
    parsed = urlsplit(url)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password:
        return False
    if parsed.port not in {None, 80, 443}:
        return False
    addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    return bool(addresses) and all(ipaddress.ip_address(row[4][0]).is_global for row in addresses)


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.links, self.text, self.structured = [], [], []
        self.script = None
        self.hidden = 0
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and attrs.get('href'):
            self.links.append(attrs['href'])
        if tag == 'script':
            self.script = [] if attrs.get('type') == 'application/ld+json' else None
        if tag in {'script', 'style'}:
            self.hidden += 1
    def handle_endtag(self, tag):
        if tag == 'script' and self.script is not None:
            try:
                self.structured.append(json.loads(''.join(self.script)))
            except ValueError:
                pass
            self.script = None
        if tag in {'script', 'style'}:
            self.hidden = max(0, self.hidden-1)
    def handle_data(self, data):
        if self.script is not None:
            self.script.append(data)
        if not self.hidden and data.strip():
            self.text.append(data.strip())


def objects(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from objects(child)


def evidence(page, base):
    found = {}
    for link in page.links:
        url = urlsplit(urljoin(base, link))
        if url.scheme == 'tel' and not found.get('phone'):
            found['phone'] = unquote(url.path).strip()
        if url.scheme in {'http', 'https'} and url.hostname in {'discogs.com', 'www.discogs.com'}:
            match = re.fullmatch(r'/seller/([^/]+)(?:/(?:profile|shop))?/?', url.path)
            seller = unquote(match[1]) if match else parse_qs(url.query).get('seller', [''])[0] if url.path == '/sell/list' else ''
            if seller and len(seller) <= 120 and not re.search(r'[\s/\\]', seller):
                found['discogs_seller_name'] = seller
    for obj in objects(page.structured):
        if not found.get('phone') and isinstance(obj.get('telephone'), str):
            found['phone'] = obj['telephone'].strip()
        hours = obj.get('openingHours') or obj.get('openingHoursSpecification')
        if hours and isinstance(hours, (str, dict, list)) and not found.get('hours'):
            found['hours'] = hours if isinstance(hours, str) else json.dumps(hours, ensure_ascii=False, separators=(',', ':'))
    if not found.get('phone'):
        for line in page.text:
            match = re.search(r'(?:phone|telephone|tel)\s*:\s*(\+?1?[ .-]*\(?\d{3}\)?[ .–-]*\d{3}[ .–-]*\d{4})', line, re.I)
            if match:
                found['phone'] = match[1].strip()
                break
    if not found.get('hours'):
        lines = [line for line in page.text if re.search(r'\b(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\b', line, re.I)
                 and re.search(r'\d\s*(?::\d\d|[ap]\.?m)', line, re.I)]
        if lines:
            found['hours'] = '; '.join(lines[:7])
    text = ' '.join(page.text)
    if re.search(r'permanently closed|closed permanently|no longer in business|ceased trading', text, re.I):
        found['likely_status'] = 'possibly closed'
        found['reason'] = 'Own website contains a permanent-closure statement; check date/current status.'
    elif re.search(r'instrument|guitar|piano|pro audio', text, re.I) and re.search(r'repair|rental|lesson', text, re.I) and not re.search(r'vinyl|record store|record shop|records for sale', text, re.I):
        found['likely_status'] = 'instruments only'
        found['reason'] = 'Own website describes instruments/lessons/rentals; vinyl sales not established.'
    return found


class Reader:
    def __init__(self, client, cache, *, allowed=public_url):
        self.client, self.cache, self.allowed = client, cache, allowed
        self.robots, self.last_request = {}, {}
        cache.mkdir(parents=True, exist_ok=True)
    def request(self, url):
        if not self.allowed(url):
            raise ValueError('Non-public or unsupported website URL')
        key = hashlib.sha256(url.encode()).hexdigest()
        target = self.cache / f'{key}.json'
        if target.exists():
            return json.loads(target.read_text())
        # Bound response size and redirects; no page crawl or arbitrary link following.
        with self.client.stream('GET', url) as response:
            data = bytearray()
            for part in response.iter_bytes():
                data.extend(part)
                if len(data) > 2_000_000:
                    raise ValueError('Website response exceeds 2 MB')
            result = {'url': url, 'status': response.status_code,
                      'location': response.headers.get('location'),
                      'text': data.decode('utf-8', errors='replace'),
                      'fetched_at': datetime.now(UTC).isoformat()}
        target.write_text(json.dumps(result, ensure_ascii=False))
        return result
    def permitted(self, url):
        parsed = urlsplit(url)
        origin = f'{parsed.scheme}://{parsed.netloc}'
        if origin not in self.robots:
            robots_url = origin+'/robots.txt'
            response = self.request(robots_url)
            for _ in range(3):
                if response['status'] not in {301, 302, 303, 307, 308} or not response['location']:
                    break
                redirected = urljoin(robots_url, response['location'])
                if (urlsplit(redirected).hostname or '').removeprefix('www.') != (parsed.hostname or '').removeprefix('www.'):
                    break
                robots_url = redirected
                response = self.request(robots_url)
            parser = RobotFileParser(origin+'/robots.txt')
            if response['status'] in {404, 410}:
                parser.parse(['User-agent: *', 'Allow: /'])
            elif response['status'] == 200:
                parser.parse(response['text'].splitlines())
            else:
                parser.parse(['User-agent: *', 'Disallow: /'])
            self.robots[origin] = parser
        parser = self.robots[origin]
        if not parser.can_fetch(USER_AGENT, url):
            return False
        delay = parser.crawl_delay(USER_AGENT) or parser.crawl_delay('*') or 0
        remaining = delay - (time.monotonic()-self.last_request.get(origin, 0))
        while remaining > 0:
            pause = min(30, remaining)
            time.sleep(pause)
            remaining -= pause
        self.last_request[origin] = time.monotonic()
        return True
    def page(self, url, *, origin_host=None):
        for _ in range(4):
            host = urlsplit(url).hostname or ''
            if origin_host and host.removeprefix('www.') != origin_host.removeprefix('www.'):
                return None, url, 'Linked page redirected outside the shop domain; skipped.'
            if not self.permitted(url):
                return None, url, 'robots.txt disallowed/unavailable; page not fetched.'
            response = self.request(url)
            if response['status'] in {301, 302, 303, 307, 308} and response['location']:
                url = urljoin(url, response['location'])
                continue
            if response['status'] >= 400:
                return None, url, f'Website returned HTTP {response["status"]}; availability not confirmed.'
            if response['status'] != 200:
                return None, url, f'Website returned HTTP {response["status"]}; skipped.'
            page = Page(response['text'])
            page.fetched_at = response['fetched_at']
            return page, url, ''
        return None, url, 'Website redirect limit reached; availability not confirmed.'


def prefill(row, reader):
    website = row['website']
    if not website:
        return
    try:
        home, final, error = reader.page(website, origin_host=urlsplit(website).hostname)
        if home is None:
            row['notes'] += ' '+error
            if error.startswith('Website returned HTTP'):
                row['likely_status'] = 'possibly closed'
            return
        pages = [(home, final)]
        host = urlsplit(final).hostname
        for link in home.links:
            url = urljoin(final, link)
            if (urlsplit(url).hostname == host and urlsplit(url).scheme in {'http', 'https'}
                    and urlsplit(url).path != urlsplit(final).path
                    and re.search(r'hours|contact|about', urlsplit(url).path, re.I)):
                page, page_url, note = reader.page(url, origin_host=host)
                if page:
                    pages.append((page, page_url))
                elif note:
                    row['notes'] += ' '+note
                break  # At most ONE linked content page, even if blocked or unavailable.
        for page, url in pages:
            found = evidence(page, url)
            filled = []
            for field in ['phone', 'hours', 'discogs_seller_name']:
                if not row[field] and found.get(field):
                    row[field] = found[field]
                    filled.append(field)
            if found.get('likely_status') and row['likely_status'] != 'possibly closed':
                row['likely_status'] = found['likely_status']
            row['notes'] += f' Own-site check {page.fetched_at.split("T")[0]} UTC: {url}.'
            if filled:
                row['notes'] += ' Prefilled '+', '.join(filled)+' from this page.'
            if found.get('reason'):
                row['notes'] += ' '+found['reason']
        if row['discogs_seller_name']:
            row['notes'] += ' Seller link found on own site; seller-profile location still needs human confirmation.'
    except (httpx.HTTPError, OSError, ValueError) as error:
        row['notes'] += f' Website unavailable ({type(error).__name__}); business closure NOT confirmed.'
        row['likely_status'] = 'possibly closed'


def prefill_all(rows, cache):
    with httpx.Client(headers={'User-Agent': USER_AGENT}, timeout=10, follow_redirects=False) as client:
        reader = Reader(client, Path(cache))
        for row in rows:
            if row['website']:
                print('Own-site prefill: '+row['name'], flush=True)
                prefill(row, reader)
