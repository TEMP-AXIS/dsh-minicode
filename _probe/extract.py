
import struct, json, sys, os
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
def extract(path):
    e = paths[path]
    f.seek(data_start + int(e["offset"]))
    return f.read(e["size"])
n=0
for pref in sys.argv[1:]:
    pref = "/" + pref.strip("/")
    for pp in paths:
        if pp.startswith(pref):
            out = "_probe/asar_out" + pp
            os.makedirs(os.path.dirname(out), exist_ok=True)
            open(out,"wb").write(extract(pp)); n+=1
print("extracted", n)
