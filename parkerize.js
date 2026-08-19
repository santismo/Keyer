/*
 * Parkerize: original bebop harmony, solo generation, and MIDI export.
 *
 * The generator uses aggregate harmonic/rhythmic tendencies instead of
 * replaying source phrases.  Its baked-in priors were distilled from the
 * Charlie Parker study corpus, then the Standards UI augments them with
 * transition counts learned from the loaded jazz-chart library.
 */
(function attachKeyerParkerize(root, factory) {
  var theory = root && root.KeyerJazzTheory;
  if (!theory && typeof module === 'object' && module.exports) theory = require('./jazz-theory.js');
  var api = factory(theory);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KeyerParkerize = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildKeyerParkerize(Theory) {
  'use strict';

  var PPQ = 480;
  var SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var FLAT_KEYS = new Set([1, 3, 5, 8, 10]);
  var KEY_FIFTHS = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6 };
  var TITLE_LEFT = ['Afterimage', 'Birdlight', 'Chromatic', 'Copper', 'Crosswind', 'Midnight', 'Neon', 'Sidecar', 'Velvet', 'Wayward', 'Blue', 'Mercury'];
  var TITLE_RIGHT = ['Circuit', 'Comet', 'Ledger', 'Mosaic', 'Relay', 'Riddle', 'Signal', 'Stairway', 'Thread', 'Transit', 'Whisper', 'Window'];

  // Aggregate transition priors. These are functional summaries, not copied
  // melodies or full progressions from any transcription.
  var PARKER_TRANSITION_PRIORS = {
    '0:maj': ['9:dom', '1:dim', '2:min', '4:min', '6:hdim', '4:dom', '5:maj', '8:dom'],
    '0:min': ['2:hdim', '5:min', '7:dom', '9:hdim'],
    '1:dim': ['2:min', '4:min', '0:maj'],
    '2:min': ['7:dom', '7:dom', '11:hdim', '6:dim', '5:maj'],
    '2:hdim': ['7:dom', '7:alt'],
    '3:min': ['8:dom', '9:dom', '2:min'],
    '3:dom': ['2:min', '6:dom', '0:maj'],
    '4:min': ['9:dom', '2:min', '10:dom'],
    '4:dom': ['9:min', '9:dom', '2:min'],
    '5:maj': ['5:min', '11:hdim', '0:maj', '10:dom'],
    '5:min': ['10:dom', '0:maj', '4:min'],
    '6:dim': ['7:dom', '4:min', '2:min'],
    '6:hdim': ['11:dom', '11:alt', '4:min'],
    '7:dom': ['0:maj', '0:maj', '9:min', '1:dim', '8:dom'],
    '8:dom': ['2:min', '1:dim', '0:maj'],
    '9:min': ['2:min', '4:dom', '6:hdim'],
    '9:dom': ['2:min', '2:min', '5:maj', '6:hdim'],
    '10:dom': ['0:maj', '4:min', '3:dom'],
    '11:hdim': ['4:dom', '4:alt'],
    '11:dom': ['4:min', '4:dom']
  };

  var BAR_CELLS = [
    { min: 1, weight: 7, chords: [[0, 'maj']] },
    { min: 1, weight: 6, chords: [[2, 'min'], [7, 'dom']] },
    { min: 1, weight: 4, chords: [[9, 'dom'], [2, 'min']] },
    { min: 1, weight: 3, chords: [[5, 'maj']] },
    { min: 2, weight: 6, chords: [[4, 'min'], [9, 'dom']] },
    { min: 2, weight: 5, chords: [[0, 'maj'], [9, 'dom']] },
    { min: 2, weight: 4, chords: [[1, 'dim'], [2, 'min']] },
    { min: 2, weight: 4, chords: [[5, 'min'], [10, 'dom']] },
    { min: 3, weight: 5, chords: [[6, 'hdim'], [11, 'dom']] },
    { min: 3, weight: 5, chords: [[4, 'min'], [3, 'dom']] },
    { min: 3, weight: 4, chords: [[0, 'maj'], [8, 'dom']] },
    { min: 3, weight: 4, chords: [[11, 'hdim'], [4, 'dom']] },
    { min: 4, weight: 5, chords: [[3, 'dom'], [2, 'min']] },
    { min: 4, weight: 4, chords: [[8, 'dom'], [1, 'dim']] },
    { min: 4, weight: 4, chords: [[6, 'dim'], [7, 'dom']] },
    { min: 4, weight: 3, chords: [[0, 'maj'], [4, 'dom']] },
    { min: 5, weight: 4, chords: [[10, 'dom'], [4, 'min']] },
    { min: 5, weight: 4, chords: [[2, 'hdim'], [7, 'alt']] },
    { min: 5, weight: 3, chords: [[5, 'maj'], [11, 'hdim']] },
    { min: 5, weight: 3, chords: [[9, 'dom'], [3, 'dom']] }
  ];

  var RHYTHM_STEPS = {
    1: [[1, 8], [0.5, 3], [1.5, 2], [2, 2]],
    2: [[0.5, 8], [1, 4], [0.75, 2], [1.5, 1]],
    3: [[0.5, 9], [0.333333, 3], [0.666667, 3], [0.25, 2], [1, 2]],
    4: [[0.5, 7], [0.25, 6], [0.333333, 3], [0.75, 2], [1, 1]],
    5: [[0.25, 8], [0.5, 6], [0.333333, 4], [0.166667, 2], [0.75, 1]]
  };
  var INTERVAL_PRIORS = {
    1: [[1, 5], [-1, 5], [2, 7], [-2, 7], [3, 2], [-3, 2]],
    2: [[1, 7], [-1, 7], [2, 8], [-2, 8], [3, 4], [-3, 4], [4, 2], [-4, 2]],
    3: [[1, 8], [-1, 8], [2, 8], [-2, 8], [3, 5], [-3, 5], [4, 3], [-4, 3], [5, 2], [-5, 2]],
    4: [[1, 8], [-1, 8], [2, 7], [-2, 7], [3, 5], [-3, 5], [4, 4], [-4, 4], [5, 3], [-5, 3], [7, 2], [-7, 2]],
    5: [[1, 9], [-1, 9], [2, 7], [-2, 7], [3, 6], [-3, 6], [4, 5], [-4, 5], [5, 4], [-5, 4], [7, 3], [-7, 3], [9, 1], [-9, 1]]
  };

  function mod(value, base) {
    var divisor = base || 12;
    return ((value % divisor) + divisor) % divisor;
  }

  function clampLevel(value) {
    return Math.max(1, Math.min(5, Math.round(Number(value) || 3)));
  }

  function hashSeed(value) {
    var text = String(value == null ? '' : value);
    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    var state = hashSeed(seed) || 0x6d2b79f5;
    return function random() {
      state += 0x6d2b79f5;
      var value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function pick(values, random) {
    return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  }

  function weightedPick(entries, random, weightAt) {
    var total = entries.reduce(function totalWeight(sum, entry) { return sum + Math.max(0, weightAt(entry)); }, 0);
    if (!entries.length) return null;
    if (!total) return pick(entries, random);
    var cursor = random() * total;
    for (var index = 0; index < entries.length; index += 1) {
      cursor -= Math.max(0, weightAt(entries[index]));
      if (cursor <= 0) return entries[index];
    }
    return entries[entries.length - 1];
  }

  function pitchClass(value) {
    var match = String(value || '').replace(/♭/g, 'b').replace(/♯/g, '#').match(/^([A-Ga-g])([#b]?)/);
    if (!match) return null;
    var naturals = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    return mod(naturals[match[1].toUpperCase()] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0));
  }

  function canonicalFamily(value) {
    var family = String(value || '').toLowerCase();
    if (/alt/.test(family)) return 'alt';
    if (/half|hdim|m7b5/.test(family)) return 'hdim';
    if (/dim|^o$/.test(family)) return 'dim';
    if (/dom|7|aug/.test(family)) return 'dom';
    if (/min|minor|^-/.test(family)) return 'min';
    return 'maj';
  }

  function chordToken(rawChord, tonicPc) {
    if (!rawChord || tonicPc == null) return null;
    var parsed = null;
    if (rawChord.root != null && Number.isFinite(Number(rawChord.root))) parsed = rawChord;
    else if (Theory && typeof Theory.parseChordSymbol === 'function') {
      parsed = Theory.parseChordSymbol(rawChord.resolvedRaw || rawChord.raw || rawChord.symbol || rawChord.text || String(rawChord));
    }
    var rootPc = parsed && Number.isFinite(Number(parsed.root)) ? Number(parsed.root) : pitchClass(rawChord.root || rawChord.rootText);
    if (rootPc == null) return null;
    var family = canonicalFamily(parsed && (parsed.family || parsed.quality && parsed.quality.family) || rawChord.qualityFamily || rawChord.quality);
    return { degree: mod(rootPc - tonicPc), family: family };
  }

  function tokenKey(token) {
    return token ? mod(token.degree) + ':' + canonicalFamily(token.family) : '';
  }

  function learnHarmonyCorpus(songs) {
    var transitions = Object.create(null);
    var songCount = 0;
    var chordCount = 0;
    (Array.isArray(songs) ? songs : []).forEach(function inspectSong(song) {
      var tonic = pitchClass(song && song.key);
      if (tonic == null || !Array.isArray(song.bars)) return;
      var tokens = [];
      song.bars.forEach(function inspectBar(bar) {
        var chords = [].concat(Array.isArray(bar && bar.chords) ? bar.chords : [], Array.isArray(bar && bar.overflowChords) ? bar.overflowChords : []);
        chords.forEach(function inspectChord(chord) {
          if (chord && (chord.isAlternateOnly || chord.isNoChord || chord.isPause)) return;
          var token = chordToken(chord, tonic);
          if (token) tokens.push(token);
        });
      });
      if (tokens.length < 4) return;
      songCount += 1;
      chordCount += tokens.length;
      for (var index = 0; index < tokens.length - 1; index += 1) {
        var from = tokenKey(tokens[index]);
        var to = tokenKey(tokens[index + 1]);
        if (!transitions[from]) transitions[from] = Object.create(null);
        transitions[from][to] = (transitions[from][to] || 0) + 1;
      }
    });
    Object.keys(transitions).forEach(function compact(from) {
      var ranked = Object.keys(transitions[from]).sort(function byFrequency(left, right) {
        return transitions[from][right] - transitions[from][left];
      }).slice(0, 10);
      var next = Object.create(null);
      ranked.forEach(function retain(key) { next[key] = transitions[from][key]; });
      transitions[from] = next;
    });
    return { songCount: songCount, chordCount: chordCount, transitions: transitions };
  }

  function transitionOptions(token, corpus) {
    var key = tokenKey(token);
    var counts = Object.create(null);
    (PARKER_TRANSITION_PRIORS[key] || []).forEach(function addPrior(next) { counts[next] = (counts[next] || 0) + 8; });
    var learned = corpus && corpus.transitions && corpus.transitions[key];
    Object.keys(learned || {}).forEach(function addLearned(next) { counts[next] = (counts[next] || 0) + Math.min(30, learned[next]); });
    return Object.keys(counts).map(function create(next) {
      var parts = next.split(':');
      return { token: { degree: Number(parts[0]), family: parts[1] }, weight: counts[next] };
    });
  }

  function corpusNext(token, corpus, random) {
    var options = transitionOptions(token, corpus);
    var selected = weightedPick(options, random, function weight(entry) { return entry.weight; });
    return selected && selected.token;
  }

  function chordName(rootPc, family, complexity, random, preferFlats) {
    var name = (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod(rootPc)];
    var suffix = '';
    if (family === 'maj') suffix = complexity >= 3 && random() < 0.34 ? 'maj9' : random() < 0.28 ? '6' : 'maj7';
    else if (family === 'min') suffix = complexity >= 4 && random() < 0.2 ? 'm6' : 'm7';
    else if (family === 'hdim') suffix = 'm7b5';
    else if (family === 'dim') suffix = 'dim7';
    else if (family === 'alt') suffix = complexity >= 4 && random() < 0.55 ? '7alt' : '7b9';
    else if (complexity >= 5 && random() < 0.28) suffix = pick(['7alt', '7b9', '7#5'], random);
    else if (complexity >= 3 && random() < 0.24) suffix = pick(['9', '7b9', '13'], random);
    else suffix = '7';
    return name + suffix;
  }

  function formShape(complexity, random) {
    if (complexity === 1) return [8, 8, 8, 8];
    var sectionCount = complexity === 2 ? 4 : complexity === 3 ? 4 + (random() < 0.3 ? 1 : 0) : complexity === 4 ? 4 + (random() < 0.55 ? 1 : 0) : 5;
    var lengths = [];
    var pools = complexity === 2 ? [6, 8] : complexity === 3 ? [6, 7, 8, 9] : complexity === 4 ? [5, 6, 7, 8, 9] : [5, 6, 7, 8, 9, 10];
    for (var index = 0; index < sectionCount; index += 1) lengths.push(pick(pools, random));
    return lengths;
  }

  function sectionKeyOffsets(complexity, count, random) {
    var choices = complexity === 1 ? [0]
      : complexity === 2 ? [0, 0, 5, 9]
      : complexity === 3 ? [0, 2, 3, 5, 9]
      : complexity === 4 ? [0, 1, 2, 3, 5, 8, 9]
      : [0, 1, 2, 3, 5, 6, 8, 9, 10];
    var offsets = [0];
    for (var index = 1; index < count; index += 1) {
      if (index === count - 1 && random() < 0.55) offsets.push(0);
      else offsets.push(pick(choices, random));
    }
    return offsets;
  }

  function generatedTitle(seedHash) {
    var random = seededRandom('title:' + seedHash);
    return pick(TITLE_LEFT, random) + ' ' + pick(TITLE_RIGHT, random) + ' ' + String(seedHash % 997 + 1).padStart(3, '0');
  }

  function generateChart(options) {
    var settings = options || {};
    var complexity = clampLevel(settings.complexity);
    var seed = settings.seed == null ? Date.now() + ':' + Math.random() : settings.seed;
    var seedHash = hashSeed(seed);
    var random = seededRandom('chart:' + seed);
    var keyPc = settings.key == null ? pick([0, 1, 2, 3, 5, 6, 7, 8, 9, 10], random) : pitchClass(settings.key);
    if (keyPc == null) keyPc = 0;
    var preferFlats = settings.preferFlats == null ? FLAT_KEYS.has(keyPc) : Boolean(settings.preferFlats);
    var key = (preferFlats ? FLAT_NAMES : SHARP_NAMES)[keyPc];
    var lengths = formShape(complexity, random);
    var offsets = sectionKeyOffsets(complexity, lengths.length, random);
    var bars = [];
    var lastLocalToken = { degree: 0, family: 'maj' };

    lengths.forEach(function buildSection(length, sectionIndex) {
      var localOffset = offsets[sectionIndex];
      var nextOffset = offsets[sectionIndex + 1] == null ? 0 : offsets[sectionIndex + 1];
      var label = String.fromCharCode(65 + sectionIndex);
      for (var barIndex = 0; barIndex < length; barIndex += 1) {
        var remaining = length - barIndex;
        var localTokens;
        if (remaining === 2) {
          localTokens = [{ degree: mod(nextOffset - localOffset + 2), family: 'min' }, { degree: mod(nextOffset - localOffset + 7), family: complexity >= 4 ? 'alt' : 'dom' }];
        } else if (remaining === 1) {
          localTokens = sectionIndex === lengths.length - 1
            ? [{ degree: mod(-localOffset), family: 'maj' }]
            : [{ degree: mod(nextOffset - localOffset), family: 'maj' }, { degree: mod(nextOffset - localOffset + 9), family: 'dom' }];
        } else if (barIndex === 0) {
          localTokens = [{ degree: 0, family: 'maj' }];
        } else {
          var candidates = BAR_CELLS.filter(function available(cell) { return cell.min <= complexity; });
          var cell = weightedPick(candidates, random, function weight(entry) { return entry.weight; });
          localTokens = cell.chords.map(function clone(parts) { return { degree: parts[0], family: parts[1] }; });
          if (complexity >= 2 && random() < 0.32) {
            var learned = corpusNext(lastLocalToken, settings.corpus, random);
            if (learned) localTokens[localTokens.length - 1] = learned;
          }
        }
        // Higher chart complexity means denser harmonic rhythm as well as
        // farther key centers; it never means an arbitrary pile of chords.
        if (complexity >= 4 && localTokens.length === 1 && remaining > 2 && random() < 0.34) {
          var continuation = corpusNext(localTokens[0], settings.corpus, random);
          if (continuation) localTokens.push(continuation);
        }
        lastLocalToken = localTokens[localTokens.length - 1];
        var chords = localTokens.slice(0, 3).map(function renderToken(token) {
          return { raw: chordName(keyPc + localOffset + token.degree, token.family, complexity, random, preferFlats) };
        });
        bars.push({
          index: bars.length,
          chords: chords,
          overflowChords: [],
          section: label,
          sectionMarker: barIndex === 0 ? label : null,
          timeSignature: { beats: 4, beatUnit: 4 },
          timeSignatureChange: bars.length === 0 ? { beats: 4, beatUnit: 4 } : null,
          annotations: [],
          comments: [],
          repeatStart: false,
          repeatEnd: false,
          noChord: false,
          pause: false
        });
      }
    });

    var bpm = Math.round(Number(settings.bpm) || (complexity <= 2 ? 156 + random() * 28 : 174 + random() * 42));
    return {
      title: generatedTitle(seedHash),
      composer: 'Parkerize generator',
      style: 'Original bebop · chart complexity ' + complexity,
      key: key,
      bpm: bpm,
      bars: bars,
      playbackOrder: bars.map(function barIndex(_, index) { return index; }),
      parkerizeGenerated: true,
      parkerizeSeed: String(seed),
      parkerizeChartComplexity: complexity,
      parkerizeCorpusSongs: Number(settings.corpus && settings.corpus.songCount) || 0
    };
  }

  function timingForEvent(event) {
    var start = Number(event && (event.playbackStartBeat != null ? event.playbackStartBeat : event.startBeat));
    var end = Number(event && (event.playbackEndBeat != null ? event.playbackEndBeat : event.endBeat));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    var chord = event.chord || event.parsed;
    if (!chord && Theory && typeof Theory.parseChordSymbol === 'function') chord = Theory.parseChordSymbol(event.raw || event.symbol || '');
    if (!chord || !Number.isFinite(Number(chord.root))) return null;
    return { start: start, end: end, chord: chord };
  }

  function chordPitchPools(chord) {
    var rootPc = mod(Number(chord.root));
    var family = canonicalFamily(chord.family || chord.quality && chord.quality.family || chord.suffix);
    var intervals = Array.isArray(chord.intervals) && chord.intervals.length ? chord.intervals.map(function pc(value) { return mod(value); }) : family === 'min' ? [0, 3, 7, 10] : family === 'hdim' ? [0, 3, 6, 10] : family === 'dim' ? [0, 3, 6, 9] : family === 'dom' || family === 'alt' ? [0, 4, 7, 10] : [0, 4, 7, 11];
    var scale = family === 'min' ? [0, 2, 3, 5, 7, 9, 10]
      : family === 'hdim' ? [0, 2, 3, 5, 6, 8, 10]
      : family === 'dim' ? [0, 2, 3, 5, 6, 8, 9, 11]
      : family === 'alt' ? [0, 1, 3, 4, 6, 8, 10]
      : family === 'dom' ? [0, 2, 4, 5, 7, 9, 10]
      : [0, 2, 4, 5, 7, 9, 11];
    var chordPcs = intervals.map(function transpose(value) { return mod(rootPc + value); });
    var guideIntervals = intervals.filter(function guide(value) { return [3, 4, 10, 11].indexOf(mod(value)) >= 0; });
    return {
      chord: chordPcs,
      guides: (guideIntervals.length ? guideIntervals : intervals.slice(0, 2)).map(function transpose(value) { return mod(rootPc + value); }),
      scale: scale.map(function transpose(value) { return mod(rootPc + value); })
    };
  }

  function nearestMidi(pc, target, low, high) {
    var candidates = [];
    for (var midi = low; midi <= high; midi += 1) if (mod(midi) === mod(pc)) candidates.push(midi);
    return candidates.reduce(function nearest(best, value) {
      return best == null || Math.abs(value - target) < Math.abs(best - target) ? value : best;
    }, null);
  }

  function weightedNumber(entries, random) {
    var selected = weightedPick(entries, random, function weight(entry) { return entry[1]; });
    return selected ? selected[0] : 1;
  }

  function midiObject(title, notes, bpm, durationBeats, ppq) {
    var microseconds = Math.round(60000000 / bpm);
    var mapped = notes.map(function mapNote(note, index) {
      var tick = Math.max(0, Math.round(note.startBeat * ppq));
      var endTick = Math.max(tick + 1, Math.round(note.endBeat * ppq));
      return {
        id: 'parkerize-' + index,
        trackIndex: 0,
        trackName: 'Parkerize Solo',
        channel: 1,
        midi: note.midi,
        velocity: note.velocity,
        tick: tick,
        durationTicks: endTick - tick,
        endTick: endTick,
        time: note.startBeat * 60 / bpm,
        duration: (note.endBeat - note.startBeat) * 60 / bpm
      };
    });
    return {
      fileName: title + '.mid',
      title: title,
      format: 1,
      ppq: ppq,
      durationTicks: Math.round(durationBeats * ppq),
      duration: durationBeats * 60 / bpm,
      tempos: [{ tick: 0, time: 0, bpm: bpm, mpq: microseconds }],
      timeSignatures: [{ tick: 0, time: 0, numerator: 4, denominator: 4, clocksPerClick: 24, thirtySecondNotes: 8 }],
      keySignatures: [],
      markers: [],
      tracks: [{ index: 0, name: 'Parkerize Solo', channels: [1], programs: { 1: 65 }, notes: mapped }],
      sourceFormat: 'parkerize'
    };
  }

  function generateSolo(options) {
    var settings = options || {};
    var complexity = clampLevel(settings.complexity);
    var seed = settings.seed == null ? Date.now() + ':' + Math.random() : settings.seed;
    var random = seededRandom('solo:' + seed);
    var ppq = Math.max(96, Math.round(Number(settings.ppq) || PPQ));
    var bpm = Math.max(40, Math.min(300, Math.round(Number(settings.bpm) || 180)));
    var events = (Array.isArray(settings.events) ? settings.events : []).map(timingForEvent).filter(Boolean).sort(function chronological(left, right) { return left.start - right.start; });
    if (!events.length) throw new Error('Parkerize needs a readable chord timeline.');
    var chartEnd = events.reduce(function latest(value, event) { return Math.max(value, event.end); }, 0);
    var notes = [];
    var previousMidi = 70 + Math.floor(random() * 5);
    var pendingResolution = null;
    var restChance = [0, 0.31, 0.23, 0.15, 0.09, 0.055][complexity];
    var chromaticChance = [0, 0.025, 0.06, 0.12, 0.21, 0.29][complexity];

    events.forEach(function improvise(event, eventIndex) {
      var pools = chordPitchPools(event.chord);
      var cursor = event.start;
      while (cursor < event.end - 0.08) {
        var step = weightedNumber(RHYTHM_STEPS[complexity], random);
        step = Math.max(0.125, Math.min(step, event.end - cursor));
        var onBeat = Math.abs(cursor - Math.round(cursor)) < 0.055;
        var phraseBreak = eventIndex > 0 && Math.abs(mod(cursor, 8)) < 0.04 && random() < 0.5;
        if (phraseBreak || random() < restChance) {
          cursor += step;
          continue;
        }
        var pc;
        if (pendingResolution != null) {
          pc = pendingResolution;
          pendingResolution = null;
        } else if (!onBeat && random() < chromaticChance) {
          var target = pick(random() < 0.7 ? pools.guides : pools.chord, random);
          pc = mod(target + (random() < 0.5 ? -1 : 1));
          pendingResolution = target;
        } else {
          var pool = onBeat || random() < 0.48 ? pools.chord : pools.scale;
          if (onBeat && random() < 0.55) pool = pools.guides;
          pc = pick(pool, random);
        }
        var interval = weightedNumber(INTERVAL_PRIORS[complexity], random);
        var contour = 71 + Math.sin((cursor / Math.max(8, chartEnd)) * Math.PI * (2 + complexity * 0.35)) * (3 + complexity * 0.7);
        var desired = previousMidi + interval;
        desired = desired * 0.68 + contour * 0.32;
        var midi = nearestMidi(pc, desired, 55, 91);
        if (midi == null) midi = 70;
        if (midi === previousMidi && random() < 0.7) {
          var alternate = nearestMidi(pc, desired + (random() < 0.5 ? -12 : 12), 55, 91);
          if (alternate != null) midi = alternate;
        }
        var duration = Math.max(0.08, Math.min(event.end - cursor, step * (complexity >= 4 ? 0.86 : 0.8)));
        notes.push({
          midi: midi,
          startBeat: Number(cursor.toFixed(6)),
          endBeat: Number((cursor + duration).toFixed(6)),
          durationBeats: Number(duration.toFixed(6)),
          velocity: Math.max(0.46, Math.min(0.96, (onBeat ? 0.75 : 0.64) + random() * 0.16))
        });
        previousMidi = midi;
        cursor += step;
      }
    });

    // Resolve near the end so the generated line always spans a complete
    // form and can be looped as one solo-study chorus by Standards.
    var finalEvent = events[events.length - 1];
    var finalPools = chordPitchPools(finalEvent.chord);
    var finalStart = Math.max(finalEvent.start, chartEnd - (complexity >= 4 ? 0.5 : 1));
    var last = notes[notes.length - 1];
    if (!last || last.endBeat < chartEnd - 0.12) {
      var finalPc = pick(finalPools.guides.length ? finalPools.guides : finalPools.chord, random);
      var finalMidi = nearestMidi(finalPc, previousMidi, 55, 91);
      notes.push({ midi: finalMidi, startBeat: finalStart, endBeat: Math.max(finalStart + 0.1, chartEnd - 0.02), durationBeats: Math.max(0.1, chartEnd - 0.02 - finalStart), velocity: 0.82 });
    }
    notes.sort(function chronological(left, right) { return left.startBeat - right.startBeat || left.midi - right.midi; });
    var title = String(settings.title || 'Parkerize Take');
    return {
      title: title,
      complexity: complexity,
      seed: String(seed),
      notes: notes,
      durationBeats: chartEnd,
      midi: midiObject(title, notes, bpm, chartEnd, ppq)
    };
  }

  function variableLength(value) {
    var number = Math.max(0, Math.round(Number(value) || 0));
    var bytes = [number & 0x7f];
    while ((number >>= 7)) bytes.unshift((number & 0x7f) | 0x80);
    return bytes;
  }

  function textBytes(value) {
    var text = String(value || '');
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
    return Array.from(unescape(encodeURIComponent(text))).map(function code(char) { return char.charCodeAt(0); });
  }

  function metaEvent(type, payload) {
    return [0xff, type].concat(variableLength(payload.length), payload);
  }

  function chunk(tag, payload) {
    var length = payload.length;
    return textBytes(tag).concat([(length >>> 24) & 255, (length >>> 16) & 255, (length >>> 8) & 255, length & 255], payload);
  }

  function timedTrack(events, endTick) {
    events.sort(function eventOrder(left, right) { return left.tick - right.tick || left.priority - right.priority; });
    var payload = [];
    var previousTick = 0;
    events.forEach(function write(event) {
      payload.push.apply(payload, variableLength(Math.max(0, event.tick - previousTick)));
      payload.push.apply(payload, event.bytes);
      previousTick = event.tick;
    });
    payload.push.apply(payload, variableLength(Math.max(0, endTick - previousTick)));
    payload.push.apply(payload, [0xff, 0x2f, 0x00]);
    return chunk('MTrk', payload);
  }

  function exportMidi(options) {
    var settings = options || {};
    var ppq = Math.max(96, Math.round(Number(settings.ppq) || PPQ));
    var bpm = Math.max(40, Math.min(300, Math.round(Number(settings.bpm) || 180)));
    var events = (Array.isArray(settings.events) ? settings.events : []).map(timingForEvent).filter(Boolean).sort(function chronological(left, right) { return left.start - right.start; });
    var notes = Array.isArray(settings.notes) ? settings.notes : [];
    if (!events.length) throw new Error('There are no chord events to export.');
    if (!notes.length) throw new Error('There is no generated solo to export.');
    var durationBeats = Math.max(events[events.length - 1].end, notes.reduce(function latest(value, note) { return Math.max(value, Number(note.endBeat) || 0); }, 0));
    var endTick = Math.max(1, Math.round(durationBeats * ppq));
    var title = String(settings.title || 'Parkerize Take');
    var conductor = [
      { tick: 0, priority: 0, bytes: metaEvent(0x03, textBytes(title + ' · Chords')) },
      { tick: 0, priority: 1, bytes: metaEvent(0x01, textBytes('Generated by Keyer Parkerize from aggregate bebop models')) },
      { tick: 0, priority: 2, bytes: metaEvent(0x51, [(Math.round(60000000 / bpm) >>> 16) & 255, (Math.round(60000000 / bpm) >>> 8) & 255, Math.round(60000000 / bpm) & 255]) },
      { tick: 0, priority: 3, bytes: metaEvent(0x58, [4, 2, 24, 8]) }
    ];
    var fifths = KEY_FIFTHS[String(settings.key || '').replace(/♭/g, 'b').replace(/♯/g, '#')];
    if (Number.isFinite(fifths)) conductor.push({ tick: 0, priority: 4, bytes: metaEvent(0x59, [fifths < 0 ? 256 + fifths : fifths, 0]) });
    var lastMarker = '';
    events.forEach(function chordMarker(event, index) {
      var raw = String(event.chord.raw || event.chord.display || event.chord.symbol || 'Chord');
      var tick = Math.max(0, Math.round(event.start * ppq));
      var markerKey = tick + ':' + raw;
      if (markerKey === lastMarker) return;
      lastMarker = markerKey;
      conductor.push({ tick: tick, priority: 10 + index, bytes: metaEvent(0x06, textBytes(raw)) });
    });

    var solo = [
      { tick: 0, priority: 0, bytes: metaEvent(0x03, textBytes('Parkerize Solo')) },
      { tick: 0, priority: 1, bytes: [0xc0, 65] }
    ];
    notes.forEach(function noteEvents(note, index) {
      var tick = Math.max(0, Math.round(Number(note.startBeat) * ppq));
      var end = Math.max(tick + 1, Math.round(Number(note.endBeat) * ppq));
      var midi = Math.max(0, Math.min(127, Math.round(Number(note.midi) || 60)));
      var velocity = Math.max(1, Math.min(127, Math.round((Number(note.velocity) || 0.76) * 127)));
      solo.push({ tick: tick, priority: 20 + index * 2 + 1, bytes: [0x90, midi, velocity] });
      solo.push({ tick: end, priority: 20 + index * 2, bytes: [0x80, midi, 0] });
    });

    var header = chunk('MThd', [0, 1, 0, 2, (ppq >>> 8) & 255, ppq & 255]);
    return new Uint8Array(header.concat(timedTrack(conductor, endTick), timedTrack(solo, endTick)));
  }

  function fileNameForTitle(title) {
    var safe = String(title || 'Parkerize Take').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return (safe || 'parkerize-take') + '.mid';
  }

  return Object.freeze({
    PPQ: PPQ,
    corpusModel: Object.freeze({ parkerSoloCount: 50, approach: 'aggregate-transitions-and-rhythm-cells' }),
    learnHarmonyCorpus: learnHarmonyCorpus,
    generateChart: generateChart,
    generateSolo: generateSolo,
    exportMidi: exportMidi,
    fileNameForTitle: fileNameForTitle,
    clampLevel: clampLevel
  });
});
