(function initKeyerStandardsReharm(root, factory) {
  const Theory = typeof module === 'object' && module.exports
    ? require('./jazz-theory.js')
    : root.KeyerJazzTheory;
  const api = factory(Theory);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KeyerStandardsReharm = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function buildKeyerStandardsReharm(Theory) {
  'use strict';

  const LEVELS = Object.freeze([
    Object.freeze({ value: 0, label: 'Original', concepts: [] }),
    Object.freeze({ value: 1, label: 'Color', concepts: ['9ths, 13ths, and richer chord color'] }),
    Object.freeze({ value: 2, label: 'Diatonic', concepts: ['tonic-family and predominant substitutions'] }),
    Object.freeze({ value: 3, label: 'Dominants', concepts: ['secondary and tritone-substitute dominants'] }),
    Object.freeze({ value: 4, label: 'Borrowed', concepts: ['modal interchange, backdoor, and diminished motion'] }),
    Object.freeze({ value: 5, label: 'Advanced', concepts: ['temporary ii–V movement and outside resolution'] })
  ]);
  const CHANGE_RATES = [0, .26, .38, .52, .67, .8];
  const mod = value => Theory.mod(value);

  function normalizeLevel(value) {
    const level = Math.trunc(Number(value));
    return Number.isFinite(level) ? Math.max(0, Math.min(5, level)) : 0;
  }

  function stableHash(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function sourceSymbol(item) {
    return String(item?.raw || item?.parsed?.raw || item?.parsed?.display || '').trim();
  }

  function rootName(pc, context, fallbackChord) {
    const contextText = context?.rootText || fallbackChord?.rootText || '';
    return Theory.noteName(mod(pc), Theory.preferFlatsForKey(contextText));
  }

  function parseCandidate(rootPc, suffix, context, fallbackChord) {
    const symbol = `${rootName(rootPc, context, fallbackChord)}${suffix}`;
    const chord = Theory.parseChordSymbol(symbol);
    return chord && Number.isFinite(chord.root) ? { chord, symbol } : null;
  }

  function sameChord(left, right) {
    if (!left || !right) return false;
    return left.root === right.root
      && left.slash === right.slash
      && String(left.quality?.low || '') === String(right.quality?.low || '');
  }

  function melodySafe(candidate, melodyPcs, nextChord) {
    if (!candidate || !Array.isArray(melodyPcs) || !melodyPcs.length) return true;
    const scale = Theory.suggestScale(candidate, { nextChord });
    const allowed = new Set([...(scale?.pcs || []), ...Theory.chordPitchClasses(candidate)].map(mod));
    return melodyPcs.every(pc => allowed.has(mod(pc)));
  }

  function commonToneCount(left, right) {
    const leftSet = new Set(Theory.chordPitchClasses(left));
    return Theory.chordPitchClasses(right).reduce((count, pc) => count + Number(leftSet.has(pc)), 0);
  }

  function makeProposal(entry, candidate, minLevel, ruleId, ruleLabel, extraScore = 0) {
    if (!candidate || sameChord(entry.chord, candidate.chord)) return null;
    const common = commonToneCount(entry.chord, candidate.chord);
    return {
      cellId: entry.cellId,
      chord: candidate.chord,
      symbol: candidate.symbol,
      originalChord: entry.chord,
      originalRaw: entry.raw,
      minLevel,
      ruleId,
      ruleLabel,
      score: minLevel * 20 + common * 1.4 + extraScore
    };
  }

  function colorProposal(entry) {
    const chord = entry.chord;
    const low = chord?.quality?.low || '';
    if (!chord || chord.altered || chord.family === 'dim') return null;
    let suffix = null;
    if (chord.family === 'maj') suffix = /6/.test(low) && !/7/.test(low) ? '69' : '^9';
    else if (chord.family === 'min') suffix = '-9';
    else if (chord.family === 'minmaj') suffix = '-^9';
    else if (chord.family === 'dom') suffix = /sus/.test(low) ? '9sus' : '13';
    else if (chord.family === 'sus') suffix = '9sus';
    else if (chord.family === 'hdim') suffix = 'h9';
    else if (chord.family === 'aug') suffix = '^7#5';
    if (!suffix) return null;
    return makeProposal(
      entry,
      parseCandidate(chord.root, suffix, entry.context, chord),
      1,
      'color',
      'Added color tones'
    );
  }

  function diatonicProposal(entry, index) {
    const chord = entry.chord;
    const context = entry.context;
    if (!chord || !context || entry.sectionStart || entry.sectionEnd) return null;
    const degree = mod(chord.root - context.root);
    let root = null;
    let suffix = null;
    let label = 'Diatonic substitution';
    if (context.mode === 'major' && degree === 0 && chord.family === 'maj') {
      root = mod(context.root + (stableHash(entry.cellId) % 2 ? 4 : 9));
      suffix = '-7';
      label = root === mod(context.root + 4) ? 'Tonic to iii' : 'Tonic to vi';
    } else if (context.mode === 'major' && degree === 2 && chord.family === 'min') {
      root = mod(context.root + 5);
      suffix = '^7';
      label = 'ii to IV';
    } else if (context.mode === 'major' && degree === 5 && chord.family === 'maj') {
      root = mod(context.root + 2);
      suffix = '-7';
      label = 'IV to ii';
    } else if (context.mode === 'minor' && degree === 0 && ['min', 'minmaj'].includes(chord.family)) {
      root = mod(context.root + 3);
      suffix = '^7';
      label = 'Minor tonic relative-major color';
    }
    if (root == null) return null;
    return makeProposal(entry, parseCandidate(root, suffix, context, chord), 2, 'diatonic', label, index % 3 * .1);
  }

  function dominantProposal(entry) {
    const chord = entry.chord;
    const next = entry.next?.chord;
    if (!chord || !next) return null;
    if (chord.family === 'dom' && mod(chord.root + 5) === next.root) {
      const candidate = parseCandidate(mod(chord.root + 6), '7#11', entry.context, chord);
      return makeProposal(entry, candidate, 3, 'tritone', 'Tritone substitution', 2);
    }
    if (['min', 'maj'].includes(chord.family) && mod(chord.root + 5) === next.root) {
      const suffix = ['min', 'minmaj', 'hdim', 'dim'].includes(next.family) ? '7b9' : '7';
      const candidate = parseCandidate(chord.root, suffix, entry.context, chord);
      return makeProposal(entry, candidate, 3, 'secondary-dominant', 'Secondary dominant', 1.4);
    }
    if (chord.family === 'dom' && ['min', 'minmaj'].includes(next.family)) {
      return makeProposal(entry, parseCandidate(chord.root, '7alt', entry.context, chord), 3, 'altered-dominant', 'Altered dominant', 1);
    }
    return null;
  }

  function borrowedProposal(entry) {
    const chord = entry.chord;
    const next = entry.next?.chord;
    const context = entry.context;
    if (!chord || !next) return null;
    const nextIsTonic = context && next.root === context.root && ['maj', 'min', 'minmaj'].includes(next.family);
    if (nextIsTonic && context.mode === 'major' && chord.root === mod(context.root + 5) && chord.family === 'maj') {
      return makeProposal(entry, parseCandidate(chord.root, '-6', context, chord), 4, 'borrowed-iv', 'Borrowed minor iv', 3);
    }
    if (nextIsTonic && chord.family === 'dom' && mod(chord.root + 5) === next.root) {
      return makeProposal(entry, parseCandidate(mod(next.root + 10), '7', context, chord), 4, 'backdoor', 'Backdoor dominant', 2.8);
    }
    if (Math.min(mod(chord.root - next.root), mod(next.root - chord.root)) === 1 && chord.family !== 'dim') {
      return makeProposal(entry, parseCandidate(chord.root, 'o7', context, chord), 4, 'diminished-approach', 'Diminished approach', 1.8);
    }
    return null;
  }

  function advancedPair(entries, index) {
    const first = entries[index];
    const second = entries[index + 1];
    const target = entries[index + 2];
    if (!first || !second || !target || first.sectionId !== second.sectionId || second.sectionId !== target.sectionId) return null;
    if (first.sectionStart || target.chord.family === 'dim' || target.chord.family === 'aug') return null;
    const targetMinor = ['min', 'minmaj'].includes(target.chord.family);
    const useTritone = stableHash(`${first.cellId}:${target.cellId}`) % 3 === 0;
    const dominantRoot = useTritone ? mod(target.chord.root + 1) : mod(target.chord.root + 7);
    const iiRoot = mod(dominantRoot + 7);
    const firstCandidate = parseCandidate(iiRoot, targetMinor && !useTritone ? 'h7' : '-7', first.context, first.chord);
    const secondCandidate = parseCandidate(dominantRoot, targetMinor ? '7b9' : useTritone ? '7#11' : '13', second.context, second.chord);
    const firstProposal = makeProposal(first, firstCandidate, 5, 'ii-v', useTritone ? 'Tritone ii–V approach' : 'Temporary ii–V', 5);
    const secondProposal = makeProposal(second, secondCandidate, 5, 'ii-v', useTritone ? 'Tritone ii–V approach' : 'Temporary ii–V', 5);
    if (!firstProposal || !secondProposal) return null;
    const groupId = `ii-v:${first.cellId}:${second.cellId}:${target.cellId}`;
    firstProposal.groupId = groupId;
    secondProposal.groupId = groupId;
    return [firstProposal, secondProposal];
  }

  function primaryEntries(bars, contexts) {
    const entries = [];
    (bars || []).forEach(bar => {
      (bar?.chords || []).forEach(item => {
        if (!item?.parsed || item.optionalOnly || item.holdOnly) return;
        const cellId = `${bar.barIndex}:${item.chordIndex}`;
        entries.push({
          cellId,
          barIndex: bar.barIndex,
          chordIndex: item.chordIndex,
          sourceMarkerIndex: item.sourceMarkerIndex,
          raw: sourceSymbol(item),
          chord: item.parsed,
          bar,
          item,
          sectionId: bar.sectionId,
          context: contexts?.get?.(bar.sectionId) || null,
          sectionStart: Boolean(bar.sectionStarts)
        });
      });
    });
    entries.forEach((entry, index) => {
      entry.index = index;
      entry.previous = entries[index - 1] || null;
      entry.next = entries[index + 1] || null;
      entry.sectionEnd = !entry.next || entry.next.sectionId !== entry.sectionId;
    });
    return entries;
  }

  function choosePlan(bars, options) {
    const level = normalizeLevel(options.level);
    const entries = primaryEntries(bars, options.contexts);
    if (!level || !entries.length) return new Map();
    const melodyByCell = options.melodyPcsByCell instanceof Map ? options.melodyPcsByCell : new Map();
    const proposalByCell = new Map();

    entries.forEach((entry, index) => {
      const proposals = [
        colorProposal(entry),
        level >= 2 ? diatonicProposal(entry, index) : null,
        level >= 3 ? dominantProposal(entry) : null,
        level >= 4 ? borrowedProposal(entry) : null
      ].filter(proposal => proposal && proposal.minLevel <= level)
        .filter(proposal => melodySafe(proposal.chord, melodyByCell.get(entry.cellId), entry.next?.chord));
      proposals.sort((left, right) => right.minLevel - left.minLevel || right.score - left.score || left.ruleId.localeCompare(right.ruleId));
      if (proposals[0]) proposalByCell.set(entry.cellId, proposals[0]);
    });

    if (level >= 5) {
      for (let index = 0; index < entries.length - 2; index += 1) {
        const pair = advancedPair(entries, index);
        if (!pair) continue;
        if (!pair.every(proposal => melodySafe(
          proposal.chord,
          melodyByCell.get(proposal.cellId),
          entries.find(entry => entry.cellId === proposal.cellId)?.next?.chord
        ))) continue;
        pair.forEach(proposal => proposalByCell.set(proposal.cellId, proposal));
        index += 1;
      }
    }

    const candidates = [...proposalByCell.values()];
    if (!candidates.length) return new Map();
    const targetCount = Math.max(1, Math.min(candidates.length, Math.ceil(entries.length * CHANGE_RATES[level])));
    const seed = options.seed || '';
    candidates.sort((left, right) => (
      right.minLevel - left.minLevel
      || (stableHash(`${seed}:${left.cellId}`) - stableHash(`${seed}:${right.cellId}`))
      || right.score - left.score
    ));
    const chosen = new Map();
    const grouped = new Map();
    candidates.forEach(proposal => {
      if (!proposal.groupId) return;
      if (!grouped.has(proposal.groupId)) grouped.set(proposal.groupId, []);
      grouped.get(proposal.groupId).push(proposal);
    });
    for (const proposal of candidates) {
      if (chosen.size >= targetCount) break;
      if (chosen.has(proposal.cellId)) continue;
      const selection = proposal.groupId ? grouped.get(proposal.groupId) || [proposal] : [proposal];
      // A temporary ii–V is one musical decision. Never let the density
      // budget cut it in half and leave an orphan ii or V in the chart.
      selection.forEach(member => chosen.set(member.cellId, member));
    }
    return chosen;
  }

  function cloneBarsWithPlan(bars, plan, level) {
    const byMarker = new Map();
    (bars || []).forEach(bar => {
      (bar?.chords || []).forEach(item => {
        if (item?.holdOnly || item?.sourceMarkerIndex == null) return;
        const proposal = plan.get(`${bar.barIndex}:${item.chordIndex}`);
        if (proposal) byMarker.set(item.sourceMarkerIndex, proposal);
      });
    });
    return (bars || []).map(bar => ({
      ...bar,
      chords: (bar?.chords || []).map(item => {
        const cellId = `${bar.barIndex}:${item.chordIndex}`;
        const proposal = item.holdOnly && item.sourceMarkerIndex != null
          ? byMarker.get(item.sourceMarkerIndex)
          : plan.get(cellId);
        if (!proposal) return {
          ...item,
          alternates: Array.isArray(item.alternates) ? item.alternates.slice() : []
        };
        return {
          ...item,
          raw: proposal.symbol,
          parsed: proposal.chord,
          alternates: Array.isArray(item.alternates) ? item.alternates.slice() : [],
          reharm: {
            level,
            originalRaw: sourceSymbol(item),
            originalDisplay: item.parsed?.display || sourceSymbol(item),
            ruleId: proposal.ruleId,
            ruleLabel: proposal.ruleLabel
          }
        };
      })
    }));
  }

  function reharmonizeBars(bars, options = {}) {
    const level = normalizeLevel(options.level);
    if (!level) return { level: 0, bars, plan: new Map(), changed: 0 };
    const plan = choosePlan(bars, { ...options, level });
    const derivedBars = cloneBarsWithPlan(bars, plan, level);
    return { level, bars: derivedBars, plan, changed: plan.size };
  }

  return {
    LEVELS,
    normalizeLevel,
    stableHash,
    reharmonizeBars,
    planReharmonization: choosePlan
  };
});
