"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ireal = require("../ireal.js");

test("exports the same reusable parser surface expected by the browser UI", () => {
  assert.equal(typeof ireal.parsePlaylist, "function");
  assert.equal(typeof ireal.parseChart, "function");
  assert.equal(typeof ireal.parseChordSymbol, "function");
  assert.equal(typeof ireal.parseRoadmapDirective, "function");
  assert.equal(typeof ireal.expandPlayback, "function");
  assert.equal(ireal.MAX_CHORDS_PER_BAR, 4);
  assert.equal(ireal.MAX_PLAYBACK_BARS, 4096);
});

test("keeps literal quality, slash bass, alternate, and bare-major semantics", () => {
  const slash = ireal.parseChordSymbol("Db^9/Ab");
  assert.equal(slash.raw, "Db^9/Ab");
  assert.equal(slash.root, "Db");
  assert.equal(slash.quality, "^9");
  assert.equal(slash.qualityFamily, "major");
  assert.equal(slash.bass, "Ab");

  const alternate = ireal.parseChordSymbol("G7b9(Db7)");
  assert.equal(alternate.raw, "G7b9(Db7)");
  assert.equal(alternate.alternateRaw, "Db7");
  assert.equal(alternate.alternate.root, "Db");

  const bare = ireal.parseChordSymbol("C");
  assert.equal(bare.quality, "");
  assert.equal(bare.qualityFamily, "major");
});

test("resolves invisible W roots without erasing the original symbol", () => {
  const previous = ireal.parseChordSymbol("F^7");
  const invisible = ireal.parseChordSymbol("W/Bb", previous);
  assert.equal(invisible.raw, "W/Bb");
  assert.equal(invisible.literalRoot, "W");
  assert.equal(invisible.root, "F");
  assert.equal(invisible.quality, "^7");
  assert.equal(invisible.bass, "Bb");
  assert.equal(invisible.resolvedRaw, "F^7/Bb");
});

test("preserves four chords, sections, meter, endings, repeats, and playback order", () => {
  const chart = ireal.parseChart("[*AT44{C^7 D-7 G7 C^7LZN1F^7}N2C6/G A7Z");

  assert.equal(chart.bars.length, 3);
  assert.deepEqual(chart.bars[0].chords.map(chord => chord.raw), ["C^7", "D-7", "G7", "C^7"]);
  assert.equal(chart.bars[0].section, "A");
  assert.equal(chart.bars[0].sectionMarker, "A");
  assert.equal(chart.bars[0].timeSignature.value, "44");
  assert.equal(chart.bars[0].repeatStart, true);
  assert.equal(chart.bars[1].ending, 1);
  assert.equal(chart.bars[1].repeatEnd, true);
  assert.equal(chart.bars[2].ending, 2);
  assert.equal(chart.bars[2].chords[0].raw, "C6/G");
  assert.equal(chart.bars[2].chords[0].bass, "G");
  assert.deepEqual(chart.playbackOrder, [0, 1, 0, 2]);
  assert.deepEqual(chart.sections, [{ label: "A", raw: "*A", barIndex: 0 }]);
});

test("keeps roadmap and text annotations on their chart bars", () => {
  const chart = ireal.parseChart("[*AS<Cue>C^7LZQ<Fine>F^7LZ<D.C. al Fine>C7Z");
  assert.equal(chart.bars[0].segno, true);
  assert.deepEqual(chart.bars[0].comments, ["Cue"]);
  assert.equal(chart.bars[1].coda, true);
  assert.equal(chart.bars[1].fine, true);
  assert.ok(chart.annotations.some(entry => entry.annotation.type === "segno"));
  assert.ok(chart.annotations.some(entry => entry.annotation.type === "coda"));
  assert.ok(chart.annotations.some(entry => entry.annotation.text === "D.C. al Fine"));
  assert.ok(chart.playbackOrder.length > chart.bars.length);
});

test("recognizes D.C. and D.S. roadmap spelling variants without losing comment text", () => {
  const cases = [
    ["D.C. al Fine", "dc", "fine", null],
    ["D.S. al Coda", "ds", "coda", null],
    ["D.C. al 1st ending", "dc", "ending", 1],
    ["D.C. al 2nd End.", "dc", "ending", 2],
    ["D.S. al 3rd end.", "ds", "ending", 3],
    ["After solos, D.S. al 2nd End.", "ds", "ending", 2],
    ["Solos on CD, after solos D.S. al Coda", "ds", "coda", null]
  ];
  cases.forEach(([text, type, target, ending]) => {
    const directive = ireal.parseRoadmapDirective(text);
    assert.equal(directive.type, type, text);
    assert.equal(directive.target, target, text);
    assert.equal(directive.ending, ending, text);
    assert.equal(directive.text, text, text);
  });
  assert.equal(ireal.parseRoadmapDirective("Open for solos"), null);
});

