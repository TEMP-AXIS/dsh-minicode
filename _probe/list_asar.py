
import struct, json, sys, re
sys.stdout.reconfigure(encoding="utf-8")
p = r"C:\Users\mi\AppData\Local\Programs\DeepSeek Harness\resources\app.asar"
f = open(p,"rb")
vals = struct.unpack("<4I", f.read(16))
data_start = 8 + vals[1]
f.seek(12); jlen = struct.unpack("<I", f.read(4))[0]
hdr = json.loads(f.read(jlen).decode("utf-8"))
paths={}
def walk(node, prefix):
    for k,v in node.get("files",{}).items():
        pp = prefix+"/"+k
        if "files" in v: walk(v, pp)
        else: paths[pp] = v
walk(hdr, "")
names=set()
for pp in paths:
    m = re.match(r"^/dsh/node_modules/(@deepseek-ai/[^/]+)", pp)
    if m: names.add(m.group(1))
print("\n".join(sorted(names)))
print("=== client-ish files ===")
for pp in sorted(paths):
    if pp.startswith("/dsh/") and "node_modules" not in pp and re.search(r"\.(js|mjs|cjs)$", pp):
        print(pp, paths[pp]["size"])
