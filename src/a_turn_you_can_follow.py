# -*- coding: utf-8 -*-
r"""A turn you can follow.                                                          2026-10-12

Søren: *"The downloaded gif of a turn is too fast. Can we make it slower somehow? The speed in the
3D window is fine, I guess it is around half the speed of the downloaded gif."*

WHAT IT ACTUALLY WAS. 48 frames at 24 fps, and 24 fps is not what came out: the GIF format stores a
frame delay in CENTISECONDS, gifenc writes Math.round(delay / 10), and 1000/24 = 42 ms rounds to
4 cs. So every frame was shown for 40 ms, the turn ran at 25 fps, and a full revolution took 1.92 s
— 7.5 degrees a frame. His "about half" is right about the fix even though the panel itself turns
far slower than that: view.yaw += dt * 0.00045 rad/ms is a revolution in 14 s, and a 14-second GIF
at any watchable frame rate is 300-plus frames and several megabytes. He does not want the panel's
speed in a file; he wants to be able to follow it.

50 FRAMES AT 12.5 fps = 4.00 s A TURN, exactly half of what it was.

AND THE RATE IS CHOSEN FOR THE UNIT. Only a few frame rates survive the centisecond: 50, 25, 20,
12.5 and 10 fps. Everything else is rounded by the format and the file plays at a speed nobody
picked, which is exactly how 24 became 25. 1000/12.5 = 80 ms = 8 cs on the nose.

AND IT COSTS NOTHING. Duration is frames x delay, so halving the speed can be bought with frames or
with time, and time is free: 50 frames is the file he already has (48), shown twice as long. 80
frames at 20 fps would be the same four seconds and smoother -- 4.5 degrees a frame against 7.2 --
but 1.6x the bytes, measured, and he asked for slower rather than smoother. The console can have
it: saveTurn({frames: 80, fps: 20}).

NO NEW CONTROL. turnBlob() already reads o.frames and o.fps, so saveTurn({frames: 160, fps: 20})
gives an eight-second turn from the console. A button for it would be a third thing to decide at
download time, and this week has been spent removing two of those.

Changes: core/mesh3dshot.js
Check:   shotcheck.js (extended)
Run: python3 src/a_turn_you_can_follow.py
     node shotcheck.js
"""
import io, os
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def edit(rel, pairs):
    P = os.path.join(HERE, rel)
    s = io.open(P, encoding="utf-8").read(); b = s
    print(rel)
    for name, old, new in pairs:
        if new in s:
            print("  already there: " + name); continue
        n = s.count(old)
        assert n == 1, "@NM@ (@F@): @N@".replace("@NM@", name).replace(
            "@F@", os.path.basename(P)).replace("@N@", str(n))
        s = s.replace(old, new, 1); print("  ok: " + name)
    if s != b: io.open(P, "w", encoding="utf-8").write(s)


edit("core/mesh3dshot.js", [
    (u"the turn takes four seconds, and the frame rate is a whole centisecond",
     u'''  function turnBlob(opts){
    var o = opts || {};
    var n = Math.max(8, Math.min(120, o.frames || 48));
    var fps = Math.max(5, Math.min(50, o.fps || 24));''',
     u'''  /* \\u2500\\u2500 HOW LONG A TURN TAKES \\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500  2026-10-12
     S\\u00f8ren: *"The downloaded gif of a turn is too fast... around half the speed."*

     It was 48 frames at 24 fps, and 24 fps is not what came out. A GIF stores its frame delay in
     CENTISECONDS: 1000/24 = 42 ms, written as Math.round(42/10) = 4 cs, so every frame was held
     for 40 ms and the turn ran at 25 fps \\u2014 1.92 s a revolution, 7.5\\u00b0 a frame.

     50 at 12.5 is 4.00 s, exactly half, and the rate is chosen FOR THE UNIT: only 50, 25, 20,
     12.5 and 10 fps survive the centisecond, and 1000/12.5 = 80 ms = 8 cs on the nose. Bought
     with TIME rather than with frames, so the file is the one he already has shown twice as long;
     80 at 20 fps is the same four seconds and smoother, at 1.6x the bytes, and is one argument
     away: saveTurn({frames: 80, fps: 20}).

     NOT THE PANEL'S OWN SPEED, which is a revolution in 14 s (view.yaw += dt * 0.00045 in
     core/mesh3d.js) \\u2014 that is 300-plus frames and several megabytes. The ceiling is raised to
     240 so a longer turn is reachable from the console: saveTurn({frames: 160, fps: 20}). */
  function turnBlob(opts){
    var o = opts || {};
    var n = Math.max(8, Math.min(240, o.frames || 50));
    var fps = Math.max(5, Math.min(50, o.fps || 12.5));'''),
])

# ── guards ───────────────────────────────────────────────────────────────────────────────────
P = os.path.join(HERE, "core/mesh3dshot.js")
s = io.open(P, encoding="utf-8").read()
assert s.count(u"o.frames || 50") == 1 and s.count(u"o.fps || 12.5") == 1
assert u"o.frames || 48" not in s and u"o.fps || 24" not in s
# A WHOLE CENTISECOND OR THE FORMAT PICKS FOR YOU. The delay is still written the same way; what
# this change relies on is that 1000/fps divides by 10 exactly, so it is asserted here in the
# arithmetic rather than left to be noticed in a player.
assert s.count(u"delay: Math.round(1000 / fps)") == 1, "the delay line moved"
assert round(1000 / 12.5) % 10 == 0, "12.5 fps is not a whole centisecond"
assert 50 * round(1000 / 12.5) == 4000, "50 frames at 12.5 fps is not four seconds"
print("done")
print("all applied")
