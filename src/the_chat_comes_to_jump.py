"""The chat comes to the Jump tools (2026-10-23).

Idempotent. Run from microns-neuroglancer-tool/:  python3 src/the_chat_comes_to_jump.py
  * every tool page loads core/chat.js right after core/jumplink.js
  * µJump's two identity cards get "🗳 Ask the chat to vote", which opens the chat with
    /vote <x,y,z> "" "<current type>" filled in (the new type is the asker's to write)."""
import io, re, sys

TAG = '<!-- The chat between everybody working in the Jump tools (core/chat.js, Firebase), 2026-10-23. -->\n<script src="core/chat.js"></script>\n'
ANCHOR = '<script src="core/jumplink.js"></script>\n'

def put_tag(path):
    s = io.open(path, encoding="utf-8").read()
    if 'src="core/chat.js"' in s:
        return path + ": tag already there"
    if s.count(ANCHOR) != 1:
        return path + ": NO single jumplink anchor (%d) -- not touched" % s.count(ANCHOR)
    s = s.replace(ANCHOR, ANCHOR + TAG)
    io.open(path, "w", encoding="utf-8", newline="").write(s)
    return path + ": tag added"

def vote_buttons(path):
    s = io.open(path, encoding="utf-8").read()
    if 'id="chatVote"' in s:
        return path + ": vote buttons already there"
    row = "'<div class=\"idcta-top\" style=\"border-top:1px dashed var(--line);padding-top:10px\"><span>Unsure, or think it is mislabelled? Ask the people online.</span><button class=\"idbtn\" id=\"chatVote\" title=\"Opens the chat with a vote on this cell: everybody online answers with one click\">&#x1F5F3; Ask the chat to vote</button></div>'"
    # 1. the verified ("own") card
    a1 = """    +'<div class="idcta-search">'+leafSearchHtml("mainLeaf","Already know it? Jump straight there")+'</div></div>';"""
    if s.count(a1) != 1:
        return path + ": own-card anchor not found once (%d)" % s.count(a1)
    s = s.replace(a1, """    +'<div class="idcta-search">'+leafSearchHtml("mainLeaf","Already know it? Jump straight there")+'</div>'+""" + row + """+'</div>';""")
    w1 = """  const idfCtx={suggested:null,pos:st.pos};
  const idfBtn=panel.querySelector("#idfgo");
  if(idfBtn)idfBtn.addEventListener("click",()=>openIdentify(idfCtx));"""
    if s.count(w1) != 1:
        return path + ": own-card wiring anchor not found once (%d)" % s.count(w1)
    s = s.replace(w1, w1 + """
  { const cvb=panel.querySelector("#chatVote"); if(cvb)cvb.addEventListener("click",()=>{ if(window.UJ&&UJ.chat)UJ.chat.askVote(st.pos.map(Math.round).join(","),"",longName(st.type)); else alert("The chat is not loaded on this page."); }); }""")
    # 2. the main card
    a2 = """  h+='<div class="idcta-search">'+leafSearchHtml("mainLeaf","Already know it? Jump straight there")+'</div></div>';"""
    if s.count(a2) != 1:
        return path + ": main-card anchor not found once (%d)" % s.count(a2)
    s = s.replace(a2, """  h+='<div class="idcta-search">'+leafSearchHtml("mainLeaf","Already know it? Jump straight there")+'</div>'+""" + row + """+'</div>';""")
    w2 = """  const idfBtn=panel.querySelector("#idfgo");
  if(idfBtn)idfBtn.addEventListener("click",()=>openIdentify(idfCtx));
  wireLeafSearch("mainLeaf",slug=>openIdentifyToLeaf(idfCtx,slug));
  /* Deliberately uses the QUERY coordinate"""
    if s.count(w2) != 1:
        return path + ": main-card wiring anchor not found once (%d)" % s.count(w2)
    s = s.replace(w2, """  const idfBtn=panel.querySelector("#idfgo");
  if(idfBtn)idfBtn.addEventListener("click",()=>openIdentify(idfCtx));
  wireLeafSearch("mainLeaf",slug=>openIdentifyToLeaf(idfCtx,slug));
  { const cvb=panel.querySelector("#chatVote"); if(cvb)cvb.addEventListener("click",()=>{ if(window.UJ&&UJ.chat)UJ.chat.askVote([NX[i],NY[i],NZ[i]].map(Math.round).join(","),"",own?own.type:(ti.cls?longName(ti.name)+(ti.mtype?" ("+ti.mtype+")":""):"")); else alert("The chat is not loaded on this page."); }); }
  /* Deliberately uses the QUERY coordinate""")
    io.open(path, "w", encoding="utf-8", newline="").write(s)
    return path + ": vote buttons added"

if __name__ == "__main__":
    for p in ["ujump.html", "djump.html", "hjump.html", "bjump.html", "ljump.html", "pjump.html"]:
        print(put_tag(p))
    print(vote_buttons("ujump.html"))
