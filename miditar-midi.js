/*
 * Keyer / Miditar MIDI bridge.
 *
 * A deliberately small Standard MIDI File reader for the Standards view.  It
 * has no package dependency, so it is safe to load on the static GitHub Pages
 * build as `window.KeyerMiditarMidi` and in the Node test suite through
 * CommonJS.  It reads the practical subset Keyer needs from a .mid file:
 * tracks, note events, tempo, meter, and text/marker meta events.
 */
(function attachKeyerMiditarMidi(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KeyerMiditarMidi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildKeyerMiditarMidi() {
  'use strict';

  var DEFAULT_MPQ = 500000;
  var MIDI_EXTENSION = /\.(?:mid|midi)$/i;
  var PITCH_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

  function asBytes(input) {
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    throw new TypeError('Expected an ArrayBuffer or typed-array MIDI payload.');
  }

  function assertRange(bytes, offset, length, label) {
    if (offset < 0 || length < 0 || offset + length > bytes.length) {
      throw new Error('Unexpected end of MIDI data' + (label ? ' while reading ' + label : '') + '.');
    }
  }

  function readUint16(bytes, offset) {
    assertRange(bytes, offset, 2, 'a 16-bit value');
    return (bytes[offset] << 8) | bytes[offset + 1];
  }

  function readUint32(bytes, offset) {
    assertRange(bytes, offset, 4, 'a 32-bit value');
    return (
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]
    ) >>> 0;
  }

  function ascii(bytes, offset, length) {
    assertRange(bytes, offset, length, 'an ASCII chunk tag');
    var text = '';
    for (var index = 0; index < length; index += 1) text += String.fromCharCode(bytes[offset + index]);
    return text;
  }

  function readVarLength(bytes, offset, end) {
    var value = 0;
    var cursor = offset;
    var count = 0;

    while (cursor < end) {
      var byte = bytes[cursor];
      cursor += 1;
      count += 1;
      value = (value << 7) | (byte & 0x7f);
      if ((byte & 0x80) === 0) return { value: value, offset: cursor };
      if (count >= 4) throw new Error('Invalid variable-length MIDI value.');
    }

    throw new Error('Unexpected end of MIDI data while reading a variable-length value.');
  }

  function decodeText(bytes) {
    var trimmed = [];
    for (var index = 0; index < bytes.length; index += 1) {
      if (bytes[index] !== 0) trimmed.push(bytes[index]);
    }

    if (typeof TextDecoder !== 'undefined') {
      try {
        return new TextDecoder('utf-8').decode(new Uint8Array(trimmed)).trim();
      } catch (error) {
        // Fall through to the Latin-1-compatible decoding below.  Some older
        // embedded browsers expose TextDecoder but reject its constructor.
      }
    }

    var text = '';
    for (var charIndex = 0; charIndex < trimmed.length; charIndex += 1) {
      text += String.fromCharCode(trimmed[charIndex]);
    }
    return text.trim();
  }

  function cleanFileName(fileName) {
    var source = String(fileName || 'Untitled.mid').replace(/\\/g, '/');
    var basename = source.split('/').pop() || 'Untitled.mid';
    return basename.replace(MIDI_EXTENSION, '') || 'Untitled';
  }

  function sortByTick(a, b) {
    return a.tick - b.tick || (a.order || 0) - (b.order || 0);
  }

  function normalizeTempos(rawTempos, ppq) {
    var ordered = rawTempos.slice().sort(sortByTick);
    var compact = [];
    for (var index = 0; index < ordered.length; index += 1) {
      var tempo = ordered[index];
      if (!tempo || !Number.isFinite(tempo.mpq) || tempo.mpq <= 0) continue;
      if (compact.length && compact[compact.length - 1].tick === tempo.tick) {
        compact[compact.length - 1] = tempo;
      } else {
        compact.push(tempo);
      }
    }
    if (!compact.length || compact[0].tick !== 0) compact.unshift({ tick: 0, mpq: DEFAULT_MPQ, order: -1 });

    var seconds = 0;
    var previousTick = compact[0].tick;
    var previousMpq = DEFAULT_MPQ;
    return compact.map(function mapTempo(tempo, index) {
      if (index === 0) {
        previousTick = tempo.tick;
        previousMpq = tempo.mpq;
        return {
          tick: tempo.tick,
          time: 0,
          bpm: 60000000 / tempo.mpq,
          mpq: tempo.mpq
        };
      }
      seconds += ((tempo.tick - previousTick) * previousMpq) / ppq / 1000000;
      previousTick = tempo.tick;
      previousMpq = tempo.mpq;
      return {
        tick: tempo.tick,
        time: seconds,
        bpm: 60000000 / tempo.mpq,
        mpq: tempo.mpq
      };
    });
  }

  function ticksToSeconds(tick, tempos, ppq) {
    var target = Math.max(0, Number(tick) || 0);
    var timeline = Array.isArray(tempos) && tempos.length
      ? tempos.slice().sort(sortByTick)
      : [{ tick: 0, time: 0, mpq: DEFAULT_MPQ }];
    var active = timeline[0];
    for (var index = 1; index < timeline.length; index += 1) {
      if (timeline[index].tick > target) break;
      active = timeline[index];
    }
    var activeTime = Number.isFinite(active.time) ? active.time : 0;
    var mpq = Number.isFinite(active.mpq) && active.mpq > 0 ? active.mpq : DEFAULT_MPQ;
    return activeTime + ((target - active.tick) * mpq) / ppq / 1000000;
  }

  function midiTicksToSeconds(midi, tick) {
    if (!midi || !Number.isFinite(midi.ppq) || midi.ppq <= 0) return 0;
    return ticksToSeconds(tick, midi.tempos, midi.ppq);
  }

  function secondsToMidiTicks(midi, seconds) {
    if (!midi || !Number.isFinite(midi.ppq) || midi.ppq <= 0) return 0;
    var target = Math.max(0, Number(seconds) || 0);
    var timeline = Array.isArray(midi.tempos) && midi.tempos.length
      ? midi.tempos.slice().sort(function sortByTime(a, b) { return a.time - b.time || a.tick - b.tick; })
      : [{ tick: 0, time: 0, mpq: DEFAULT_MPQ }];
    var active = timeline[0];
    for (var index = 1; index < timeline.length; index += 1) {
      if (timeline[index].time > target) break;
      active = timeline[index];
    }
    var activeTime = Number.isFinite(active.time) ? active.time : 0;
    var mpq = Number.isFinite(active.mpq) && active.mpq > 0 ? active.mpq : DEFAULT_MPQ;
    return Math.round(active.tick + ((target - activeTime) * 1000000 * midi.ppq) / mpq);
  }

  function noteName(midi) {
    var normalized = Math.max(0, Math.min(127, Math.round(Number(midi) || 0)));
    return PITCH_NAMES[normalized % 12] + (Math.floor(normalized / 12) - 1);
  }

  function uniqueSorted(values) {
    var seen = {};
    values.forEach(function mark(value) { seen[value] = true; });
    return Object.keys(seen).map(Number).sort(function ascending(a, b) { return a - b; });
  }

  function closeActiveNotes(activeNotes, rawNotes, closeTick) {
    activeNotes.forEach(function closeStack(stack) {
      stack.forEach(function closeNote(note) {
        note.durationTicks = Math.max(1, closeTick - note.tick);
        note.endTick = note.tick + note.durationTicks;
        rawNotes.push(note);
      });
    });
  }

  function parseMidi(input, fileName) {
    var bytes = asBytes(input);
    if (bytes.length < 14 || ascii(bytes, 0, 4) !== 'MThd') {
      throw new Error('This does not look like a Standard MIDI file.');
    }

    var headerLength = readUint32(bytes, 4);
    if (headerLength < 6) throw new Error('The MIDI header is incomplete.');
    assertRange(bytes, 8, headerLength, 'the MIDI header');

    var format = readUint16(bytes, 8);
    var trackCount = readUint16(bytes, 10);
    var division = readUint16(bytes, 12);
    if (division & 0x8000) {
      throw new Error('SMPTE-timed MIDI files are not supported by the Standards melody reader.');
    }
    if (!division) throw new Error('The MIDI file has an invalid ticks-per-quarter-note value.');

    var ppq = division;
    var offset = 8 + headerLength;
    var rawTracks = [];
    var rawMarkers = [];
    var rawTempos = [];
    var rawTimeSignatures = [];
    var rawKeySignatures = [];
    var title = cleanFileName(fileName);
    var durationTicks = 0;
    var sequence = 0;

    for (var trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
      if (ascii(bytes, offset, 4) !== 'MTrk') {
        throw new Error('Expected MTrk at track ' + (trackIndex + 1) + '.');
      }
      var trackLength = readUint32(bytes, offset + 4);
      var trackStart = offset + 8;
      var endOffset = trackStart + trackLength;
      assertRange(bytes, trackStart, trackLength, 'MIDI track ' + (trackIndex + 1));

      var cursor = trackStart;
      var tick = 0;
      var trackEndTick = 0;
      var runningStatus = null;
      var trackName = 'Track ' + (trackIndex + 1);
      var noteSequence = 0;
      var activeNotes = new Map();
      var rawNotes = [];
      var channels = [];
      var channelSet = {};
      var programs = {};

      while (cursor < endOffset) {
        var delta = readVarLength(bytes, cursor, endOffset);
        tick += delta.value;
        trackEndTick = Math.max(trackEndTick, tick);
        durationTicks = Math.max(durationTicks, tick);
        cursor = delta.offset;
        assertRange(bytes, cursor, 1, 'a MIDI event status byte');

        var status = bytes[cursor];
        var firstDataByte = null;
        if (status < 0x80) {
          if (runningStatus === null) {
            throw new Error('Invalid running status in track ' + (trackIndex + 1) + '.');
          }
          firstDataByte = status;
          status = runningStatus;
          cursor += 1;
        } else {
          cursor += 1;
          if (status < 0xf0) runningStatus = status;
        }

        if (status === 0xff) {
          assertRange(bytes, cursor, 1, 'a MIDI meta-event type');
          var metaType = bytes[cursor];
          cursor += 1;
          var metaLength = readVarLength(bytes, cursor, endOffset);
          cursor = metaLength.offset;
          assertRange(bytes, cursor, metaLength.value, 'a MIDI meta-event payload');
          var payload = bytes.slice(cursor, cursor + metaLength.value);
          cursor += metaLength.value;

          if (metaType === 0x2f) break;
          if (metaType === 0x03) {
            trackName = decodeText(payload) || trackName;
            if (trackIndex === 0 && trackName) title = trackName.trim();
          } else if (metaType === 0x01 || metaType === 0x05 || metaType === 0x06) {
            var text = decodeText(payload);
            if (text) {
              rawMarkers.push({
                tick: tick,
                text: text,
                type: metaType === 0x06 ? 'marker' : metaType === 0x05 ? 'lyric' : 'text',
                trackIndex: trackIndex,
                trackName: trackName,
                order: sequence++
              });
            }
          } else if (metaType === 0x51 && payload.length >= 3) {
            var mpq = (payload[0] << 16) | (payload[1] << 8) | payload[2];
            if (mpq > 0) rawTempos.push({ tick: tick, mpq: mpq, order: sequence++ });
          } else if (metaType === 0x58 && payload.length >= 4) {
            rawTimeSignatures.push({
              tick: tick,
              numerator: payload[0],
              denominator: Math.pow(2, payload[1]),
              clocksPerClick: payload[2],
              thirtySecondNotes: payload[3],
              order: sequence++
            });
          } else if (metaType === 0x59 && payload.length >= 2) {
            rawKeySignatures.push({
              tick: tick,
              sf: payload[0] > 127 ? payload[0] - 256 : payload[0],
              minor: payload[1] === 1,
              order: sequence++
            });
          }
          continue;
        }

        if (status === 0xf0 || status === 0xf7) {
          var sysexLength = readVarLength(bytes, cursor, endOffset);
          cursor = sysexLength.offset;
          assertRange(bytes, cursor, sysexLength.value, 'a MIDI system-exclusive payload');
          cursor += sysexLength.value;
          continue;
        }

        if (status >= 0xf1) {
          var systemDataLength = status === 0xf1 || status === 0xf3 ? 1 : status === 0xf2 ? 2 : 0;
          assertRange(bytes, cursor, systemDataLength, 'a MIDI system message');
          cursor += systemDataLength;
          continue;
        }

        var eventType = status & 0xf0;
        var channel = status & 0x0f;
        var data1;
        if (firstDataByte === null) {
          assertRange(bytes, cursor, 1, 'a MIDI event data byte');
          data1 = bytes[cursor];
          cursor += 1;
        } else {
          data1 = firstDataByte;
        }

        if (eventType === 0xc0 || eventType === 0xd0) {
          if (eventType === 0xc0) programs[channel + 1] = data1;
          continue;
        }

        assertRange(bytes, cursor, 1, 'a MIDI event data byte');
        var data2 = bytes[cursor];
        cursor += 1;

        if (eventType === 0x90 && data2 > 0) {
          var key = channel + ':' + data1;
          var note = {
            id: trackIndex + '-' + noteSequence,
            trackIndex: trackIndex,
            trackName: trackName,
            channel: channel + 1,
            midi: data1,
            velocity: data2 / 127,
            tick: tick,
            durationTicks: 0,
            endTick: tick
          };
          noteSequence += 1;
          if (!activeNotes.has(key)) activeNotes.set(key, []);
          activeNotes.get(key).push(note);
          if (!channelSet[channel + 1]) {
            channelSet[channel + 1] = true;
            channels.push(channel + 1);
          }
        } else if (eventType === 0x80 || (eventType === 0x90 && data2 === 0)) {
          var noteKey = channel + ':' + data1;
          var noteStack = activeNotes.get(noteKey);
          var activeNote = noteStack && noteStack.shift();
          if (activeNote) {
            activeNote.durationTicks = Math.max(1, tick - activeNote.tick);
            activeNote.endTick = tick;
            rawNotes.push(activeNote);
          }
        }
      }

      closeActiveNotes(activeNotes, rawNotes, Math.max(1, trackEndTick));
      rawTracks.push({
        index: trackIndex,
        name: trackName.trim(),
        notes: rawNotes.sort(function sortNotes(a, b) { return a.tick - b.tick || a.midi - b.midi; }),
        channels: uniqueSorted(channels),
        programs: programs
      });
      offset = endOffset;
    }

    var tempos = normalizeTempos(rawTempos, ppq);
    var tracks = rawTracks.map(function mapTrack(track) {
      return {
        index: track.index,
        name: track.name,
        channels: track.channels,
        programs: track.programs,
        notes: track.notes.map(function mapNote(note) {
          var time = ticksToSeconds(note.tick, tempos, ppq);
          var end = ticksToSeconds(note.endTick, tempos, ppq);
          return {
            id: note.id,
            trackIndex: note.trackIndex,
            trackName: track.name,
            channel: note.channel,
            midi: note.midi,
            velocity: note.velocity,
            tick: note.tick,
            durationTicks: note.durationTicks,
            endTick: note.endTick,
            time: time,
            duration: Math.max(0.01, end - time)
          };
        })
      };
    });

    return {
      fileName: String(fileName || 'Untitled.mid'),
      title: title,
      format: format,
      ppq: ppq,
      durationTicks: durationTicks,
      duration: ticksToSeconds(durationTicks, tempos, ppq),
      tempos: tempos,
      timeSignatures: rawTimeSignatures
        .sort(sortByTick)
        .map(function mapSignature(signature) {
          return {
            tick: signature.tick,
            time: ticksToSeconds(signature.tick, tempos, ppq),
            numerator: signature.numerator,
            denominator: signature.denominator,
            clocksPerClick: signature.clocksPerClick,
            thirtySecondNotes: signature.thirtySecondNotes
          };
        }),
      keySignatures: rawKeySignatures
        .sort(sortByTick)
        .map(function mapKeySignature(signature) {
          return {
            tick: signature.tick,
            time: ticksToSeconds(signature.tick, tempos, ppq),
            sf: signature.sf,
            minor: signature.minor
          };
        }),
      markers: rawMarkers
        .sort(sortByTick)
        .map(function mapMarker(marker) {
          return {
            tick: marker.tick,
            time: ticksToSeconds(marker.tick, tempos, ppq),
            text: marker.text,
            type: marker.type,
            trackIndex: marker.trackIndex,
            trackName: marker.trackName
          };
        }),
      tracks: tracks,
      sourceFormat: 'midi'
    };
  }

  function median(values) {
    if (!values.length) return 0;
    var ordered = values.slice().sort(function ascending(a, b) { return a - b; });
    var middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function trackNameBias(name) {
    var normalized = String(name || '').toLowerCase();
    var boost = /\b(melody|lead|solo|vocal|voice|top\s*(?:line|voice)|tune)\b/.test(normalized) ? 34 : 0;
    var penalty = /\b(drum|perc|percussion|bass|chord|comp|accomp|rhythm|piano|guitar|pad|string|harmony|left\s*hand)\b/.test(normalized) ? 32 : 0;
    return boost - penalty;
  }

  function melodyMetrics(track, options) {
    var excludedChannels = options.excludeChannels || [10];
    var notes = (track.notes || []).filter(function playable(note) {
      return note && note.durationTicks > 0 && excludedChannels.indexOf(note.channel) === -1;
    });
    if (!notes.length) return null;

    var starts = {};
    notes.forEach(function countStart(note) {
      starts[note.tick] = (starts[note.tick] || 0) + 1;
    });
    var onsetSizes = Object.keys(starts).map(function toCount(tick) { return starts[tick]; });
    var onsetCount = onsetSizes.length || 1;
    var simultaneous = onsetSizes.reduce(function add(sum, count) { return sum + count; }, 0) / onsetCount;
    var monophonicRatio = onsetSizes.filter(function single(count) { return count === 1; }).length / onsetCount;
    var pitches = notes.map(function pitch(note) { return note.midi; });
    var medianPitch = median(pitches);
    var averagePitch = pitches.reduce(function add(sum, pitch) { return sum + pitch; }, 0) / pitches.length;
    var pitchSpread = Math.max.apply(null, pitches) - Math.min.apply(null, pitches);
    var densityScore = clamp(30 - Math.max(0, simultaneous - 1) * 13, -24, 30);
    var monoScore = monophonicRatio * 34;
    var pitchScore = clamp((medianPitch - 48) * 0.54, -12, 19);
    var sizeScore = Math.min(12, Math.log(notes.length + 1) / Math.LN2 * 2.15);
    var rangeScore = clamp(pitchSpread * 0.12, 0, 6);
    var score = densityScore + monoScore + pitchScore + sizeScore + rangeScore + trackNameBias(track.name);

    return {
      track: track,
      trackIndex: track.index,
      score: score,
      noteCount: notes.length,
      monophonicRatio: monophonicRatio,
      simultaneousNotes: simultaneous,
      medianPitch: medianPitch,
      averagePitch: averagePitch,
      pitchSpread: pitchSpread,
      nameBias: trackNameBias(track.name)
    };
  }

  /**
   * Rank usable tracks from most to least likely to contain a single melody.
   * A named melody/lead track is favoured, otherwise a high, mostly
   * monophonic track wins.  Channel 10 is excluded by default.
   */
  function rankMelodyTracks(midi, options) {
    var settings = options || {};
    var tracks = midi && Array.isArray(midi.tracks) ? midi.tracks : [];
    var results = tracks
      .map(function scoreTrack(track) { return melodyMetrics(track, settings); })
      .filter(Boolean)
      .filter(function enoughNotes(candidate) { return candidate.noteCount >= (settings.minNotes || 1); })
      .sort(function compareCandidates(a, b) {
        return b.score - a.score || b.monophonicRatio - a.monophonicRatio || b.medianPitch - a.medianPitch || a.trackIndex - b.trackIndex;
      });

    if (!results.length) return results;
    var leader = results[0];
    var runnerUp = results[1];
    var separation = runnerUp ? leader.score - runnerUp.score : 18;
    var confidence = clamp(0.35 + leader.monophonicRatio * 0.35 + clamp(separation / 34, 0, 0.3), 0, 1);
    results.forEach(function setConfidence(candidate, index) {
      candidate.confidence = index === 0
        ? confidence
        : clamp(confidence - index * 0.18 - Math.max(0, leader.score - candidate.score) / 120, 0, 1);
    });
    return results;
  }

  /** Returns the best melody track itself, or null when there are no usable notes. */
  function chooseMelodyTrack(midi, options) {
    var candidate = rankMelodyTracks(midi, options)[0];
    return candidate ? candidate.track : null;
  }

  function titleSource(value) {
    if (value && typeof value === 'object') {
      return value.title || value.fileName || value.path || '';
    }
    return value == null ? '' : String(value);
  }

  /**
   * Converts a Miditar catalog title or filename into a stable lookup key.
   * It intentionally removes a leading article and trailing arrangement/take
   * label, so e.g. "The Girl from Ipanema - Arrangement 2.mid" and
   * "Girl From Ipanema" can be matched without fuzzy matching unrelated songs.
   */
  function normalizeCatalogTitle(value) {
    var source = titleSource(value).replace(/\\/g, '/');
    try {
      source = decodeURIComponent(source);
    } catch (error) {
      // Catalog names occasionally contain a literal percent sign.  Keep the
      // original text when it was not URL-encoded.
    }
    source = source.split('/').pop() || source;
    source = source.replace(MIDI_EXTENSION, '');
    if (typeof source.normalize === 'function') source = source.normalize('NFKD');
    source = source
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’‘`]/g, "'")
      .replace(/&/g, ' and ')
      .replace(/(?:\s|^)(?:arrangement|arr\.?|version|ver\.?|take)\s*#?\s*\d+\s*$/i, ' ')
      .replace(/^\s*\d+\s*[-_.]\s*/, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .toLowerCase()
      .trim()
      .replace(/^(?:the|an|a)\s+/, '');
    return source.replace(/\s+/g, ' ');
  }

  function catalogTitlesMatch(left, right) {
    var leftKey = normalizeCatalogTitle(left);
    var rightKey = normalizeCatalogTitle(right);
    return Boolean(leftKey && rightKey && leftKey === rightKey);
  }

  /**
   * Finds an exact normalized title match in either a flat entry list or a
   * Miditar manifest-style `sources[].entries` list.  It never returns a fuzzy
   * near-match, which avoids silently pairing the wrong jazz standard.
   */
  function findCatalogMatch(title, catalog) {
    var entries = [];
    if (Array.isArray(catalog)) {
      entries = catalog;
    } else if (catalog && Array.isArray(catalog.entries)) {
      entries = catalog.entries;
    } else if (catalog && Array.isArray(catalog.sources)) {
      catalog.sources.forEach(function collectSource(source) {
        (source.entries || []).forEach(function collectEntry(entry) {
          entries.push(entry);
        });
      });
    }

    var key = normalizeCatalogTitle(title);
    if (!key) return null;
    for (var index = 0; index < entries.length; index += 1) {
      if (normalizeCatalogTitle(entries[index]) === key) return entries[index];
    }
    return null;
  }

  function activeMarkerAtTick(markers, tick, toleranceTicks) {
    var target = Number(tick) || 0;
    var tolerance = Number.isFinite(toleranceTicks) ? toleranceTicks : 1;
    var active = null;
    (markers || []).forEach(function inspectMarker(marker) {
      if (!marker || marker.type !== 'marker') return;
      if (marker.tick <= target + tolerance && (!active || marker.tick >= active.tick)) active = marker;
    });
    return active;
  }

  return {
    DEFAULT_MPQ: DEFAULT_MPQ,
    parseMidi: parseMidi,
    parseMidiFile: parseMidi,
    midiTicksToSeconds: midiTicksToSeconds,
    secondsToMidiTicks: secondsToMidiTicks,
    noteName: noteName,
    activeMarkerAtTick: activeMarkerAtTick,
    rankMelodyTracks: rankMelodyTracks,
    chooseMelodyTrack: chooseMelodyTrack,
    normalizeCatalogTitle: normalizeCatalogTitle,
    normalizeMiditarCatalogTitle: normalizeCatalogTitle,
    catalogTitlesMatch: catalogTitlesMatch,
    findCatalogMatch: findCatalogMatch
  };
});
