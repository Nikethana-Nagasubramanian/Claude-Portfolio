"""Integration checks against generated HTML and the public portfolio sources."""
import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
WIDGET = '<script src="https://inflight.co/widget.js" data-org="aius9qpt" data-path="/dive" async></script>'

class Document(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tags = []
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

class DiveReview(unittest.TestCase):
    def test_all_pages_have_scoped_widget_in_initial_head_and_noindex(self):
        pages = list((ROOT / 'dive').rglob('*.html'))
        self.assertGreaterEqual(len(pages), 20)
        for page in pages:
            with self.subTest(page=page):
                html = page.read_text()
                head = re.search(r'<head>(.*?)</head>', html, re.S | re.I)[1]
                self.assertEqual(head.count(WIDGET), 1)
                self.assertEqual(html.count('https://inflight.co/widget.js'), 1)
                self.assertIn('noindex', next(attrs['content'] for tag, attrs in Document(head).tags if tag == 'meta' and attrs.get('name') == 'robots'))
                self.assertNotIn('<iframe', html.lower())

    def test_internal_review_pages_and_assets_resolve(self):
        for page in (ROOT / 'dive').rglob('*.html'):
            for tag, attrs in Document(page.read_text()).tags:
                for attr in ('href', 'src', 'poster'):
                    value = attrs.get(attr, '')
                    if not value or value.startswith('#') or re.match(r'(?:[a-z][a-z\d+.-]*:|//)', value, re.I):
                        continue
                    with self.subTest(page=page, url=value):
                        self.assertTrue(value.startswith('/'), 'Relative assets break nested routes')
                        path = unquote(urlsplit(value).path)
                        if path.startswith('/_vercel/'):
                            continue
                        target = ROOT / path.lstrip('/')
                        options = [target, Path(str(target) + '.html'), target / 'index.html']
                        self.assertTrue(any(p.is_file() for p in options), 'Missing destination')
                        if tag == 'a' and any(p.suffix == '.html' and p.is_file() for p in options):
                            self.assertTrue(path == '/dive' or path.startswith('/dive/'), 'Review link escapes /dive')

    def test_public_sources_have_no_review_widget_or_navigation(self):
        for page in ROOT.glob('*.html'):
            self.assertNotIn('inflight.co/widget.js', page.read_text())
            self.assertNotIn('href="/dive', page.read_text())

    def test_external_links_preserved(self):
        manifest = json.loads((ROOT / 'dive/manifest.json').read_text())
        for source in manifest['pages']:
            original = Document((ROOT / source).read_text())
            review = '/dive' if source == 'index.html' else '/dive/' + source.replace('/dist/index.html', '').removesuffix('.html')
            generated = Document((ROOT / ('dive/index.html' if review == '/dive' else review.lstrip('/') + '.html')).read_text())
            links = lambda doc: [a['href'] for t, a in doc.tags if t == 'a' and re.match(r'(?:https?:|mailto:|//)', a.get('href', ''))]
            self.assertEqual(links(original), links(generated), source)

if __name__ == '__main__':
    unittest.main()
