
import lxml.html as LH, sys, re, json
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path

def clean(s): return " ".join(s.replace("\u200b","").split())
def doc_root(path):
    doc = LH.fromstring(Path(path).read_text(encoding="utf-8"))
    r = doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," vp-doc ")]')
    return r[0] if r else None

def li_label(li):
    t = clean(li.text_content())
    m = re.match(r'^([^：:]{2,12})[：:]', t)
    return m.group(1) if m else None

def parse_vars(container):
    """container = the li of 参数及类型 / 返回值及类型, may hold nested ul of var li"""
    out=[]
    lis = container.xpath('./ul/li') or [container]
    for li in lis:
        # name: text before first child element
        name = clean(li.text or "")
        if name.endswith(":") or name.endswith("："): name = name[:-1]
        if not re.match(r'^[A-Za-z_][\w]*$', name): name = ""
        # type: code element text, else strong link text
        code = li.xpath('./a//code')
        if code:
            typ = clean(code[0].text_content())
        else:
            strong = li.xpath('./a//strong')
            typ = clean(strong[0].text_content()) if strong else ""
        # desc: full text minus name/type prefixes
        desc = clean(li.text_content())
        if name: desc = re.sub(r'^'+re.escape(name)+r'\s*[：:]\s*', '', desc)
        if typ: desc = desc.replace(typ, "", 1).strip()
        out.append({"name": name, "type": typ, "desc": desc})
    return out

def body_of(h):
    body=[]; n=h.getnext()
    while n is not None and n.tag in ("ul","div","p","table","pre","blockquote","h4"):
        body.append(n); n=n.getnext()
    return body

def code_of(nodes):
    out=[]
    for n in nodes:
        pres = [n] if n.tag=="pre" else n.xpath('.//pre')
        for pre in pres:
            lines=[l.text_content().rstrip() for l in pre.xpath('.//span[@class="line"]')]
            out.append("\n".join(lines) if lines else pre.text_content())
    return out

def squash(obj):
    return obj

funcs=[]; events=[]; enums=[]; grouptables=[]
for f in sorted(Path("_probe/pages").glob("*.html")):
    root = doc_root(f); page=f.name
    if root is None: continue
    # top index table
    for tb in root.xpath('./table|./div/table'):
        hd = tuple(clean(x.text_content()) for x in tb.xpath('.//thead//th'))
        if hd and hd[0]=="序号":
            rows=[[clean(c.text_content()) for c in tr.xpath('./td')] for tr in tb.xpath('.//tbody/tr')]
            grouptables.append((page, hd, len(rows)))
    # h2 function entries
    for h in root.xpath('.//h2'):
        name = clean(h.text_content())
        body = body_of(h)
        uls=[b for b in body if b.tag=="ul"]
        if not uls: continue
        items={}
        for li in uls[0].xpath('./li'):
            lb=li_label(li)
            if lb: items[lb]=li
        if "参数及类型" not in items: continue
        funcs.append({
          "page":page,"anchor":h.get("id") or "","name":name,
          "params":parse_vars(items["参数及类型"]),
          "returns":parse_vars(items["返回值及类型"]) if "返回值及类型" in items else [],
          "note":clean(items["该方法的其他说明"].text_content()) if "该方法的其他说明" in items else (clean(items["该方法的主要作用"].text_content()) if "该方法的主要作用" in items else ""),
          "example":code_of(body)})
print("FUNCS", len(funcs), "with params:", sum(1 for x in funcs if x["params"]), "total params:", sum(len(x["params"]) for x in funcs))
print(json.dumps(funcs[2], ensure_ascii=False))
import statistics
print("avg note len", statistics.mean(len(x["note"]) for x in funcs))
chars = sum(len(x["name"])+len(x["note"])+len("".join(p["name"]+p["type"] for p in x["params"]))+len("".join(p["name"]+p["type"] for p in x["returns"])) for x in funcs)
print("compact sig total chars:", chars, "→ ~tokens:", int(chars*0.75))
# per module
from collections import Counter
c=Counter(x["page"] for x in funcs)
print(c.most_common(5))
sig_chars = {}
for x in funcs:
    sig_chars[x["page"]] = sig_chars.get(x["page"],0) + len(x["name"])+len(x["note"])+40
print("max module sig tokens:", max(sig_chars.items(), key=lambda kv: kv[1]))
