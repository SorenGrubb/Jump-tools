# -*- coding: utf-8 -*-
u"""One answer about licensing, in every place that gives one.                       2026-10-17

Søren, reading the footer: *"Tools and code released under the MIT License. Content © Søren
Grubb. What does this mean? MIT license?"* — and then, when the two were put side by side:
*"Sure, make them agree."*

THEY DID NOT AGREE. The footer said MIT. `LICENSE` in the repository root said Creative Commons
Attribution 4.0. Those grant different things — CC BY has no patent language, no sublicensing
grant and nothing about source form — so a reader got a different answer depending on where they
looked, and anyone wanting to reuse a module had no way to tell which was binding. Creative
Commons themselves recommend against using their licences for software
(https://creativecommons.org/faq/), so the footer was the one that was right.

WHAT NOW SAYS WHAT:

  LICENSE           MIT, for the code. Permissive, keeps the notice, disclaims warranty.
  LICENSE-CONTENT   CC BY 4.0, for the writing, the figures and the documentation — which is
                    what the footer's bare "Content © Søren Grubb" meant, and which meant all
                    rights reserved on a site that is otherwise about open data.
  core/vendor/*     untouched. Those are other people's libraries under their own MIT licences,
                    and MIT requires their notices to travel with the code. Saying so is part of
                    honouring them rather than a disclaimer.
  index.html        the footer states both and links to the section that explains them; the
                    Data & attribution section carries the whole statement, including the two
                    things neither licence covers.

THE TWO THINGS NEITHER LICENCE COVERS, and the reason this is more than a file swap:

  THE DATASETS ARE NOT OURS TO LICENCE. The tools read every volume from the publisher's own
  bucket and redistribute nothing; 27 of ωJump's 62 volumes state no reuse licence at all. A
  blanket footer line is exactly the thing that would quietly imply otherwise.

  WHAT CONTRIBUTORS SUBMIT. Identifications, tracings and forum posts are other people's work,
  and until now they were collected under no stated terms. The paper describes that database as
  a community resource to be shared, which needs contributors to have agreed to something.
  CC BY 4.0, said where people sign in and said in full on the site, so that it is stated before
  the submission rather than asserted after it. This is the half that cannot be retrofitted: it
  applies to submissions made from here on, and anything already in the sheets was given without
  it.

Check: licencecheck.js (new)
Run: python3 src/one_licence_in_every_place.py, then python3 src/build_stamps.py,
     then python3 wjump-build/build_wjump.py and python3 xjump-build/build_xjump.py,
     then node licencecheck.js
"""
import io
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YEAR = u"2026"
WHO = u"Søren Grubb"

MIT = u"""MIT License

Copyright (c) %s %s

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


WHAT THIS COVERS, AND WHAT IT DOES NOT
--------------------------------------

COVERS: the Jump tools and everything that makes them run -- the HTML pages,
core/*.js, the build scripts in src/ and the *-build directories, the Apps
Script backend and the Colab and Blender export scripts.

DOES NOT COVER:

  The writing and the figures. The prose on the site, the dataset tables, the
  explanatory text inside the tools and the figures are under Creative Commons
  Attribution 4.0 -- see LICENSE-CONTENT.

  The bundled libraries in core/vendor/. Each is third-party code under its own
  licence, and each keeps its own notice beside it. They are included
  unmodified, and their licences, not this one, govern them.

  The electron-microscopy datasets. The tools read every volume from the
  publisher's own cloud bucket and redistribute none of them. Each dataset's
  own terms apply and are stated on its page; a number of them state no reuse
  licence at all.

  Contributions made through the tools. Identifications, tracings, organelle
  reports and forum posts are released by the people who made them under
  Creative Commons Attribution 4.0 -- see LICENSE-CONTENT.
""" % (YEAR, WHO)

