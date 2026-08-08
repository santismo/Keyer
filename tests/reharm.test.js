'use strict';

const assert = require('node:assert/strict');
const Theory = require('../jazz-theory.js');
const Reharm = require('../standards-reharm.js');

function item(symbol, chordIndex = 0, extra = {}) {
  return {
    raw: symbol,
    parsed: Theory.parseChordSymbol(symbol),
    chordIndex,
    optionalOnly: false,
    holdOnly: false,
    alternates: [],
    ...extra
  };
}

function barsFor(symbols, sectionId = 'A@0') {
  return symbols.map((symbol, barIndex) => ({
    barIndex,
    sectionId,
    sectionLabel: 'A',
    sectionStarts: barIndex === 0,
    chords: [item(symbol)]
  }));
}

function contextsFor(bars, key = 'C') {
  const chords = bars.flatMap(bar => bar.chords.filter(chord => !chord.holdOnly).map(chord => chord.parsed));
  return new Map([[bars[0].sectionId, Theory.inferSectionContext(chords, key)]]);
}

const progression = barsFor(['C^7', 'A-7', 'D-7', 'G7', 'C^7', 'F^7', 'F-7', 'C^7']);
const contexts = contextsFor(progression, 'C');

const original = Reharm.reharmonizeBars(progression, { level: 0, contexts, seed: 'fixture' });
assert.equal(original.level, 0);
assert.equal(original.bars, progression, 'Level zero returns the exact original chart object');
assert.equal(original.changed, 0);

for (let level = 1; level <= 5; level += 1) {
  const first = Reharm.reharmonizeBars(progression, { level, contexts, seed: 'fixture' });
  const second = Reharm.reharmonizeBars(progression, { level, contexts, seed: 'fixture' });
  assert.ok(first.changed > 0, `Level ${level} changes eligible harmony`);
  assert.deepEqual(
    first.bars.map(bar => bar.chords.map(chord => chord.parsed?.display)),
    second.bars.map(bar => bar.chords.map(chord => chord.parsed?.display)),
    `Level ${level} is deterministic`
  );
  assert.deepEqual(first.bars.map(bar => bar.barIndex), progression.map(bar => bar.barIndex), 'Bar topology is preserved');
  first.bars.forEach((bar, barIndex) => {
    assert.equal(bar.chords.length, progression[barIndex].chords.length, 'Chord-cell count is preserved');
    bar.chords.forEach(chord => assert.ok(chord.parsed, 'Every substitution remains parseable'));
  });
}

assert.deepEqual(
  progression.map(bar => bar.chords.map(chord => chord.raw)),
  [['C^7'], ['A-7'], ['D-7'], ['G7'], ['C^7'], ['F^7'], ['F-7'], ['C^7']],
  'Derivation never mutates the source bars'
);

const color = Reharm.reharmonizeBars(barsFor(['C^7', 'D-7', 'G7', 'C^7']), {
  level: 1,
  contexts: contextsFor(barsFor(['C^7', 'D-7', 'G7', 'C^7']), 'C'),
  seed: 'color'
});
assert.ok([...color.plan.values()].every(change => change.ruleId === 'color'));

const dominantBars = barsFor(['C^7', 'A-7', 'D-7', 'G7', 'C^7', 'E-7', 'A7', 'D-7']);
const dominant = Reharm.reharmonizeBars(dominantBars, {
  level: 3,
  contexts: contextsFor(dominantBars, 'C'),
  seed: 'dominants'
});
assert.ok(
  [...dominant.plan.values()].some(change => ['secondary-dominant', 'tritone', 'altered-dominant'].includes(change.ruleId)),
  'Level three introduces dominant-function substitutions'
);

const borrowedBars = barsFor(['C^7', 'D-7', 'F^7', 'C^7', 'G7', 'C^7', 'F^7', 'C^7']);
const borrowed = Reharm.reharmonizeBars(borrowedBars, {
  level: 4,
  contexts: contextsFor(borrowedBars, 'C'),
  seed: 'borrowed'
});
assert.ok(
  [...borrowed.plan.values()].some(change => ['borrowed-iv', 'backdoor', 'diminished-approach'].includes(change.ruleId)),
  'Level four introduces borrowed/backdoor/diminished movement'
);