test("expands D.S. al Fine from Segno through Fine exactly once", () => {
  const chart = ireal.parseChart("C6LZ[*ASD-7LZG7<Fine>LZA7LZ<D.S. al Fine>E7Z");
  assert.deepEqual(chart.playbackOrder, [0, 1, 2, 3, 4, 1, 2]);
  assert.equal(chart.roadmapDirectives.length, 1);
  assert.deepEqual(chart.roadmapDirectives[0].route, [1, 2]);
  assert.equal(chart.roadmapDirectives[0].kind, "d.s. al fine");
  assert.equal(chart.repeatSections.at(-1).roadmap, true);
  assert.equal(chart.repeatSections.at(-1).kind, "d.s. al fine");
});

test("falls back to chart start when a D.S. export omits its Segno", () => {
  const chart = ireal.parseChart("C6LZD-7<Fine>LZA7LZ<D.S. al Fine>E7Z");
  assert.deepEqual(chart.roadmapDirectives[0].route, [0, 1]);
  assert.deepEqual(chart.playbackOrder, [0, 1, 2, 3, 0, 1]);
  assert.ok(chart.warnings.some(warning => /using chart start/.test(warning.message)));
});

test("routes D.C. and D.S. through To-Coda and resumes at the printed Coda", () => {
  const dc = ireal.parseChart("C^7LZQD-7LZE7LZ<D.C. al Coda>F7]QG7LZC6Z");
  assert.deepEqual(dc.roadmapDirectives[0].route, [0, 1]);
  assert.deepEqual(dc.playbackOrder, [0, 1, 2, 3, 0, 1, 4, 5]);

  const ds = ireal.parseChart("C^7LZSD-7LZQE7LZF7LZ<D.S. al Coda>G7]QA7LZD6Z");
  assert.deepEqual(ds.roadmapDirectives[0].route, [1, 2]);
  assert.deepEqual(ds.playbackOrder, [0, 1, 2, 3, 4, 1, 2, 5, 6]);
});

test("selects numbered endings for D.C. including future third endings", () => {
  const first = ireal.parseChart(
    "{C^7LZN1D-7}N2G7<Fine>LZA7LZ<After solos, D.C. al 1st ending>E7Z"
  );
  assert.deepEqual(first.roadmapDirectives[0].route, [0, 1]);
  assert.equal(first.roadmapDirectives[0].afterSolos, true);
  assert.deepEqual(first.playbackOrder.slice(-2), [0, 1]);

  const second = ireal.parseChart(
    "{C^7LZN1D-7}N2G7<Fine>LZA7LZ<D.C. al 2nd End.>E7Z"
  );
  assert.deepEqual(second.roadmapDirectives[0].route, [0, 2]);
  assert.deepEqual(second.playbackOrder.slice(-2), [0, 2]);

  const third = ireal.parseChart(
    "{C^7LZN1D-7}N2E7LZA7LZ<D.C. al 3rd End.>B7]N3F^7LZG7Z"
  );
  assert.deepEqual(third.roadmapDirectives[0].route, [0]);
  assert.deepEqual(third.playbackOrder, [0, 1, 0, 2, 3, 4, 0, 5, 6]);
});

test("selects first, second, and future third endings after a Segno", () => {
  const first = ireal.parseChart(
    "C6LZ{SD-7LZN1E7}N2F7<Fine>LZA7LZ<After solos, D.S. al 1st End.>B7Z"
  );
  assert.deepEqual(first.roadmapDirectives[0].route, [1, 2]);
  assert.equal(first.roadmapDirectives[0].afterSolos, true);

  const second = ireal.parseChart(
    "C6LZ{SD-7LZN1E7}N2F7<Fine>LZA7LZ<D.S. al 2nd ending>B7Z"
  );
  assert.deepEqual(second.roadmapDirectives[0].route, [1, 3]);
  assert.deepEqual(second.playbackOrder.slice(-2), [1, 3]);

  const third = ireal.parseChart(
    "C6LZ{SD-7LZN1E7}N2F7LZA7LZ<D.S. al 3rd End.>B7]N3E^7Z"
  );
  assert.deepEqual(third.roadmapDirectives[0].route, [1]);
  assert.deepEqual(third.playbackOrder.slice(-2), [1, 6]);
});

test("caps roadmap expansion and never recursively replays a copied directive", () => {
  const chart = ireal.parseChart(
    "C^7LZD-7LZG7<Fine>LZ<After solos, D.C. al Fine>A7Z",
    { maxPlaybackBars: 5 }
  );
  assert.equal(chart.playbackOrder.length, 5);
  assert.deepEqual(chart.playbackOrder, [0, 1, 2, 3, 0]);
  assert.equal(chart.roadmapDirectives.length, 1);
  assert.ok(chart.warnings.some(warning => /capped at 5 bars/.test(warning.message)));
});