CONTENT = u"""Creative Commons Attribution 4.0 International (CC BY 4.0)

Copyright (c) %s %s

THIS FILE COVERS THE WRITING, NOT THE CODE. The prose on grubblab.com, the
dataset tables, the explanatory text inside the tools, the figures and the
documentation are licensed under CC BY 4.0. The software is under the MIT
License -- see LICENSE. Creative Commons recommends against using its licences
for software, which is why the two are separate:
https://creativecommons.org/faq/

CONTRIBUTIONS. Identifications, corrections, organelle reports, tracings and
forum posts submitted through the Jump tools are released by their authors
under this same licence, so that the community annotation database can be
shared and cited. Contributors keep the copyright in what they submit and are
credited by name or handle. This applies to submissions made after
2026-10-17; anything submitted before that was given under no stated terms.

You are free to:
  - Share -- copy and redistribute the material in any medium or format
  - Adapt -- remix, transform, and build upon the material
  for any purpose, even commercially.

Under the following terms:
  - Attribution -- You must give appropriate credit, provide a link to the
    license, and indicate if changes were made. You may do so in any
    reasonable manner, but not in any way that suggests the licensor
    endorses you or your use.
  - No additional restrictions -- You may not apply legal terms or
    technological measures that legally restrict others from doing
    anything the license permits.

No warranties are given. The license may not give you all of the
permissions necessary for your intended use.

The full legal text is at:
https://creativecommons.org/licenses/by/4.0/legalcode

NOT COVERED: the electron-microscopy datasets. They are read from their
publishers' own buckets, nothing is redistributed, and each one's terms are
stated on its page in the tools.
""" % (YEAR, WHO)


def write(rel, text, name):
    p = os.path.join(HERE, rel)
    old = io.open(p, encoding="utf-8").read() if os.path.exists(p) else None
    if old == text:
        print("  already there: " + name)
        return
    io.open(p, "w", encoding="utf-8").write(text)
    print("  ok: " + name)


def edit(rel, pairs):
    p = os.path.join(HERE, rel)
    s = io.open(p, encoding="utf-8").read()
    b = s
    print(rel)
    for name, old, new in pairs:
        if new in s:
            print("  already there: " + name)
            continue
        n = s.count(old)
        assert n == 1, "%s (%s): %d" % (name, os.path.basename(p), n)
        s = s.replace(old, new, 1)
        print("  ok: " + name)
    if s != b:
        io.open(p, "w", encoding="utf-8").write(s)


print("the two licence files")
write("LICENSE", MIT, "LICENSE is the MIT License, for the code")
write("LICENSE-CONTENT", CONTENT, "LICENSE-CONTENT is CC BY 4.0, for the writing")

# ── the footer, and the section it points at ──────────────────────────────────────────────────
FOOT_OLD = u"    Tools and code released under the MIT License. Content © Søren Grubb.\n"
FOOT_NEW = (
    u"    Code under the <a href=\"https://github.com/SorenGrubb/microns-neuroglancer-tool/"
    u"blob/main/LICENSE\" rel=\"noopener\">MIT&nbsp;License</a> &middot;\n"
    u"    text and figures under <a href=\"https://creativecommons.org/licenses/by/4.0/\" "
    u"rel=\"noopener\">CC&nbsp;BY&nbsp;4.0</a> &middot;\n"
    u"    © %s %s.\n"
    u"    Bundled libraries keep their own licences, and the EM datasets keep theirs &mdash;\n"
    u"    <a href=\"#data\">what applies to what</a>.\n" % (YEAR, WHO))

LIC_SECTION = u"""    <h3 style="font-size:16px;margin:26px 0 6px">Licences, and what each one covers</h3>
    <p>
      The <b>code</b> &mdash; the pages, <code>core/*.js</code>, the build scripts, the Apps
      Script backend and the Colab and Blender exports &mdash; is under the
      <a href="https://github.com/SorenGrubb/microns-neuroglancer-tool/blob/main/LICENSE"
         rel="noopener">MIT&nbsp;License</a>. The <b>writing and the figures</b> on this site and
      inside the tools are under
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">CC&nbsp;BY&nbsp;4.0</a>.
      Two licences rather than one because Creative Commons
      <a href="https://creativecommons.org/faq/" rel="noopener">recommends against</a> using its
      licences for software.
    </p>
    <p>
      Neither covers the <b>datasets</b>. Every volume is read from its publisher's own cloud
      bucket and none is redistributed here, so each dataset's own terms apply &mdash; and a
      number of them state no reuse licence at all. The terms for each one are shown on its page.
      The <b>libraries</b> bundled in <code>core/vendor/</code> are third-party code under their
      own licences, included unmodified with their notices beside them.
    </p>
    <p>
      <b>What you submit stays yours.</b> Identifications, corrections, organelle reports,
      tracings and forum posts are released by the people who made them under
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">CC&nbsp;BY&nbsp;4.0</a>,
      so the community annotation database can be shared and cited; contributors keep the
      copyright in their own work and are credited by name or handle. This applies to
      submissions made from 17&nbsp;October&nbsp;2026 onwards. You can ask for your
      contributions to be removed at any time.
    </p>
"""

