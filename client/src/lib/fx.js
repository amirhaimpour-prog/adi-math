// Sound effects (WebAudio, no assets) and confetti.
import confetti from 'canvas-confetti';

let ctx = null;
let enabled = (() => {
  try { return localStorage.getItem('adi_sound') !== 'off'; } catch { return true; }
})();

export const isSoundOn = () => enabled;
export function setSound(on) {
  enabled = on;
  try { localStorage.setItem('adi_sound', on ? 'on' : 'off'); } catch { /* ignore */ }
}

function tone(freqs, { type = 'sine', dur = 0.12, gap = 0.07, vol = 0.09 } = {}) {
  if (!enabled) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      o.connect(g); g.connect(ctx.destination);
      const s = t0 + i * gap;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(vol, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      o.start(s); o.stop(s + dur + 0.02);
    });
  } catch { /* audio blocked */ }
}

export const sfx = {
  correct: () => tone([659, 880], { dur: 0.16, gap: 0.08 }),
  combo: () => tone([659, 784, 988, 1319], { dur: 0.14, gap: 0.06 }),
  wrong: () => tone([220, 175], { type: 'triangle', dur: 0.2, gap: 0.11, vol: 0.08 }),
  click: () => tone([520], { dur: 0.05, vol: 0.04 }),
  levelUp: () => tone([523, 659, 784, 1047, 1319], { dur: 0.22, gap: 0.09, vol: 0.1 }),
  badge: () => tone([784, 988, 1175, 1568], { type: 'triangle', dur: 0.2, gap: 0.08 }),
};

export function burst(opts = {}) {
  const colors = ['#C59B5F', '#E5B96F', '#091E3A', '#579BFC', '#00C875', '#FDAB3D', '#A25DDC'];
  confetti({ particleCount: 90, spread: 75, origin: { y: 0.65 }, colors, disableForReducedMotion: true, ...opts });
}

export function bigCelebration() {
  const end = Date.now() + 1200;
  const colors = ['#C59B5F', '#E5B96F', '#579BFC', '#00C875', '#A25DDC'];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors, disableForReducedMotion: true });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