const advancedBars = barsFor(['C^7', 'E-7', 'A-7', 'D-7', 'G7', 'C^7', 'A-7', 'D-7', 'G7', 'C^7']);
const advanced = Reharm.reharmonizeBars(advancedBars, {
  level: 5,
  contexts: contextsFor(advancedBars, 'C'),
  seed: 'advanced'
});
assert.ok([...advanced.plan.values()].some(change => change.ruleId === 'ii-v'), 'Level five introduces a coordinated ii–V');
const advancedGroups = new Map();
[...advanced.plan.values()].filter(change => change.ruleId === 'ii-v').forEach(change => {
  assert.ok(change.groupId, 'Every temporary ii–V keeps an atomic group identity');
  if (!advancedGroups.has(change.groupId)) advancedGroups.set(change.groupId, []);
  advancedGroups.get(change.groupId).push(change);
});
advancedGroups.forEach(group => {
  assert.equal(group.length, 2, 'The reharm density budget must never split a temporary ii–V in half');
});

const melodyGuardBars = barsFor(['D-7', 'G7', 'C^7', 'C^7']);
const unguarded = Reharm.reharmonizeBars(melodyGuardBars, {
  level: 3,
  contexts: contextsFor(melodyGuardBars, 'C'),
  seed: 'guard'
});
const guardedCell = [...unguarded.plan.values()].find(change => change.ruleId === 'tritone')?.cellId;
if (guardedCell) {
  const originalChord = melodyGuardBars.flatMap(bar => bar.chords.map(chord => chord.parsed))[Number(guardedCell.split(':')[0])];
  const rejectedPc = Array.from({ length: 12 }, (_, pc) => pc).find(pc => {
    const proposal = unguarded.plan.get(guardedCell);
    const proposedScale = new Set(Theory.suggestScale(proposal.chord, {}).pcs);
    const originalScale = new Set(Theory.suggestScale(originalChord, {}).pcs);
    return originalScale.has(pc) && !proposedScale.has(pc);
  });
  if (rejectedPc != null) {
    const guarded = Reharm.reharmonizeBars(melodyGuardBars, {
      level: 3,
      contexts: contextsFor(melodyGuardBars, 'C'),
      seed: 'guard',
      melodyPcsByCell: new Map([[guardedCell, [rejectedPc]]])
    });
    assert.notEqual(guarded.plan.get(guardedCell)?.ruleId, 'tritone', 'A melody-conflicting proposal is rejected');
  }
}

const midiBars = [
  { barIndex: 0, sectionId: 'MIDI@0', sectionLabel: 'MIDI', sectionStarts: true, chords: [item('G7', 0, { sourceMarkerIndex: 4 })] },
  { barIndex: 1, sectionId: 'MIDI@0', sectionLabel: 'MIDI', sectionStarts: false, chords: [item('G7', 0, { sourceMarkerIndex: 4, holdOnly: true, holdForCellId: '0:0' })] },
  { barIndex: 2, sectionId: 'MIDI@0', sectionLabel: 'MIDI', sectionStarts: false, chords: [item('C^7')] },
  { barIndex: 3, sectionId: 'MIDI@0', sectionLabel: 'MIDI', sectionStarts: false, chords: [item('D-7')] }
];
const midiResult = Reharm.reharmonizeBars(midiBars, {
  level: 3,
  contexts: contextsFor(midiBars, 'C'),
  seed: 'midi-hold'
});
const markerStart = midiResult.bars[0].chords[0];
const markerHold = midiResult.bars[1].chords[0];
if (markerStart.reharm) {
  assert.equal(markerHold.parsed.display, markerStart.parsed.display, 'A held MIDI marker uses the same reharmonized symbol');
  assert.equal(markerHold.holdOnly, true);
  assert.equal(markerHold.holdForCellId, '0:0');
}

assert.equal(Reharm.normalizeLevel(-3), 0);
assert.equal(Reharm.normalizeLevel(99), 5);
assert.equal(Reharm.normalizeLevel('bad'), 0);

console.log('Jazz standards reharmonization tests passed.');