idx = io.open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
anchor = u'  </div>\n</section>\n\n<section id="privacy">'
assert idx.count(anchor) == 1, "no Data & attribution / Privacy boundary to insert before"
edit("index.html", [
    (u"the footer states both licences and points at the section that explains them",
     FOOT_OLD, FOOT_NEW),
    (u"...and Data & attribution carries the whole statement",
     anchor, LIC_SECTION + anchor),
])

# ── and the tools say it where people sign in ─────────────────────────────────────────────────
# Where the terms belong is before the submission, not in a file a contributor will never open.
# The sign-in chip is in every tool, it is the one control that is about becoming a contributor,
# and it is one definition in core/gamify.js rather than eight.
edit("core/gamify.js", [
    (u"the sign-in chip says what submissions are released under",
     u'''    c.innerHTML='<div class="chipbtn"><span>Sign in to track progress</span></div><div id="chipGsi" style="margin-top:6px"></div>';''',
     u'''    /* THE TERMS, BEFORE THE SUBMISSION (2026-10-17). What contributors send is their own
       work, and until now it was collected under nothing stated at all -- which left the
       community database impossible to share honestly. Said here because this is the one
       control in every tool that is about becoming a contributor, and because a licence file
       nobody opens is not a notice. The full statement is on the site. */
    c.innerHTML='<div class="chipbtn"><span>Sign in to track progress</span></div><div id="chipGsi" style="margin-top:6px"></div>'
      +'<div style="font-size:10.5px;line-height:1.45;color:var(--mut,#8b949e);margin-top:6px;max-width:30ch">'
      +'What you submit stays yours, shared under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC&nbsp;BY&nbsp;4.0</a> so it can be cited. '
      +'<a href="/index.html#data" target="_blank" rel="noopener">Terms</a>.</div>';'''),
])

# ── and the README, which is where a GitHub visitor looks first ───────────────────────────────
edit("README.md", [
    (u"the README names both licences and what neither covers",
     u"""## License

This project is licensed under [CC BY 4.0](LICENSE) \u2014 you're free to share and adapt it, with attribution.""",
     u"""## License

The **code** \u2014 the pages, `core/*.js`, the build scripts in `src/` and the `*-build`
directories, the Apps Script backend and the Colab and Blender exports \u2014 is under the
[MIT License](LICENSE). The **writing and figures** on the site and inside the tools are under
[CC BY 4.0](LICENSE-CONTENT). Two licences rather than one because Creative Commons
[recommends against](https://creativecommons.org/faq/) using its licences for software.

Neither covers the **electron-microscopy datasets**: every volume is read from its publisher's
own cloud bucket, nothing is redistributed here, and each dataset's own terms apply \u2014 a
number of them state no reuse licence at all. The terms for each are shown on its page in the
tools. The **libraries** in `core/vendor/` are third-party code under their own licences,
included unmodified with their notices beside them.

**Contributions** made through the tools \u2014 identifications, corrections, organelle reports,
tracings and forum posts \u2014 are released by their authors under
[CC BY 4.0](LICENSE-CONTENT) so the community annotation database can be shared and cited.
Contributors keep the copyright in their own work and are credited by name or handle."""),
])

print("\nNow: python3 src/build_stamps.py, then the wjump and xjump builds, then node licencecheck.js")
