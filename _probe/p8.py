
import lxml.html as LH, sys, re, json
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
for f in sorted(Path("_probe/pages").glob("*.html")):
    t=Path(f).read_text(encoding="utf-8")
    m=re.findall(r'最后更新于?\s*([0-9: /\-]{6,30})|Last updated:\s*([^<"]{0,30})', t)
    print(f.name, m[:1])
