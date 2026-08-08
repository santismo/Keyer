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
  const KEYBOARD_RANGE_STORAGE_KEY = 'keyer-jazz-keyboard-range';
  const INSTRUMENT_VIEW_STORAGE_KEY = 'keyer-jazz-instrument-view';
  const KEYBOARD_TONE_STORAGE_KEY = 'keyer-jazz-keyboard-tone-mode';
  const FRETBOARD_TONE_STORAGE_KEY = 'keyer-jazz-fretboard-tone-mode';
  const DESKTOP_KEYBOARD_RANGE_STORAGE_KEY = 'keyer-jazz-desktop-keyboard-range';
  const DISPLAY_LOW = 48;
  const DISPLAY_HIGH = 72;
  const WIDE_LOW = 36;
  const WIDE_HIGH = 96;
  const ACCOMPANIMENT_LOW = 24;
  const ACCOMPANIMENT_HIGH = 72;
  const DEFAULT_TEMPO = 120;
  const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
  // Display high E first, just as a guitar is normally drawn from the
  // player's point of view.  Every string stays within its real open-to-12th
  // fret register; out-of-window melody notes carry their true octave badge.
  const FRETBOARD_STRINGS = [
    { label: 'e', name: 'high E', midi: 64 },
    { label: 'B', name: 'B', midi: 59 },
    { label: 'G', name: 'G', midi: 55 },
    { label: 'D', name: 'D', midi: 50 },
    { label: 'A', name: 'A', midi: 45 },
    { label: 'E', name: 'low E', midi: 40 }
  ];
  const FRETBOARD_MAX_FRET = 12;
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
    melodyPiano: document.querySelector('#melodyPiano'),
    keyboardStack: document.querySelector('#keyboardStack'),
    melodyKeyboardPane: document.querySelector('#melodyKeyboardPane'),
    fretboard: document.querySelector('#fretboard'),
    keyboardRangeMode: document.querySelector('#keyboardRangeMode'),
    keyboardToneMode: document.querySelector('#keyboardToneMode'),
    fretboardToneMode: document.querySelector('#fretboardToneMode'),
    instrumentView: document.querySelector('#instrumentView'),
    studyCard: document.querySelector('.study-card'),
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
    keyboardRangeMode: document.body.classList.contains('desktop-mode') ? 'wide' : 'compact',
    keyboardToneMode: 'scale',
    fretboardToneMode: 'scale',
    instrumentView: 'piano',
    // The full keyboard must remain stable while stepping through a chart.
    // It is rebuilt only when the selected chart/melody data changes.
    fullSongKeyboard: { key: '', range: null, eventVoicings: new Map(), midis: [] },
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
    // The slider is tied to an occurrence, not just an index. A repeated
    // chord can have a different melody phrase each time through the form.
    melodyCursorEventKey: '',
    melodyNavigationEventKey: '',
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
  const deferredFullKeyboardTaps = new Map();
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

  function melodyTimingForEvent(event) {
    if (!event) return null;
    const usePlaybackTiming = state.chartSource === 'ireal' && state.melodyOverlayChartId === 'ireal';
    const startBeat = Number(usePlaybackTiming ? event.playbackStartBeat : event.sourceStartBeat);
    const endBeat = Number(usePlaybackTiming ? event.playbackEndBeat : event.sourceEndBeat);
    if (!Number.isFinite(startBeat) || !Number.isFinite(endBeat) || endBeat <= startBeat) return null;
    return { startBeat, endBeat };
  }

  function melodyEventKey(event) {
    const timing = melodyTimingForEvent(event);
    if (!event || !timing) return '';
    return `${state.chartSource}:${event.eventIndex}:${event.cellId}:${timing.startBeat}:${timing.endBeat}`;
  }

  function isFirstMelodyEvent(event) {
    const firstEvent = state.events[0];
    return event?.eventIndex === firstEvent?.eventIndex;
  }

  function melodyNoteOverlapsEvent(note, event) {
    const timing = melodyTimingForEvent(event);
    if (!timing || !note) return false;
    // A marker chart can have a pickup before its first harmony marker. That
    // pickup belongs with the first playable chord, even when it begins just
    // before that marker.
    const startBeat = isFirstMelodyEvent(event) ? 0 : timing.startBeat;
    return note.startBeat < timing.endBeat - .0001 && note.endBeat > startBeat + .0001;
  }

  function melodyNotesForEvent(event) {
    if (!melodyMatchesChart() || !event || !state.melodyNotes.length) return [];
    const timing = melodyTimingForEvent(event);
    if (!timing) return [];
    const pickup = isFirstMelodyEvent(event);
    // The slider and manual arrows own notes by their onset. In particular,
    // a note held into a new bar must not reappear before that bar's own
    // melody notes and make a rightward slider drag look like it went back.
    return state.melodyNotes.filter(note => {
      if (pickup) return note.startBeat < timing.endBeat - .0001 && note.endBeat > -0.01;
      return note.startBeat >= timing.startBeat - .0001 && note.startBeat < timing.endBeat - .0001;
    });
  }

  function melodyNotesDuringEvent(event) {
    if (!melodyMatchesChart() || !event || !state.melodyNotes.length) return [];
    return state.melodyNotes.filter(note => melodyNoteOverlapsEvent(note, event));
  }

  function melodyCursorIndex(event, notes) {
    if (!notes.length) return -1;
    const activeIndex = state.activeMelodyNote ? notes.findIndex(note => note.id === state.activeMelodyNote.id) : -1;
    if (activeIndex >= 0) return activeIndex;
    if (state.melodyCursorEventKey === melodyEventKey(event)) {
      return Math.max(0, Math.min(notes.length - 1, state.melodyCursor));
    }
    return 0;
  }

  function resetMelodySelection() {
    state.activeMelodyNote = null;
    state.melodyCursor = 0;
    state.melodyCursorEventKey = '';
    state.melodyNavigationEventKey = '';
  }

  function selectMelodyNote(event, notes, index, { navigated = false } = {}) {
    if (!event || !notes.length) return null;
    const cursor = Math.max(0, Math.min(notes.length - 1, Number(index) || 0));
    const note = notes[cursor];
    const eventKey = melodyEventKey(event);
    state.melodyCursor = cursor;
    state.melodyCursorEventKey = eventKey;
    state.activeMelodyNote = note;
    if (navigated) state.melodyNavigationEventKey = eventKey;
    return note;
  }

  function activeMelodyForEvent(event) {
    if (!state.showMelody) return null;
    const notes = melodyNotesForEvent(event);
    if (state.activeMelodyNote && notes.some(note => note.id === state.activeMelodyNote.id)) return state.activeMelodyNote;
    // During transport, retain a sounding note when it crosses a chord
    // marker. It remains visible, but it is deliberately not a slider step
    // for the later chord.
    if (state.transport.playing && state.activeMelodyNote && melodyNoteOverlapsEvent(state.activeMelodyNote, event)) return state.activeMelodyNote;
    if (!notes.length) return null;
    const index = melodyCursorIndex(event, notes);
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

  function melodyMidiValues(notes) {
    return (notes || []).map(note => Number(note?.midi ?? note)).filter(Number.isFinite);
  }

  function soundingVoicingForMelody(voicing, notes = []) {
    voicing = Array.isArray(voicing) ? voicing : [];
    const melodyMidis = melodyMidiValues(notes);
    const fitted = melodyMidis.length && typeof Theory.fitVoicingForMelody === 'function'
      ? Theory.fitVoicingForMelody(voicing, melodyMidis, ACCOMPANIMENT_LOW, ACCOMPANIMENT_HIGH)
      : Theory.fitVoicingToRange(voicing, DISPLAY_LOW, DISPLAY_HIGH);
    return fitted.length === voicing.length ? fitted : voicing;
  }

  function eventChordVariants(event) {
    const variants = [event?.chord];
    (event?.item?.alternates || []).forEach(option => {
      if (option?.parsed) variants.push(option.parsed);
    });
    const seen = new Set();
    return variants.filter(chord => {
      const key = chord?.raw || chord?.display || '';
      if (!chord || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function fullSongKeyboardAvailable() {
    return Boolean(state.events.length && state.midi && state.melodyNotes.length && melodyMatchesChart());
  }

  function fullSongKeyboardKey() {
    const events = state.events.map(event => {
      const variants = eventChordVariants(event).map(chord => chord.raw || chord.display).join(',');
      const timing = melodyTimingForEvent(event);
      return `${event.eventIndex}:${event.cellId}:${variants}:${timing?.startBeat ?? ''}:${timing?.endBeat ?? ''}`;
    }).join('|');
    const melody = state.melodyNotes.map(note => `${note.id}:${note.midi}:${note.startBeat}:${note.endBeat}`).join('|');
    return `${state.chartSource}::${events}::${melody}`;
  }

  function snapFullKeyboardRange(midis) {
    const values = (midis || []).map(Number).filter(Number.isFinite);
    if (!values.length) return null;
    const min = Math.max(0, Math.min(...values));
    const max = Math.min(127, Math.max(...values));
    let low = Math.max(0, Math.floor(min / 12) * 12);
    // C-to-C gives an honest count of whole octaves and keeps the top key
    // useful, rather than ending a "full octave" at B.
    let high = Math.min(127, Math.ceil(max / 12) * 12);
    if (high - low < 12) high = Math.min(127, low + 12);
    if (high - low < 12) low = Math.max(0, high - 12);
    return {
      low,
      high,
      span: high - low + 1,
      octaves: (high - low) / 12,
      full: true
    };
  }

  function fullSongKeyboardData() {
    if (!fullSongKeyboardAvailable()) return null;
    const key = fullSongKeyboardKey();
    if (state.fullSongKeyboard?.key === key && state.fullSongKeyboard.range) return state.fullSongKeyboard;

    const allMidis = melodyMidiValues(state.melodyNotes);
    const eventVoicings = new Map();
    state.events.forEach(event => {
      // Use the exact held-note ownership rule used by the live card.  A
      // note crossing a marker can change the fitted accompaniment register.
      const eventMelody = melodyNotesDuringEvent(event);
      eventChordVariants(event).forEach(chord => {
        const voicing = soundingVoicingForMelody(Theory.makeVoicing(chord), eventMelody);
        const variantKey = `${event.eventIndex}:${chord.raw || chord.display}`;
        eventVoicings.set(variantKey, voicing);
        voicing.forEach(note => { if (Number.isFinite(note?.midi)) allMidis.push(note.midi); });
      });
    });
    const range = snapFullKeyboardRange(allMidis);
    state.fullSongKeyboard = { key, range, eventVoicings, midis: [...new Set(allMidis)].sort((a, b) => a - b) };
    return state.fullSongKeyboard;
  }

  function keyboardRangeStorageKey() {
    return document.body.classList.contains('desktop-mode') ? DESKTOP_KEYBOARD_RANGE_STORAGE_KEY : KEYBOARD_RANGE_STORAGE_KEY;
  }

  function activeKeyboardRangeMode() {
    if (state.keyboardRangeMode === 'full') return fullSongKeyboardData()?.range ? 'full' : 'compact';
    return ['compact', 'split', 'wide'].includes(state.keyboardRangeMode) ? state.keyboardRangeMode : 'compact';
  }

  function syncInstrumentControls() {
    const fullAvailable = Boolean(fullSongKeyboardData()?.range);
    if (elements.keyboardRangeMode) {
      const fullOption = elements.keyboardRangeMode.querySelector('option[value="full"], option[value="full-song"]');
      if (fullOption) fullOption.disabled = !fullAvailable;
      if (!fullAvailable && state.keyboardRangeMode === 'full') state.keyboardRangeMode = 'compact';
      elements.keyboardRangeMode.value = state.keyboardRangeMode;
      elements.keyboardRangeMode.setAttribute('aria-label', fullAvailable
        ? 'Keyboard range: compact, split, wide, or full song register'
        : 'Keyboard range: compact, split, or wide; load a matching MIDI to use the full song register');
    }
    if (elements.keyboardToneMode) elements.keyboardToneMode.value = state.keyboardToneMode;
    if (elements.fretboardToneMode) elements.fretboardToneMode.value = state.fretboardToneMode;
    const view = state.instrumentView === 'fretboard' && elements.fretboard ? 'fretboard' : 'piano';
    state.instrumentView = view;
    if (elements.instrumentView) elements.instrumentView.value = view;
    if (elements.piano) {
      elements.piano.hidden = view !== 'piano';
      elements.piano.dataset.instrumentView = view;
    }
    if (elements.keyboardStack) elements.keyboardStack.dataset.rangeMode = activeKeyboardRangeMode();
    if (elements.melodyKeyboardPane) {
      elements.melodyKeyboardPane.hidden = view !== 'piano' || activeKeyboardRangeMode() !== 'split';
    }
    if (elements.melodyPiano) elements.melodyPiano.dataset.instrumentView = view;
    if (elements.fretboard) {
      elements.fretboard.hidden = view !== 'fretboard';
      elements.fretboard.dataset.instrumentView = view;
    }
    elements.studyCard?.setAttribute('data-instrument-view', view);
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

  function validToneMode(mode) {
    return ['scale', 'chord', 'voicing'].includes(mode) ? mode : 'scale';
  }

  function oneOctaveRangeForVoicing(voicing) {
    const midis = (voicing || []).map(note => Number(note?.midi)).filter(Number.isFinite);
    const lowest = midis.length ? Math.min(...midis) : DISPLAY_LOW;
    const low = Math.max(0, Math.min(115, Math.floor(lowest / 12) * 12));
    return { low, high: low + 12, span: 13, octaves: 1, voicing: true };
  }

  function twoOctaveRangeForMelody(melodyNote) {
    const midi = Number(melodyNote?.midi);
    if (!Number.isFinite(midi)) return { low: DISPLAY_LOW, high: DISPLAY_HIGH };
    const low = Math.max(0, Math.min(103, Math.floor(midi / 12) * 12));
    return { low, high: low + 24, span: 25, octaves: 2, melody: true };
  }

  function addToneClass(element, pc, toneMode, rootBassSet, chordSet, scaleSet, sounding) {
    if (toneMode === 'voicing' && !sounding) return;
    if (rootBassSet.has(pc)) element.classList.add('root-tone');
    else if (chordSet.has(pc)) element.classList.add('chord-tone');
    else if (toneMode === 'scale' && scaleSet.has(pc)) element.classList.add('scale-tone');
  }

  function renderKeyboardSurface(surface, chord, scale, {
    range,
    rangeMode = 'compact',
    toneMode = 'scale',
    voicing = [],
    melodyNote = null,
    label = 'piano',
    updateDisplayState = false
  } = {}) {
    if (!surface || !range) return [];
    toneMode = validToneMode(toneMode);
    const scaleSet = new Set((scale?.pcs || []).map(pc => Theory.mod(pc)));
    const chordSet = new Set(Theory.chordPitchClasses(chord));
    const rootBassSet = new Set([Theory.mod(chord.root)]);
    if (chord.slash != null) rootBassSet.add(Theory.mod(chord.slash));
    const scaleSpellingByPc = new Map();
    (scale?.notes || []).forEach(note => {
      const parsed = Theory.parseNoteSpelling(note);
      if (parsed) scaleSpellingByPc.set(parsed.pc, note);
    });
    (scale?.pcs || []).forEach(pc => {
      const pitchClass = Theory.mod(pc);
      if (!scaleSpellingByPc.has(pitchClass)) scaleSpellingByPc.set(pitchClass, Theory.noteName(pitchClass, state.preferFlats));
    });
    const chordSpellingByPc = new Map((chord.spelledTones || []).map(tone => [Theory.mod(tone.pc), tone.spelling]));
    const LOW = range.low;
    const HIGH = range.high;
    const whiteMidis = [];
    for (let midi = LOW; midi <= HIGH; midi += 1) if (!BLACK_PCS.has(Theory.mod(midi))) whiteMidis.push(midi);
    const whiteCount = whiteMidis.length;
    const literalRegister = rangeMode === 'full';
    const wideSurface = rangeMode === 'full' || rangeMode === 'wide';
    const displayVoicing = literalRegister || voicing.every(note => note.midi >= LOW && note.midi <= HIGH)
      ? voicing
      : Theory.fitVoicingToRange(voicing, LOW, HIGH);
    const voicingByMidi = new Map(displayVoicing.map(note => [note.midi, note]));
    const melodyDisplayMidi = melodyNote
      ? literalRegister ? Number(melodyNote.midi) : foldedMidiForDisplay(melodyNote.midi, LOW, HIGH)
      : null;
    const melodyFolded = Boolean(melodyNote && melodyDisplayMidi !== melodyNote.midi);
    if (updateDisplayState) {
      state.displayVoicing = displayVoicing;
      state.displayRange = range;
    }
    surface.dataset.voicingCount = String(displayVoicing.length);
    surface.dataset.lowMidi = String(LOW);
    surface.dataset.highMidi = String(HIGH);
    surface.dataset.rangeMode = rangeMode;
    surface.dataset.toneMode = toneMode;
    surface.dataset.keyboardSpan = String(HIGH - LOW + 1);
    surface.dataset.whiteKeyCount = String(whiteCount);
    surface.style.setProperty('--key-count', String(HIGH - LOW + 1));
    surface.style.setProperty('--white-key-count', String(whiteCount));
    surface.style.setProperty('--full-keyboard-width', wideSurface ? `${Math.max(264, whiteCount * 24)}px` : '');
    surface.dataset.melodyMidi = melodyNote ? String(melodyNote.midi) : '';
    surface.dataset.melodyDisplayMidi = melodyDisplayMidi == null ? '' : String(melodyDisplayMidi);
    const rangeLabel = rangeMode === 'full' ? 'Full-song piano' : rangeMode === 'wide' ? 'Wide piano' : range.octaves === 1 ? 'One-octave piano' : 'Two-octave piano';
    surface.setAttribute('aria-label', `${label}: ${rangeLabel} from ${Theory.midiName(LOW, state.preferFlats)} to ${Theory.midiName(HIGH, state.preferFlats)}`);
    const fragment = document.createDocumentFragment();
    let whitesBefore = 0;

    for (let midi = LOW; midi <= HIGH; midi += 1) {
      const pc = Theory.mod(midi);
      const black = BLACK_PCS.has(pc);
      const sounding = voicingByMidi.get(midi);
      const melodyHere = melodyDisplayMidi === midi;
      const toneVisible = toneMode === 'scale' || Boolean(sounding) || melodyHere || (toneMode === 'chord' && (rootBassSet.has(pc) || chordSet.has(pc)));
      const key = document.createElement('button');
      key.type = 'button';
      key.className = `piano-key ${black ? 'black' : 'white'}`;
      addToneClass(key, pc, toneMode, rootBassSet, chordSet, scaleSet, sounding);
      if (sounding) key.classList.add('voicing');
      if (sounding?.bass) key.classList.add('bass');
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
      const name = spelling ? Theory.spelledMidiName(midi, spelling, state.preferFlats) : Theory.midiName(midi, state.preferFlats);
      key.setAttribute('aria-label', `${name}${sounding ? `, suggested ${sounding.role}` : ''}${melodyHere ? `, melody ${melodyLabel(melodyNote)}${melodyFolded ? ', shown in this two-octave view' : ''}` : ''}`);
      if (state.showNoteNames && toneVisible) {
        const noteLabel = document.createElement('span');
        noteLabel.className = 'key-name';
        noteLabel.textContent = Theory.displayNoteSpelling(spelling);
        key.appendChild(noteLabel);
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
    surface.replaceChildren(fragment);
    pressedCounts.forEach((count, midi) => {
      if (count > 0) surface.querySelector(`[data-midi="${midi}"]`)?.classList.add('playing');
    });
    return displayVoicing;
  }

  function renderPiano(chord, scale, voicing, melodyNote = null, melodyNotes = []) {
    const melodyMidis = melodyMidiValues(melodyNotes);
    const soundingVoicing = soundingVoicingForMelody(voicing, melodyMidis);
    const rangeMode = activeKeyboardRangeMode();
    const toneMode = validToneMode(state.keyboardToneMode);
    const fullSongRange = rangeMode === 'full' ? fullSongKeyboardData()?.range : null;
    const baseRange = fullSongRange || (rangeMode === 'wide' ? { low: WIDE_LOW, high: WIDE_HIGH, octaves: 5, wide: true } : displayRangeForVoicing(soundingVoicing, melodyMidis));

    if (rangeMode === 'split') {
      const chordRange = displayRangeForVoicing(soundingVoicing, []);
      renderKeyboardSurface(elements.piano, chord, scale, {
        range: chordRange,
        rangeMode: 'compact',
        toneMode: 'voicing',
        voicing: soundingVoicing,
        label: 'Chord fingering',
        updateDisplayState: true
      });
      renderKeyboardSurface(elements.melodyPiano, chord, scale, {
        range: twoOctaveRangeForMelody(melodyNote),
        rangeMode: 'compact',
        toneMode: 'voicing',
        voicing: [],
        melodyNote,
        label: state.showMelody ? 'Melody' : 'Melody (enable melody to show a note)'
      });
    } else {
      const range = toneMode === 'voicing' ? oneOctaveRangeForVoicing(soundingVoicing) : baseRange;
      const surfaceRangeMode = toneMode === 'voicing' ? 'voicing' : rangeMode;
      renderKeyboardSurface(elements.piano, chord, scale, {
        range,
        rangeMode: surfaceRangeMode,
        toneMode,
        voicing: soundingVoicing,
        melodyNote,
        label: 'Chord and scale',
        updateDisplayState: true
      });
    }
    elements.piano.closest('.study-card')?.querySelector('.color-legend')?.setAttribute('data-melody-visible', String(Boolean(melodyNote)));
  }

  function fretboardPositionForMidi(value, { preferLowString = false } = {}) {
    const target = Number(value);
    if (!Number.isFinite(target)) return null;
    const candidates = [];
    FRETBOARD_STRINGS.forEach((string, stringIndex) => {
      for (let fret = 0; fret <= FRETBOARD_MAX_FRET; fret += 1) {
        const midi = string.midi + fret;
        if (Theory.mod(midi) !== Theory.mod(target)) continue;
        candidates.push({ stringIndex, fret, midi, distance: Math.abs(midi - target) });
      }
    });
    candidates.sort((left, right) => (
      left.distance - right.distance
      || left.fret - right.fret
      || (preferLowString ? right.stringIndex - left.stringIndex : left.stringIndex - right.stringIndex)
    ));
    return candidates[0] || null;
  }

  function fretboardPositionKey(position) {
    return position ? `${position.stringIndex}:${position.fret}` : '';
  }

  function renderFretboard(chord, scale, voicing, melodyNote = null) {
    if (!elements.fretboard) return;
    const toneMode = validToneMode(state.fretboardToneMode);
    const scaleSet = new Set((scale?.pcs || []).map(pc => Theory.mod(pc)));
    const chordSet = new Set(Theory.chordPitchClasses(chord));
    const rootBassSet = new Set([Theory.mod(chord.root)]);
    if (chord.slash != null) rootBassSet.add(Theory.mod(chord.slash));
    const scaleSpellingByPc = new Map();
    (scale?.notes || []).forEach(note => {
      const parsed = Theory.parseNoteSpelling(note);
      if (parsed) scaleSpellingByPc.set(parsed.pc, note);
    });
    (scale?.pcs || []).forEach(pc => {
      const pitchClass = Theory.mod(pc);
      if (!scaleSpellingByPc.has(pitchClass)) scaleSpellingByPc.set(pitchClass, Theory.noteName(pitchClass, state.preferFlats));
    });
    const chordSpellingByPc = new Map((chord.spelledTones || []).map(tone => [Theory.mod(tone.pc), tone.spelling]));
    const voicingByPosition = new Map();
    (voicing || []).forEach(note => {
      const position = fretboardPositionForMidi(note.midi, { preferLowString: Boolean(note.bass) });
      const key = fretboardPositionKey(position);
      if (!key) return;
      const current = voicingByPosition.get(key);
      if (!current || note.bass) voicingByPosition.set(key, { ...note, displayMidi: position.midi, folded: position.midi !== note.midi });
    });
    const melodyPosition = melodyNote ? fretboardPositionForMidi(melodyNote.midi) : null;
    const melodyPositionKey = fretboardPositionKey(melodyPosition);
    elements.fretboard.dataset.lowMidi = '40';
    elements.fretboard.dataset.highMidi = String(64 + FRETBOARD_MAX_FRET);
    elements.fretboard.dataset.rangeMode = 'fretboard';
    elements.fretboard.dataset.toneMode = toneMode;
    elements.fretboard.dataset.melodyMidi = melodyNote ? String(melodyNote.midi) : '';
    elements.fretboard.setAttribute('aria-label', 'Guitar fretboard from the open strings through the twelfth fret, showing chord, scale, voicing, and optional melody');

    const board = document.createElement('div');
    board.className = 'fretboard-grid';
    FRETBOARD_STRINGS.forEach((string, stringIndex) => {
      const row = document.createElement('div');
      row.className = 'fretboard-string';
      row.setAttribute('role', 'row');
      row.dataset.string = String(stringIndex);
      row.dataset.openMidi = String(string.midi);
      const stringLabel = document.createElement('span');
      stringLabel.className = 'fretboard-string-label';
      stringLabel.textContent = string.label;
      stringLabel.setAttribute('aria-hidden', 'true');
      row.appendChild(stringLabel);
      for (let fret = 0; fret <= FRETBOARD_MAX_FRET; fret += 1) {
        const midi = string.midi + fret;
        const pc = Theory.mod(midi);
        const cellKey = `${stringIndex}:${fret}`;
        const sounding = voicingByPosition.get(cellKey);
        const melodyHere = cellKey === melodyPositionKey;
        const toneVisible = toneMode === 'scale' || Boolean(sounding) || melodyHere || (toneMode === 'chord' && (rootBassSet.has(pc) || chordSet.has(pc)));
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'fretboard-cell';
        cell.setAttribute('role', 'gridcell');
        if (fret === 0) cell.classList.add('open-string');
        addToneClass(cell, pc, toneMode, rootBassSet, chordSet, scaleSet, sounding);
        if (sounding) cell.classList.add('voicing');
        if (sounding?.bass) cell.classList.add('bass');
        if (melodyHere) {
          cell.classList.add('melody-tone');
          cell.dataset.melodyMidi = String(melodyNote.midi);
        }
        cell.dataset.string = String(stringIndex);
        cell.dataset.fret = String(fret);
        cell.dataset.midi = String(midi);
        const spelling = sounding?.spelling || chordSpellingByPc.get(pc) || scaleSpellingByPc.get(pc) || Theory.noteName(pc, state.preferFlats);
        const name = spelling ? Theory.spelledMidiName(midi, spelling, state.preferFlats) : Theory.midiName(midi, state.preferFlats);
        const foldedMelody = Boolean(melodyHere && melodyPosition.midi !== melodyNote.midi);
        cell.setAttribute('aria-label', `${string.name} string, fret ${fret}, ${name}${sounding ? `, suggested ${sounding.role}` : ''}${melodyHere ? `, melody ${melodyLabel(melodyNote)}${foldedMelody ? ', shown on this fretboard octave' : ''}` : ''}`);
        if (stringIndex === 0) {
          const fretLabel = document.createElement('span');
          fretLabel.className = 'fretboard-fret-label';
          fretLabel.textContent = String(fret);
          fretLabel.setAttribute('aria-hidden', 'true');
          cell.appendChild(fretLabel);
        }
        if (state.showNoteNames && toneVisible) {
          const noteLabel = document.createElement('span');
          noteLabel.className = 'fretboard-note';
          noteLabel.textContent = Theory.displayNoteSpelling(spelling);
          cell.appendChild(noteLabel);
        }
        if (sounding) {
          const role = document.createElement('span');
          role.className = 'fretboard-role';
          role.textContent = sounding.role === 'Bass' ? 'B' : sounding.role;
          cell.appendChild(role);
        }
        if (foldedMelody) {
          const octave = document.createElement('span');
          octave.className = 'melody-octave';
          octave.textContent = melodyLabel(melodyNote);
          octave.setAttribute('aria-hidden', 'true');
          cell.appendChild(octave);
        }
        row.appendChild(cell);
      }
      board.appendChild(row);
    });
    elements.fretboard.replaceChildren(board);
    pressedCounts.forEach((count, midi) => {
      if (!count) return;
      const position = fretboardPositionForMidi(midi);
      if (!position) return;
      elements.fretboard.querySelector(`[data-string="${position.stringIndex}"][data-fret="${position.fret}"]`)?.classList.add('playing');
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
    elements.melodySlider.dataset.eventKey = visible ? melodyEventKey(event) : '';
    if (!visible) {
      syncMelodyNavigationLabels(event, notes);
      return;
    }
    if (!notes.length) {
      elements.melodyReadout.textContent = 'No melody note here';
      elements.melodySlider.min = '0';
      elements.melodySlider.max = '0';
      elements.melodySlider.value = '0';
      elements.melodySlider.disabled = true;
      syncMelodyNavigationLabels(event, notes);
      return;
    }
    const selectedIndex = melodyNote ? notes.findIndex(note => note.id === melodyNote.id) : -1;
    const index = selectedIndex >= 0 ? selectedIndex : melodyCursorIndex(event, notes);
    const selected = notes[index];
    state.melodyCursor = index;
    state.melodyCursorEventKey = melodyEventKey(event);
    elements.melodySlider.min = '0';
    elements.melodySlider.max = String(notes.length - 1);
    elements.melodySlider.value = String(index);
    elements.melodySlider.disabled = false;
    elements.melodyReadout.textContent = `${melodyLabel(selected)} · ${index + 1} / ${notes.length}`;
    syncMelodyNavigationLabels(event, notes);
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
    const melodyNotesOnCard = melodyNotesDuringEvent(event);
    if (state.activeMelodyNote && !melodyNotesOnCard.some(note => note.id === state.activeMelodyNote.id)) state.activeMelodyNote = null;
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
    renderPiano(event.chord, scale, voicing, melodyNote, melodyNotesOnCard);
    renderFretboard(event.chord, scale, state.displayVoicing, melodyNote);
    syncInstrumentControls();
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
    resetMelodySelection();
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
      resetMelodySelection();
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
    resetMelodySelection();
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
          resetMelodySelection();
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
      resetMelodySelection();
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
    [elements.piano, elements.melodyPiano].forEach(surface => {
      surface?.querySelectorAll(`[data-midi="${midi}"]`).forEach(key => key.classList.toggle('playing', next > 0));
    });
    const fretPosition = fretboardPositionForMidi(midi);
    if (fretPosition) {
      elements.fretboard?.querySelector(`[data-string="${fretPosition.stringIndex}"][data-fret="${fretPosition.fret}"]`)?.classList.toggle('playing', next > 0);
    }
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

  function midiMelodyNavigationEnabled() {
    return state.chartSource === 'midi' && state.showMelody && melodyMatchesChart('midi');
  }

  function setChordNavigationLabel(element, label) {
    element.setAttribute('aria-label', label);
    element.title = label;
  }

  function syncMelodyNavigationLabels(event, suppliedNotes = null) {
    if (!midiMelodyNavigationEnabled()) {
      setChordNavigationLabel(elements.previousChord, 'Previous chord');
      setChordNavigationLabel(elements.nextChord, 'Next chord');
      return;
    }
    const notes = suppliedNotes || melodyNotesForEvent(event);
    if (!notes.length) {
      setChordNavigationLabel(elements.previousChord, 'Previous chord');
      setChordNavigationLabel(
        elements.nextChord,
        state.melodyNavigationEventKey === melodyEventKey(event) ? 'Next chord' : 'Play this chord'
      );
      return;
    }
    const eventKey = melodyEventKey(event);
    const cursor = melodyCursorIndex(event, notes);
    const hasStarted = state.melodyNavigationEventKey === eventKey;
    const nextEvent = state.events[Theory.mod(state.activeIndex + 1, state.events.length)];
    const previousEvent = state.events[Theory.mod(state.activeIndex - 1, state.events.length)];
    const nextHasMelody = melodyNotesForEvent(nextEvent).length > 0;
    const previousHasMelody = melodyNotesForEvent(previousEvent).length > 0;
    const nextLabel = !hasStarted
      ? 'Play this chord and first melody note'
      : cursor >= notes.length - 1
        ? nextHasMelody ? 'Next chord and first melody note' : 'Next chord'
        : 'Next melody note';
    const previousLabel = cursor <= 0
      ? previousHasMelody ? 'Previous chord’s last melody note' : 'Previous chord'
      : 'Previous melody note';
    setChordNavigationLabel(elements.previousChord, previousLabel);
    setChordNavigationLabel(elements.nextChord, nextLabel);
  }

  function auditionManualMelodyStep(event, notes, index, { playChord = false } = {}) {
    const note = selectMelodyNote(event, notes, index, { navigated: true });
    if (!note) return false;
    renderStudy();
    if (playChord) playCurrentVoicing();
    previewMelodyNote(note);
    return true;
  }

  function selectMidiMelodyEvent(index, direction) {
    selectEvent(index, false);
    const event = activeChartEvent();
    const notes = melodyNotesForEvent(event);
    if (!notes.length) {
      // A chart can legitimately contain a harmony change with a rest in the
      // melody. Keep that chord reachable rather than silently skipping it.
      playCurrentVoicing();
      return;
    }
    const cursor = direction < 0 ? notes.length - 1 : 0;
    // Forward entry is the chord's downbeat: sound the compact voicing and
    // its first melody note together. Reverse entry intentionally lands on
    // the preceding chord's final melodic event.
    auditionManualMelodyStep(event, notes, cursor, { playChord: direction > 0 });
  }

  function navigateChord(direction) {
    const step = Number(direction) < 0 ? -1 : 1;
    if (!state.events.length) return;
    if (!midiMelodyNavigationEnabled()) {
      selectEvent(state.activeIndex + step, true);
      return;
    }
    if (state.transport.playing) {
      stopChartPlayback({ render: false });
      resetMelodySelection();
    }
    const event = activeChartEvent();
    const notes = melodyNotesForEvent(event);
    const eventKey = melodyEventKey(event);
    const cursor = melodyCursorIndex(event, notes);

    // The first forward press from a newly selected MIDI chord is its
    // downbeat, not a skipped preview. Once that note has sounded, arrows
    // advance or rewind one melody note at a time inside the same chord.
    if (step > 0 && state.melodyNavigationEventKey !== eventKey) {
      if (notes.length) {
        auditionManualMelodyStep(event, notes, cursor, { playChord: true });
      } else {
        // Do not skip a harmony that happens under a melodic rest. Its first
        // forward press is still the chord's downbeat; the following press
        // may move on to the next event.
        state.melodyNavigationEventKey = eventKey;
        renderStudy();
        playCurrentVoicing();
      }
      return;
    }
    const nextCursor = cursor + step;
    if (notes.length && nextCursor >= 0 && nextCursor < notes.length) {
      auditionManualMelodyStep(event, notes, nextCursor);
      return;
    }
    selectMidiMelodyEvent(state.activeIndex + step, step);
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
  elements.previousChord.addEventListener('click', () => navigateChord(-1));
  elements.nextChord.addEventListener('click', () => navigateChord(1));
  elements.toggleNoteNames.addEventListener('click', toggleNoteNames);
  elements.keyboardRangeMode?.addEventListener('change', () => {
    const selected = ['full', 'split', 'wide'].includes(elements.keyboardRangeMode.value) ? elements.keyboardRangeMode.value : 'compact';
    state.keyboardRangeMode = selected === 'full' && !fullSongKeyboardData()?.range ? 'compact' : selected;
    try { localStorage.setItem(keyboardRangeStorageKey(), state.keyboardRangeMode); } catch (_) {}
    renderStudy({ keepVisible: false });
  });
  elements.keyboardToneMode?.addEventListener('change', () => {
    state.keyboardToneMode = validToneMode(elements.keyboardToneMode.value);
    try { localStorage.setItem(KEYBOARD_TONE_STORAGE_KEY, state.keyboardToneMode); } catch (_) {}
    renderStudy({ keepVisible: false });
  });
  elements.fretboardToneMode?.addEventListener('change', () => {
    state.fretboardToneMode = validToneMode(elements.fretboardToneMode.value);
    try { localStorage.setItem(FRETBOARD_TONE_STORAGE_KEY, state.fretboardToneMode); } catch (_) {}
    renderStudy({ keepVisible: false });
  });
  elements.instrumentView?.addEventListener('change', () => {
    state.instrumentView = elements.instrumentView.value === 'fretboard' ? 'fretboard' : 'piano';
    try { localStorage.setItem(INSTRUMENT_VIEW_STORAGE_KEY, state.instrumentView); } catch (_) {}
    renderStudy({ keepVisible: false });
  });
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
    const eventKey = melodyEventKey(event);
    // A range input keeps receiving input events while it is being dragged.
    // Ignore an event emitted by a slider rendered for a different chord
    // occurrence instead of ever deriving a new active chart index from it.
    if (!eventKey || elements.melodySlider.dataset.eventKey !== eventKey) return;
    const notes = melodyNotesForEvent(event);
    if (!notes.length || !state.showMelody) return;
    const index = Math.max(0, Math.min(notes.length - 1, Number(elements.melodySlider.value) || 0));
    const note = selectMelodyNote(event, notes, index, { navigated: true });
    renderStudy({ keepVisible: false });
    previewMelodyNote(note);
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

  function instrumentPointerDown(surface, event) {
    const key = event.target.closest('.piano-key[data-midi], .fretboard-cell[data-midi]');
    if (!key || !surface?.contains(key)) return;
    // In full mode a real horizontal swipe must scroll the internal keyboard,
    // not get captured as a held key.  A short release is still an audible tap.
    if ((surface === elements.piano || surface === elements.melodyPiano) && ['full', 'wide'].includes(surface.dataset.rangeMode)) {
      deferredFullKeyboardTaps.set(event.pointerId, { midi: Number(key.dataset.midi), x: event.clientX, y: event.clientY });
      return;
    }
    event.preventDefault();
    surface.setPointerCapture(event.pointerId);
    startVoice(`pointer-${event.pointerId}`, Number(key.dataset.midi));
  }
  function releaseInstrumentPointer(surface, event) {
    const deferred = deferredFullKeyboardTaps.get(event.pointerId);
    if (deferred) {
      deferredFullKeyboardTaps.delete(event.pointerId);
      const distance = Math.hypot(event.clientX - deferred.x, event.clientY - deferred.y);
      if (event.type === 'pointerup' && distance < 10) startVoice(`pointer-${event.pointerId}`, deferred.midi, .62);
      return;
    }
    stopVoice(`pointer-${event.pointerId}`);
    if (surface?.hasPointerCapture?.(event.pointerId)) surface.releasePointerCapture(event.pointerId);
  }
  function bindInstrumentSurface(surface) {
    if (!surface) return;
    surface.addEventListener('pointerdown', event => instrumentPointerDown(surface, event));
    surface.addEventListener('pointerup', event => releaseInstrumentPointer(surface, event));
    surface.addEventListener('pointercancel', event => releaseInstrumentPointer(surface, event));
    surface.addEventListener('lostpointercapture', event => releaseInstrumentPointer(surface, event));
    surface.addEventListener('contextmenu', event => event.preventDefault());
  }
  bindInstrumentSurface(elements.piano);
  bindInstrumentSurface(elements.melodyPiano);
  bindInstrumentSurface(elements.fretboard);

  elements.studyCard.addEventListener('pointerdown', event => {
    // Range drags used to bubble into the study-card swipe recognizer. A
    // rightward drag then looked exactly like a swipe and selected the prior
    // chord/bar. Controls own their pointer interaction completely.
    if (event.target.closest('button, input, select, textarea, label, a, [contenteditable], .piano, .fretboard, .instrument-stage')) {
      swipe = null;
      return;
    }
    swipe = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  });
  elements.studyCard.addEventListener('pointerup', event => {
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) navigateChord(dx < 0 ? 1 : -1);
  });
  elements.studyCard.addEventListener('pointercancel', () => { swipe = null; });

  document.addEventListener('keydown', event => {
    if (event.target.closest('input, button, a, select, textarea, [contenteditable]')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigateChord(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); navigateChord(1); }
    if (event.key === ' ') { event.preventDefault(); playCurrentVoicing(); }
  });
  // `touch-action: manipulation` handles current mobile browsers without
  // disabling pinch or scroll.  This small fallback also prevents a stray
  // double-click from turning into a browser zoom gesture on older WebKit.
  document.addEventListener('dblclick', event => {
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
  }, { passive: false });
  window.addEventListener('pagehide', () => {
    stopChartPlayback({ render: false });
    [...voices.keys()].forEach(id => stopVoice(id, true));
  });

  try { state.showNoteNames = localStorage.getItem(NOTE_NAMES_STORAGE_KEY) !== 'off'; } catch (_) {}
  try {
    const savedRange = localStorage.getItem(keyboardRangeStorageKey());
    if (['full', 'compact', 'split', 'wide'].includes(savedRange)) state.keyboardRangeMode = savedRange;
  } catch (_) {}
  try { state.keyboardToneMode = validToneMode(localStorage.getItem(KEYBOARD_TONE_STORAGE_KEY)); } catch (_) {}
  try { state.fretboardToneMode = validToneMode(localStorage.getItem(FRETBOARD_TONE_STORAGE_KEY)); } catch (_) {}
  try {
    const savedView = localStorage.getItem(INSTRUMENT_VIEW_STORAGE_KEY);
    if (savedView === 'fretboard' || savedView === 'piano') state.instrumentView = savedView;
  } catch (_) {}
  try {
    const savedTempo = Number(localStorage.getItem(TEMPO_STORAGE_KEY));
    if (Number.isFinite(savedTempo) && savedTempo >= 40 && savedTempo <= 260) state.transport.customBpm = savedTempo;
  } catch (_) {}
  syncNoteNameToggle();
  syncInstrumentControls();
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
    melodyNotesForEvent,
    navigateChord,
    fullSongKeyboardData,
    snapFullKeyboardRange,
    fretboardPositionForMidi,
    activeKeyboardRangeMode
  };
  loadCatalog();
})();
