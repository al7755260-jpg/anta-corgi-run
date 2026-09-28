import {assetUrl} from './assets.js';

const SOUND_PREFERENCE = 'anta-corgi-sound-v2';

export class Sound {
  constructor() {
    this.enabled = true;
    try { this.enabled = localStorage.getItem(SOUND_PREFERENCE) !== 'muted'; } catch {}
    this.ctx = null;
    this.master = null;
    this.active = false;
    this.pendingPlay = null;
    this.revision = 0;
    this.blocked = false;
    this.errorReported = false;
    this.music = document.createElement('audio');
    this.music.id = 'game-bgm';
    this.music.src = assetUrl('pixel-paw-sprint.m4a');
    this.music.preload = 'none';
    this.music.loop = true;
    this.music.volume = 0.24;
    this.music.muted = !this.enabled;
    this.music.hidden = true;
    this.music.dataset.status = 'idle';
    this.music.setAttribute('aria-label', '汪汪向前冲背景音乐');
    document.body.append(this.music);
    this.music.addEventListener('playing', () => {
      if (!this.shouldPlay()) { this.music.pause(); return; }
      this.music.dataset.status = 'playing';
      this.errorReported = false;
    });
    this.music.addEventListener('pause', () => {
      if (!this.music.error && !this.blocked) this.music.dataset.status = 'paused';
    });
    this.music.addEventListener('error', () => this.reportError('error'));
    document.addEventListener('visibilitychange', () => {
      this.revision++;
      this.reconcile();
    });
  }

  shouldPlay() { return this.active && this.enabled && !document.hidden; }

  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem(SOUND_PREFERENCE, this.enabled ? 'enabled' : 'muted'); } catch {}
    this.music.muted = !this.enabled;
    if (this.master) this.master.gain.setValueAtTime(this.enabled ? 1 : 0, this.ctx.currentTime);
    this.setActive(this.active, { gesture: true });
    return this.enabled;
  }

  // Keep play() inside the Start/Continue gesture to satisfy autoplay policies.
  setActive(active, { gesture = false, restart = false } = {}) {
    const changed = this.active !== active;
    this.active = active;
    if (!changed && !gesture && !restart) return;
    this.revision++;
    if (gesture) {
      this.blocked = false;
      this.errorReported = false;
      if (this.enabled) this.unlock();
    }
    if (restart) {
      try { this.music.currentTime = 0; } catch {}
    }
    // Retry failed loads only on an explicit gesture, never on every frame.
    if (gesture && this.shouldPlay() && this.music.error) this.music.load();
    this.reconcile();
  }

  reconcile() {
    if (!this.shouldPlay()) { this.music.pause(); return; }
    if (this.pendingPlay || !this.music.paused || this.blocked || this.music.error) return;
    const revision = this.revision;
    this.music.dataset.status = 'loading';
    let playback;
    try { playback = this.music.play(); } catch { this.reportError('error'); return; }
    this.pendingPlay = Promise.resolve(playback).catch(error => {
      if (error.name === 'AbortError' || revision !== this.revision) return;
      this.blocked = error.name === 'NotAllowedError';
      this.reportError(this.blocked ? 'blocked' : 'error');
    }).finally(() => {
      this.pendingPlay = null;
      if (!this.shouldPlay()) this.music.pause();
      // Pause -> Continue can arrive while a previous play() is still pending.
      else if (this.revision !== revision) this.reconcile();
    });
  }

  reportError(status) {
    this.music.dataset.status = status;
    if (this.shouldPlay() && !this.errorReported) {
      this.errorReported = true;
      this.onMusicError?.(status === 'blocked'
        ? '浏览器暂停了背景音乐，请关闭再开启声音后重试'
        : '背景音乐暂未载入，请检查音乐文件');
    }
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 1 : 0;
        this.master.connect(this.ctx.destination);
      }
      this.ctx.resume().catch(() => {});
    } catch {}
  }

  play(kind) {
    if (!this.enabled || document.hidden) return;
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const notes = kind === 'coin' ? [880, 1174] : kind === 'jump' ? [330, 660] : kind === 'hit' ? [140, 90] : kind === 'win' ? [523, 659, 784, 1046] : kind === 'power' ? [440, 660, 880] : [440];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = kind === 'hit' ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(freq, now + i * .065);
      g.gain.setValueAtTime(0, now + i * .065);
      g.gain.linearRampToValueAtTime(.055, now + i * .065 + .01);
      g.gain.exponentialRampToValueAtTime(.001, now + i * .065 + .18);
      o.connect(g); g.connect(this.master);
      o.start(now + i * .065); o.stop(now + i * .065 + .2);
    });
  }
}
