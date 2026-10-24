
import re,json,sys
sys.stdout.reconfigure(encoding="utf-8")
h=open(r"_probe/pages/apis__block.html",encoding="utf-8").read()
# strip tags
t=re.sub(r"<[^>]+>","\n",h)
t=re.sub(r"\n{2,}","\n",t)
lines=[l.strip() for l in t.split("\n") if l.strip()]
# find lines mentioning 方块ID or PlaceBlock examples
for i,l in enumerate(lines):
    if "PlaceBlock" in l or "方块ID" in l:
        print(" | ".join(lines[max(0,i-1):i+3])[:300])
