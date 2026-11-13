"""Write each page's build stamp at deploy time, from git.                            2026-11-13

Søren: "It seems like the build date and time has stopped updating?" -- it had: the stamp was written
by src/build_stamps.py, which somebody had to remember to run, and nobody had since 23 October.
So the deploy writes it now, on the copy GitHub Pages serves (the repository's own files are not
changed): for every page that carries <span class="build">, the time of the last commit that
changed that page -- or, for a page that loads the shared core/ scripts, the last commit that
changed core/ if that is later -- in Copenhagen time. A page nobody touched keeps its old date,
which is the point of the stamp: it says which version of THAT page you are looking at.

Run by .github/workflows/static.yml after checkout (which needs fetch-depth: 0 for the history).
"""
import os, re, subprocess, glob

os.environ["TZ"] = "Europe/Copenhagen"
STAMP = re.compile(r'(<span class="build"[^>]*>)build [^<]*(</span>)')

def last_change(paths):
    out = subprocess.run(["git", "log", "-1", "--format=%cd", "--date=format-local:%Y-%m-%d %H:%M", "--"] + paths,
                         capture_output=True, text=True).stdout.strip()
    return out

for page in sorted(glob.glob("*.html")):
    with open(page, encoding="utf-8") as fh:
        s = fh.read()
    if not STAMP.search(s):
        continue
    paths = [page] + (["core"] if 'src="core/' in s else [])
    when = last_change(paths)
    if not when:
        print(page, ": no history, stamp left as it is")
        continue
    s2 = STAMP.sub(lambda m: m.group(1) + "build " + when + m.group(2), s)
    if s2 != s:
        with open(page, "w", encoding="utf-8") as fh:
            fh.write(s2)
    print(page, "->", when)
