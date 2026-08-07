(() => {
  'use strict';

  const Theory = window.KeyerJazzTheory;
  const IReal = window.KeyerIReal;
  const MiditarMidi = window.KeyerMiditarMidi;
  const CATALOG_URLS = [
    'https://raw.githubusercontent.com/santismo/fakebot/main/real%20playlist.txt',
    'https://cdn.jsdelivr.net/gh/santismo/fakebot@main/real%20playlist.txt'
  ];
  const MIDITAR_MANIFEST_URLS = [
    '/miditar/example-songs.json',
    'https://raw.githubusercontent.com/santismo/miditar/main/public/example-songs.json',
    'https://cdn.jsdelivr.net/gh/santismo/miditar@main/public/example-songs.json'
  ];
  const MIDITAR_MIDI_BASE_URLS = [
    '/miditar/example%20midi%20songs/',
    'https://raw.githubusercontent.com/santismo/miditar/main/public/example%20midi%20songs/',
    'https://cdn.jsdelivr.net/gh/santismo/miditar@main/public/example%20midi%20songs/'
  ];
  const STORAGE_KEY = 'keyer-jazz-standard';
  const NOTE_NAMES_STORAGE_KEY = 'keyer-jazz-note-names';
  const TEMPO_STORAGE_KEY = 'keyer-jazz-tempo';
  const DISPLAY_LOW = 48;
  const DISPLAY_HIGH = 72;
  const ACCOMPANIMENT_LOW = 24;
  const ACCOMPANIMENT_HIGH = 72;
  const DEFAULT_TEMPO = 120;
  const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
  const MODE_NAMES = {
    major: ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'],
    minor: ['Aeolian', 'Locrian', 'Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian']
  };

  const elements = {
    search: document.querySelector('#songSearch'),
    searchResults: document.querySelector('#searchResults'),
    randomSong: document.querySelector('#randomSong'),
    libraryStatus: document.querySelector('#libraryStatus'),
    lesson: document.querySelector('#lesson'),
    songTitle: document.querySelector('#songTitle'),
    songComposer: document.querySelector('#songComposer'),
    songMeta: document.querySelector('#songMeta'),
    chart: document.querySelector('#chart'),
    chartScroll: document.querySelector('#chartScroll'),
    chartStatus: document.querySelector('#chartStatus'),
    sectionReadout: document.querySelector('#sectionReadout'),
    chordProgress: document.querySelector('#chordProgress'),
    toggleNoteNames: document.querySelector('#toggleNoteNames'),
    previousChord: document.querySelector('#previousChord'),
    nextChord: document.querySelector('#nextChord'),
    selectedChord: document.querySelector('#selectedChord'),
    scaleName: document.querySelector('#scaleName'),
    toggleMelody: document.querySelector('#toggleMelody'),
    loadMidi: document.querySelector('#loadMidi'),
    midiFileInput: document.querySelector('#midiFileInput'),
    midiStatus: document.querySelector('#midiStatus'),
    chartSourceLabel: document.querySelector('#chartSourceLabel'),
    chartSource: document.querySelector('#chartSource'),
    melodyPanel: document.querySelector('#melodyPanel'),
    melodySlider: document.querySelector('#melodySlider'),
    melodyReadout: document.querySelector('#melodyReadout'),
    playChart: document.querySelector('#playChart'),
    useChartTempo: document.querySelector('#useChartTempo'),
    tempoRange: document.querySelector('#tempoRange'),
    tempoValue: document.querySelector('#tempoValue'),
    playMelody: document.querySelector('#playMelody'),
    piano: document.querySelector('#piano'),
    errorCard: document.querySelector('#errorCard'),
    errorMessage: document.querySelector('#errorMessage'),
    retryLoad: document.querySelector('#retryLoad')
  };

  const state = {
    songs: [],
    song: null,
    bars: [],
    events: [],
    timeline: [],
    timelineByEventIndex: new Map(),
    structuralEvents: new Map(),
    occurrenceIndices: new Map(),
    sections: new Map(),
    irealChart: null,
    midiChart: null,
    chartSource: 'ireal',
    activeIndex: 0,
    preferFlats: true,
    searchIndex: -1,
    voicing: [],
    displayVoicing: [],
    displayRange: { low: DISPLAY_LOW, high: DISPLAY_HIGH },
    scale: null,
    activeAlternateCellId: null,
    activeAlternateIndex: -1,
    showNoteNames: true,
    midiCatalog: [],
    midiCatalogReady: false,
    midiCatalogLoading: false,
    midiEntry: null,
    midi: null,
    melodyTrack: null,
    melodyNotes: [],
    melodyOverlayChartId: null,
    showMelody: false,
    melodyCursor: 0,
    activeMelodyNote: null,
    transport: {
      playing: false,
      session: 0,
      timerIds: new Set(),
      useChartTempo: true,
      customBpm: DEFAULT_TEMPO,
      playMelody: true
    },
    loading: false
  };

  let audioContext = null;
  let audioInput = null;
  const voices = new Map();
  const pressedCounts = new Map();
  let swipe = null;

  const safeText = value => String(value == null ? '' : value).trim();

  function sectionLabel(value) {
    if (typeof value === 'string' || typeof value === 'number') return safeText(value);
    return safeText(value?.label || value?.name || value?.text || value?.value);
  }

  function annotationText(value) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return values.map(item => typeof item === 'string' ? item : item?.text || item?.label || item?.type).filter(Boolean).join(' · ');
  }

  function rawChordSymbol(value) {
    if (typeof value === 'string') return safeText(value);
    if (value?.isNoChord || value?.isPause || value?.isAlternateOnly) return '';
    if (value?.root) return `${value.root}${value.quality || ''}${value.bass ? `/${value.bass}` : ''}`;
    return safeText(value?.resolvedRaw || value?.symbol || value?.raw || value?.source || value?.text || value?.name);
  }

  function meterText(value) {
    if (!value) return '';
    if (typeof value === 'string' || typeof value === 'number') return safeText(value);
    if (value.beats && value.beatUnit) return `${value.beats}/${value.beatUnit}`;
    return safeText(value.value || value.raw);
  }

  function endingsText(bar) {
    const values = Array.isArray(bar?.endings) ? bar.endings : bar?.ending != null ? [bar.ending] : [];
    return values.map(value => `${typeof value === 'object' ? value.number || value.value || value.text : value}.`).join(' / ');
  }

  function roadmapMarks(bar) {
    const annotations = Array.isArray(bar?.annotations) ? bar.annotations : [];
    const marks = [];
    if (bar?.segno || annotations.some(item => item?.type === 'segno')) marks.push({ glyph: '𝄋', label: 'Segno' });
    if (bar?.coda || annotations.some(item => item?.type === 'coda')) marks.push({ glyph: '𝄌', label: 'Coda' });
    if (annotations.some(item => item?.type === 'fermata')) marks.push({ glyph: '𝄐', label: 'Fermata' });
    if (bar?.fine) marks.push({ glyph: 'Fine', label: 'Fine' });
    return marks;
  }

  function normalizeBars(song) {
    const source = Array.isArray(song?.bars) ? song.bars : [];
    const hasExplicitSections = source.some(bar => sectionLabel(bar?.sectionMarker || bar?.rehearsal || bar?.sectionMark));
    let currentSection = 'A';
    let currentSectionId = 'A@0';
    return source.map((bar, barIndex) => {
      const explicit = sectionLabel(bar?.sectionMarker || bar?.rehearsal || bar?.sectionMark);
      const inheritedSection = sectionLabel(bar?.section);
      let sectionStarts = false;
      if (explicit) {
        currentSection = explicit;
        currentSectionId = `${currentSection}@${barIndex}`;
        sectionStarts = true;
      } else if (inheritedSection && inheritedSection !== currentSection) {
        currentSection = inheritedSection;
        currentSectionId = `${currentSection}@${barIndex}`;
        sectionStarts = true;
      } else if (!hasExplicitSections && barIndex % 8 === 0) {
        currentSection = String.fromCharCode(65 + Math.floor(barIndex / 8) % 26);
        currentSectionId = `${currentSection}@${barIndex}`;
        sectionStarts = true;
      }
      const parsedCells = [
        ...(Array.isArray(bar?.chords) ? bar.chords : []),
        ...(Array.isArray(bar?.overflowChords) ? bar.overflowChords : [])
      ]
        .map((entry, chordIndex) => {
          const optionalOnly = Boolean(entry?.isAlternateOnly && entry?.alternate);
          const harmony = optionalOnly ? entry.alternate : entry;
          const raw = rawChordSymbol(harmony);
          if (!raw) return null;
          const attachedRaw = !optionalOnly ? rawChordSymbol(entry?.alternate) : '';
          return {
            raw,
            parsed: Theory.parseChordSymbol(raw),
            source: entry,
            chordIndex,
            optionalOnly,
            attachedAlternate: attachedRaw ? { raw: attachedRaw, parsed: Theory.parseChordSymbol(attachedRaw), source: entry.alternate } : null
          };
        })
        .filter(Boolean);
      const chords = [];
      const leadingAlternates = [];
      parsedCells.forEach(item => {
        if (item.optionalOnly) {
          const option = { raw: item.raw, parsed: item.parsed, source: item.source, standalone: true };
          const base = chords[chords.length - 1];
          if (base) base.alternates.push(option);
          else leadingAlternates.push(option);
          return;
        }
        item.alternates = [];
        if (leadingAlternates.length) item.alternates.push(...leadingAlternates.splice(0));
        if (item.attachedAlternate?.parsed) item.alternates.push(item.attachedAlternate);
        delete item.attachedAlternate;
        chords.push(item);
      });
      if (!chords.length && leadingAlternates.length) {
        const first = leadingAlternates.shift();
        chords.push({ ...first, chordIndex: 0, optionalOnly: true, alternates: leadingAlternates });
      }
      return {
        ...bar,
        barIndex,
        chords,
        sectionId: currentSectionId,
        sectionLabel: currentSection,
        sectionStarts,
        explicitSection: explicit,
        annotationsText: annotationText(bar?.comments || bar?.annotation || bar?.text),
        roadmapMarks: roadmapMarks(bar),
        endingText: endingsText(bar),
        timeSignatureText: meterText(bar?.timeSignatureChange || bar?.meterChange)
      };
    });
  }

  function playbackBarIndices(song, bars, suppliedOrder = null) {
    const rawOrder = Array.isArray(suppliedOrder) ? suppliedOrder : Array.isArray(song?.playbackOrder) ? song.playbackOrder : [];
    const order = rawOrder.map(value => {
      if (Number.isInteger(value)) return value;
      return Number(value?.barIndex ?? value?.index);
    }).filter(index => Number.isInteger(index) && index >= 0 && index < bars.length);
    return order.length ? order.slice(0, 4096) : bars.map((_, index) => index);
  }

  function buildSectionContexts(bars, songKey) {
    const groups = new Map();
    bars.forEach(bar => {
      if (!groups.has(bar.sectionId)) groups.set(bar.sectionId, []);
      bar.chords.forEach(item => {
        if (item.parsed && !item.optionalOnly && !item.holdOnly) groups.get(bar.sectionId).push(item.parsed);
      });
    });
    const contexts = new Map();
    groups.forEach((chords, id) => contexts.set(id, Theory.inferSectionContext(chords, songKey)));
    return contexts;
  }

  function quarterBeatsForBar(bar) {
    const meter = bar?.timeSignature || bar?.timeSignatureChange || null;
    const beats = Number(meter?.beats);
    const beatUnit = Number(meter?.beatUnit);
    if (Number.isFinite(beats) && Number.isFinite(beatUnit) && beats > 0 && beatUnit > 0) return beats * 4 / beatUnit;
    return 4;
  }

  function mainChordItems(bar) {
    return (bar?.chords || []).filter(item => item?.parsed && !item.optionalOnly && !item.holdOnly);
  }

  function structuralChordTiming(bars) {
    const timing = new Map();
    let cursor = 0;
    bars.forEach(bar => {
      const beats = quarterBeatsForBar(bar);
      const items = mainChordItems(bar);
      const division = Math.max(1, items.length);
      items.forEach((item, index) => {
        const cellId = `${bar.barIndex}:${item.chordIndex}`;
        const startBeat = Number.isFinite(item.startBeat) ? item.startBeat : cursor + beats * index / division;
        const endBeat = Number.isFinite(item.endBeat) ? item.endBeat : cursor + beats * (index + 1) / division;
        timing.set(cellId, {
          startBeat,
          endBeat: Math.max(startBeat + .01, endBeat),
          durationBeats: Math.max(.01, endBeat - startBeat)
        });
      });
      cursor += beats;
    });
    return timing;
  }

  function applyEventTiming(song, bars, events, playbackOrder, options = {}) {
    const byPassCell = new Map();
    events.forEach(event => byPassCell.set(`${event.passIndex}:${event.cellId}`, event));
    const structural = structuralChordTiming(bars);
    const timeline = [];
    const byEventIndex = new Map();
    let cursor = 0;
    const explicitTiming = Boolean(options.explicitTiming);

    // MIDI marker charts provide absolute timestamps. Build this timeline from
    // those marker spans rather than from the visual bar grid: a marker may
    // deliberately hold across one or more barlines.
    if (explicitTiming) {
      const timedEvents = events.map(event => {
        const timing = structural.get(event.cellId);
        if (!timing) return null;
        return { event, timing };
      }).filter(Boolean).sort((left, right) => (
        left.timing.startBeat - right.timing.startBeat
        || left.event.barIndex - right.event.barIndex
        || left.event.chordIndex - right.event.chordIndex
      ));

      timedEvents.forEach(({ event, timing }, index) => {
        const startBeat = Math.max(0, timing.startBeat);
        const endBeat = Math.max(startBeat + .01, timing.endBeat);
        if (startBeat > cursor + .001) {
          timeline.push({
            id: `midi:${index}:rest`,
            type: 'rest',
            barIndex: event.barIndex,
            passIndex: event.passIndex,
            startBeat: cursor,
            durationBeats: startBeat - cursor,
            endBeat: startBeat
          });
        }
        const entry = {
          id: `midi:${event.cellId}`,
          type: 'chord',
          eventIndex: event.eventIndex,
          barIndex: event.barIndex,
          passIndex: event.passIndex,
          cellId: event.cellId,
          startBeat,
          durationBeats: endBeat - startBeat,
          endBeat
        };
        timeline.push(entry);
        event.playbackStartBeat = startBeat;
        event.playbackEndBeat = endBeat;
        event.durationBeats = entry.durationBeats;
        event.sourceStartBeat = startBeat;
        event.sourceEndBeat = endBeat;
        event.sourceDurationBeats = entry.durationBeats;
        byEventIndex.set(event.eventIndex, entry);
        cursor = Math.max(cursor, endBeat);
      });
      return { timeline, byEventIndex, durationBeats: cursor };
    }

    playbackOrder.forEach((barIndex, passIndex) => {
      const bar = bars[barIndex];
      if (!bar) return;
      const beats = quarterBeatsForBar(bar);
      const items = mainChordItems(bar);
      if (!items.length) {
        timeline.push({
          id: `${passIndex}:${barIndex}:rest`,
          type: 'rest',
          barIndex,
          passIndex,
          startBeat: cursor,
          durationBeats: beats,
          endBeat: cursor + beats
        });
        cursor += beats;
        return;
      }
      const division = items.length;
      items.forEach((item, slot) => {
        const cellId = `${barIndex}:${item.chordIndex}`;
        const event = byPassCell.get(`${passIndex}:${cellId}`);
        const generatedStart = cursor + beats * slot / division;
        const generatedEnd = cursor + beats * (slot + 1) / division;
        const structuralTiming = structural.get(cellId) || {
          startBeat: generatedStart,
          endBeat: generatedEnd,
          durationBeats: generatedEnd - generatedStart
        };
        const startBeat = explicitTiming ? structuralTiming.startBeat : generatedStart;
        const endBeat = explicitTiming ? structuralTiming.endBeat : generatedEnd;
        const entry = {
          id: `${passIndex}:${barIndex}:${slot}`,
          type: 'chord',
          eventIndex: event?.eventIndex ?? null,
          barIndex,
          passIndex,
          cellId,
          startBeat,
          durationBeats: endBeat - startBeat,
          endBeat
        };
        timeline.push(entry);
        if (event) {
          event.playbackStartBeat = startBeat;
          event.playbackEndBeat = endBeat;
          event.durationBeats = entry.durationBeats;
          event.sourceStartBeat = structuralTiming.startBeat;
          event.sourceEndBeat = structuralTiming.endBeat;
          event.sourceDurationBeats = structuralTiming.durationBeats;
          byEventIndex.set(event.eventIndex, entry);
        }
      });
      cursor += beats;
    });
    return { timeline, byEventIndex, durationBeats: cursor };
  }

  function buildEvents(song, bars, suppliedOrder = null, options = {}) {
    const structuralEvents = new Map();
    bars.forEach(bar => {
      bar.chords.forEach(item => {
        if (!item.parsed || item.optionalOnly || item.holdOnly) return;
        const cellId = `${bar.barIndex}:${item.chordIndex}`;
        structuralEvents.set(cellId, { cellId, barIndex: bar.barIndex, chordIndex: item.chordIndex, bar, item, chord: item.parsed, sectionId: bar.sectionId, sectionLabel: bar.sectionLabel, optionalAlternate: item.optionalOnly });
      });
    });

    const events = [];
    const occurrences = new Map();
    const playbackOrder = playbackBarIndices(song, bars, suppliedOrder);
    playbackOrder.forEach((barIndex, passIndex) => {
      const bar = bars[barIndex];
      bar.chords.forEach(item => {
        const cellId = `${barIndex}:${item.chordIndex}`;
        const source = structuralEvents.get(cellId);
        if (!source) return;
        const event = { ...source, passIndex, eventIndex: events.length };
        events.push(event);
        if (!occurrences.has(cellId)) occurrences.set(cellId, []);
        occurrences.get(cellId).push(event.eventIndex);
      });
    });

    if (!events.length) {
      structuralEvents.forEach(source => {
        const event = { ...source, passIndex: source.barIndex, eventIndex: events.length };
        events.push(event);
        occurrences.set(source.cellId, [event.eventIndex]);
      });
    }
    const timing = applyEventTiming(song, bars, events, playbackOrder, options);
    return { events, structuralEvents, occurrences, playbackOrder, ...timing };
  }

  function midiMeterAtTick(midi, tick) {
    const signatures = Array.isArray(midi?.timeSignatures) ? midi.timeSignatures : [];
    let active = signatures[0] || { numerator: 4, denominator: 4 };
    signatures.forEach(signature => {
      if (Number(signature?.tick) <= tick) active = signature;
    });
    const beats = Number(active?.numerator) || 4;
    const beatUnit = Number(active?.denominator) || 4;
    return { beats, beatUnit };
  }

  function midiBarTicks(midi, tick) {
    const meter = midiMeterAtTick(midi, tick);
    return Math.max(1, Math.round((Number(midi?.ppq) || 120) * meter.beats * 4 / meter.beatUnit));
  }

  function buildMidiChart(midi) {
    if (!midi || !MiditarMidi || !Array.isArray(midi.markers)) return null;
    const markers = midi.markers
      .filter(marker => marker?.type === 'marker')
      .map(marker => ({ ...marker, raw: safeText(marker.text), parsed: Theory.parseChordSymbol(safeText(marker.text)) }))
      .filter(marker => marker.raw && marker.parsed && Number.isFinite(marker.parsed.root))
      .sort((left, right) => left.tick - right.tick);
    if (!markers.length) return null;

    const ppq = Number(midi.ppq) || 120;
    const initialBarTicks = midiBarTicks(midi, 0);
    const finalTick = Math.max(Number(midi.durationTicks) || 0, markers[markers.length - 1].tick + initialBarTicks);
    const barCount = Math.max(1, Math.ceil(finalTick / initialBarTicks));
    const bars = Array.from({ length: barCount }, (_, barIndex) => {
      const tick = barIndex * initialBarTicks;
      const meter = midiMeterAtTick(midi, tick);
      const label = 'MIDI';
      return {
        index: barIndex,
        barIndex,
        raw: '',
        chords: [],
        overflowChords: [],
        sectionId: 'MIDI@0',
        sectionLabel: label,
        sectionStarts: barIndex === 0,
        explicitSection: barIndex === 0 ? label : '',
        annotationsText: '',
        roadmapMarks: [],
        endingText: '',
        timeSignature: meter,
        timeSignatureText: barIndex === 0 ? `${meter.beats}/${meter.beatUnit}` : '',
        repeatStart: false,
        repeatEnd: false,
        noChord: false,
        pause: false
      };
    });

    const markerSpans = markers.map((marker, markerIndex) => {
      const next = markers[markerIndex + 1];
      return {
        marker,
        markerIndex,
        startTick: marker.tick,
        endTick: Math.max(marker.tick + 1, next ? next.tick : finalTick)
      };
    });

    // A MIDI marker is a harmony span, not just a label at a single barline.
    // Slice a span into every visual bar it crosses so the Real Book chart
    // shows a continuation mark instead of incorrectly inventing N.C.
    markerSpans.forEach(span => {
      const firstBar = Math.max(0, Math.floor(span.startTick / initialBarTicks));
      const lastBar = Math.min(
        bars.length - 1,
        Math.floor(Math.max(span.startTick, span.endTick - .001) / initialBarTicks)
      );
      for (let barIndex = firstBar; barIndex <= lastBar; barIndex += 1) {
        const barStartTick = barIndex * initialBarTicks;
        const barEndTick = barStartTick + initialBarTicks;
        const sliceStartTick = Math.max(span.startTick, barStartTick);
        const sliceEndTick = Math.min(span.endTick, barEndTick);
        if (sliceEndTick <= sliceStartTick) continue;
        bars[barIndex].chords.push({
          raw: span.marker.raw,
          parsed: span.marker.parsed,
          source: span.marker,
          sourceMarkerIndex: span.markerIndex,
          chordIndex: 0,
          optionalOnly: false,
          holdOnly: span.startTick < barStartTick,
          alternates: [],
          startBeat: span.startTick / ppq,
          endBeat: span.endTick / ppq,
          displayStartBeat: sliceStartTick / ppq,
          displayEndBeat: sliceEndTick / ppq
        });
      }
    });

    const markerCellIds = new Map();
    bars.forEach(bar => {
      bar.chords.sort((left, right) => (
        left.displayStartBeat - right.displayStartBeat
        || Number(left.holdOnly) - Number(right.holdOnly)
        || left.sourceMarkerIndex - right.sourceMarkerIndex
      ));
      bar.chords.forEach((item, chordIndex) => {
        item.chordIndex = chordIndex;
        if (!item.holdOnly) markerCellIds.set(item.sourceMarkerIndex, `${bar.barIndex}:${chordIndex}`);
      });
      bar.noChord = !bar.chords.length;
    });
    bars.forEach(bar => {
      bar.chords.forEach(item => {
        if (item.holdOnly) item.holdForCellId = markerCellIds.get(item.sourceMarkerIndex) || '';
      });
    });
    return {
      bars,
      playbackOrder: bars.map((_, index) => index),
      tempoBpm: Number(midi.tempos?.[0]?.bpm) || null,
      sourceKey: '',
      title: midi.title || state.song?.title || 'Miditar MIDI'
    };
  }

  function buildMelodyNotes(midi, track) {
    const ppq = Number(midi?.ppq) || 120;
    const grouped = new Map();
    (track?.notes || []).forEach(note => {
      if (!Number.isFinite(note?.midi) || !Number.isFinite(note?.tick) || !Number.isFinite(note?.endTick)) return;
      const bucket = grouped.get(note.tick) || [];
      bucket.push(note);
      grouped.set(note.tick, bucket);
    });
    return [...grouped.values()].map(notes => {
      const note = notes.slice().sort((left, right) => right.midi - left.midi || right.durationTicks - left.durationTicks)[0];
      return {
        id: `melody-${note.trackIndex}-${note.tick}-${note.midi}`,
        midi: note.midi,
        tick: note.tick,
        endTick: Math.max(note.tick + 1, note.endTick),
        startBeat: note.tick / ppq,
        endBeat: Math.max(note.tick + 1, note.endTick) / ppq,
        durationBeats: Math.max(1, note.endTick - note.tick) / ppq,
        source: note
      };
    }).sort((left, right) => left.startBeat - right.startBeat || left.midi - right.midi);
  }

  function foldedMidiForDisplay(midi, low = state.displayRange.low, high = state.displayRange.high) {
    let value = Number(midi);
    if (!Number.isFinite(value)) return null;
    value = Math.round(value);
    while (value < low) value += 12;
    while (value > high) value -= 12;
    return value >= low && value <= high ? value : null;
  }

  function melodyLabel(note) {
    return note ? Theory.midiName(note.midi, state.preferFlats) : '—';
  }

  function melodyMatchesChart(source = state.chartSource) {
    if (!state.midi || !state.melodyNotes.length) return false;
    if (source === 'midi') return Boolean(state.midiChart);
    return state.melodyOverlayChartId === 'ireal';
  }

  function melodyNotesForEvent(event) {
    if (!melodyMatchesChart() || !event || !state.melodyNotes.length) return [];
    const usePlaybackTiming = state.chartSource === 'ireal' && state.melodyOverlayChartId === 'ireal';
    const startBeat = Number(usePlaybackTiming ? event.playbackStartBeat : event.sourceStartBeat);
    const endBeat = Number(usePlaybackTiming ? event.playbackEndBeat : event.sourceEndBeat);
    if (!Number.isFinite(startBeat) || !Number.isFinite(endBeat)) return [];
    const firstEvent = state.events[0];
    const pickup = event.eventIndex === firstEvent?.eventIndex;
    return state.melodyNotes.filter(note => {
      if (pickup && note.startBeat < endBeat && note.endBeat > -0.01) return true;
      return note.startBeat < endBeat - .0001 && note.endBeat > startBeat + .0001;
    });
  }

  function activeMelodyForEvent(event) {
    if (!state.showMelody) return null;
    const notes = melodyNotesForEvent(event);
    if (!notes.length) return null;
    const index = Math.max(0, Math.min(notes.length - 1, state.melodyCursor));
    if (state.activeMelodyNote && notes.some(note => note.id === state.activeMelodyNote.id)) return state.activeMelodyNote;
    // In transport mode the melody marker should move only when that note is
    // actually sounding. Manual study still defaults to the first note so the
    // slider is immediately useful.
    if (state.transport.playing) return null;
    return notes[index];
  }

  function relativeSectionScale(chord, section) {
    if (!chord || !section) return null;
    const parent = section.mode === 'minor' ? Theory.SCALES.aeolian : Theory.SCALES.ionian;
    const parentPcs = parent.intervals.map(interval => Theory.mod(section.root + interval));
    const parentSet = new Set(parentPcs);
    const chordPcs = Theory.chordPitchClasses(chord);
    const localOnly = chord.altered || ['dim', 'aug', 'minmaj', 'hdim'].includes(chord.family);
    if (localOnly || chordPcs.some(pc => !parentSet.has(pc))) return null;
    const degree = parent.intervals.indexOf(Theory.mod(chord.root - section.root));
    if (degree < 0) return null;
    const intervals = parentPcs.map(pc => Theory.mod(pc - chord.root)).sort((a, b) => a - b);
    const result = {
      id: `section-${section.mode}-${degree}`,
      name: MODE_NAMES[section.mode][degree],
      root: chord.root,
      rootText: chord.rootText,
      pcs: parentPcs,
      intervals,
      sectionBased: true
    };
    result.notes = Theory.spellScaleNotes(chord, result);
    return result;
  }

  function scaleForEvent(event, nextEvent) {
    const section = state.sections.get(event.sectionId);
    return relativeSectionScale(event.chord, section) || Theory.suggestScale(event.chord, { section, nextChord: nextEvent?.chord || null });
  }

  function displaySection(sectionId, context) {
    const contextLabel = Theory.contextName(context, state.preferFlats);
    return `${sectionId || '—'} · ${contextLabel || 'local harmony'}`;
  }

  function setChartButtonState(event) {
    document.querySelectorAll('.chart-chord.active, .chart-alternate.active').forEach(button => {
      button.classList.remove('active');
      button.removeAttribute('aria-current');
    });
    document.querySelectorAll('.measure.selected').forEach(measure => measure.classList.remove('selected'));
    const alternateActive = state.activeAlternateCellId === event.cellId;
    const selector = alternateActive
      ? `[data-alternate-for="${event.cellId}"][data-alternate-index="${state.activeAlternateIndex}"]`
      : `[data-cell-id="${event.cellId}"]`;
    const button = elements.chart.querySelector(selector);
    if (!button) return;
    button.classList.add('active');
    button.setAttribute('aria-current', 'true');
    button.closest('.measure')?.classList.add('selected');
  }

  function keepMeasureVisible(event) {
    const measure = elements.chart.querySelector(`[data-bar-index="${event.barIndex}"]`);
    if (!measure) return;
    const view = elements.chartScroll;
    const viewRect = view.getBoundingClientRect();
    const measureRect = measure.getBoundingClientRect();
    const visibleTop = viewRect.top + view.clientTop;
    const visibleBottom = visibleTop + view.clientHeight;
    const inset = 4;
    let delta = 0;
    if (measureRect.height > view.clientHeight - inset * 2) delta = measureRect.top - visibleTop - inset;
    else if (measureRect.top < visibleTop + inset) delta = measureRect.top - visibleTop - inset;
    else if (measureRect.bottom > visibleBottom - inset) delta = measureRect.bottom - visibleBottom + inset;
    if (!delta) return;
    const maxScroll = Math.max(0, view.scrollHeight - view.clientHeight);
    view.scrollTop = Math.min(maxScroll, Math.max(0, view.scrollTop + delta));
  }

  function renderChart() {
    const fragment = document.createDocumentFragment();
    const finalRowStart = Math.floor((state.bars.length - 1) / 4) * 4;
    state.bars.forEach(bar => {
      const measure = document.createElement('div');
      measure.className = 'measure';
      measure.dataset.barIndex = String(bar.barIndex);
      if (bar.barIndex >= finalRowStart) measure.classList.add('last-row');
      if (bar.repeatStart) measure.classList.add('repeat-start');
      if (bar.repeatEnd) measure.classList.add('repeat-end');

      if (bar.sectionStarts) {
        const marker = document.createElement('span');
        marker.className = 'section-mark';
        marker.textContent = bar.sectionLabel;
        measure.appendChild(marker);
      }
      if (bar.endingText) {
        const ending = document.createElement('span');
        ending.className = 'ending-mark';
        ending.textContent = bar.endingText;
        measure.appendChild(ending);
      }
      const metaText = [bar.timeSignatureText, bar.annotationsText].filter(Boolean).join(' · ');
      if (metaText) {
        const annotation = document.createElement('span');
        annotation.className = 'annotation';
        annotation.textContent = metaText;
        annotation.title = metaText;
        measure.appendChild(annotation);
      }
      if (bar.repeatStart) {
        const dot = document.createElement('span');
        dot.className = 'repeat-dot start';
        dot.textContent = '∶';
        measure.appendChild(dot);
      }
      if (bar.repeatEnd) {
        const dot = document.createElement('span');
        dot.className = 'repeat-dot end';
        dot.textContent = '∶';
        measure.appendChild(dot);
      }
      if (bar.roadmapMarks.length) {
        const roadmap = document.createElement('span');
        roadmap.className = 'roadmap-marks';
        roadmap.textContent = bar.roadmapMarks.map(mark => mark.glyph).join(' ');
        roadmap.title = bar.roadmapMarks.map(mark => mark.label).join(' · ');
        roadmap.setAttribute('aria-label', roadmap.title);
        measure.appendChild(roadmap);
      }

      if (bar.chords.length) {
        const chordWrap = document.createElement('div');
        chordWrap.className = 'measure-chords';
        const chordCount = Math.min(4, Math.max(1, bar.chords.length));
        chordWrap.style.setProperty('--chord-count', String(chordCount));
        measure.dataset.chordCount = String(chordCount);
        if (chordCount > 2) measure.classList.add('dense-measure');
        bar.chords.forEach(item => {
          const stack = document.createElement('span');
          stack.className = 'chord-stack';
          const button = document.createElement('button');
          button.type = 'button';
          const cellId = `${bar.barIndex}:${item.chordIndex}`;
          const display = item.parsed?.display || item.raw;
          if (item.holdOnly) {
            button.className = 'chart-hold';
            button.dataset.holdFor = item.holdForCellId || '';
            button.textContent = '—';
            button.title = `Hold ${display}`;
            button.setAttribute('aria-label', `Hold ${display} through bar ${bar.barIndex + 1}`);
            if (item.holdForCellId) button.addEventListener('click', () => selectCell(item.holdForCellId, true));
            stack.appendChild(button);
            chordWrap.appendChild(stack);
            return;
          }
          button.className = 'chart-chord';
          button.dataset.cellId = cellId;
          button.textContent = item.optionalOnly ? `(${display})` : display;
          button.setAttribute('aria-label', `${display}, bar ${bar.barIndex + 1}`);
          button.title = display;
          if (display.length > 6) button.classList.add('long-symbol');
          if (item.optionalOnly) button.classList.add('optional');
          if (!item.parsed) {
            button.classList.add('unsupported');
            button.title = `The original symbol is preserved: ${item.raw}`;
          } else {
            button.addEventListener('click', () => selectCell(cellId, true));
          }
          if (item.alternates?.length) {
            const alternates = document.createElement('span');
            alternates.className = 'chart-alternates';
            item.alternates.forEach((option, alternateIndex) => {
              if (!option.parsed) return;
              const alternate = document.createElement('button');
              alternate.type = 'button';
              alternate.className = 'chart-alternate';
              alternate.dataset.alternateFor = cellId;
              alternate.dataset.alternateIndex = String(alternateIndex);
              alternate.textContent = `(${option.parsed.display})`;
              alternate.title = option.parsed.display;
              if (option.parsed.display.length > 6) alternate.classList.add('long-symbol');
              alternate.setAttribute('aria-label', `Optional ${option.parsed.display}, bar ${bar.barIndex + 1}`);
              alternate.addEventListener('click', () => selectAlternate(cellId, alternateIndex, true));
              alternates.appendChild(alternate);
            });
            stack.appendChild(alternates);
          }
          stack.appendChild(button);
          chordWrap.appendChild(stack);
        });
        measure.appendChild(chordWrap);
      } else {
        const empty = document.createElement('div');
        empty.className = 'empty-measure';
        empty.textContent = bar.noChord || bar.noChordText ? 'N.C.' : '—';
        measure.appendChild(empty);
      }
      fragment.appendChild(measure);
    });
    elements.chart.replaceChildren(fragment);
  }

  function twoOctaveRanges() {
    const ranges = [];
    for (let low = ACCOMPANIMENT_LOW; low <= ACCOMPANIMENT_HIGH; low += 1) {
      if (BLACK_PCS.has(Theory.mod(low))) continue;
      ranges.push({ low, high: low + 24 });
    }
    return ranges;
  }

  function displayRangeForVoicing(voicing, melodyMidis) {
    const voicingMidis = (voicing || []).map(note => Number(note?.midi)).filter(Number.isFinite);
    if (!voicingMidis.length) return { low: DISPLAY_LOW, high: DISPLAY_HIGH };
    const melody = (melodyMidis || []).map(Number).filter(Number.isFinite);
    const ranges = twoOctaveRanges();
    const contains = values => ranges.filter(range => values.every(midi => midi >= range.low && midi <= range.high));
    const choose = candidates => candidates.slice().sort((left, right) => (
      Math.abs(left.low - DISPLAY_LOW) - Math.abs(right.low - DISPLAY_LOW)
      || left.low - right.low
    ))[0];

    // Prefer showing both the accompaniment and all notes for this chord at
    // their sounding octave. When that will not fit in two octaves, preserve
    // the real accompaniment register and fold only the melody with its
    // actual octave badge.
    return choose(contains([...voicingMidis, ...melody]))
      || choose(contains(voicingMidis))
      || { low: DISPLAY_LOW, high: DISPLAY_HIGH };
  }

  function renderPiano(chord, scale, voicing, melodyNote = null, melodyNotes = []) {
    const scaleSet = new Set(scale.pcs.map(pc => Theory.mod(pc)));
    const chordSet = new Set(Theory.chordPitchClasses(chord));
    const rootBassSet = new Set([Theory.mod(chord.root)]);
    if (chord.slash != null) rootBassSet.add(Theory.mod(chord.slash));
    const scaleSpellingByPc = new Map();
    (scale.notes || []).forEach(note => {
      const parsed = Theory.parseNoteSpelling(note);
      if (parsed) scaleSpellingByPc.set(parsed.pc, note);
    });
    (scale.pcs || []).forEach(pc => {
      const pitchClass = Theory.mod(pc);
      if (!scaleSpellingByPc.has(pitchClass)) scaleSpellingByPc.set(pitchClass, Theory.noteName(pitchClass, state.preferFlats));
    });
    const chordSpellingByPc = new Map((chord.spelledTones || []).map(tone => [Theory.mod(tone.pc), tone.spelling]));
    const melodyMidis = melodyNotes.map(note => note?.midi).filter(Number.isFinite);
    const fitted = melodyMidis.length && typeof Theory.fitVoicingForMelody === 'function'
      ? Theory.fitVoicingForMelody(voicing, melodyMidis, ACCOMPANIMENT_LOW, ACCOMPANIMENT_HIGH)
      : Theory.fitVoicingToRange(voicing, DISPLAY_LOW, DISPLAY_HIGH);
    const soundingVoicing = fitted.length === voicing.length ? fitted : voicing;
    const range = displayRangeForVoicing(soundingVoicing, melodyMidis);
    const LOW = range.low;
    const HIGH = range.high;
    const whiteMidis = [];
    for (let midi = LOW; midi <= HIGH; midi += 1) if (!BLACK_PCS.has(Theory.mod(midi))) whiteMidis.push(midi);
    const whiteCount = whiteMidis.length;
    const displayVoicing = soundingVoicing.every(note => note.midi >= LOW && note.midi <= HIGH)
      ? soundingVoicing
      : Theory.fitVoicingToRange(soundingVoicing, LOW, HIGH);
    const voicingByMidi = new Map(displayVoicing.map(note => [note.midi, note]));
    const melodyDisplayMidi = melodyNote ? foldedMidiForDisplay(melodyNote.midi, LOW, HIGH) : null;
    const melodyFolded = melodyNote && melodyDisplayMidi !== melodyNote.midi;
    state.displayVoicing = displayVoicing;
    state.displayRange = range;
    elements.piano.dataset.voicingCount = String(displayVoicing.length);
    elements.piano.dataset.lowMidi = String(LOW);
    elements.piano.dataset.highMidi = String(HIGH);
    elements.piano.dataset.melodyMidi = melodyNote ? String(melodyNote.midi) : '';
    elements.piano.dataset.melodyDisplayMidi = melodyDisplayMidi == null ? '' : String(melodyDisplayMidi);
    elements.piano.setAttribute('aria-label', `Two-octave piano from ${Theory.midiName(LOW, state.preferFlats)} to ${Theory.midiName(HIGH, state.preferFlats)} showing the chord, scale, suggested fingering, and optional melody`);
    elements.piano.closest('.study-card')?.querySelector('.color-legend')?.setAttribute('data-melody-visible', String(Boolean(melodyNote)));
    const fragment = document.createDocumentFragment();
    let whitesBefore = 0;

    for (let midi = LOW; midi <= HIGH; midi += 1) {
      const pc = Theory.mod(midi);
      const black = BLACK_PCS.has(pc);
      const key = document.createElement('button');
      key.type = 'button';
      key.className = `piano-key ${black ? 'black' : 'white'}`;
      if (rootBassSet.has(pc)) key.classList.add('root-tone');
      else if (chordSet.has(pc)) key.classList.add('chord-tone');
      else if (scaleSet.has(pc)) key.classList.add('scale-tone');
      const sounding = voicingByMidi.get(midi);
      if (sounding) key.classList.add('voicing');
      if (sounding?.bass) key.classList.add('bass');
      const melodyHere = melodyDisplayMidi === midi;
      if (melodyHere) {
        key.classList.add('melody-tone');
        key.dataset.melodyMidi = String(melodyNote.midi);
      }
      if (black) {
        const width = (0.84 / whiteCount) * 100;
        key.style.left = `${(whitesBefore / whiteCount) * 100 - width / 2}%`;
        key.style.width = `${width}%`;
      } else {
        key.style.left = `${(whitesBefore / whiteCount) * 100}%`;
        key.style.width = `${100 / whiteCount}%`;
        whitesBefore += 1;
      }
      key.dataset.midi = String(midi);
      const spelling = sounding?.spelling || chordSpellingByPc.get(pc) || scaleSpellingByPc.get(pc) || Theory.noteName(pc, state.preferFlats);
      const name = spelling
        ? Theory.spelledMidiName(midi, spelling, state.preferFlats)
        : Theory.midiName(midi, state.preferFlats);
      key.setAttribute('aria-label', `${name}${sounding ? `, suggested ${sounding.role}` : ''}${melodyHere ? `, melody ${melodyLabel(melodyNote)}${melodyFolded ? ', shown in this two-octave view' : ''}` : ''}`);
      if (state.showNoteNames) {
        const label = document.createElement('span');
        label.className = 'key-name';
        label.textContent = Theory.displayNoteSpelling(spelling);
        key.appendChild(label);
      }
      if (sounding) {
        const role = document.createElement('span');
        role.className = 'key-role';
        role.textContent = sounding.role === 'Bass' ? 'B' : sounding.role;
        key.appendChild(role);
      }
      if (melodyHere && melodyFolded) {
        const octave = document.createElement('span');
        octave.className = 'melody-octave';
        octave.textContent = melodyLabel(melodyNote);
        octave.setAttribute('aria-hidden', 'true');
        key.appendChild(octave);
      }
      fragment.appendChild(key);
    }
    elements.piano.replaceChildren(fragment);
    pressedCounts.forEach((count, midi) => {
      if (count > 0) elements.piano.querySelector(`[data-midi="${midi}"]`)?.classList.add('playing');
    });
  }

  function activeChartEvent() {
    const baseEvent = state.events[state.activeIndex];
    if (!baseEvent) return null;
    const alternate = state.activeAlternateCellId === baseEvent.cellId
      ? baseEvent.item.alternates?.[state.activeAlternateIndex]
      : null;
    return alternate?.parsed ? { ...baseEvent, chord: alternate.parsed, optionalAlternate: true } : baseEvent;
  }

  function syncMelodyControls(event, notes, melodyNote) {
    const ready = Boolean(state.midi && state.melodyNotes.length);
    const melodyMatchesActiveChart = melodyMatchesChart();
    elements.toggleMelody.textContent = state.showMelody ? 'Hide melody' : ready || state.midiEntry ? 'Show melody' : 'Add melody MIDI';
    elements.toggleMelody.setAttribute('aria-pressed', String(state.showMelody));
    elements.toggleMelody.setAttribute('aria-label', state.showMelody ? 'Hide melody from the piano' : ready || state.midiEntry ? 'Show melody over the chord' : 'Import a MIDI melody');
    elements.playMelody.disabled = !ready || !melodyMatchesActiveChart;
    elements.playMelody.checked = state.transport.playMelody;
    elements.chartSourceLabel.hidden = !state.midiChart;
    if (state.midiChart) elements.chartSource.value = state.chartSource;

    const visible = state.showMelody && melodyMatchesActiveChart;
    elements.melodyPanel.hidden = !visible;
    if (!visible) return;
    if (!notes.length) {
      elements.melodyReadout.textContent = 'No melody note here';
      elements.melodySlider.min = '0';
      elements.melodySlider.max = '0';
      elements.melodySlider.value = '0';
      elements.melodySlider.disabled = true;
      return;
    }
    const selected = melodyNote || notes[0];
    const index = Math.max(0, notes.findIndex(note => note.id === selected.id));
    state.melodyCursor = index;
    elements.melodySlider.min = '0';
    elements.melodySlider.max = String(notes.length - 1);
    elements.melodySlider.value = String(index);
    elements.melodySlider.disabled = false;
    elements.melodyReadout.textContent = `${melodyLabel(selected)} · ${index + 1} / ${notes.length}`;
  }

  function syncTempoControls() {
    const chartTempo = activeChartTempo();
    const bpm = state.transport.useChartTempo ? chartTempo : state.transport.customBpm;
    elements.useChartTempo.checked = state.transport.useChartTempo;
    elements.tempoRange.disabled = state.transport.useChartTempo;
    elements.tempoRange.value = String(state.transport.customBpm);
    elements.tempoValue.textContent = `${Math.round(bpm)} BPM`;
    const hasSourceTempo = state.chartSource === 'midi'
      ? Number(state.midiChart?.tempoBpm) >= 30
      : Number(state.song?.bpm) >= 30 || (state.melodyOverlayChartId === 'ireal' && Number(state.midi?.tempos?.[0]?.bpm) >= 30);
    elements.useChartTempo.parentElement.title = state.transport.useChartTempo
      ? hasSourceTempo ? `Using this chart's ${Math.round(chartTempo)} BPM tempo` : `No chart BPM was supplied; using ${Math.round(chartTempo)} BPM`
      : 'Use the custom tempo slider';
  }

  function syncTransportControls() {
    elements.playChart.textContent = state.transport.playing ? 'Stop chart' : 'Play chart';
    elements.playChart.setAttribute('aria-pressed', String(state.transport.playing));
    syncTempoControls();
  }

  function renderStudy({ keepVisible = true } = {}) {
    const event = activeChartEvent();
    if (!event) return;
    const nextEvent = state.events[state.activeIndex + 1] || null;
    const section = state.sections.get(event.sectionId);
    const scale = scaleForEvent(event, nextEvent);
    const voicing = Theory.makeVoicing(event.chord);
    const melodyNotes = melodyNotesForEvent(event);
    if (state.activeMelodyNote && !melodyNotes.some(note => note.id === state.activeMelodyNote.id)) state.activeMelodyNote = null;
    const melodyNote = activeMelodyForEvent(event);
    state.scale = scale;
    state.voicing = voicing;

    elements.selectedChord.textContent = `${event.optionalAlternate ? '(' : ''}${event.chord.display}${event.optionalAlternate ? ')' : ''}`;
    elements.chordProgress.textContent = `${state.activeIndex + 1} / ${state.events.length}`;
    elements.sectionReadout.textContent = displaySection(event.sectionLabel, section);
    const parentSuffix = scale.sectionBased ? ` · ${Theory.contextName(section, state.preferFlats)} section` : '';
    const scaleRoot = scale.rootText ? Theory.displayNoteSpelling(scale.rootText) : Theory.noteName(scale.root, state.preferFlats);
    elements.scaleName.textContent = `${scaleRoot} ${scale.name}${parentSuffix}`;
    elements.chartStatus.textContent = `Bar ${event.barIndex + 1} · ${event.sectionLabel || 'form'}`;
    renderPiano(event.chord, scale, voicing, melodyNote, melodyNotes);
    syncMelodyControls(event, melodyNotes, melodyNote);
    syncTransportControls();
    setChartButtonState(event);
    if (keepVisible) keepMeasureVisible(event);
  }

  function activeChartTempo() {
    if (state.chartSource === 'midi' && Number(state.midiChart?.tempoBpm) > 20) return Number(state.midiChart.tempoBpm);
    if (state.chartSource === 'ireal' && state.melodyOverlayChartId === 'ireal' && Number(state.midi?.tempos?.[0]?.bpm) > 20) {
      return Number(state.midi.tempos[0].bpm);
    }
    const irealTempo = Number(state.song?.bpm);
    return Number.isFinite(irealTempo) && irealTempo >= 30 ? irealTempo : DEFAULT_TEMPO;
  }

  function currentTempo() {
    return state.transport.useChartTempo ? activeChartTempo() : state.transport.customBpm;
  }

  function createChartData(id, bars, playbackOrder, options = {}) {
    const built = buildEvents(state.song, bars, playbackOrder, { explicitTiming: Boolean(options.explicitTiming) });
    return {
      id,
      bars,
      playbackOrder: built.playbackOrder,
      events: built.events,
      structuralEvents: built.structuralEvents,
      occurrenceIndices: built.occurrences,
      timeline: built.timeline,
      timelineByEventIndex: built.byEventIndex,
      durationBeats: built.durationBeats,
      sections: buildSectionContexts(bars, options.sourceKey ?? state.song?.key),
      sourceKey: options.sourceKey ?? state.song?.key ?? '',
      tempoBpm: Number(options.tempoBpm) || null
    };
  }

  function syncMidiSourceStatus() {
    if (!state.song) return;
    if (state.midi) {
      const markerText = state.midiChart
        ? `${state.midiChart.events.length} chord markers`
        : 'melody over iReal timing';
      const tempo = Number(state.midi.tempos?.[0]?.bpm);
      const caution = !state.midiChart ? ' · check the form matches' : '';
      elements.midiStatus.textContent = `Miditar MIDI · ${markerText}${Number.isFinite(tempo) ? ` · ${Math.round(tempo)} BPM` : ''}${caution}`;
      elements.loadMidi.textContent = 'Replace MIDI';
      return;
    }
    if (state.midiCatalogLoading) {
      elements.midiStatus.textContent = 'Looking for a matching Miditar MIDI…';
      elements.loadMidi.textContent = 'MIDI source';
      return;
    }
    if (state.midiEntry) {
      elements.midiStatus.textContent = 'Matching Miditar MIDI available · markers, melody, and tempo';
      elements.loadMidi.textContent = 'Load Miditar MIDI';
      return;
    }
    if (state.midiCatalogReady) {
      elements.midiStatus.textContent = 'No matching Miditar MIDI · import your own melody MIDI';
      elements.loadMidi.textContent = 'Import MIDI';
    }
  }

  function activateChartSource(source, options = {}) {
    const chart = source === 'midi' ? state.midiChart : state.irealChart;
    if (!chart) return false;
    if (!options.transport) stopChartPlayback({ render: false });
    state.chartSource = source;
    state.bars = chart.bars;
    state.events = chart.events;
    state.structuralEvents = chart.structuralEvents;
    state.occurrenceIndices = chart.occurrenceIndices;
    state.timeline = chart.timeline;
    state.timelineByEventIndex = chart.timelineByEventIndex;
    state.sections = chart.sections;
    state.activeIndex = 0;
    state.activeAlternateCellId = null;
    state.activeAlternateIndex = -1;
    state.activeMelodyNote = null;
    state.melodyCursor = 0;
    if (!melodyMatchesChart(source)) state.showMelody = false;
    state.preferFlats = Theory.preferFlatsForKey(chart.sourceKey || state.song?.key);
    elements.songMeta.textContent = songMetaText();
    renderChart();
    renderStudy({ keepVisible: false });
    elements.chartScroll.scrollTo({ top: 0, left: 0 });
    syncMidiSourceStatus();
    return true;
  }

  function selectEvent(index, preview = false, options = {}) {
    if (!state.events.length) return;
    if (state.transport.playing && !options.transport) stopChartPlayback({ render: false });
    state.activeIndex = Theory.mod(index, state.events.length);
    state.activeAlternateCellId = null;
    state.activeAlternateIndex = -1;
    if (!options.transport) {
      state.activeMelodyNote = null;
      state.melodyCursor = 0;
    }
    renderStudy();
    if (preview) playCurrentVoicing();
  }

  function selectCell(cellId, preview = false) {
    const indices = state.occurrenceIndices.get(cellId) || [];
    if (!indices.length) return;
    const nextOccurrence = indices.find(index => index >= state.activeIndex) ?? indices[0];
    selectEvent(nextOccurrence, preview);
  }

  function selectAlternate(cellId, alternateIndex, preview = false) {
    const indices = state.occurrenceIndices.get(cellId) || [];
    if (!indices.length) return;
    if (state.transport.playing) stopChartPlayback({ render: false });
    state.activeIndex = indices.find(index => index >= state.activeIndex) ?? indices[0];
    state.activeAlternateCellId = cellId;
    state.activeAlternateIndex = alternateIndex;
    state.activeMelodyNote = null;
    state.melodyCursor = 0;
    renderStudy();
    if (preview) playCurrentVoicing();
  }

  function loadSong(song) {
    const bars = normalizeBars(song);
    if (!bars.length) return false;
    stopChartPlayback({ render: false });
    state.song = song;
    state.irealChart = createChartData('ireal', bars, song.playbackOrder, { sourceKey: song.key, tempoBpm: song.bpm });
    if (!state.irealChart.events.length) return false;
    state.midiChart = null;
    state.midi = null;
    state.melodyTrack = null;
    state.melodyNotes = [];
    state.melodyOverlayChartId = null;
    state.showMelody = false;
    state.midiEntry = MiditarMidi?.findCatalogMatch?.(song.title, state.midiCatalog) || null;

    elements.songTitle.textContent = song.title || 'Untitled standard';
    elements.songComposer.textContent = song.composer || 'Unknown composer';
    elements.songMeta.textContent = [song.style, song.key ? `Key ${song.key}` : '', `${bars.length} bars`].filter(Boolean).join(' · ');
    elements.search.value = song.title || '';
    elements.lesson.hidden = false;
    elements.errorCard.hidden = true;
    hideSearchResults();
    activateChartSource('ireal', { transport: true });
    syncMidiSourceStatus();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ title: song.title, composer: song.composer, key: song.key })); } catch (_) {}
    return true;
  }

  function matchingSongs(query) {
    const q = safeText(query).toLowerCase();
    const source = q ? state.songs.filter(song => `${song.title} ${song.composer} ${song.style}`.toLowerCase().includes(q)) : state.songs;
    return source.slice(0, 60);
  }

  function renderSearchResults() {
    if (!state.songs.length) return;
    const songs = matchingSongs(elements.search.value);
    const fragment = document.createDocumentFragment();
    state.searchIndex = Math.min(state.searchIndex, songs.length - 1);
    songs.forEach((song, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'result-button';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === state.searchIndex));
      const meta = document.createElement('span');
      const title = document.createElement('span');
      title.className = 'result-title';
      title.textContent = song.title || 'Untitled';
      const sub = document.createElement('span');
      sub.className = 'result-sub';
      sub.textContent = [song.composer, song.style].filter(Boolean).join(' · ');
      meta.append(title, sub);
      const key = document.createElement('span');
      key.className = 'result-key';
      key.textContent = song.key || '';
      button.append(meta, key);
      button.addEventListener('click', () => loadSong(song));
      fragment.appendChild(button);
    });
    elements.searchResults.replaceChildren(fragment);
    elements.searchResults.hidden = false;
    elements.search.setAttribute('aria-expanded', 'true');
    elements.libraryStatus.textContent = songs.length === 60
      ? `Showing the first 60 matches · ${state.songs.length.toLocaleString()} charts available`
      : `${songs.length.toLocaleString()} match${songs.length === 1 ? '' : 'es'} · ${state.songs.length.toLocaleString()} charts available`;
  }

  function hideSearchResults() {
    elements.searchResults.hidden = true;
    elements.search.setAttribute('aria-expanded', 'false');
    state.searchIndex = -1;
    if (state.songs.length) elements.libraryStatus.textContent = `${state.songs.length.toLocaleString()} jazz-standard charts · search by title or composer`;
  }

  function restoredSong() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved) return null;
      return state.songs.find(song => song.title === saved.title && song.composer === saved.composer && song.key === saved.key) || null;
    } catch (_) { return null; }
  }

  async function fetchCatalog() {
    let lastError = null;
    for (const url of CATALOG_URLS) {
      try {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
        return await response.text();
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('The catalog could not be downloaded.');
  }

  function titleFromMidiFileName(name) {
    return safeText(name).replace(/\.(?:mid|midi)$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  async function fetchFirst(urls, kind = 'text') {
    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Source returned ${response.status}`);
        return kind === 'json' ? await response.json() : kind === 'arrayBuffer' ? await response.arrayBuffer() : await response.text();
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('The source could not be downloaded.');
  }

  async function loadMiditarCatalog() {
    if (state.midiCatalogLoading || state.midiCatalogReady || !MiditarMidi) return;
    state.midiCatalogLoading = true;
    syncMidiSourceStatus();
    try {
      const manifest = await fetchFirst(MIDITAR_MANIFEST_URLS, 'json');
      const songs = Array.isArray(manifest?.songs) ? manifest.songs : [];
      state.midiCatalog = songs.flatMap(item => {
        const name = safeText(item?.name);
        if (!/\.(?:mid|midi)$/i.test(name)) return [];
        return [{
          name,
          title: titleFromMidiFileName(name),
          size: Number(item?.size) || undefined
        }];
      });
      state.midiCatalogReady = true;
      if (state.song) state.midiEntry = MiditarMidi.findCatalogMatch(state.song.title, state.midiCatalog);
    } catch (error) {
      console.warn('Miditar catalog unavailable', error);
      state.midiCatalogReady = true;
    } finally {
      state.midiCatalogLoading = false;
      syncMidiSourceStatus();
    }
  }

  function songMetaText() {
    if (!state.song) return '';
    const chart = state.chartSource === 'midi' ? state.midiChart : state.irealChart;
    const source = state.chartSource === 'midi' ? 'MIDI markers' : '';
    const key = state.chartSource === 'midi'
      ? chart?.sourceKey ? `Key ${chart.sourceKey}` : 'MIDI form'
      : chart?.sourceKey ? `Key ${chart.sourceKey}` : state.song.key ? `Key ${state.song.key}` : '';
    return [state.song.style, key, `${chart?.bars?.length || 0} bars`, source].filter(Boolean).join(' · ');
  }

  function midiUrlsForEntry(entry) {
    const encodedName = encodeURIComponent(entry.name);
    return MIDITAR_MIDI_BASE_URLS.map(base => `${base}${encodedName}`);
  }

  function installMidiSource(midi, entry = null) {
    const chart = buildMidiChart(midi);
    const melodyTrack = MiditarMidi?.chooseMelodyTrack?.(midi);
    const melodyNotes = buildMelodyNotes(midi, melodyTrack);
    if (!melodyNotes.length) throw new Error('This MIDI has no readable melody track.');
    state.midi = midi;
    state.midiEntry = entry || state.midiEntry;
    state.melodyTrack = melodyTrack;
    state.melodyNotes = melodyNotes;
    state.midiChart = chart?.bars?.length && chart.playbackOrder.length
      ? createChartData('midi', chart.bars, chart.playbackOrder, {
        explicitTiming: true,
        sourceKey: chart.sourceKey,
        tempoBpm: chart.tempoBpm
      })
      : null;
    state.melodyOverlayChartId = state.midiChart ? 'midi' : 'ireal';
    state.showMelody = true;
    activateChartSource(state.midiChart ? 'midi' : 'ireal', { transport: true });
    elements.songMeta.textContent = songMetaText();
    syncMidiSourceStatus();
  }

  async function loadMatchedMiditarMidi() {
    if (!MiditarMidi) throw new Error('The MIDI melody reader did not load.');
    if (!state.midiEntry) throw new Error('No matching Miditar MIDI was found.');
    elements.loadMidi.disabled = true;
    elements.toggleMelody.disabled = true;
    elements.midiStatus.textContent = `Loading ${state.midiEntry.title} from Miditar…`;
    try {
      const buffer = await fetchFirst(midiUrlsForEntry(state.midiEntry), 'arrayBuffer');
      installMidiSource(MiditarMidi.parseMidi(buffer, state.midiEntry.name), state.midiEntry);
    } finally {
      elements.loadMidi.disabled = false;
      elements.toggleMelody.disabled = false;
      syncMidiSourceStatus();
    }
  }

  async function loadImportedMidi(file) {
    if (!file || !MiditarMidi) return;
    elements.loadMidi.disabled = true;
    elements.toggleMelody.disabled = true;
    elements.midiStatus.textContent = `Reading ${file.name}…`;
    try {
      const buffer = await file.arrayBuffer();
      installMidiSource(MiditarMidi.parseMidi(buffer, file.name), { name: file.name, title: titleFromMidiFileName(file.name) });
    } finally {
      elements.loadMidi.disabled = false;
      elements.toggleMelody.disabled = false;
      syncMidiSourceStatus();
      elements.midiFileInput.value = '';
    }
  }

  async function requestMidiSource({ showAfterLoad = false } = {}) {
    try {
      if (!MiditarMidi) throw new Error('The MIDI melody reader did not load.');
      if (state.midi) {
        if (state.midiChart && state.chartSource !== 'midi') activateChartSource('midi');
        if (showAfterLoad) {
          state.showMelody = true;
          state.activeMelodyNote = null;
          state.melodyCursor = 0;
          renderStudy({ keepVisible: false });
        }
        return;
      }
      if (state.midiEntry) {
        await loadMatchedMiditarMidi();
        return;
      }
      elements.midiFileInput.click();
    } catch (error) {
      console.error(error);
      elements.midiStatus.textContent = error?.message || 'Could not load this MIDI source.';
    }
  }

  async function toggleMelody() {
    if (state.showMelody) {
      state.showMelody = false;
      state.activeMelodyNote = null;
      renderStudy({ keepVisible: false });
      return;
    }
    await requestMidiSource({ showAfterLoad: true });
  }

  async function loadCatalog() {
    if (state.loading) return;
    state.loading = true;
    elements.errorCard.hidden = true;
    elements.libraryStatus.textContent = 'Loading jazz standards…';
    elements.randomSong.disabled = true;
    try {
      if (!Theory || !IReal || typeof IReal.parsePlaylist !== 'function') throw new Error('The standards parser did not load.');
      const text = await fetchCatalog();
      elements.libraryStatus.textContent = 'Reading chart forms and chord symbols…';
      await new Promise(resolve => requestAnimationFrame(resolve));
      const parsed = IReal.parsePlaylist(text);
      state.songs = Array.isArray(parsed) ? parsed : parsed?.songs || [];
      if (!state.songs.length) throw new Error('No readable standards were found in the catalog.');
      state.songs.sort((a, b) => safeText(a.title).localeCompare(safeText(b.title), undefined, { sensitivity: 'base' }));
      elements.randomSong.disabled = false;
      const first = restoredSong()
        || state.songs.find(song => safeText(song.title).toLowerCase() === 'autumn leaves')
        || state.songs[0];
      loadSong(first);
      window.setTimeout(() => { loadMiditarCatalog(); }, 0);
    } catch (error) {
      console.error(error);
      elements.lesson.hidden = true;
      elements.errorCard.hidden = false;
      elements.errorMessage.textContent = error?.message || 'Check your connection and try again.';
      elements.libraryStatus.textContent = 'Catalog unavailable';
    } finally {
      state.loading = false;
    }
  }

  function ensureAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContext) {
      audioContext = new AudioContextClass();
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 15;
      compressor.ratio.value = 5;
      compressor.attack.value = .006;
      compressor.release.value = .22;
      const master = audioContext.createGain();
      master.gain.value = .56;
      master.connect(compressor);
      compressor.connect(audioContext.destination);
      audioInput = master;
    }
    if (audioContext.state !== 'running') audioContext.resume().catch(() => {});
    return audioContext;
  }

  function markPressed(midi, direction) {
    if (!Number.isFinite(Number(midi))) return;
    const next = Math.max(0, (pressedCounts.get(midi) || 0) + direction);
    if (next) pressedCounts.set(midi, next);
    else pressedCounts.delete(midi);
    elements.piano.querySelector(`[data-midi="${midi}"]`)?.classList.toggle('playing', next > 0);
  }

  function startVoice(id, midi, duration = null, displayMidi = midi) {
    stopVoice(id, true);
    const context = ensureAudio();
    markPressed(displayMidi, 1);
    if (!context || !audioInput) {
      const voice = { midi, displayMidi, silent: true, timerId: null };
      voices.set(id, voice);
      if (duration) {
        voice.timerId = window.setTimeout(() => {
          if (voices.get(id) === voice) stopVoice(id);
        }, duration * 1000);
      }
      return;
    }
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const color = context.createOscillator();
    const colorGain = context.createGain();
    const envelope = context.createGain();
    const frequency = 440 * (2 ** ((midi - 69) / 12));
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    color.type = 'sine';
    color.frequency.value = frequency * 2;
    colorGain.gain.value = .1;
    envelope.gain.setValueAtTime(.0001, now);
    envelope.gain.exponentialRampToValueAtTime(.13, now + .014);
    envelope.gain.exponentialRampToValueAtTime(.07, now + .55);
    oscillator.connect(envelope);
    color.connect(colorGain);
    colorGain.connect(envelope);
    envelope.connect(audioInput);
    oscillator.start(now);
    color.start(now);
    const voice = { midi, displayMidi, envelope, oscillators: [oscillator, color], startedAt: now, timerId: null };
    voices.set(id, voice);
    if (duration) {
      voice.timerId = window.setTimeout(() => {
        if (voices.get(id) === voice) stopVoice(id);
      }, duration * 1000);
    }
  }

  function stopVoice(id, immediate = false) {
    const voice = voices.get(id);
    if (!voice) return;
    voices.delete(id);
    if (voice.timerId != null) window.clearTimeout(voice.timerId);
    markPressed(voice.displayMidi ?? voice.midi, -1);
    if (voice.silent || !audioContext) return;
    const now = audioContext.currentTime;
    const release = immediate ? .025 : .2;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(.06, now);
    voice.envelope.gain.exponentialRampToValueAtTime(.0001, now + release);
    voice.oscillators.forEach(oscillator => oscillator.stop(now + release + .03));
  }

  function playVoicing(voicing, duration = 1.35, prefix = 'preview') {
    if (!voicing.length) return;
    [...voices.keys()].filter(id => String(id).startsWith(`${prefix}-`)).forEach(id => stopVoice(id, true));
    voicing.forEach((note, index) => startVoice(`${prefix}-${index}`, note.midi, duration, note.midi));
  }

  function playCurrentVoicing(duration = 1.35) {
    const voicing = state.displayVoicing.length ? state.displayVoicing : state.voicing;
    if (!voicing.length) return;
    playVoicing(voicing, duration, 'preview');
  }

  function clearTransportTimers() {
    state.transport.timerIds.forEach(timerId => window.clearTimeout(timerId));
    state.transport.timerIds.clear();
  }

  function stopChartPlayback({ render = true } = {}) {
    const wasPlaying = state.transport.playing;
    state.transport.session += 1;
    state.transport.playing = false;
    clearTransportTimers();
    [...voices.keys()].filter(id => String(id).startsWith('chart-')).forEach(id => stopVoice(id, true));
    if (wasPlaying) state.activeMelodyNote = null;
    if (render && state.events.length) renderStudy({ keepVisible: false });
    else syncTransportControls();
  }

  function scheduleTransport(callback, milliseconds, session) {
    const timerId = window.setTimeout(() => {
      state.transport.timerIds.delete(timerId);
      if (state.transport.playing && state.transport.session === session) callback();
    }, Math.max(0, milliseconds));
    state.transport.timerIds.add(timerId);
  }

  function previewMelodyNote(note, id = 'melody-scrub', duration = .78) {
    if (!note) return;
    const displayMidi = foldedMidiForDisplay(note.midi);
    startVoice(id, note.midi, duration, displayMidi == null ? note.midi : displayMidi);
  }

  function scheduleMelodyForSegment(entry, secondsPerBeat, session) {
    if (!state.transport.playMelody || !melodyMatchesChart()) return;
    const segmentStart = Number(entry.startBeat) || 0;
    const segmentEnd = Number(entry.endBeat) || segmentStart + Number(entry.durationBeats) || segmentStart;
    const notes = state.melodyNotes.filter(note => (
      note.startBeat >= segmentStart - .0001 && note.startBeat < segmentEnd - .0001
    ));
    if (!notes.length) return;
    const chartEndBeat = state.timeline[state.timeline.length - 1]?.endBeat;
    notes.forEach((note, index) => {
      const offsetBeats = Math.max(0, note.startBeat - segmentStart);
      const play = () => {
        if (!state.transport.playing || state.transport.session !== session) return;
        state.activeMelodyNote = note;
        const activeNotes = melodyNotesForEvent(activeChartEvent());
        const noteIndex = activeNotes.findIndex(candidate => candidate.id === note.id);
        if (noteIndex >= 0) state.melodyCursor = noteIndex;
        renderStudy({ keepVisible: false });
        // Let a held melody note ring across a chord marker. It is scheduled
        // once at its real onset, not chopped/restarted at every harmony cell.
        const playableBeats = Math.max(.06, Math.min(
          note.durationBeats,
          Number.isFinite(chartEndBeat) ? Math.max(.06, chartEndBeat - note.startBeat) : note.durationBeats
        ));
        previewMelodyNote(note, `chart-melody-${entry.id}-${index}`, playableBeats * secondsPerBeat * .94);
      };
      if (offsetBeats <= .001) play();
      else scheduleTransport(play, offsetBeats * secondsPerBeat * 1000, session);
    });
  }

  function playTimelineEntry(timelineIndex, session, secondsPerBeat) {
    if (!state.transport.playing || state.transport.session !== session) return;
    const entry = state.timeline[timelineIndex];
    if (!entry) {
      stopChartPlayback();
      return;
    }
    if (entry.type === 'chord' && Number.isInteger(entry.eventIndex)) {
      selectEvent(entry.eventIndex, false, { transport: true });
      const event = activeChartEvent();
      if (event) {
        const duration = Math.max(.06, entry.durationBeats * secondsPerBeat * .92);
        playVoicing(state.displayVoicing.length ? state.displayVoicing : state.voicing, duration, `chart-chord-${entry.id}`);
        scheduleMelodyForSegment(entry, secondsPerBeat, session);
      }
    } else {
      state.activeMelodyNote = null;
      renderStudy({ keepVisible: false });
      scheduleMelodyForSegment(entry, secondsPerBeat, session);
    }
    const next = state.timeline[timelineIndex + 1];
    if (!next) {
      scheduleTransport(() => stopChartPlayback(), Math.max(.06, entry.durationBeats * secondsPerBeat) * 1000, session);
      return;
    }
    const delayBeats = Math.max(.01, next.startBeat - entry.startBeat);
    scheduleTransport(() => playTimelineEntry(timelineIndex + 1, session, secondsPerBeat), delayBeats * secondsPerBeat * 1000, session);
  }

  function startChartPlayback() {
    if (!state.timeline.length) return;
    if (state.transport.playing) {
      stopChartPlayback();
      return;
    }
    const activeEntry = state.timelineByEventIndex.get(state.activeIndex);
    let startIndex = activeEntry ? state.timeline.findIndex(entry => entry.id === activeEntry.id) : state.timeline.findIndex(entry => entry.type === 'chord');
    if (melodyMatchesChart() && state.activeIndex === 0 && activeEntry) {
      const firstChordIndex = state.timeline.findIndex(entry => entry.type === 'chord');
      if (firstChordIndex >= 0 && state.timeline.slice(0, firstChordIndex).some(entry => entry.type === 'rest')) startIndex = 0;
    }
    if (startIndex < 0) return;
    if (state.transport.playMelody && melodyMatchesChart()) state.showMelody = true;
    state.activeMelodyNote = null;
    state.transport.playing = true;
    state.transport.session += 1;
    const session = state.transport.session;
    const secondsPerBeat = 60 / currentTempo();
    renderStudy({ keepVisible: false });
    playTimelineEntry(startIndex, session, secondsPerBeat);
  }

  function syncNoteNameToggle() {
    elements.toggleNoteNames.textContent = `Names: ${state.showNoteNames ? 'On' : 'Off'}`;
    elements.toggleNoteNames.setAttribute('aria-pressed', String(state.showNoteNames));
    elements.toggleNoteNames.setAttribute('aria-label', `${state.showNoteNames ? 'Hide' : 'Show'} note names on piano keys`);
  }

  function toggleNoteNames() {
    state.showNoteNames = !state.showNoteNames;
    syncNoteNameToggle();
    try { localStorage.setItem(NOTE_NAMES_STORAGE_KEY, state.showNoteNames ? 'on' : 'off'); } catch (_) {}
    renderStudy({ keepVisible: false });
  }

  elements.search.addEventListener('focus', renderSearchResults);
  elements.search.addEventListener('input', () => { state.searchIndex = -1; renderSearchResults(); });
  elements.search.addEventListener('keydown', event => {
    const songs = matchingSongs(elements.search.value);
    if (event.key === 'Escape') { hideSearchResults(); elements.search.blur(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowDown') state.searchIndex = Math.min(songs.length - 1, state.searchIndex + 1);
    if (event.key === 'ArrowUp') state.searchIndex = Math.max(0, state.searchIndex - 1);
    if (event.key === 'Enter' && songs[state.searchIndex < 0 ? 0 : state.searchIndex]) {
      loadSong(songs[state.searchIndex < 0 ? 0 : state.searchIndex]);
      return;
    }
    renderSearchResults();
    elements.searchResults.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.search-wrap')) hideSearchResults();
  });
  elements.randomSong.addEventListener('click', () => {
    if (!state.songs.length) return;
    loadSong(state.songs[Math.floor(Math.random() * state.songs.length)]);
  });
  elements.previousChord.addEventListener('click', () => selectEvent(state.activeIndex - 1, true));
  elements.nextChord.addEventListener('click', () => selectEvent(state.activeIndex + 1, true));
  elements.toggleNoteNames.addEventListener('click', toggleNoteNames);
  elements.toggleMelody.addEventListener('click', () => { toggleMelody(); });
  elements.loadMidi.addEventListener('click', () => {
    if (state.midi) elements.midiFileInput.click();
    else requestMidiSource();
  });
  elements.midiFileInput.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    loadImportedMidi(file).catch(error => {
      console.error(error);
      elements.midiStatus.textContent = error?.message || 'Could not read this MIDI file.';
    });
  });
  elements.chartSource.addEventListener('change', () => {
    if (elements.chartSource.value === state.chartSource) return;
    activateChartSource(elements.chartSource.value);
  });
  elements.melodySlider.addEventListener('input', () => {
    const event = activeChartEvent();
    const notes = melodyNotesForEvent(event);
    if (!notes.length || !state.showMelody) return;
    const index = Math.max(0, Math.min(notes.length - 1, Number(elements.melodySlider.value) || 0));
    state.melodyCursor = index;
    state.activeMelodyNote = notes[index];
    renderStudy({ keepVisible: false });
    previewMelodyNote(notes[index]);
  });
  elements.playChart.addEventListener('click', startChartPlayback);
  elements.useChartTempo.addEventListener('change', () => {
    const resume = state.transport.playing;
    if (resume) stopChartPlayback({ render: false });
    state.transport.useChartTempo = elements.useChartTempo.checked;
    syncTransportControls();
    if (resume) startChartPlayback();
  });
  elements.tempoRange.addEventListener('input', () => {
    const resume = state.transport.playing;
    if (resume) stopChartPlayback({ render: false });
    state.transport.customBpm = Math.max(40, Math.min(260, Number(elements.tempoRange.value) || DEFAULT_TEMPO));
    try { localStorage.setItem(TEMPO_STORAGE_KEY, String(state.transport.customBpm)); } catch (_) {}
    syncTransportControls();
    if (resume) startChartPlayback();
  });
  elements.playMelody.addEventListener('change', () => {
    state.transport.playMelody = elements.playMelody.checked;
    if (state.transport.playMelody && melodyMatchesChart()) {
      state.showMelody = true;
      renderStudy({ keepVisible: false });
    }
  });
  elements.retryLoad.addEventListener('click', loadCatalog);

  elements.piano.addEventListener('pointerdown', event => {
    const key = event.target.closest('.piano-key[data-midi]');
    if (!key) return;
    event.preventDefault();
    elements.piano.setPointerCapture(event.pointerId);
    startVoice(`pointer-${event.pointerId}`, Number(key.dataset.midi));
  });
  const releasePianoPointer = event => {
    stopVoice(`pointer-${event.pointerId}`);
    if (elements.piano.hasPointerCapture(event.pointerId)) elements.piano.releasePointerCapture(event.pointerId);
  };
  elements.piano.addEventListener('pointerup', releasePianoPointer);
  elements.piano.addEventListener('pointercancel', releasePianoPointer);
  elements.piano.addEventListener('lostpointercapture', releasePianoPointer);
  elements.piano.addEventListener('contextmenu', event => event.preventDefault());

  elements.studyCard = document.querySelector('.study-card');
  elements.studyCard.addEventListener('pointerdown', event => {
    if (event.target.closest('button, .piano')) return;
    swipe = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  });
  elements.studyCard.addEventListener('pointerup', event => {
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) selectEvent(state.activeIndex + (dx < 0 ? 1 : -1), true);
  });
  elements.studyCard.addEventListener('pointercancel', () => { swipe = null; });

  document.addEventListener('keydown', event => {
    if (event.target.closest('input, button, a, select, textarea, [contenteditable]')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); selectEvent(state.activeIndex - 1, true); }
    if (event.key === 'ArrowRight') { event.preventDefault(); selectEvent(state.activeIndex + 1, true); }
    if (event.key === ' ') { event.preventDefault(); playCurrentVoicing(); }
  });
  window.addEventListener('pagehide', () => {
    stopChartPlayback({ render: false });
    [...voices.keys()].forEach(id => stopVoice(id, true));
  });

  try { state.showNoteNames = localStorage.getItem(NOTE_NAMES_STORAGE_KEY) !== 'off'; } catch (_) {}
  try {
    const savedTempo = Number(localStorage.getItem(TEMPO_STORAGE_KEY));
    if (Number.isFinite(savedTempo) && savedTempo >= 40 && savedTempo <= 260) state.transport.customBpm = savedTempo;
  } catch (_) {}
  syncNoteNameToggle();
  syncTransportControls();
  window.KeyerStandardsDebug = {
    state,
    loadSong,
    selectEvent,
    scaleForEvent,
    toggleNoteNames,
    buildMidiChart,
    installMidiSource,
    startChartPlayback,
    stopChartPlayback,
    melodyNotesForEvent
  };
  loadCatalog();
})();
