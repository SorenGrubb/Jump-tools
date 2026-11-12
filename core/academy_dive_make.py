# Licence-card art: the µJump wordmark, its ↗ as the springboard, a dotted arc and a stick figure
# diving head first into Søren's astrocyte-around-an-EM-cube render. Rendered by shot2.js.
import base64
cube=base64.b64encode(open('cube.png','rb').read()).decode()
html='''<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:transparent}</style></head><body>
<svg id="s" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 720" width="1240" height="720">
<image id="cube" href="data:image/png;base64,CUBE" x="590" y="170" width="640" height="527"/>
<text id="w" x="24" y="640" style="font:800 150px Inter,'Segoe UI',sans-serif;letter-spacing:-4px"><tspan id="mu" fill="#27e0b3" font-style="italic">µ</tspan><tspan id="jm" fill="#e6edf3">Jump</tspan><tspan id="ar" fill="#27e0b3" font-size="80" font-weight="800" dx="10" dy="-58">↗</tspan></text>
<g id="fx"></g></svg>
<script>
const s=document.getElementById("s"),NS="http://www.w3.org/2000/svg";
const ar=document.getElementById("ar").getBBox();
const ax=ar.x+ar.width*0.86, ay=ar.y+ar.height*0.22;           // the arrow's tip
const tx=590+640*0.4516, ty=170+527*0.237;                       // where he goes in
const g=document.getElementById("fx");
g.innerHTML=
 `<path d="M${ax+6},${ay-8} C ${ax+70},${ay-300} ${tx-200},${ty-330} ${tx-34},${ty-150}" fill="none" stroke="#27e0b3" stroke-width="6" stroke-dasharray="2 16" stroke-linecap="round" opacity=".95"/>`
 +[[30,.9],[54,.6],[80,.35]].map(([r,o])=>`<ellipse cx="${tx}" cy="${ty+6}" rx="${r}" ry="${(r*.32).toFixed(1)}" fill="none" stroke="#7fd3ff" stroke-width="3.5" opacity="${o}"/>`).join("")
 +[[-38,44],[-16,64],[20,66],[42,46]].map(([dx,h])=>`<path d="M${tx+dx},${ty-2} q${(dx*.3).toFixed(0)},-${h} ${(dx*.8).toFixed(0)},-${(h*.4).toFixed(0)}" fill="none" stroke="#7fd3ff" stroke-width="4.5" stroke-linecap="round"/>`).join("")
 +`<g stroke="#e6edf3" stroke-width="11" stroke-linecap="round" fill="none" transform="translate(${tx} ${ty-44}) rotate(162)">
   <circle cx="0" cy="-62" r="20" fill="#e6edf3" stroke="none"/><line x1="0" y1="-40" x2="0" y2="24"/>
   <line x1="0" y1="-32" x2="-15" y2="-98"/><line x1="0" y1="-32" x2="15" y2="-98"/>
   <line x1="0" y1="24" x2="-17" y2="78"/><line x1="0" y1="24" x2="15" y2="76"/></g>`;
document.title="ready";
</script></body></html>'''
open('dive2.html','w').write(html.replace('CUBE',cube))
