#!/usr/bin/env python3
"""Convert a .docx (e.g. the GDD) to Markdown using only the standard library.

    python3 -I tools/docx_to_md.py gdd/current/Apocalypse_Tycoon_GDD.docx gdd/current/gdd-full.md

Keeps headings (Heading 1-6 / Title), bullet and numbered lists (with nesting), bold/italic runs,
tables (as Markdown tables) and line breaks. Images and comments are dropped.
"""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def styles_map(z):
    """styleId -> style name, so localized or renamed heading styles still resolve."""
    try:
        root = ET.fromstring(z.read('word/styles.xml'))
    except KeyError:
        return {}
    out = {}
    for s in root.iter(W + 'style'):
        sid = s.get(W + 'styleId')
        name = s.find(W + 'name')
        if sid and name is not None:
            out[sid] = name.get(W + 'val', sid)
    return out


def numbering_formats(z):
    """(numId, ilvl) -> 'bullet' | 'decimal' | ..."""
    try:
        root = ET.fromstring(z.read('word/numbering.xml'))
    except KeyError:
        return {}
    abstract = {}
    for a in root.iter(W + 'abstractNum'):
        aid = a.get(W + 'abstractNumId')
        for lvl in a.iter(W + 'lvl'):
            fmt = lvl.find(W + 'numFmt')
            abstract[(aid, lvl.get(W + 'ilvl'))] = fmt.get(W + 'val') if fmt is not None else 'bullet'
    out = {}
    for n in root.iter(W + 'num'):
        aid = n.find(W + 'abstractNumId').get(W + 'val')
        for (a, lvl), fmt in abstract.items():
            if a == aid:
                out[(n.get(W + 'numId'), lvl)] = fmt
    return out


def run_text(r):
    parts = []
    for c in r:
        if c.tag == W + 't':
            parts.append(c.text or '')
        elif c.tag == W + 'tab':
            parts.append('\t')
        elif c.tag in (W + 'br', W + 'cr'):
            parts.append('  \n')
    text = ''.join(parts)
    if not text.strip():
        return text
    rpr = r.find(W + 'rPr')
    bold = rpr is not None and rpr.find(W + 'b') is not None and rpr.find(W + 'b').get(W + 'val') not in ('0', 'false')
    ital = rpr is not None and rpr.find(W + 'i') is not None and rpr.find(W + 'i').get(W + 'val') not in ('0', 'false')
    lead = text[: len(text) - len(text.lstrip())]
    trail = text[len(text.rstrip()):]
    core = text.strip()
    if bold and ital:
        core = f'***{core}***'
    elif bold:
        core = f'**{core}**'
    elif ital:
        core = f'*{core}*'
    return lead + core + trail


def para_text(p):
    out = []
    for el in p:
        if el.tag == W + 'r':
            out.append(run_text(el))
        elif el.tag == W + 'hyperlink':
            out.extend(run_text(r) for r in el.iter(W + 'r'))
        elif el.tag in (W + 'ins', W + 'smartTag'):
            out.extend(run_text(r) for r in el.iter(W + 'r'))
    text = ''.join(out)
    return re.sub(r'\*\*\s*\*\*', '', text).rstrip()


def convert(path):
    z = zipfile.ZipFile(path)
    styles = styles_map(z)
    numfmt = numbering_formats(z)
    body = ET.fromstring(z.read('word/document.xml')).find(W + 'body')
    lines = []
    counters = {}

    def heading_level(p):
        ppr = p.find(W + 'pPr')
        if ppr is None:
            return 0
        ps = ppr.find(W + 'pStyle')
        if ps is None:
            return 0
        name = styles.get(ps.get(W + 'val'), ps.get(W + 'val')).lower()
        if name == 'title':
            return 1
        m = re.match(r'heading\s*(\d)', name)
        return int(m.group(1)) if m else 0

    for el in body:
        if el.tag == W + 'p':
            text = para_text(el)
            ppr = el.find(W + 'pPr')
            lvl = heading_level(el)
            num = ppr.find(W + 'numPr') if ppr is not None else None
            if lvl and text.strip():
                lines += ['', '#' * min(lvl, 6) + ' ' + text.strip().strip('*'), '']
            elif num is not None and text.strip():
                ilvl = num.find(W + 'ilvl')
                ilvl = ilvl.get(W + 'val') if ilvl is not None else '0'
                nid = num.find(W + 'numId').get(W + 'val')
                fmt = numfmt.get((nid, ilvl), 'bullet')
                indent = '  ' * int(ilvl)
                if fmt == 'bullet':
                    lines.append(f'{indent}- {text.strip()}')
                else:
                    key = (nid, ilvl)
                    counters[key] = counters.get(key, 0) + 1
                    lines.append(f'{indent}{counters[key]}. {text.strip()}')
            else:
                lines.append(text)
                if text.strip():
                    lines.append('')
        elif el.tag == W + 'tbl':
            rows = []
            for tr in el.iter(W + 'tr'):
                cells = [' '.join(para_text(p) for p in tc.iter(W + 'p')).replace('|', '\\|').strip() for tc in tr.iter(W + 'tc')]
                rows.append(cells)
            if rows:
                width = max(len(r) for r in rows)
                rows = [r + [''] * (width - len(r)) for r in rows]
                lines.append('')
                lines.append('| ' + ' | '.join(rows[0]) + ' |')
                lines.append('|' + '---|' * width)
                for r in rows[1:]:
                    lines.append('| ' + ' | '.join(r) + ' |')
                lines.append('')
    md = '\n'.join(lines)
    md = re.sub(r'\n{3,}', '\n\n', md).strip() + '\n'
    return md


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    md = convert(sys.argv[1])
    if len(sys.argv) > 2:
        with open(sys.argv[2], 'w', encoding='utf-8') as f:
            f.write(md)
        print(f'wrote {sys.argv[2]} ({len(md.splitlines())} lines)')
    else:
        sys.stdout.write(md)
