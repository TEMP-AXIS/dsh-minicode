
import struct, json, sys, io
sys.stdout.reconfigure(encoding="utf-8")
p = r"C:\Users\mi\AppData\Local\Programs\DeepSeek Harness\resources\app.asar"
with open(p,"rb") as f:
    data = f.read(64)
# asar: uint32 4 (size pickle), uint32 header pickle size, uint32 payload size, uint32 json len
print(data[:16])
h = struct.unpack("<4I", data[:16])
print(h)
with open(p,"rb") as f:
    raw = f.read(16 + h[2] if False else 16)
with open(p,"rb") as f:
    f.seek(12)
    jlen = struct.unpack("<I", f.read(4))[0]
    js = f.read(jlen)
hdr = json.loads(js.decode("utf-8"))
print("files:", len(hdr["files"]))
print(list(hdr["files"].keys())[:20])
