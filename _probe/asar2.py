
import struct, json, sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"C:\Users\mi\AppData\Local\Programs\DeepSeek Harness\resources\app.asar"
with open(p,"rb") as f:
    f.seek(12); jlen = struct.unpack("<I", f.read(4))[0]
    hdr = json.loads(f.read(jlen).decode("utf-8"))
paths=[]
def walk(node, prefix):
    for k,v in node.get("files",{}).items():
        pp = prefix+"/"+k
        if "files" in v: walk(v, pp)
        else: paths.append((pp, v.get("size",0)))
walk(hdr, "")
print("total files:", len(paths))
hits = [x for x in paths if "plugin" in x[0].lower()]
print("plugin-related:", len(hits))
for h in hits[:60]: print(h)