test("preserves alternate-only cells instead of discarding their parentheses", () => {
  const chart = ireal.parseChart("C7(G-7) (C7)LZF7Z");
  assert.equal(chart.bars[0].chords[0].alternateRaw, "G-7");
  assert.equal(chart.bars[0].chords[1].raw, "(C7)");
  assert.equal(chart.bars[0].chords[1].isAlternateOnly, true);
  assert.equal(chart.bars[0].chords[1].alternate.root, "C");
  assert.equal(chart.warnings.length, 0);
});

test("resolves one-bar, Kcl, and two-bar repeat cells while retaining their symbols", () => {
  const oneBar = ireal.parseChart("C^7LZxZ");
  assert.deepEqual(oneBar.bars[1].chords.map(chord => chord.raw), ["C^7"]);
  assert.equal(oneBar.bars[1].repeatSymbol, "x");
  assert.equal(oneBar.bars[1].chords[0].inherited, true);

  const kcl = ireal.parseChart("F^7KclZ");
  assert.deepEqual(kcl.bars.map(bar => bar.chords[0].raw), ["F^7", "F^7"]);
  assert.equal(kcl.bars[1].repeatSymbol, "x");

  const twoBars = ireal.parseChart("C^7LZD-7 G7LZrZ");
  assert.deepEqual(twoBars.bars.map(bar => bar.chords.map(chord => chord.raw)), [
    ["C^7"],
    ["D-7", "G7"],
    ["C^7"],
    ["D-7", "G7"]
  ]);
  assert.equal(twoBars.bars[2].repeatSymbol, "r");
  assert.equal(twoBars.bars[3].repeatSymbol, "r");
});

test("retains exact empty metadata fields in modern ten-field song records", () => {
  const chunk = "Test Tune=Writer Name==Medium Swing=Bb==" +
    ireal.MUSIC_PREFIX + "[*AT44Bb C-7 F7 BbZ==132=2";
  const payload = encodeURIComponent(chunk + "===Test Book");
  const playlist = ireal.parsePlaylist(`[url=irealb://${payload}]Test Book[/url]`);

  assert.equal(playlist.name, "Test Book");
  assert.equal(playlist.errors.length, 0);
  assert.equal(playlist.songs.length, 1);
  const song = playlist.songs[0];
  assert.equal(song.title, "Test Tune");
  assert.equal(song.composer, "Writer Name");
  assert.equal(song.extra, "");
  assert.equal(song.style, "Medium Swing");
  assert.equal(song.key, "Bb");
  assert.equal(song.transpose, null);
  assert.equal(song.compStyle, "");
  assert.equal(song.bpm, 132);
  assert.equal(song.repeats, 2);
  assert.equal(song.bars[0].chords.length, 4);
});

test("parses the canonical Fakebot catalog when the sibling checkout is available", t => {
  const catalogPath = path.resolve(__dirname, "../../fakebot/real playlist.txt");
  if (!fs.existsSync(catalogPath)) {
    t.skip("Fakebot catalog is not present in this checkout");
    return;
  }

  const playlist = ireal.parsePlaylist(fs.readFileSync(catalogPath, "utf8"));
  assert.equal(playlist.name, "Jazz 1460");
  assert.equal(playlist.songs.length, 1460);
  assert.equal(playlist.errors.length, 0);
  assert.ok(playlist.songs.every(song => song.title && song.bars.length));
  assert.ok(playlist.songs.every(song => song.bars.every(bar => bar.chords.length <= 4)));
  assert.ok(playlist.songs.every(song => song.playbackOrder.length <= ireal.MAX_PLAYBACK_BARS));
  assert.ok(playlist.songs.some(song => song.sections.some(section => section.label === "A")));
  assert.ok(playlist.songs.some(song => song.bars.some(bar => bar.chords.some(chord => chord.bass))));

  const butterfly = playlist.songs.find(song => song.title === "Butterfly Dreams");
  assert.equal(butterfly.music.roadmapDirectives[0].kind, "d.s. al fine");
  assert.ok(butterfly.music.roadmapDirectives[0].route.length > 0);

  const crisis = playlist.songs.find(song => song.title === "Crisis");
  assert.equal(crisis.music.roadmapDirectives[0].kind, "d.s. al 2nd ending");
  assert.deepEqual(crisis.music.roadmapDirectives[0].route.slice(-1), [20]);

  const withoutASong = playlist.songs.find(song => song.title === "Without A Song");
  assert.equal(withoutASong.music.roadmapDirectives[0].kind, "d.c. al 3rd ending");
  assert.deepEqual(withoutASong.playbackOrder.slice(-5), [28, 29, 30, 31, 32]);

  const slippedDisc = playlist.songs.find(song => song.title === "Slipped Disc");
  assert.equal(slippedDisc.music.roadmapDirectives[0].afterSolos, true);
  assert.equal(slippedDisc.music.roadmapDirectives[0].kind, "d.c. al fine");

  const delSasser = playlist.songs.find(song => song.title === "Del Sasser");
  assert.ok(delSasser.music.roadmapDirectives[0].route.length > 0);
  assert.ok(delSasser.music.warnings.some(warning => /using chart start/.test(warning.message)));
});
