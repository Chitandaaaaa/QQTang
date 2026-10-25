/* =========================================================================
   QQ糖 · 夺宝对决 — 音效
   （自 tools/game/main.js 按分段切出；各文件共享全局作用域，按文件名顺序加载）
   ========================================================================= */
'use strict';

  /* ------------------------------------------------------------- 音效 */
  let AC = null, noiseBuf = null;
  function audio() {
    if (!AC) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      AC = new C();
      const n = AC.sampleRate * 0.5;
      noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, dur, type, gain, slideTo) {
    const a = audio(); if (!a || state.muted) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
    g.gain.setValueAtTime(gain == null ? 0.06 : gain, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur + 0.02);
  }
  function sfx(name) {
    if (state.muted) return;
    const a = audio(); if (!a) return;
    if (name === 'place') { tone(300, 0.09, 'square', 0.05, 160); }
    else if (name === 'boom') {
      const s = a.createBufferSource(); s.buffer = noiseBuf;
      const f = a.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(1800, a.currentTime);
      f.frequency.exponentialRampToValueAtTime(220, a.currentTime + 0.34);
      const g = a.createGain();
      g.gain.setValueAtTime(0.24, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.4);
      s.connect(f); f.connect(g); g.connect(a.destination);
      s.start();
      tone(90, 0.3, 'sine', 0.16, 46);
    } else if (name === 'pick') { tone(660, 0.07, 'triangle', 0.05); setTimeout(() => tone(990, 0.1, 'triangle', 0.05), 60); }
    else if (name === 'die') { tone(420, 0.5, 'sawtooth', 0.07, 70); }
    else if (name === 'win') { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.06), i * 110)); }
    else if (name === 'draw') { tone(300, 0.4, 'sine', 0.06, 180); }
    else if (name === 'push') { tone(140, 0.1, 'square', 0.05, 84); }
    else if (name === 'step') { /* 静音脚步，避免吵闹 */ }
  }

