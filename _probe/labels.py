
import lxml.html as LH, sys, re, collections
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
labels = collections.Counter()
langs = collections.Counter()
th = collections.Counter()
for f in sorted(Path("_probe/pages").glob("*.html")):
    doc = LH.fromstring(f.read_text(encoding="utf-8"))
    root = doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," vp-doc ")]')[0]
    for li in root.xpath('.//li'):
        t = " ".join(li.text_content().split())
        m = re.match(r'^([^：:]{2,12})[：:]', t)
        if m: labels[m.group(1)] += 1
    for d in root.xpath('.//div[contains(@class,"language-")]'):
        c = d.get("class","")
        langs[c.split("language-")[1].split()[0]] += 1
    for tb in root.xpath('.//table'):
        hd = tuple(" ".join(x.text_content().split()) for x in tb.xpath('.//thead//th'))
        th[hd]+=1
print("LABELS:")
for k,v in labels.most_common(30): print(" ", v, k)
print("LANGS:", langs.most_common(10))
print("TABLE HEADERS:")
for k,v in th.most_common(15): print(" ", v, k)
