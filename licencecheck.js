/* Every place that answers "what is this licensed under" gives the same answer.   2026-10-17

   Søren, reading the footer: *"Tools and code released under the MIT License. Content © Søren
   Grubb. What does this mean?"* — and the honest answer was that the repository did not agree
   with itself. `LICENSE` said Creative Commons Attribution 4.0; the footer said MIT; the README
   said CC BY 4.0 for the whole project. Three statements, three different grants, and nothing
   that would ever have failed.

   That is the class of bug this file exists for. A licence is not checked by running the site,
   it is checked by reading it, and nobody re-reads four files looking for a contradiction. So
   the contradiction is asserted against instead:

     THE CODE IS MIT AND SAYS SO IN ONE PLACE. `LICENSE` is the MIT text, not a CC licence.
     THE WRITING IS CC BY AND SAYS SO IN ANOTHER. `LICENSE-CONTENT` exists and is CC BY 4.0.
     NEITHER FILE CLAIMS THE OTHER'S TERRITORY, and both say what they do not cover — the
     datasets and the bundled libraries, which are the two things a blanket line would quietly
     swallow.
     THE FOOTER, THE SITE AND THE README NAME BOTH. A page that names one licence and not the
     other is how this started.
     CONTRIBUTORS ARE TOLD BEFORE THEY SUBMIT, not in a file they will never open: the terms
     are on the sign-in control that every tool carries.

   The vendored libraries are checked for still having their own notices, because MIT requires
   it and because "we bundle three MIT libraries" is a claim with an obligation attached.

   Run: node licencecheck.js */
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;
const R = [];
const ok = (n, c, d) => { R.push(!!c);
  console.log((c ? "PASS " : "*** FAIL *** ") + n + (d !== undefined ? "  <- " + d : "")); };
const read = p => { try { return fs.readFileSync(path.join(ROOT, p), "utf8"); } catch (e) { return null; } };

console.log("--- the two files ---");
const code = read("LICENSE"), content = read("LICENSE-CONTENT");
ok("LICENSE exists and is the MIT License",
   !!code && /^MIT License/m.test(code) && /Permission is hereby granted, free of charge/.test(code),
   code ? code.split("\n")[0] : "missing");
/* The specific mistake that was there: a Creative Commons licence on software. */
ok("...and is not a Creative Commons licence", !!code && !/Creative Commons/i.test(code.split("WHAT THIS COVERS")[0]),
   code && /Creative Commons/i.test(code.split("WHAT THIS COVERS")[0]) ? "still CC" : "MIT only");
ok("LICENSE-CONTENT exists and is CC BY 4.0",
   !!content && /Creative Commons Attribution 4\.0/.test(content),
   content ? content.split("\n")[0] : "missing");
ok("...and points at the real legal text",
   !!content && /creativecommons\.org\/licenses\/by\/4\.0\/legalcode/.test(content));

console.log("\n--- each says what it does not cover ---");
ok("the code licence disclaims the writing, the libraries and the datasets",
   !!code && /LICENSE-CONTENT/.test(code) && /core\/vendor/.test(code)
   && /redistribute/.test(code));
ok("the content licence disclaims the code and the datasets",
   /* \s+ because these files are hard-wrapped at 72 columns and "MIT License" lands across a
      line break -- a check that fails on the wrap rather than on the content is noise. */
   !!content && /MIT\s+License/.test(content) && /NOT COVERED/.test(content));

console.log("\n--- everywhere a reader might look ---");
const idx = read("index.html") || "";
const foot = idx.slice(idx.lastIndexOf("<footer>"));
ok("the footer names the MIT License", /MIT&nbsp;License|MIT License/.test(foot));
ok("...and CC BY 4.0", /CC&nbsp;BY&nbsp;4\.0|CC BY 4\.0/.test(foot));
ok("...and does not leave the content bare", !/Content &copy;|Content ©/.test(foot),
   /Content ©/.test(foot) ? "still says 'Content ©' with no licence" : "both named");
ok("the site explains which covers what",
   /Licences, and what each one covers/.test(idx));
ok("...including that the datasets are not ours to licence",
   /publisher&rsquo;s own cloud\s*\n?\s*bucket|publisher's own cloud/.test(idx)
   || /none is redistributed here/.test(idx));
const rd = read("README.md") || "";
ok("the README names both too",
   /\[MIT License\]\(LICENSE\)/.test(rd) && /\[CC BY 4\.0\]\(LICENSE-CONTENT\)/.test(rd));
ok("...and no longer licenses the whole project as CC BY",
   !/This project is licensed under \[CC BY 4\.0\]/.test(rd));

console.log("\n--- contributors are told before they submit ---");
const gam = read("core/gamify.js") || "";
ok("the sign-in control states the terms",
   /creativecommons\.org\/licenses\/by\/4\.0/.test(gam) && /What you submit stays yours/.test(gam));
ok("...and links to the full statement", /index\.html#data/.test(gam));
ok("the site states them in full",
   /What you submit stays yours/.test(idx) && /credited by name or handle/.test(idx));
/* Said in both licence files as well, so that someone reading only the repository finds it. */
ok("...and both licence files record them",
   !!code && !!content && /Contributions/i.test(code) && /CONTRIBUTIONS/.test(content));

console.log("\n--- the bundled libraries keep their own notices ---");
const vendor = path.join(ROOT, "core", "vendor");
let notices = [];
if (fs.existsSync(vendor)) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/^LICEN[SC]E/i.test(e.name)) notices.push(path.relative(ROOT, p));
  });
  walk(vendor);
}
ok("every vendored library still carries a licence file", notices.length >= 3,
   notices.join(", ") || "none found");
ok("...and the code licence says they govern themselves",
   !!code && /their licences, not this one, govern them/.test(code));

const bad = R.filter(x => !x).length;
console.log("\n" + (bad ? "*** " + bad + " of " + R.length + " FAILED ***"
                        : "RESULT: ALL " + R.length + " CHECKS PASSED"));
process.exit(bad ? 1 : 0);
