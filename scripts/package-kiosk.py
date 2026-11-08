#!/usr/bin/env python3
"""Validate and package the local frontend; no device-side build is needed."""
import hashlib
import re
import subprocess
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'frontend'
OUTPUT = ROOT / 'dist'
RUNTIME = (
    'index.html', 'app.js', 'content.js', 'display-shell.js',
    'time-signal-config.js', 'time-signal.js', 'update.js',
    'styles.css', 'time-signal.css', 'sw.js',
)
ASSET_TYPES = {'.svg', '.webp', '.png', '.jpg', '.jpeg', '.gif', '.avif',
               '.woff', '.woff2', '.ttf', '.otf', '.ico'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        self.urls.extend(value for key, value in attrs
                         if key in ('src', 'href') and value)


def main():
    assets = []
    for path in (SOURCE / 'assets').rglob('*'):
        require(not path.is_symlink(), f'Symlink is not allowed: {path}')
        if path.is_file():
            require(path.suffix.lower() in ASSET_TYPES, f'Unexpected asset type: {path}')
            assets.append(path.relative_to(SOURCE).as_posix())
    names = sorted(set(RUNTIME) | set(assets))
    for name in names:
        path = SOURCE / name
        require(path.is_file() and not path.is_symlink(), f'Missing runtime file: {name}')
        if path.suffix == '.js':
            subprocess.run(['node', '--check', str(path)], check=True)
        urls = []
        if path.suffix == '.html':
            parser = References()
            parser.feed(path.read_text())
            urls = parser.urls
        elif path.suffix == '.css':
            urls = re.findall(r'url\(\s*[\"\']?([^\)\"\']+)', path.read_text())
        for url in urls:
            if url.startswith(('data:', '#')):
                continue
            parsed = urlsplit(url)
            require(not parsed.scheme and not parsed.netloc, f'Nonlocal resource: {url}')
            target = (path.parent / unquote(parsed.path)).resolve()
            require(target.is_relative_to(SOURCE) and target.is_file(), f'Missing resource: {url}')
            require(target.relative_to(SOURCE).as_posix() in names, f'Unbundled resource: {url}')
    # Check generated image paths and release-driven cache defaults using actual data.
    subprocess.run(['node', '-e', r'''
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const context = {window:{}}; vm.createContext(context);
vm.runInContext(fs.readFileSync('frontend/content.js','utf8'),context);
const content = context.window.CSSU_CONTENT;
assert.equal(content.settings.serviceWorker,false);
assert.equal(content.settings.persistContent,false);
for (const slide of content.slides) assert(fs.existsSync(`frontend/assets/${slide.art}.svg`));
for (const name of ['coffee','snack',...content.menu.map(item=>item.icon)])
  assert(fs.existsSync(`frontend/assets/products/${name}.svg`));
assert.match(fs.readFileSync('frontend/index.html','utf8'), /<script\s+src="update\.js"\s+defer><\/script>/);
'''], cwd=ROOT, check=True)
    OUTPUT.mkdir(exist_ok=True)
    archive = OUTPUT / 'kiosk.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
        for name in names:
            entry = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.external_attr = 0o100644 << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            package.writestr(entry, (SOURCE / name).read_bytes())
    with zipfile.ZipFile(archive) as package:
        require(package.testzip() is None, 'ZIP integrity check failed')
        require('index.html' in package.namelist(), 'index.html must be at the ZIP root')
        require('version.txt' not in package.namelist(), 'version.txt is device-generated')
        for name in names:
            require(package.read(name) == (SOURCE / name).read_bytes(), f'Source mismatch: {name}')
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (OUTPUT / 'kiosk.zip.sha256').write_text(f'{digest}  kiosk.zip\n')
    print(f'Validated {len(names)} files; SHA-256 {digest}')


if __name__ == '__main__':
    main()
