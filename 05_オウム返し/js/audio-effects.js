(() => {
  "use strict";

  const PRESETS = Object.freeze({
    normal: { label: "普通", pitch: 0, speed: 1 },
    parrot: { label: "オウム", pitch: 5, speed: 1.05 },
    tiny: { label: "チビ", pitch: 11, speed: 1.05 },
    monster: { label: "怪物", pitch: -10, speed: 0.94, lowPass: 6500 },
    robot: { label: "ロボット", pitch: 0, speed: 1, robot: true, distortion: 0.16, highPass: 100 },
    alien: { label: "宇宙人", pitch: 7, speed: 1.03, tremolo: 0.35, echo: 0.28 },
    cave: { label: "洞窟", pitch: -1, speed: 0.96, echo: 0.46, reverb: 0.72 },
    telephone: { label: "電話", pitch: 0, speed: 1, highPass: 300, lowPass: 3400 },
    "slow-monster": { label: "スロー怪物", pitch: -9, speed: 0.72, lowPass: 5200 },
    hyper: { label: "ハイパー", pitch: 9, speed: 1.4 },
    reverse: { label: "逆再生", pitch: 0, speed: 1, reverse: true },
  });
  const RANDOM_KEYS = Object.freeze(Object.keys(PRESETS).filter((key) => key !== "normal"));
  const bufferCache = new WeakMap();
  const impulseCache = new WeakMap();
  const activeSessions = new Set();
  const diagnostics = { pitchMethod: "Granular OLA", activeNodes: 0, chain: "なし", preset: "—" };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const chance = (probability) => Math.random() < probability;

  function normalized(config) {
    return {
      label: config.label || "カスタム",
      pitch: clamp(config.pitch || 0, -12, 12),
      speed: clamp(config.speed || 1, 0.5, 2),
      echo: clamp(config.echo || 0, 0, 1),
      reverb: clamp(config.reverb || 0, 0, 1),
      robot: Boolean(config.robot),
      tremolo: clamp(config.tremolo || 0, 0, 1),
      lowPass: config.lowPass ? clamp(config.lowPass, 300, 18000) : 0,
      highPass: config.highPass ? clamp(config.highPass, 20, 4000) : 0,
      volume: clamp(config.volume ?? 1, 0.1, 1.5),
      reverse: Boolean(config.reverse),
      distortion: clamp(config.distortion || 0, 0, 1),
    };
  }

  function chaosConfig() {
    const config = {
      label: "カオス",
      pitch: Math.round(randomBetween(-9, 10)),
      speed: randomBetween(0.75, 1.4),
      echo: chance(0.45) ? randomBetween(0.18, 0.5) : 0,
      reverb: chance(0.3) ? randomBetween(0.2, 0.55) : 0,
      robot: chance(0.22),
      tremolo: chance(0.3) ? randomBetween(0.15, 0.4) : 0,
      lowPass: chance(0.2) ? randomBetween(2800, 9000) : 0,
      highPass: chance(0.15) ? randomBetween(120, 650) : 0,
      volume: randomBetween(0.78, 1.08),
      reverse: chance(0.1),
    };
    if (config.robot && config.tremolo) config.tremolo = 0;
    return normalized(config);
  }

  function applyEmotion(config, emotion) {
    const result = { ...config };
    if (emotion === "happy") {
      result.pitch += 2;
      result.speed *= 1.06;
    } else if (emotion === "angry") {
      result.pitch -= 2;
      result.volume *= 1.12;
      result.distortion = Math.max(result.distortion, 0.18);
    } else if (emotion === "sleepy") {
      result.pitch -= 3;
      result.speed *= 0.84;
    } else if (emotion === "panic") {
      result.pitch += 4;
      result.speed *= 1.16;
      result.tremolo = Math.max(result.tremolo, 0.3);
    }
    return normalized(result);
  }

  function resolvePreset(name, custom, emotion = "normal") {
    let key = name;
    let base;
    if (name === "random") {
      key = RANDOM_KEYS[Math.floor(Math.random() * RANDOM_KEYS.length)];
      base = PRESETS[key];
    } else if (name === "chaos") {
      base = chaosConfig();
    } else if (name === "custom") {
      base = { label: "カスタム", ...custom };
    } else {
      base = PRESETS[name] || PRESETS.parrot;
    }
    const resolved = applyEmotion(normalized(base), emotion);
    resolved.key = key;
    resolved.sourceMode = name;
    return resolved;
  }

  function cloneOrReverse(context, input, reverse) {
    const output = context.createBuffer(input.numberOfChannels, input.length, input.sampleRate);
    for (let channel = 0; channel < input.numberOfChannels; channel += 1) {
      const source = input.getChannelData(channel);
      const target = output.getChannelData(channel);
      if (reverse) {
        for (let index = 0; index < source.length; index += 1) target[index] = source[source.length - 1 - index];
      } else {
        target.set(source);
      }
    }
    return output;
  }

  function granularPitchShift(context, input, semitones) {
    if (Math.abs(semitones) < 0.01) return input;
    const ratio = Math.pow(2, semitones / 12);
    const output = context.createBuffer(input.numberOfChannels, input.length, input.sampleRate);
    const grainSize = input.sampleRate > 48000 ? 4096 : 2048;
    const hopSize = Math.floor(grainSize / 4);
    const windowValues = new Float32Array(grainSize);
    for (let index = 0; index < grainSize; index += 1) {
      windowValues[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (grainSize - 1));
    }

    for (let channel = 0; channel < input.numberOfChannels; channel += 1) {
      const source = input.getChannelData(channel);
      const target = output.getChannelData(channel);
      const weights = new Float32Array(input.length);
      for (let start = -grainSize; start < input.length; start += hopSize) {
        for (let offset = 0; offset < grainSize; offset += 1) {
          const outputIndex = start + offset;
          if (outputIndex < 0 || outputIndex >= input.length) continue;
          const sourcePosition = start + offset * ratio;
          if (sourcePosition < 0 || sourcePosition >= input.length - 1) continue;
          const left = Math.floor(sourcePosition);
          const fraction = sourcePosition - left;
          const sample = source[left] * (1 - fraction) + source[left + 1] * fraction;
          const weight = windowValues[offset];
          target[outputIndex] += sample * weight;
          weights[outputIndex] += weight;
        }
      }
      for (let index = 0; index < target.length; index += 1) {
        if (weights[index] > 0.001) target[index] /= weights[index];
      }
    }
    return output;
  }

  function prepareBuffer(context, input, config) {
    const key = `${config.reverse ? 1 : 0}:${config.pitch.toFixed(2)}`;
    let entries = bufferCache.get(input);
    if (!entries) {
      entries = new Map();
      bufferCache.set(input, entries);
    }
    if (entries.has(key)) return entries.get(key);
    let output = config.reverse ? cloneOrReverse(context, input, true) : input;
    output = granularPitchShift(context, output, config.pitch);
    entries.set(key, output);
    return output;
  }

  function createDistortionCurve(amount) {
    const samples = 1024;
    const curve = new Float32Array(samples);
    const strength = 10 + amount * 80;
    for (let index = 0; index < samples; index += 1) {
      const x = (index * 2) / (samples - 1) - 1;
      curve[index] = ((3 + strength) * x * 20 * Math.PI / 180) / (Math.PI + strength * Math.abs(x));
    }
    return curve;
  }

  function getImpulse(context) {
    if (impulseCache.has(context)) return impulseCache.get(context);
    const duration = 1.5;
    const impulse = context.createBuffer(2, Math.floor(context.sampleRate * duration), context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      let seed = channel + 19;
      for (let index = 0; index < data.length; index += 1) {
        seed = (seed * 16807) % 2147483647;
        const noise = (seed / 2147483647) * 2 - 1;
        data[index] = noise * Math.pow(1 - index / data.length, 2.6);
      }
    }
    impulseCache.set(context, impulse);
    return impulse;
  }

  async function applyEffect(context, audioBuffer, rawConfig, options = {}) {
    const config = normalized({ ...rawConfig, pitch: (rawConfig.pitch || 0) + (options.pitchOffset || 0) });
    const buffer = prepareBuffer(context, audioBuffer, config);
    const nodes = [];
    const oscillators = [];
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = config.speed;
    nodes.push(source);
    let current = source;
    const chain = [config.pitch ? `Pitch ${config.pitch > 0 ? "+" : ""}${config.pitch}st` : "Pitch bypass", `Speed ${config.speed.toFixed(2)}x`];

    const addFilter = (type, frequency) => {
      if (!frequency) return;
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = 0.7;
      current.connect(filter);
      current = filter;
      nodes.push(filter);
      chain.push(`${type} ${Math.round(frequency)}Hz`);
    };
    addFilter("highpass", config.highPass);
    addFilter("lowpass", config.lowPass);

    if (config.robot) {
      const ring = context.createGain();
      ring.gain.value = 0;
      const oscillator = context.createOscillator();
      const depth = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 38;
      depth.gain.value = 0.82;
      oscillator.connect(depth).connect(ring.gain);
      current.connect(ring);
      current = ring;
      nodes.push(ring, depth);
      oscillators.push(oscillator);
      chain.push("Ring modulation");
    }

    if (config.distortion) {
      const shaper = context.createWaveShaper();
      shaper.curve = createDistortionCurve(config.distortion);
      shaper.oversample = "2x";
      current.connect(shaper);
      current = shaper;
      nodes.push(shaper);
      chain.push("Distortion");
    }

    if (config.tremolo) {
      const tremolo = context.createGain();
      tremolo.gain.value = 0.72;
      const oscillator = context.createOscillator();
      const depth = context.createGain();
      oscillator.frequency.value = 6.2;
      depth.gain.value = Math.min(0.65, config.tremolo * 0.7);
      oscillator.connect(depth).connect(tremolo.gain);
      current.connect(tremolo);
      current = tremolo;
      nodes.push(tremolo, depth);
      oscillators.push(oscillator);
      chain.push("Tremolo");
    }

    const mix = context.createGain();
    current.connect(mix);
    nodes.push(mix);
    let tailSeconds = 0.06;

    if (config.echo) {
      const delay = context.createDelay(1.5);
      const feedback = context.createGain();
      const wet = context.createGain();
      delay.delayTime.value = 0.25;
      feedback.gain.value = Math.min(0.62, 0.18 + config.echo * 0.46);
      wet.gain.value = config.echo * 0.72;
      current.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(mix);
      nodes.push(delay, feedback, wet);
      tailSeconds = Math.max(tailSeconds, 0.5 + config.echo * 1.2);
      chain.push("Echo");
    }

    if (config.reverb) {
      const convolver = context.createConvolver();
      const wet = context.createGain();
      convolver.buffer = getImpulse(context);
      wet.gain.value = config.reverb * 0.72;
      current.connect(convolver).connect(wet).connect(mix);
      nodes.push(convolver, wet);
      tailSeconds = Math.max(tailSeconds, 1.55);
      chain.push("Reverb");
    }

    let output = mix;
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = clamp(options.pan || 0, -1, 1);
      output.connect(panner);
      output = panner;
      nodes.push(panner);
      if (options.pan) chain.push(`Pan ${options.pan.toFixed(1)}`);
    }
    const gain = context.createGain();
    gain.gain.value = config.volume * clamp(options.volume ?? 1, 0, 1.5);
    output.connect(gain).connect(context.destination);
    nodes.push(gain);
    chain.push("Gain");

    let finish;
    const finished = new Promise((resolve) => { finish = resolve; });
    let settled = false;
    let cleanupTimer = 0;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(cleanupTimer);
      oscillators.forEach((oscillator) => {
        try { oscillator.stop(); } catch (_) { /* stopped */ }
        try { oscillator.disconnect(); } catch (_) { /* disconnected */ }
      });
      nodes.forEach((node) => { try { node.disconnect(); } catch (_) { /* disconnected */ } });
      activeSessions.delete(session);
      diagnostics.activeNodes = Math.max(0, diagnostics.activeNodes - nodes.length - oscillators.length);
      finish();
    };
    const session = {
      stop() {
        try { source.stop(); } catch (_) { /* stopped */ }
        cleanup();
      },
    };
    activeSessions.add(session);
    diagnostics.activeNodes += nodes.length + oscillators.length;
    diagnostics.chain = chain.join(" → ");
    diagnostics.preset = config.label;
    oscillators.forEach((oscillator) => oscillator.start());
    source.onended = () => { cleanupTimer = setTimeout(cleanup, tailSeconds * 1000); };
    source.start();
    await finished;
    return { chain: diagnostics.chain, nodeCount: nodes.length + oscillators.length };
  }

  function stopAll() {
    [...activeSessions].forEach((session) => session.stop());
  }

  function playReaction(context, kind = "before") {
    return new Promise((resolve) => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "before" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(kind === "before" ? 880 : 720, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === "before" ? 1250 : 420, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
      oscillator.connect(gain).connect(context.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); resolve(); };
      oscillator.start(now);
      oscillator.stop(now + 0.18);
    });
  }

  window.OumuEffects = {
    PRESETS,
    RANDOM_KEYS,
    resolvePreset,
    applyEffect,
    playReaction,
    stopAll,
    getDiagnostics: () => ({ ...diagnostics }),
  };
})();
