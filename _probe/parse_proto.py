
import lxml.html as LH, sys, re, json, collections
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

def clean(s):
    return " ".join(s.replace("\u200b","").split())

def doc_root(path):
    doc = LH.fromstring(Path(path).read_text(encoding="utf-8"))
    r = doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," vp-doc ")]')
    return r[0] if r else None

def section_nodes(root, tag, title_eq=None):
    for h in root.xpath('.//'+tag):
        t = clean(h.text_content())
        if title_eq is None or t == title_eq:
            body=[]; n=h.getnext()
            while n is not None and n.tag in ("ul","div","p","table","pre","blockquote","h4"):
                body.append(n); n=n.getnext()
            yield h, t, body

def code_of(nodes):
    out=[]
    for n in nodes:
        for pre in ([n] if n.tag=="pre" else n.xpath('.//pre')):
            out.append(("\n".join(l.text_content().rstrip() for l in pre.xpath('.//span[@class="line"]')) or pre.text_content()))
    return out

def parse_li_items(ul):
    """returns dict label -> text, plus params list, returns list"""
    res = {}
    for li in ul.xpath('./li'):
        txt = clean(li.text_content())
        m = re.match(r'^([^：:]{2,12})[：:]\s*(.*)$', txt, re.S)
        if not m: continue
        res[m.group(1)] = m.group(2)
    return res

def parse_entries(page, root):
    """function-style page: h2 per function"""
    out=[]
    for h, name, body in section_nodes(root, "h2"):
        uls=[b for b in body if b.tag=="ul"]
        if not uls: continue
        ul = uls[0]
        if not any("参数及类型" in clean(x.text_content()) for x in ul.xpath('./li')): continue
        items = parse_li_items(ul)
        out.append({
            "page": page, "anchor": (h.get("id") or ""), "name": name,
            "params": items.get("参数及类型",""),
            "returns": items.get("返回值及类型", items.get("返回值","")),
            "note": items.get("该方法的其他说明", items.get("该方法的主要作用","")),
            "example": "\n".join(code_of(body)),
        })
    return out

allf=[]; alle=[]; allen=[]
for f in sorted(Path("_probe/pages").glob("*.html")):
    root = doc_root(f)
    if root is None: continue
    entries = parse_entries(f.name, root)
    allf += entries
print("functions parsed:", len(allf))
# samples
for e in allf[:2]:
    print(json.dumps(e, ensure_ascii=False)[:600])
print()
dups = collections.Counter(e["name"] for e in allf)
print("unique names:", len(dups), "dups:", [(k,v) for k,v in dups.items() if v>1][:15])
print("with return:", sum(1 for e in allf if e["returns"]), "with example:", sum(1 for e in allf if e["example"]))
print("empty params:", sum(1 for e in allf if not e["params"] or e["params"] in ("无","none")))
# param parse
def parse_params(s):
    ps=[]
    for m in re.finditer(r'([A-Za-z_][\w]*)\s*:\s*(number|string|boolean|bool|table|function|nil|any|userdata|void|vector)', s or ""):
        ps.append((m.group(1), m.group(2)))
    return ps
bad=[e for e in allf if e["params"] and not parse_params(e["params"])]
print("params unparsed:", len(bad))
for e in bad[:5]: print("   ", e["name"], "|", e["params"][:120])
# signature sample
for e in allf[:3]:
    sig = "%s(%s) -> %s" % (e["name"], ", ".join("%s:%s"%p for p in parse_params(e["params"])), ", ".join("%s:%s"%p for p in parse_params(e["returns"])) or "nil")
    print("   SIG:", sig, "|", e["note"][:40])
