/*
 * Keyer tab import bridge.
 *
 * Guitar Pro files retain the physical string and fret selected by the
 * author.  This adapter turns those source notes into Keyer's small MIDI
 * shape while keeping that physical-position data attached to every beat.
 */
(function attachKeyerTabImport(root, factory) {
  var alphaTab = root && root.alphaTab;
  if (!alphaTab && typeof module === 'object' && module.exports) alphaTab = require('./vendor/score-reader/alphaTab.min.js');
  var api = factory(alphaTab);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KeyerTabImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildKeyerTabImport(alphaTab) {
  'use strict';

  var PPQ = 960;
  var DIRECT_EXTENSIONS = Object.freeze(['gp', 'gpx', 'gp3', 'gp4', 'gp5', 'musicxml', 'xml']);
  var CONVERSION_EXTENSIONS = Object.freeze(['ptb', 'pt2']);

  function extensionOf(value) {
    var match = String(value || '').trim().match(/\.([^.\\/]+)$/);
    return match ? match[1].toLowerCase() : '';
  }

  function titleFromFileName(value) {
    return String(value || '')
      .replace(/^.*[\\/]/, '')
      .replace(/\.[^.]+$/, '')
      .replace(/^\d+[\s_.-]*/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Untitled tab';
  }

  function isDirectlySupported(value) {
    return DIRECT_EXTENSIONS.indexOf(extensionOf(value)) >= 0;
  }

  function requiresConversion(value) {
    return CONVERSION_EXTENSIONS.indexOf(extensionOf(value)) >= 0;
  }

  function supportedFileMessage(value) {
    if (isDirectlySupported(value)) return '';
    if (requiresConversion(value)) {
      return 'Power Tab files need conversion first. Open the .ptb in Power Tab Editor and export a Guitar Pro (.gp) or MusicXML (.musicxml) file; those formats keep the authored string and fret positions in Keyer.';
    }
    return 'Keyer can read Guitar Pro (.gp, .gpx, .gp3–.gp5) and MusicXML (.musicxml, .xml) tabs.';
  }

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clampMidi(value) {
    return Math.max(0, Math.min(127, Math.round(number(value, 60))));
  }

  function readableTrackName(track, index) {
    return String(track && (track.name || track.shortName) || '').trim() || 'Track ' + (index + 1);
  }

  function isFrettedTrack(track) {
    return Boolean(track && Array.isArray(track.staves) && track.staves.some(function hasTuning(staff) {
      return Array.isArray(staff && staff.tuning) && staff.tuning.length > 0;
    }));
  }

  function staffForTrack(track) {
    return (track && track.staves || []).find(function hasTuning(staff) {
      return Array.isArray(staff && staff.tuning) && staff.tuning.length > 0;
    }) || track && track.staves && track.staves[0] || null;
  }

  function trackDefinitions(score) {
    return (score && score.tracks || []).map(function define(track, index) {
      var staff = staffForTrack(track);
      var tuning = Array.isArray(staff && staff.tuning) ? staff.tuning.map(function midi(value) { return clampMidi(value); }) : [];
      return Object.freeze({
        index: index,
        name: readableTrackName(track, index),
        fretted: tuning.length > 0,
        tuning: Object.freeze(tuning),
        stringCount: tuning.length
      });
    });
  }

  function preferredTrackIndex(score) {
    var definitions = trackDefinitions(score);
    var guitar = definitions.find(function guitarTrack(track) { return track.fretted && /guitar|lead|rhythm/i.test(track.name); });
    var nonBass = definitions.find(function nonBassTrack(track) { return track.fretted && !/bass/i.test(track.name); });
    var anyFretted = definitions.find(function frettedTrack(track) { return track.fretted; });
    return guitar ? guitar.index : nonBass ? nonBass.index : anyFretted ? anyFretted.index : 0;
  }

  function scoreTempo(score) {
    return Math.max(30, Math.min(300, Math.round(number(score && score.tempo, 120))));
  }

  function masterBarDuration(masterBar) {
    var numerator = Math.max(1, number(masterBar && masterBar.timeSignatureNumerator, 4));
    var denominator = Math.max(1, number(masterBar && masterBar.timeSignatureDenominator, 4));
    return Math.max(1, Math.round(PPQ * numerator * 4 / denominator));
  }

  function scoreDurationTicks(score) {
    var bars = Array.isArray(score && score.masterBars) ? score.masterBars : [];
    if (!bars.length) return PPQ * 4;
    var finalBar = bars[bars.length - 1];
    return Math.max(PPQ, Math.round(number(finalBar && finalBar.start, 0) + masterBarDuration(finalBar)));
  }

  function scoreTempos(score) {
    var defaultTempo = scoreTempo(score);
    var result = [{ tick: 0, time: 0, bpm: defaultTempo, mpq: Math.round(60000000 / defaultTempo) }];
    (score && score.masterBars || []).forEach(function readBar(bar) {
      var automation = bar && bar.tempoAutomation;
      var bpm = number(automation && automation.value, NaN);
      var tick = Math.round(number(bar && bar.start, 0));
      if (!Number.isFinite(bpm) || bpm < 20 || tick < 0) return;
      var previous = result[result.length - 1];
      if (previous && previous.tick === tick) {
        previous.bpm = bpm;
        previous.mpq = Math.round(60000000 / bpm);
        return;
      }
      if (previous && previous.bpm === bpm) return;
      result.push({ tick: tick, time: tick * 60 / (PPQ * bpm), bpm: bpm, mpq: Math.round(60000000 / bpm) });
    });
    return result;
  }

  function scoreTimeSignatures(score) {
    var result = [];
    (score && score.masterBars || []).forEach(function readBar(bar, index) {
      var tick = Math.round(number(bar && bar.start, 0));
      var numerator = Math.max(1, Math.round(number(bar && bar.timeSignatureNumerator, 4)));
      var denominator = Math.max(1, Math.round(number(bar && bar.timeSignatureDenominator, 4)));
      var previous = result[result.length - 1];
      if (previous && previous.numerator === numerator && previous.denominator === denominator) return;
      result.push({
        tick: tick,
        time: 0,
        numerator: numerator,
        denominator: denominator,
        clocksPerClick: 24,
        thirtySecondNotes: 8,
        barIndex: index
      });
    });
    if (!result.length) result.push({ tick: 0, time: 0, numerator: 4, denominator: 4, clocksPerClick: 24, thirtySecondNotes: 8, barIndex: 0 });
    return result;
  }

  function barsForScore(score) {
    var masterBars = Array.isArray(score && score.masterBars) ? score.masterBars : [];
    var scoreEnd = scoreDurationTicks(score);
    var previousMeter = '';
    return masterBars.flatMap(function chartBar(masterBar, index) {
      var startTick = Math.max(0, Math.round(number(masterBar && masterBar.start, 0)));
      var next = masterBars[index + 1];
      var endTick = next
        ? Math.round(number(next && next.start, startTick))
        : scoreEnd;
      // GPX can include a zero-duration anacrusis master bar before bar one.
      // It has no playable time, so omit it instead of adding a second chart
      // measure at beat zero.
      if (endTick <= startTick) return [];
      var numerator = Math.max(1, Math.round(number(masterBar && masterBar.timeSignatureNumerator, 4)));
      var denominator = Math.max(1, Math.round(number(masterBar && masterBar.timeSignatureDenominator, 4)));
      var meter = numerator + '/' + denominator;
      var startBeat = startTick / PPQ;
      var endBeat = endTick / PPQ;
      var bar = {
        index: index,
        chords: [{ raw: 'C5', tabPlaceholder: true, startBeat: startBeat, endBeat: endBeat }],
        overflowChords: [],
        section: 'Tab',
        sectionMarker: previousMeter ? null : 'Tab',
        timeSignature: { beats: numerator, beatUnit: denominator },
        timeSignatureChange: !previousMeter || previousMeter !== meter ? { beats: numerator, beatUnit: denominator } : null,
        annotations: [],
        comments: [],
        repeatStart: false,
        repeatEnd: false,
        noChord: false,
        pause: false,
        startBeat: startBeat,
        endBeat: endBeat
      };
      previousMeter = meter;
      return [bar];
    });
  }

  function tabPosition(note, tuning) {
    var authoredString = Math.round(number(note && note.string, 0));
    var fret = Math.max(0, Math.round(number(note && note.fret, 0)));
    var stringIndex = tuning.length - authoredString;
    if (!Number.isInteger(stringIndex) || stringIndex < 0 || stringIndex >= tuning.length) return null;
    var computedMidi = tuning[stringIndex] + fret;
    var midi = clampMidi(note && note.realValue != null ? note.realValue : computedMidi);
    return {
      stringIndex: stringIndex,
      sourceString: authoredString,
      fret: fret,
      midi: midi,
      exact: true,
      techniques: {
        dead: Boolean(note && note.isDead),
        palmMute: Boolean(note && note.isPalmMute),
        letRing: Boolean(note && note.isLetRing),
        hammerPull: Boolean(note && note.isHammerPullOrigin),
        tieDestination: Boolean(note && note.isTieDestination)
      }
    };
  }

  function notesForTrack(track, trackIndex, tuning, bpm) {
    var staff = staffForTrack(track);
    var notes = [];
    (staff && staff.bars || []).forEach(function inspectBar(bar, barIndex) {
      // alphaTab exposes Beat.playbackStart relative to its measure. The
      // master-bar offset turns that into the score-wide tick position Keyer
      // needs for a complete song instead of replaying every bar at beat one.
      var barStart = Math.max(0, Math.round(number(bar && bar.masterBar && bar.masterBar.start, 0)));
      (bar && bar.voices || []).forEach(function inspectVoice(voice, voiceIndex) {
        (voice && voice.beats || []).forEach(function inspectBeat(beat, beatIndex) {
          var tick = barStart + Math.max(0, Math.round(number(beat && beat.playbackStart, 0)));
          var durationTicks = Math.max(1, Math.round(number(beat && beat.playbackDuration, PPQ / 4)));
          (beat && beat.notes || []).forEach(function inspectNote(sourceNote, noteIndex) {
            var position = tabPosition(sourceNote, tuning);
            if (!position) return;
            var velocity = number(sourceNote && sourceNote.velocity, 95);
            if (velocity > 1) velocity /= 127;
            notes.push({
              id: 'tab-' + trackIndex + '-' + barIndex + '-' + voiceIndex + '-' + beatIndex + '-' + noteIndex,
              trackIndex: trackIndex,
              trackName: readableTrackName(track, trackIndex),
              channel: 1,
              midi: position.midi,
              velocity: Math.max(0.08, Math.min(1, velocity)),
              tick: tick,
              durationTicks: durationTicks,
              endTick: tick + durationTicks,
              time: tick * 60 / (PPQ * bpm),
              duration: durationTicks * 60 / (PPQ * bpm),
              tabPosition: position
            });
          });
        });
      });
    });
    return notes.sort(function chronological(left, right) {
      return left.tick - right.tick || left.tabPosition.stringIndex - right.tabPosition.stringIndex || left.midi - right.midi;
    });
  }

  function parseScore(bytes, fileName) {
    if (!alphaTab || !alphaTab.importer || !alphaTab.importer.ScoreLoader) {
      throw new Error('The Guitar Pro reader did not load. Reload Keyer and try again.');
    }
    if (!isDirectlySupported(fileName)) throw new Error(supportedFileMessage(fileName));
    var data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(data);
    if (!score || !Array.isArray(score.tracks) || !score.tracks.length) throw new Error('This tab has no readable tracks.');
    var tracks = trackDefinitions(score);
    if (!tracks.some(function fretted(track) { return track.fretted; })) throw new Error('This tab has no fretted guitar or bass track.');
    return Object.freeze({
      sourceFormat: 'guitar-pro',
      fileName: String(fileName || ''),
      title: String(score.title || titleFromFileName(fileName)),
      artist: String(score.artist || score.music || ''),
      bpm: scoreTempo(score),
      score: score,
      tracks: Object.freeze(tracks),
      preferredTrackIndex: preferredTrackIndex(score),
      bars: Object.freeze(barsForScore(score))
    });
  }

  function midiForTrack(parsed, trackIndex) {
    if (!parsed || !parsed.score) throw new Error('No Guitar Pro score is loaded.');
    var index = Math.max(0, Math.min(parsed.tracks.length - 1, Math.round(number(trackIndex, parsed.preferredTrackIndex))));
    var definition = parsed.tracks[index];
    if (!definition || !definition.fretted) throw new Error('Choose a guitar or bass track with tab positions.');
    var track = parsed.score.tracks[index];
    var bpm = parsed.bpm;
    var notes = notesForTrack(track, index, definition.tuning, bpm);
    if (!notes.length) throw new Error(definition.name + ' has no readable fretted notes.');
    return {
      fileName: parsed.title + ' · ' + definition.name + '.mid',
      title: parsed.title,
      format: 1,
      ppq: PPQ,
      durationTicks: scoreDurationTicks(parsed.score),
      duration: scoreDurationTicks(parsed.score) * 60 / (PPQ * bpm),
      tempos: scoreTempos(parsed.score),
      timeSignatures: scoreTimeSignatures(parsed.score),
      keySignatures: [],
      markers: [],
      tracks: [{
        index: index,
        name: definition.name,
        channels: [1],
        programs: { 1: number(track && track.playbackInfo && track.playbackInfo.program, 29) },
        notes: notes
      }],
      sourceFormat: 'guitar-pro',
      tabSource: {
        sourceFormat: 'guitar-pro',
        fileName: parsed.fileName,
        title: parsed.title,
        artist: parsed.artist,
        trackIndex: index,
        trackName: definition.name,
        tuning: definition.tuning.slice(),
        exactPositions: true
      }
    };
  }

  function songForParsedTab(parsed, entry, trackIndex) {
    var index = Math.max(0, Math.min(parsed.tracks.length - 1, Math.round(number(trackIndex, parsed.preferredTrackIndex))));
    var track = parsed.tracks[index];
    return {
      title: parsed.title,
      composer: parsed.artist || 'Tab import',
      style: 'Original tab fingering · ' + (track && track.name || 'track'),
      key: '',
      bpm: parsed.bpm,
      bars: parsed.bars.map(function copy(bar) { return Object.assign({}, bar, { chords: bar.chords.map(function clone(chord) { return Object.assign({}, chord); }) }); }),
      playbackOrder: parsed.bars.map(function bar(_, barIndex) { return barIndex; }),
      tabEntry: entry,
      tabTrackIndex: index,
      tabSource: true,
      tabTiming: true
    };
  }

  return Object.freeze({
    PPQ: PPQ,
    directExtensions: DIRECT_EXTENSIONS,
    conversionExtensions: CONVERSION_EXTENSIONS,
    extensionOf: extensionOf,
    titleFromFileName: titleFromFileName,
    isDirectlySupported: isDirectlySupported,
    requiresConversion: requiresConversion,
    supportedFileMessage: supportedFileMessage,
    parseScore: parseScore,
    midiForTrack: midiForTrack,
    songForParsedTab: songForParsedTab,
    trackDefinitions: trackDefinitions,
    preferredTrackIndex: preferredTrackIndex
  });
});
