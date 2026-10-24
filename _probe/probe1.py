
import lxml.html as LH, sys, io, json
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
p = Path("_probe/pages/apis__actor.html")
doc = LH.fromstring(p.read_text(encoding="utf-8"))
root = doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," vp-doc ")]')[0]
heads = root.xpath('.//h1|.//h2|.//h3|.//h4')
print("headings:", len(heads))
for h in heads[:60]:
    print(h.tag, "|", " ".join(h.text_content().replace("\u200b","").split())[:110])
txt = " ".join(root.text_content().replace("\u200b","").split())
print("=== text chars:", len(txt))
print(txt[:2500])
print("=== tables:", len(root.xpath('.//table')), "pre:", len(root.xpath('.//pre')))
