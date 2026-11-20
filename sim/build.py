"""sim/index.html + vendor + src → tek dosyalık çevrimdışı HTML üretir."""
import os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(ROOT), "TriPan_3B_Simulasyon.html")

def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()

html = read("index.html")

scripts = re.findall(r'<script src="([^"]+)"></script>', html)
parts = []
for src in scripts:
    code = read(src)
    code = code.replace("</script", "<\\/script")
    parts.append("/* ---- %s ---- */\n%s" % (src, code))

inline = "<script>\n" + "\n\n".join(parts) + "\n</script>"
html = re.sub(r'(<script src="[^"]+"></script>\s*)+', lambda m: inline + "\n", html, count=1)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)

print("yazıldı:", OUT, "%.0f KB" % (os.path.getsize(OUT) / 1024))
