
import lxml.html as LH, sys, re, json
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
def clean(s): return " ".join(s.replace("\u200b","").split())
def doc_root(path):
    doc = LH.fromstring(Path(path).read_text(encoding="utf-8"))
    r = doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," vp-doc ")]')
    return r[0] if r else None

# events
ev=[]
for f in ["apis__triggerevent.html","apis__componentevent.html"]:
    root=doc_root("_probe/pages/"+f)
    for h in root.xpath('.//h3'):
        anchor=h.get("id") or ""
        body=[]; n=h.getnext()
        while n is not None and n.tag in ("ul","div","p","table"): body.append(n); n=n.getnext()
        desc=""; name=""; params=[]
        for b in body:
            for li in ([b] if b.tag=="li" else b.xpath('./li')):
                t=clean(li.text_content())
                if t.startswith("事件描述"): desc=re.sub(r'^事件描述[：:]\s*','',t)
                elif t.startswith("事件名"): name=re.sub(r'^事件名[：:]\s*','',t)
            for tb in ([b] if b.tag=="table" else b.xpath('.//table')):
                for tr in tb.xpath('.//tbody/tr'):
                    tds=[clean(c.text_content()) for c in tr.xpath('./td')]
                    if len(tds)>=2: params.append({"name":tds[0],"desc":tds[1]})
        ev.append({"page":f,"anchor":anchor,"title":clean(h.text_content()),"event":name,"desc":desc,"params":params})
print("EVENTS", len(ev))
print(json.dumps(ev[0], ensure_ascii=False)[:400])
print(json.dumps(ev[40], ensure_ascii=False)[:400])
print("with event name:", sum(1 for e in ev if e["event"]), "with params:", sum(1 for e in ev if e["params"]))

# enums
en=[]
root=doc_root("_probe/pages/apis__global.html")
for h in root.xpath('.//h2'):
    g=clean(h.text_content())
    body=[]; n=h.getnext()
    while n is not None and n.tag in ("table","ul","p","div"): body.append(n); n=n.getnext()
    vals=[]
    for b in body:
        for tb in ([b] if b.tag=="table" else b.xpath('.//table')):
            for tr in tb.xpath('.//tbody/tr'):
                tds=[clean(c.text_content()) for c in tr.xpath('./td')]
                if len(tds)>=2: vals.append({"name":tds[0],"desc":tds[1]})
    en.append({"group":g,"anchor":h.get("id") or "","values":vals})
print("ENUM GROUPS", len(en), "values", sum(len(x["values"]) for x in en))
print(json.dumps(en[1], ensure_ascii=False)[:400])
print("groups without table:", [x["group"] for x in en if not x["values"]][:10])
