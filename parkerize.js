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
  var soloCorpus = root && root.KeyerParkerizeCorpus;
  if (!theory && typeof module === 'object' && module.exports) theory = require('./jazz-theory.js');
  if (!soloCorpus && typeof module === 'object' && module.exports) soloCorpus = require('./parkerize-corpus.js');
  var api = factory(theory, soloCorpus);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KeyerParkerize = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildKeyerParkerize(Theory, SoloCorpus) {
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

  function compactCounts(counts, limit) {
    var ranked = Object.keys(counts || {}).sort(function byFrequency(left, right) {
      return counts[right] - counts[left] || left.localeCompare(right);
    }).slice(0, limit || 120);
    var compact = Object.create(null);
    ranked.forEach(function retain(key) { compact[key] = counts[key]; });
    return compact;
  }

  function histogramEntries(histogram) {
    return Object.keys(histogram || {}).map(function entry(key) {
      return { value: Number(key), key: key, weight: Number(histogram[key]) || 0 };
    }).filter(function valid(entry) { return Number.isFinite(entry.value) && entry.weight > 0; });
  }

  function corpusNumber(histogram, random, fallback, filter) {
    var entries = histogramEntries(histogram).filter(function allowed(entry) {
      return typeof filter !== 'function' || filter(entry.value);
    });
    var chosen = weightedPick(entries, random, function weight(entry) { return entry.weight; });
    return chosen ? chosen.value : fallback;
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
    var trigrams = Object.create(null);
    var barCells = Object.create(null);
    var chordCounts = Object.create(null);
    var cadenceCells = Object.create(null);
    var formProfiles = Object.create(null);
    var songCount = 0;
    var chordCount = 0;
    (Array.isArray(songs) ? songs : []).forEach(function inspectSong(song) {
      var tonic = pitchClass(song && song.key);
      if (tonic == null || !Array.isArray(song.bars)) return;
      var tokens = [];
      var tokenBars = [];
      var sections = [];
      var activeSection = null;
      song.bars.forEach(function inspectBar(bar, barIndex) {
        var chords = [].concat(Array.isArray(bar && bar.chords) ? bar.chords : [], Array.isArray(bar && bar.overflowChords) ? bar.overflowChords : []);
        var barTokens = [];
        chords.forEach(function inspectChord(chord) {
          if (chord && (chord.isAlternateOnly || chord.isNoChord || chord.isPause)) return;
          var token = chordToken(chord, tonic);
          if (token) {
            tokens.push(token);
            barTokens.push(token);
          }
        });
        if (barTokens.length) {
          tokenBars.push(barTokens);
          chordCounts[barTokens.length] = (chordCounts[barTokens.length] || 0) + 1;
          var cellKey = barTokens.map(tokenKey).join('>');
          barCells[cellKey] = (barCells[cellKey] || 0) + 1;
        }
        var sectionLabel = String(bar && (bar.sectionMarker || bar.section) || '').trim();
        if (!sectionLabel) sectionLabel = activeSection ? activeSection.label : String.fromCharCode(65 + Math.floor(barIndex / 8));
        if (!activeSection || activeSection.label !== sectionLabel) {
          activeSection = { label: sectionLabel, length: 0, tokens: [] };
          sections.push(activeSection);
        }
        activeSection.length += 1;
        activeSection.tokens.push.apply(activeSection.tokens, barTokens);
      });
      if (tokens.length < 4) return;
      songCount += 1;
      chordCount += tokens.length;
      for (var index = 0; index < tokens.length - 1; index += 1) {
        var from = tokenKey(tokens[index]);
        var to = tokenKey(tokens[index + 1]);
        if (!transitions[from]) transitions[from] = Object.create(null);
        transitions[from][to] = (transitions[from][to] || 0) + 1;
        if (index > 0) {
          var context = tokenKey(tokens[index - 1]) + '>' + from;
          if (!trigrams[context]) trigrams[context] = Object.create(null);
          trigrams[context][to] = (trigrams[context][to] || 0) + 1;
        }
      }
      sections.forEach(function rememberCadence(section) {
        if (section.tokens.length < 2) return;
        var cadence = section.tokens.slice(-3).map(tokenKey).join('>');
        cadenceCells[cadence] = (cadenceCells[cadence] || 0) + 1;
      });
      if (sections.length > 1 && sections.length <= 6) {
        var labelMap = Object.create(null);
        var nextLabel = 0;
        var labels = sections.map(function normalizedLabel(section) {
          if (labelMap[section.label] == null) labelMap[section.label] = String.fromCharCode(65 + nextLabel++);
          return labelMap[section.label];
        }).join('');
        var lengths = sections.map(function sectionLength(section) { return section.length; });
        if (lengths.every(function practical(length) { return length >= 4 && length <= 16; })) {
          var profile = labels + ':' + lengths.join(',');
          formProfiles[profile] = (formProfiles[profile] || 0) + 1;
        }
      }
    });
    Object.keys(transitions).forEach(function compact(from) {
      transitions[from] = compactCounts(transitions[from], 14);
    });
    Object.keys(trigrams).forEach(function compact(context) { trigrams[context] = compactCounts(trigrams[context], 10); });
    return {
      songCount: songCount,
      chordCount: chordCount,
      transitions: transitions,
      trigrams: trigrams,
      barCells: compactCounts(barCells, 180),
      chordCounts: chordCounts,
      cadenceCells: compactCounts(cadenceCells, 80),
      formProfiles: compactCounts(formProfiles, 50)
    };
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

  function corpusNext(token, corpus, random, previousToken) {
    var options = transitionOptions(token, corpus);
    var context = previousToken && tokenKey(previousToken) + '>' + tokenKey(token);
    var trigram = context && corpus && corpus.trigrams && corpus.trigrams[context];
    if (trigram) {
      options.forEach(function boost(entry) { entry.weight += Math.min(45, Number(trigram[tokenKey(entry.token)]) || 0) * 3; });
      Object.keys(trigram).forEach(function addMissing(next) {
        if (options.some(function same(entry) { return tokenKey(entry.token) === next; })) return;
        var parts = next.split(':');
        options.push({ token: { degree: Number(parts[0]), family: parts[1] }, weight: Math.min(45, trigram[next] * 3) });
      });
    }
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

  function parseFormProfile(value) {
    var parts = String(value || '').split(':');
    var labels = parts[0];
    var lengths = String(parts[1] || '').split(',').map(Number);
    if (!/^[A-F]+$/.test(labels) || labels.length !== lengths.length || !lengths.every(Number.isFinite)) return null;
    return { labels: labels.split(''), lengths: lengths };
  }

  function formShape(complexity, random, corpus) {
    var learned = Object.keys(corpus && corpus.formProfiles || {}).map(function profile(key) {
      var parsed = parseFormProfile(key);
      if (!parsed) return null;
      var total = parsed.lengths.reduce(function sum(value, length) { return value + length; }, 0);
      var repeated = new Set(parsed.labels).size < parsed.labels.length;
      var allowed = total >= (complexity <= 2 ? 24 : 16) && total <= (complexity >= 4 ? 48 : 40)
        && parsed.lengths.every(function practical(length) { return length >= 4 && length <= 12; });
      return allowed ? { form: parsed, weight: corpus.formProfiles[key] * (repeated ? 1.5 : 1) } : null;
    }).filter(Boolean);
    if (learned.length && complexity >= 2 && random() < 0.62) {
      var learnedForm = weightedPick(learned, random, function weight(entry) { return entry.weight; });
      if (learnedForm) return learnedForm.form;
    }
    var forms = complexity === 1
      ? [{ labels: 'AABA'.split(''), lengths: [8, 8, 8, 8], weight: 6 }]
      : complexity === 2
        ? [
          { labels: 'AABA'.split(''), lengths: [8, 8, 8, 8], weight: 7 },
          { labels: 'ABAC'.split(''), lengths: [8, 8, 8, 8], weight: 4 }
        ]
        : complexity === 3
          ? [
            { labels: 'AABA'.split(''), lengths: [8, 8, 8, 8], weight: 6 },
            { labels: 'ABAC'.split(''), lengths: [8, 8, 8, 8], weight: 6 },
            { labels: 'AABC'.split(''), lengths: [8, 8, 8, 8], weight: 3 }
          ]
          : complexity === 4
            ? [
              { labels: 'ABAC'.split(''), lengths: [8, 8, 8, 8], weight: 6 },
              { labels: 'AABA'.split(''), lengths: [8, 8, 8, 8], weight: 4 },
              { labels: 'AABAC'.split(''), lengths: [8, 8, 8, 8, 8], weight: 3 }
            ]
            : [
              { labels: 'AABAC'.split(''), lengths: [8, 8, 8, 8, 8], weight: 6 },
              { labels: 'ABAC'.split(''), lengths: [8, 8, 8, 8], weight: 5 },
              { labels: 'AABC'.split(''), lengths: [8, 8, 8, 8], weight: 4 }
            ];
    var selected = weightedPick(forms, random, function weight(entry) { return entry.weight; }) || forms[0];
    return { labels: selected.labels, lengths: selected.lengths };
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

  function tokenFromKey(value) {
    var parts = String(value || '').split(':');
    return { degree: mod(Number(parts[0]) || 0), family: canonicalFamily(parts[1]) };
  }

  function learnedBarCell(corpus, previousToken, complexity, random) {
    var maximumChords = complexity <= 1 ? 1 : complexity <= 3 ? 2 : 3;
    var candidates = Object.keys(corpus && corpus.barCells || {}).map(function candidate(key) {
      var tokens = key.split('>').map(tokenFromKey).slice(0, maximumChords);
      if (!tokens.length || tokens.length > maximumChords) return null;
      var transition = corpus.transitions && corpus.transitions[tokenKey(previousToken)];
      var connection = transition && transition[tokenKey(tokens[0])] || 0;
      return { tokens: tokens, weight: Math.max(1, corpus.barCells[key]) * (1 + Math.min(10, connection) * 0.28) };
    }).filter(Boolean);
    var chosen = weightedPick(candidates, random, function weight(entry) { return entry.weight; });
    return chosen && chosen.tokens.map(function clone(token) { return { degree: token.degree, family: token.family }; });
  }

  function fallbackBarCell(complexity, random) {
    var candidates = BAR_CELLS.filter(function available(cell) { return cell.min <= complexity; });
    var cell = weightedPick(candidates, random, function weight(entry) { return entry.weight; });
    return cell.chords.map(function clone(parts) { return { degree: parts[0], family: parts[1] }; });
  }

  function buildSectionTemplate(length, complexity, corpus, random) {
    var section = [];
    var previous = null;
    var current = { degree: 0, family: 'maj' };
    for (var barIndex = 0; barIndex < length; barIndex += 1) {
      var remaining = length - barIndex;
      var tokens;
      if (barIndex === 0) tokens = [{ degree: 0, family: 'maj' }];
      else if (remaining <= 2) tokens = [{ degree: 2, family: 'min' }, { degree: 7, family: complexity >= 4 ? 'alt' : 'dom' }];
      else if (barIndex % 4 === 3 && random() < 0.58) {
        tokens = complexity >= 4 && random() < 0.42
          ? [{ degree: 6, family: 'hdim' }, { degree: 11, family: 'alt' }]
          : [{ degree: 2, family: 'min' }, { degree: 7, family: 'dom' }];
      } else {
        tokens = random() < 0.78 ? learnedBarCell(corpus, current, complexity, random) : null;
        if (!tokens) tokens = fallbackBarCell(complexity, random);
        if (tokens.length && tokenKey(tokens[0]) === tokenKey(current) && random() < 0.72) {
          var next = corpusNext(current, corpus, random, previous);
          if (next) tokens[0] = next;
        }
      }
      previous = current;
      current = tokens[tokens.length - 1];
      section.push(tokens);
    }
    return section;
  }

  function varyRepeatedSection(template, complexity, corpus, random) {
    var variation = template.map(function cloneBar(tokens) {
      return tokens.map(function cloneToken(token) { return { degree: token.degree, family: token.family }; });
    });
    var changes = complexity <= 2 ? 1 : complexity <= 4 ? 2 : 3;
    for (var index = 0; index < changes; index += 1) {
      var barIndex = 1 + Math.floor(random() * Math.max(1, variation.length - 3));
      var tokens = variation[barIndex];
      var previous = variation[barIndex - 1][variation[barIndex - 1].length - 1];
      if (complexity >= 4 && tokens.length === 1 && random() < 0.45) {
        variation[barIndex] = [{ degree: mod(tokens[0].degree + 6), family: 'dom' }, tokens[0]];
      } else {
        var next = corpusNext(previous, corpus, random);
        if (next) tokens[tokens.length - 1] = next;
      }
    }
    return variation;
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
    var form = formShape(complexity, random, settings.corpus);
    var lengths = form.lengths;
    var labels = form.labels;
    var uniqueLabels = [];
    labels.forEach(function unique(label) { if (uniqueLabels.indexOf(label) < 0) uniqueLabels.push(label); });
    var uniqueOffsets = sectionKeyOffsets(complexity, uniqueLabels.length, random);
    var offsetsByLabel = Object.create(null);
    uniqueLabels.forEach(function assign(label, index) { offsetsByLabel[label] = uniqueOffsets[index]; });
    var templates = Object.create(null);
    var bars = [];

    lengths.forEach(function buildSection(length, sectionIndex) {
      var label = labels[sectionIndex] || String.fromCharCode(65 + sectionIndex);
      var localOffset = offsetsByLabel[label] || 0;
      var nextLabel = labels[sectionIndex + 1];
      var nextOffset = nextLabel == null ? 0 : offsetsByLabel[nextLabel] || 0;
      var template = templates[label];
      var localBars;
      if (!template || template.length !== length) {
        template = buildSectionTemplate(length, complexity, settings.corpus, random);
        templates[label] = template;
        localBars = template.map(function cloneBar(tokens) { return tokens.map(function cloneToken(token) { return { degree: token.degree, family: token.family }; }); });
      } else {
        localBars = varyRepeatedSection(template, complexity, settings.corpus, random);
      }
      for (var barIndex = 0; barIndex < length; barIndex += 1) {
        var remaining = length - barIndex;
        var localTokens = localBars[barIndex];
        if (remaining === 2) localTokens = [{ degree: mod(nextOffset - localOffset + 2), family: 'min' }, { degree: mod(nextOffset - localOffset + 7), family: complexity >= 4 ? 'alt' : 'dom' }];
        if (remaining === 1) localTokens = [{ degree: mod(nextOffset - localOffset), family: 'maj' }];
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
      parkerizeCorpusSongs: Number(settings.corpus && settings.corpus.songCount) || 0,
      parkerizeForm: labels.join('') + ' · ' + lengths.join('-')
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

  function corpusKey(histogram, random, fallback) {
    var entries = Object.keys(histogram || {}).map(function entry(key) {
      return { key: key, weight: Number(histogram[key]) || 0 };
    }).filter(function valid(entry) { return entry.weight > 0; });
    var selected = weightedPick(entries, random, function weight(entry) { return entry.weight; });
    return selected ? selected.key : fallback;
  }

  function soloRhythmStep(previousStep, complexity, random) {
    var transition = previousStep != null && SoloCorpus && SoloCorpus.stepTransitions && SoloCorpus.stepTransitions[String(previousStep)];
    var histogram = transition || SoloCorpus && SoloCorpus.steps;
    var entries = histogramEntries(histogram).filter(function useful(entry) {
      if (entry.value > 1.5) return false;
      if (complexity === 1) return entry.value >= 0.5;
      if (complexity === 2) return entry.value >= 1 / 3;
      if (complexity === 3) return entry.value >= 0.25;
      return entry.value >= 1 / 6;
    });
    entries.forEach(function complexityWeight(entry) {
      if (complexity === 1) entry.weight *= entry.value >= 1 ? 2.4 : 0.7;
      else if (complexity === 2) entry.weight *= entry.value >= 0.5 ? 1.5 : 0.35;
      else if (complexity === 3) entry.weight *= entry.value <= 0.5 ? 1.25 : 0.75;
      else if (complexity === 4) entry.weight *= entry.value <= 1 / 3 ? 1.7 : entry.value <= 0.5 ? 1.1 : 0.35;
      else entry.weight *= entry.value <= 0.25 ? 2.8 : entry.value <= 1 / 3 ? 2 : entry.value <= 0.5 ? 0.85 : 0.15;
    });
    var selected = weightedPick(entries, random, function weight(entry) { return entry.weight; });
    if (selected) return selected.value;
    return weightedNumber(RHYTHM_STEPS[complexity], random);
  }

  function soloInterval(previousInterval, phase, complexity, random) {
    var transition = previousInterval != null && SoloCorpus && SoloCorpus.intervalTransitions && SoloCorpus.intervalTransitions[String(previousInterval)];
    var phaseHistogram = SoloCorpus && SoloCorpus.intervalsByPhase && SoloCorpus.intervalsByPhase[phase];
    var histogram = transition || phaseHistogram || SoloCorpus && SoloCorpus.intervals;
    var maximum = [0, 5, 7, 9, 11, 12][complexity];
    var entries = histogramEntries(histogram).filter(function practical(entry) { return Math.abs(entry.value) <= maximum; });
    entries.forEach(function melodicWeight(entry) {
      var size = Math.abs(entry.value);
      if (size <= 3) entry.weight *= 1.4;
      if (previousInterval != null && Math.abs(previousInterval) >= 5 && Math.sign(entry.value) !== Math.sign(previousInterval)) entry.weight *= 2.2;
      if (previousInterval != null && Math.abs(previousInterval) >= 7 && Math.sign(entry.value) === Math.sign(previousInterval)) entry.weight *= 0.2;
      if (entry.value === 0) entry.weight *= 0.35;
    });
    var selected = weightedPick(entries, random, function weight(entry) { return entry.weight; });
    return selected ? selected.value : weightedNumber(INTERVAL_PRIORS[complexity], random);
  }

  function phraseLengthForComplexity(complexity, random) {
    var maximum = [0, 4, 6, 8, 12, 16][complexity];
    var minimum = complexity >= 4 ? 4 : complexity === 3 ? 3 : 1.5;
    return corpusNumber(SoloCorpus && SoloCorpus.phraseLengths, random, complexity >= 4 ? 8 : 4, function within(value) {
      return value >= minimum && value <= maximum;
    });
  }

  function restLengthForComplexity(complexity, random) {
    var sampled = corpusNumber(SoloCorpus && SoloCorpus.rests, random, 1, function useful(value) { return value <= 4; });
    var scale = [0, 0.9, 0.7, 0.48, 0.3, 0.2][complexity];
    return Math.max(complexity >= 4 ? 0.25 : 0.5, Math.round(sampled * scale * 4) / 4);
  }

  function performedOnset(nominal, random) {
    var whole = Math.floor(nominal);
    var phase = nominal - whole;
    var jitter = (random() - 0.5) * 0.026;
    if (Math.abs(phase - 0.5) < 0.035) return whole + 0.625 + random() * 0.045 + jitter;
    if (Math.abs(phase) < 0.035) return nominal + jitter * 0.45;
    return nominal + jitter;
  }

  function eventForBeat(events, beat, hint) {
    var start = Math.max(0, Math.min(events.length - 1, Number(hint) || 0));
    for (var index = start; index < events.length; index += 1) {
      if (beat >= events[index].start - 0.001 && beat < events[index].end - 0.001) return { event: events[index], index: index };
      if (events[index].start > beat) break;
    }
    for (var fallback = Math.min(start, events.length - 1); fallback >= 0; fallback -= 1) {
      if (beat >= events[fallback].start - 0.001) return { event: events[fallback], index: fallback };
    }
    return { event: events[0], index: 0 };
  }

  function contourTarget(contourKey, progress, startMidi, random) {
    var parts = String(contourKey || '0:7:2:1:2').split(':').map(Number);
    var net = Number.isFinite(parts[0]) ? parts[0] : 0;
    var range = Number.isFinite(parts[1]) ? Math.min(16, parts[1]) : 7;
    var peakFirst = (parts[2] || 0) <= (parts[3] || 3);
    var turns = Math.min(5, Number(parts[4]) || 1);
    var arc = Math.sin(progress * Math.PI) * range * 0.46 * (peakFirst ? 1 : -1);
    var motion = Math.sin(progress * Math.PI * Math.max(1, turns * 0.5)) * Math.min(2.2, turns * 0.35);
    return startMidi + net * progress + arc + motion + (random() - 0.5) * 0.7;
  }

  function articulationForStep(step, phraseFinal, random) {
    var key = String(Number(step.toFixed(6)));
    var source = SoloCorpus && SoloCorpus.gatesByStep && SoloCorpus.gatesByStep[key];
    var gate = corpusNumber(source, random, step <= 0.5 ? 0.97 : 0.9);
    if (phraseFinal) gate *= 0.72 + random() * 0.12;
    else if (random() < 0.09) gate *= 0.72 + random() * 0.12;
    else gate *= 0.94 + random() * 0.06;
    return Math.max(0.52, Math.min(0.995, gate));
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
    var previousMidi = 66 + Math.floor(random() * 8);
    var previousInterval = null;
    var pendingResolution = null;
    var motif = null;
    var eventHint = 0;
    var cursor = complexity <= 2 && random() < 0.65 ? 0.5 : 0;
    var phraseIndex = 0;

    while (cursor < chartEnd - 0.25) {
      var phraseLength = Math.min(phraseLengthForComplexity(complexity, random), chartEnd - cursor);
      if (phraseLength < 0.45) break;
      var phraseEnd = Math.min(chartEnd, cursor + phraseLength);
      var contour = corpusKey(SoloCorpus && SoloCorpus.contours, random, '0:7:2:1:2');
      var useMotif = motif && phraseIndex > 0 && random() < 0.34;
      var motifInvert = useMotif && random() < 0.3;
      var nominalOnsets = [];
      var nominal = cursor;
      var previousStep = null;
      while (nominal < phraseEnd - 0.08 && nominalOnsets.length < 96) {
        nominalOnsets.push(nominal);
        var motifStep = useMotif && motif.steps[nominalOnsets.length - 1];
        var step = motifStep || soloRhythmStep(previousStep, complexity, random);
        step = Math.max(1 / 6, Math.min(1.5, step));
        previousStep = Number(step.toFixed(6));
        nominal += step;
      }
      if (!nominalOnsets.length) break;

      var phraseNotes = [];
      var phraseStartMidi = previousMidi;
      nominalOnsets.forEach(function improvise(nominalOnset, noteIndex) {
        var onset = Math.max(cursor, Math.min(phraseEnd - 0.04, performedOnset(nominalOnset, random)));
        if (phraseNotes.length) onset = Math.max(phraseNotes[phraseNotes.length - 1].startBeat + 0.07, onset);
        if (onset >= phraseEnd - 0.025) return;
        var lookup = eventForBeat(events, onset, eventHint);
        eventHint = lookup.index;
        var pools = chordPitchPools(lookup.event.chord);
        var phaseValue = ((nominalOnset % 1) + 1) % 1;
        var strong = Math.abs(phaseValue) < 0.045;
        var offbeat = Math.abs(phaseValue - 0.5) < 0.09;
        var phase = strong ? 'strong' : offbeat ? 'offbeat' : 'triplet';
        var motifInterval = useMotif && motif.intervals[noteIndex - 1];
        var interval = motifInterval != null ? motifInterval * (motifInvert ? -1 : 1) : soloInterval(previousInterval, phase, complexity, random);
        var progress = nominalOnsets.length <= 1 ? 1 : noteIndex / (nominalOnsets.length - 1);
        var contourMidi = contourTarget(contour, progress, phraseStartMidi, random);
        var desired = previousMidi * 0.48 + (previousMidi + interval) * 0.28 + contourMidi * 0.24;
        var nextNominal = nominalOnsets[noteIndex + 1];
        var nextStrong = nextNominal != null && Math.abs(nextNominal - Math.round(nextNominal)) < 0.045;
        var pc;
        if (pendingResolution != null) {
          pc = mod(pendingResolution);
          desired = pendingResolution;
          pendingResolution = null;
        } else if (!strong && nextStrong && complexity >= 2 && random() < [0, 0, 0.22, 0.38, 0.52, 0.62][complexity]) {
          var nextLookup = eventForBeat(events, nextNominal, eventHint);
          var nextPools = chordPitchPools(nextLookup.event.chord);
          var targetPc = pick(random() < 0.76 ? nextPools.guides : nextPools.chord, random);
          var targetMidi = nearestMidi(targetPc, desired, 55, 88);
          var approachDirection = random() < 0.62 ? -1 : 1;
          pc = mod(targetMidi + approachDirection);
          pendingResolution = targetMidi;
        } else {
          var pool = strong ? (random() < 0.68 ? pools.guides : pools.chord)
            : random() < 0.18 + complexity * 0.045 ? pools.chord : pools.scale;
          pc = pick(pool, random);
        }
        var midi = nearestMidi(pc, desired, 55, 88);
        if (midi == null) midi = previousMidi;
        if (Math.abs(midi - previousMidi) > 12) {
          var closer = nearestMidi(pc, previousMidi + Math.sign(midi - previousMidi) * 7, 55, 88);
          if (closer != null) midi = closer;
        }
        if (midi === previousMidi && random() < 0.72) {
          var alternatePcs = pools.scale.concat(pools.chord).filter(function different(candidate, index, all) {
            return mod(candidate) !== mod(previousMidi) && all.indexOf(candidate) === index;
          });
          var alternates = alternatePcs.map(function nearby(candidate) { return nearestMidi(candidate, desired, 55, 88); })
            .filter(function practical(candidate) { return candidate != null && Math.abs(candidate - previousMidi) <= 9; })
            .sort(function melodic(left, right) {
              return Math.abs(left - desired) + Math.abs(left - previousMidi) * 0.3
                - (Math.abs(right - desired) + Math.abs(right - previousMidi) * 0.3);
            });
          if (alternates.length) midi = alternates[Math.min(alternates.length - 1, Math.floor(random() * Math.min(3, alternates.length)))];
        }
        var dynamicArc = Math.sin(progress * Math.PI) * 0.09;
        var velocity = (strong ? 0.78 : offbeat ? 0.64 : 0.69) + dynamicArc + (random() - 0.5) * 0.12;
        if (pendingResolution != null) velocity -= 0.09;
        phraseNotes.push({
          midi: midi,
          startBeat: onset,
          nominalBeat: nominalOnset,
          velocity: Math.max(0.44, Math.min(0.96, velocity))
        });
        previousInterval = midi - previousMidi;
        previousMidi = midi;
      });

      phraseNotes.forEach(function articulate(note, noteIndex) {
        var next = phraseNotes[noteIndex + 1];
        var available = Math.max(0.08, (next ? next.startBeat : phraseEnd) - note.startBeat);
        var nominalNext = nominalOnsets[Math.min(noteIndex + 1, nominalOnsets.length - 1)];
        var nominalStep = noteIndex + 1 < nominalOnsets.length ? nominalNext - note.nominalBeat : available;
        var gate = articulationForStep(Math.max(1 / 6, nominalStep), noteIndex === phraseNotes.length - 1, random);
        var duration = Math.max(0.075, available * gate);
        notes.push({
          midi: note.midi,
          startBeat: Number(note.startBeat.toFixed(6)),
          endBeat: Number(Math.min(chartEnd - 0.01, note.startBeat + duration).toFixed(6)),
          durationBeats: Number(duration.toFixed(6)),
          velocity: Number(note.velocity.toFixed(4))
        });
      });

      if (!motif && phraseNotes.length >= 4) {
        motif = {
          steps: phraseNotes.slice(1, 5).map(function motifStep(note, index) { return Number((note.nominalBeat - phraseNotes[index].nominalBeat).toFixed(6)); }),
          intervals: phraseNotes.slice(1, 5).map(function motifInterval(note, index) { return note.midi - phraseNotes[index].midi; })
        };
      }
      phraseIndex += 1;
      if (phraseEnd >= chartEnd - 0.25) break;
      cursor = phraseEnd + restLengthForComplexity(complexity, random);
      if (cursor < chartEnd) cursor = Math.round(cursor * 4) / 4;
    }

    // Resolve near the end so the generated line always spans a complete
    // form and can be looped as one solo-study chorus by Standards.
    var finalEvent = events[events.length - 1];
    var finalPools = chordPitchPools(finalEvent.chord);
    var finalStart = Math.max(finalEvent.start, chartEnd - (complexity >= 4 ? 0.5 : 1));
    var last = notes[notes.length - 1];
    if (!last || last.endBeat < chartEnd - 0.12) {
      var finalPc = pick(finalPools.guides.length ? finalPools.guides : finalPools.chord, random);
      var finalMidi = nearestMidi(finalPc, previousMidi, 55, 91);
      while (last && last.startBeat + 0.08 > finalStart) {
        notes.pop();
        last = notes[notes.length - 1];
      }
      if (last && last.endBeat > finalStart - 0.02) {
        last.endBeat = Math.max(last.startBeat + 0.075, finalStart - 0.02);
        last.durationBeats = Number((last.endBeat - last.startBeat).toFixed(6));
      }
      notes.push({ midi: finalMidi, startBeat: finalStart, endBeat: Math.max(finalStart + 0.1, chartEnd - 0.02), durationBeats: Math.max(0.1, chartEnd - 0.02 - finalStart), velocity: 0.82 });
    }
    notes.sort(function chronological(left, right) { return left.startBeat - right.startBeat || left.midi - right.midi; });
    notes.slice(0, -1).forEach(function keepMonophonic(note, index) {
      var nextStart = notes[index + 1].startBeat;
      if (note.endBeat > nextStart - 0.004) {
        note.endBeat = Number(Math.max(note.startBeat + 0.04, nextStart - 0.004).toFixed(6));
        note.durationBeats = Number((note.endBeat - note.startBeat).toFixed(6));
      }
    });
    var title = String(settings.title || 'Parkerize Take');
    return {
      title: title,
      complexity: complexity,
      seed: String(seed),
      notes: notes,
      durationBeats: chartEnd,
      corpusSoloCount: Number(SoloCorpus && SoloCorpus.soloCount) || 0,
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
    corpusModel: Object.freeze({
      parkerSoloCount: Number(SoloCorpus && SoloCorpus.soloCount) || 0,
      parkerNoteCount: Number(SoloCorpus && SoloCorpus.noteCount) || 0,
      parkerPhraseCount: Number(SoloCorpus && SoloCorpus.phraseCount) || 0,
      approach: 'aggregate-phrase-rhythm-contour-articulation-and-harmony-models'
    }),
    learnHarmonyCorpus: learnHarmonyCorpus,
    generateChart: generateChart,
    generateSolo: generateSolo,
    exportMidi: exportMidi,
    fileNameForTitle: fileNameForTitle,
    clampLevel: clampLevel
  });
});
