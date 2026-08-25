(() => {
  'use strict';

  const Theory = window.KeyerJazzTheory;
  const IReal = window.KeyerIReal;
  const MiditarMidi = window.KeyerMiditarMidi;
  const TabImport = window.KeyerTabImport;
  const TabLibraryCatalog = window.KeyerTabLibraryCatalog;
  const SoloCatalog = window.KeyerJazzSoloCatalog;
  const WJazzDSoloCatalog = window.KeyerWJazzDSoloCatalog;
  const AzMidiCatalog = window.KeyerAzMidiCatalog;
  const Reharm = window.KeyerStandardsReharm;
  const Parkerize = window.KeyerParkerize;
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
  const FRETBOARD_POSITION_STORAGE_KEY = 'keyer-jazz-fretboard-position';
  const FRETBOARD_SOLO_OCTAVE_STORAGE_KEY = 'keyer-jazz-fretboard-solo-octave-down';
  const PIANO_VOICING_STORAGE_KEY = 'keyer-jazz-piano-voicing-style';
  const GUITAR_VOICING_STORAGE_KEY = 'keyer-jazz-guitar-voicing-style';
  const MELODY_VISIBILITY_STORAGE_KEY = 'keyer-jazz-show-melody';
  const AUTO_ADVANCE_RANDOM_STORAGE_KEY = 'keyer-jazz-auto-advance-random';
  const STREAM_MODE_STORAGE_KEY = 'keyer-jazz-stream-mode';
  const STREAM_VISUAL_DELAY_STORAGE_KEY = 'keyer-jazz-stream-visual-delay-ms';
  const PARKERIZE_HARMONY_STORAGE_KEY = 'keyer-jazz-parkerize-harmony';
  const PARKERIZE_CHART_COMPLEXITY_STORAGE_KEY = 'keyer-jazz-parkerize-chart-complexity';
  const PARKERIZE_SOLO_COMPLEXITY_STORAGE_KEY = 'keyer-jazz-parkerize-solo-complexity';
  const REHARM_LEVEL_STORAGE_KEY = 'keyer-jazz-reharm-level';
  const FAVORITES_STORAGE_KEY = 'keyer-jazz-standard-favorites';
  const DESKTOP_KEYBOARD_RANGE_STORAGE_KEY = 'keyer-jazz-desktop-keyboard-range';
  const DISPLAY_LOW = 48;
  const DISPLAY_HIGH = 72;
  const WIDE_LOW = 36;
  const WIDE_HIGH = 96;
  const ACCOMPANIMENT_LOW = 24;
  const ACCOMPANIMENT_HIGH = 72;
  const DEFAULT_TEMPO = 120;
  // Bluetooth and CarPlay add a much deeper hardware buffer than the phone
  // speaker.  The default Web Audio "interactive" hint optimizes for tiny
  // touch-instrument latency and can underrun on those routes, so the chart
  // player deliberately asks for stable playback instead.
  const AUDIO_LATENCY_HINT = 'playback';
  const AUDIO_START_LEAD_SECONDS = .03;
  // Stream mode deliberately renders the selected chart ahead of time, then
  // hands one ordinary media file to iOS. That avoids the live Web Audio
  // scheduler and short-lived oscillator churn that can break up over a car
  // or Bluetooth route. Mono 32 kHz is ample for Keyer's synthesized study
  // tone and keeps the temporary iPhone memory footprint reasonable.
  const STREAM_SAMPLE_RATE = 32000;
  const STREAM_CHANNELS = 1;
  const STREAM_MAX_SECONDS = 6 * 60;
  // Do not leave a hidden release tail after the last written beat. A native
  // media loop is gapless at the file boundary, but any extra tail becomes a
  // perceptible dead spot before beat one on every repeat.
  const STREAM_RENDER_TAIL_SECONDS = 0;
  const STREAM_RENDER_VERSION = 'stream-v1';
  const STREAM_VISUAL_DELAY_MIN_MS = 0;
  const STREAM_VISUAL_DELAY_MAX_MS = 1500;
  const STREAM_VISUAL_DELAY_STEP_MS = 25;
  const DEFAULT_STREAM_VISUAL_DELAY_MS = 250;
  const STREAM_MEDIA_READY_TIMEOUT_MS = 5000;
  const STREAM_VISUAL_FRAME_INTERVAL_MS = 1000 / 30;
  const PIANO_VOICING_STYLES = new Set([
    'root-shell', 'shell', 'rootless', 'closed', 'spread',
    'upper-structure', 'modern', 'cluster', 'avant-garde'
  ]);
  const GUITAR_VOICING_STYLES = new Set([
    'chord-melody', 'adjacent-strings', 'shell', 'rootless', 'triads', 'drop-2', 'spread'
  ]);
  const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
  // Display high E first, just as a guitar is normally drawn from the
  // player's point of view. The neck starts in first position, then grows
  // for a song whose actual MIDI melody reaches above the twelfth fret.
  const FRETBOARD_STRINGS = [
    { label: 'e', name: 'high E', midi: 64 },
    { label: 'B', name: 'B', midi: 59 },
    { label: 'G', name: 'G', midi: 55 },
    { label: 'D', name: 'D', midi: 50 },
    { label: 'A', name: 'A', midi: 45 },
    { label: 'E', name: 'low E', midi: 40 }
  ];
  const FRETBOARD_MIDI_MAX_FRET = 127 - FRETBOARD_STRINGS[0].midi;
  // This is the normal, compact first-position board. Do not use it directly
  // for a rendered/solved neck: fretboardMaxFret() keeps a high melody in its
  // written register instead of folding it down an octave.
  const FRETBOARD_MAX_FRET = 12;
  // A difference of four covers five numbered fret positions (for example,
  // frets 5–9), which is the practical upper edge for a normal chord grip.
  // Open strings do not consume a left-hand finger and are excluded below.
  const FRETBOARD_MAX_FRETTED_SPAN = 4;
  const FRETBOARD_CANDIDATES_PER_VOICE = 8;
  const MODE_NAMES = {
    major: ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'],
    minor: ['Aeolian', 'Locrian', 'Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian']
  };
  const PARKERIZE_COMPLEXITY_LABELS = ['','Spacious', 'Swinging', 'Bebop', 'Intricate', 'Bird fire'];

  const elements = {
    search: document.querySelector('#songSearch'),
    searchResults: document.querySelector('#searchResults'),
    songAvailabilityFilter: document.querySelector('#songAvailabilityFilter'),
    parkerizePanel: document.querySelector('#parkerizePanel'),
    parkerizeStatus: document.querySelector('#parkerizeStatus'),
    parkerizeHarmonyMode: document.querySelector('#parkerizeHarmonyMode'),
    parkerizeChartComplexity: document.querySelector('#parkerizeChartComplexity'),
    parkerizeChartComplexityValue: document.querySelector('#parkerizeChartComplexityValue'),
    parkerizeSoloComplexity: document.querySelector('#parkerizeSoloComplexity'),
    parkerizeSoloComplexityValue: document.querySelector('#parkerizeSoloComplexityValue'),
    generateParkerize: document.querySelector('#generateParkerize'),
    regenerateParkerizeSolo: document.querySelector('#regenerateParkerizeSolo'),
    exportParkerizeMidi: document.querySelector('#exportParkerizeMidi'),
    randomSong: document.querySelector('#randomSong'),
    openTabFile: document.querySelector('#openTabFile'),
    tabFileInput: document.querySelector('#tabFileInput'),
    favoriteSong: document.querySelector('#favoriteSong'),
    libraryStatus: document.querySelector('#libraryStatus'),
    lesson: document.querySelector('#lesson'),
    songTitle: document.querySelector('#songTitle'),
    songComposer: document.querySelector('#songComposer'),
    songMeta: document.querySelector('#songMeta'),
    chart: document.querySelector('#chart'),
    chartScroll: document.querySelector('#chartScroll'),
    chartStatus: document.querySelector('#chartStatus'),
    reharmLevel: document.querySelector('#reharmLevel'),
    sectionReadout: document.querySelector('#sectionReadout'),
    chordProgress: document.querySelector('#chordProgress'),
    toggleNoteNames: document.querySelector('#toggleNoteNames'),
    previousChord: document.querySelector('#previousChord'),
    nextChord: document.querySelector('#nextChord'),
    selectedChord: document.querySelector('#selectedChord'),
    scaleName: document.querySelector('#scaleName'),
    toggleMelody: document.querySelector('#toggleMelody'),
    midiStatus: document.querySelector('#midiStatus'),
    midiAttribution: document.querySelector('#midiAttribution'),
    midiStudyControl: document.querySelector('#midiStudyControl'),
    midiStudy: document.querySelector('#midiStudy'),
    tabTrackControl: document.querySelector('#tabTrackControl'),
    tabTrack: document.querySelector('#tabTrack'),
    tabMixControl: document.querySelector('#tabMixControl'),
    tabPlayAllTracks: document.querySelector('#tabPlayAllTracks'),
    midiChorusControl: document.querySelector('#midiChorusControl'),
    midiChorus: document.querySelector('#midiChorus'),
    chartSourceLabel: document.querySelector('#chartSourceLabel'),
    chartSource: document.querySelector('#chartSource'),
    playChart: document.querySelector('#playChart'),
    useChartTempo: document.querySelector('#useChartTempo'),
    tempoRange: document.querySelector('#tempoRange'),
    tempoValue: document.querySelector('#tempoValue'),
    playMelody: document.querySelector('#playMelody'),
    autoAdvanceRandom: document.querySelector('#autoAdvanceRandom'),
    autoAdvanceRandomLabel: document.querySelector('#autoAdvanceRandomLabel'),
    streamMode: document.querySelector('#streamMode'),
    streamVisualDelay: document.querySelector('#streamVisualDelay'),
    streamVisualDelayValue: document.querySelector('#streamVisualDelayValue'),
    piano: document.querySelector('#piano'),
    melodyPiano: document.querySelector('#melodyPiano'),
    keyboardStack: document.querySelector('#keyboardStack'),
    melodyKeyboardPane: document.querySelector('#melodyKeyboardPane'),
    fretboard: document.querySelector('#fretboard'),
    keyboardRangeMode: document.querySelector('#keyboardRangeMode'),
    keyboardToneMode: document.querySelector('#keyboardToneMode'),
    pianoVoicingStyle: document.querySelector('#pianoVoicingStyle'),
    guitarVoicingStyle: document.querySelector('#guitarVoicingStyle'),
    fretboardToneMode: document.querySelector('#fretboardToneMode'),
    fretboardSoloOctave: document.querySelector('#fretboardSoloOctave'),
    instrumentView: document.querySelector('#instrumentView'),
    studyCard: document.querySelector('.study-card'),
    errorCard: document.querySelector('#errorCard'),
    errorMessage: document.querySelector('#errorMessage'),
    retryLoad: document.querySelector('#retryLoad')
  };

  const state = {
    songs: [],
    azMidiSongs: [],
    legendSoloSongs: [],
    tabSongs: [],
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
    searchPickerPrimed: false,
    songAvailabilityFilter: 'all',
    favoriteSongKeys: new Set(),
    parkerize: {
      active: false,
      harmonyMode: 'standard',
      chartComplexity: 3,
      soloComplexity: 3,
      seedCounter: 0,
      corpus: null,
      baseSong: null,
      lastTake: null
    },
    voicing: [],
    displayVoicing: [],
    fretboardVoicing: [],
    guitarPlanCache: null,
    displayRange: { low: DISPLAY_LOW, high: DISPLAY_HIGH },
    keyboardRangeMode: document.body.classList.contains('desktop-mode') ? 'wide' : 'compact',
    keyboardToneMode: 'scale',
    fretboardToneMode: 'scale',
    fretboardPositionAnchor: null,
    fretboardSoloOctaveDown: false,
    pianoVoicingStyle: 'root-shell',
    guitarVoicingStyle: 'chord-melody',
    reharmLevel: 0,
    reharmCharts: new Map(),
    instrumentView: 'piano',
    // The full keyboard must remain stable while stepping through a chart.
    // It is rebuilt only when the selected chart/melody data changes.
    fullSongKeyboard: { key: '', range: null, eventVoicings: new Map(), midis: [] },
    scale: null,
    activeAlternateCellId: null,
    activeAlternateIndex: -1,
    showNoteNames: true,
    midiCatalog: [],
    midiCatalogTitles: new Set(),
    midiCatalogReady: false,
    midiCatalogLoading: false,
    midiEntries: [],
    midiEntry: null,
    midi: null,
    tabSession: null,
    tabSource: null,
    melodyTrack: null,
    allMelodyNotes: [],
    melodyNotes: [],
    midiChoruses: [],
    midiChorusIndex: 0,
    preferSoloChorus: false,
    melodyOverlayChartId: null,
    showMelody: false,
    melodyCursor: 0,
    // The melody cursor is tied to an occurrence, not just an index. A repeated
    // chord can have a different melody phrase each time through the form.
    melodyCursorEventKey: '',
    melodyNavigationEventKey: '',
    activeMelodyNote: null,
    // Split mode keeps its melody range stable across a phrase instead of
    // recentering around every newly selected note.
    splitMelodyRange: null,
    transport: {
      playing: false,
      session: 0,
      timerIds: new Set(),
      useChartTempo: true,
      customBpm: DEFAULT_TEMPO,
      playMelody: true,
      autoAdvanceRandom: false,
      streamMode: false,
      streamVisualDelayMs: DEFAULT_STREAM_VISUAL_DELAY_MS
    },
    loading: false
  };

  let audioContext = null;
  let audioInput = null;
  let audioKeepAlive = null;
  let audioResumePromise = null;
  // Keep one persistent HTML media element for every stream-mode song. It is
  // intentionally never connected back into Web Audio: iOS can buffer and
  // route media-element playback more reliably than a graph of live notes.
  const streamTransport = {
    audio: null,
    objectUrl: '',
    readyKey: '',
    preparingKey: '',
    preparePromise: null,
    generation: 0,
    rendering: false,
    session: 0,
    secondsPerBeat: 0,
    chartEndBeat: 0,
    rafId: 0,
    lastVisualBeat: -1,
    lastVisualAudioTime: 0,
    visualLoopOffsetSeconds: 0,
    error: '',
    waitingForGesture: false,
    transitioning: false
  };
  const voices = new Map();
  const pressedCounts = {
    chord: new Map(),
    melody: new Map(),
    fretboard: new Map(),
    fretboardChord: new Map()
  };
  const deferredFullKeyboardTaps = new Map();
  let swipe = null;
  let songLoadSequence = 0;
  const safeText = value => String(value == null ? '' : value).trim();

  function parkerizeActive() {
    return Boolean(state.parkerize.active && state.songAvailabilityFilter === 'parkerize');
  }

  function parkerizeComplexityLabel(value) {
    const level = Parkerize?.clampLevel?.(value) || Math.max(1, Math.min(5, Number(value) || 3));
    return `${level} · ${PARKERIZE_COMPLEXITY_LABELS[level]}`;
  }

  function nextParkerizeSeed(kind) {
    state.parkerize.seedCounter += 1;
    return `${kind}:${Date.now()}:${state.parkerize.seedCounter}:${state.song?.title || 'chart'}`;
  }

  function syncParkerizePanel() {
    const active = parkerizeActive();
    if (elements.parkerizePanel) elements.parkerizePanel.hidden = !active;
    if (elements.parkerizeHarmonyMode) elements.parkerizeHarmonyMode.value = state.parkerize.harmonyMode;
    if (elements.parkerizeChartComplexity) {
      elements.parkerizeChartComplexity.value = String(state.parkerize.chartComplexity);
      elements.parkerizeChartComplexity.disabled = state.parkerize.harmonyMode !== 'generated';
    }
    if (elements.parkerizeSoloComplexity) elements.parkerizeSoloComplexity.value = String(state.parkerize.soloComplexity);
    if (elements.parkerizeChartComplexityValue) elements.parkerizeChartComplexityValue.textContent = parkerizeComplexityLabel(state.parkerize.chartComplexity);
    if (elements.parkerizeSoloComplexityValue) elements.parkerizeSoloComplexityValue.textContent = parkerizeComplexityLabel(state.parkerize.soloComplexity);
    if (elements.generateParkerize) elements.generateParkerize.textContent = state.parkerize.harmonyMode === 'generated' ? 'New chart + solo' : 'Generate solo';
    if (elements.regenerateParkerizeSolo) elements.regenerateParkerizeSolo.hidden = state.parkerize.harmonyMode !== 'generated';
    if (elements.exportParkerizeMidi) elements.exportParkerizeMidi.disabled = !state.parkerize.lastTake || state.midiEntry?.type !== 'parkerize';
    if (elements.search) elements.search.placeholder = active && state.parkerize.harmonyMode === 'standard'
      ? 'Choose a standard to Parkerize…'
      : 'Find a standard or composer…';
    if (elements.randomSong) {
      const generated = active && state.parkerize.harmonyMode === 'generated';
      elements.randomSong.textContent = generated ? 'New tune' : active ? 'Random tune' : 'Random';
      elements.randomSong.setAttribute('aria-label', generated ? 'Generate a new original bebop chart and solo' : active ? 'Parkerize a random standard' : 'Choose a random standard');
      elements.randomSong.title = elements.randomSong.getAttribute('aria-label');
    }
  }

  function parkerizeChartEvents() {
    return (state.irealChart?.events || []).filter(event => event?.kind === 'chord' && event.chord);
  }

  function installParkerizedSolo({ transport = false } = {}) {
    if (!Parkerize || !state.song || !state.irealChart?.events?.length) return false;
    if (state.transport.playing && !transport) stopChartPlayback({ render: false });
    if (!state.song.parkerizeGenerated) state.parkerize.baseSong = state.song;
    const events = parkerizeChartEvents();
    if (!events.length) return false;
    try {
      const result = Parkerize.generateSolo({
        events,
        complexity: state.parkerize.soloComplexity,
        seed: nextParkerizeSeed('solo'),
        title: `${state.song.title || 'Standard'} · Parkerize`,
        bpm: Number(state.song.bpm) || DEFAULT_TEMPO
      });
      const entry = {
        type: 'parkerize',
        name: `${state.song.title || 'Standard'}-parkerize.mid`,
        title: result.title,
        sourceLabel: 'Parkerize · aggregate Parker model',
        soloTitle: result.title
      };
      state.midiEntries = [];
      state.midiEntry = entry;
      state.preferSoloChorus = true;
      state.parkerize.lastTake = { ...result, events: events.slice(), song: state.song };
      installMidiSource(result.midi, entry, { transport });
      if (elements.parkerizeStatus) {
        const harmony = state.song.parkerizeGenerated
          ? `original chart ${state.parkerize.chartComplexity}`
          : state.song.title;
        elements.parkerizeStatus.textContent = `${result.notes.length} solo notes · ${harmony} · solo ${state.parkerize.soloComplexity}`;
      }
      syncParkerizePanel();
      return true;
    } catch (error) {
      console.error(error);
      if (elements.parkerizeStatus) elements.parkerizeStatus.textContent = error?.message || 'Could not generate this solo';
      return false;
    }
  }

  function generateParkerizedChart({ transport = false } = {}) {
    if (!Parkerize) return false;
    if (state.transport.playing && !transport) stopChartPlayback({ render: false });
    if (state.song && !state.song.parkerizeGenerated) state.parkerize.baseSong = state.song;
    const song = Parkerize.generateChart({
      complexity: state.parkerize.chartComplexity,
      corpus: state.parkerize.corpus,
      seed: nextParkerizeSeed('chart')
    });
    return applyLoadedSong(song, { transport });
  }

  function exportParkerizedMidi() {
    const take = state.parkerize.lastTake;
    if (!Parkerize || !take || state.midiEntry?.type !== 'parkerize') return false;
    try {
      const bytes = Parkerize.exportMidi({
        title: `${state.song?.title || 'Parkerize'} · solo ${state.parkerize.soloComplexity}`,
        key: state.song?.key,
        bpm: currentTempo(),
        events: take.events,
        notes: state.melodyNotes
      });
      const blob = new Blob([bytes], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = Parkerize.fileNameForTitle(`${state.song?.title || 'parkerize'}-solo-${state.parkerize.soloComplexity}`);
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (elements.parkerizeStatus) elements.parkerizeStatus.textContent = `Exported ${link.download || 'Parkerize MIDI'} with chord markers`;
      return true;
    } catch (error) {
      console.error(error);
      if (elements.parkerizeStatus) elements.parkerizeStatus.textContent = error?.message || 'Could not export this MIDI';
      return false;
    }
  }

  function validFretboardPositionAnchor(value) {
    if (value == null || value === '') return null;
    const fret = Number(value);
    return Number.isSafeInteger(fret) && fret >= 0 && fret <= FRETBOARD_MIDI_MAX_FRET ? fret : null;
  }

  function activeFretboardStrings() {
    const tuning = state.tabSource?.exactPositions && Array.isArray(state.tabSource?.tuning)
      ? state.tabSource.tuning.map(Number).filter(Number.isFinite)
      : [];
    if (!tuning.length) return FRETBOARD_STRINGS;
    return tuning.map((midi, stringIndex) => {
      const note = Theory?.midiName?.(midi, state.preferFlats) || `MIDI ${midi}`;
      const label = note.replace(/[0-9-]/g, '').replace('#', '♯').replace('b', '♭') || String(stringIndex + 1);
      return {
        label,
        name: `${note} string`,
        midi
      };
    });
  }

  function tabPositionsForNote(note) {
    if (!state.tabSource?.exactPositions || !Array.isArray(note?.tabPositions)) return [];
    return note.tabPositions.map(position => ({
      stringIndex: Number(position?.stringIndex),
      fret: Number(position?.fret),
      midi: Number(position?.midi),
      exact: Boolean(position?.exact),
      trackIndex: Number.isInteger(Number(position?.trackIndex)) ? Number(position.trackIndex) : null
    })).filter(position => (
      position.exact
      && Number.isInteger(position.stringIndex)
      && position.stringIndex >= 0
      && Number.isInteger(position.fret)
      && position.fret >= 0
      && Number.isFinite(position.midi)
    ));
  }

  function exactTabPositionsForNote(note) {
    const displayTrackIndex = Number(state.tabSource?.displayTrackIndex ?? state.tabSource?.trackIndex);
    const stringCount = activeFretboardStrings().length;
    return tabPositionsForNote(note).filter(position => (
      position.trackIndex == null
      || !Number.isInteger(displayTrackIndex)
      || position.trackIndex === displayTrackIndex
    )).filter(position => position.stringIndex < stringCount);
  }

  function fretboardMaxFret() {
    // Keep the geometry stable for the whole selected song. Recomputing from
    // only the current note would make the neck jump as the arrows or player
    // moves through a phrase.
    const strings = activeFretboardStrings();
    const highStringMidi = strings[0].midi;
    const highestMelodyMidi = state.melodyNotes.reduce((highest, note) => {
      const midi = Number(note?.midi);
      return Number.isFinite(midi) ? Math.max(highest, fretboardSoloDisplayMidi(midi)) : highest;
    }, -Infinity);
    const melodyFret = Number.isFinite(highestMelodyMidi)
      ? Math.ceil(highestMelodyMidi - highStringMidi)
      : FRETBOARD_MAX_FRET;
    const anchoredFret = Number.isInteger(state.fretboardPositionAnchor)
      ? state.fretboardPositionAnchor + FRETBOARD_MAX_FRETTED_SPAN
      : FRETBOARD_MAX_FRET;
    const sourceFrets = state.melodyNotes.flatMap(exactTabPositionsForNote).map(position => position.fret).filter(Number.isFinite);
    const maximumFret = Math.max(FRETBOARD_MAX_FRET, 127 - highStringMidi);
    return Math.min(maximumFret, Math.max(FRETBOARD_MAX_FRET, melodyFret, anchoredFret, sourceFrets.length ? Math.max(...sourceFrets) : 0));
  }

  function fretboardSoloDisplayMidi(value) {
    const midi = Number(value);
    // Tab sources are already authored for a particular string and fret.
    // Keep that literal visual placement even if the learner used the octave
    // button on an earlier MIDI study.
    if (!Number.isFinite(midi) || state.tabSource?.exactPositions || !soloStudyActive() || !state.fretboardSoloOctaveDown) return midi;
    const lowered = midi - 12;
    // A standard guitar reaches E2. Keep the rare notes below that at their
    // written octave instead of silently changing their pitch class or shape.
    const strings = activeFretboardStrings();
    return lowered >= strings[strings.length - 1].midi ? lowered : midi;
  }

  function fretboardSoloDisplayNote(note) {
    if (!note || !Number.isFinite(Number(note.midi))) return note;
    const displayMidi = fretboardSoloDisplayMidi(note.midi);
    return displayMidi === Number(note.midi) ? note : { ...note, midi: displayMidi, writtenMidi: Number(note.midi) };
  }

  function fretboardMarkerFrets(maxFret = fretboardMaxFret()) {
    const markerOffsets = [3, 5, 7, 9, 12];
    const markers = [];
    for (let octave = 0; octave <= maxFret; octave += 12) {
      markerOffsets.forEach(offset => {
        const fret = octave + offset;
        if (fret <= maxFret) markers.push(fret);
      });
    }
    return markers;
  }

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
            startBeat: Number.isFinite(Number(entry?.startBeat)) ? Number(entry.startBeat) : undefined,
            endBeat: Number.isFinite(Number(entry?.endBeat)) ? Number(entry.endBeat) : undefined,
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
        const timing = event.kind === 'pickup'
          ? {
            startBeat: Number(event.pickupStartBeat ?? event.bar?.startBeat),
            endBeat: Number(event.pickupEndBeat ?? event.bar?.endBeat)
          }
          : structural.get(event.cellId);
        if (!timing) return null;
        if (!Number.isFinite(timing.startBeat) || !Number.isFinite(timing.endBeat) || timing.endBeat <= timing.startBeat) return null;
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
          type: event.kind === 'pickup' ? 'pickup' : 'chord',
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
    const pickupSources = [];
    bars.forEach(bar => {
      if (bar.pickup && Array.isArray(bar.pickupNotes) && bar.pickupNotes.length) {
        const cellId = `${bar.barIndex}:pickup`;
        const pickup = {
          cellId,
          barIndex: bar.barIndex,
          chordIndex: -1,
          bar,
          item: null,
          chord: null,
          kind: 'pickup',
          pickup: true,
          pickupStartBeat: Number(bar.startBeat),
          pickupEndBeat: Number(bar.endBeat),
          sectionId: bar.sectionId,
          sectionLabel: bar.sectionLabel || 'MIDI',
          optionalAlternate: false
        };
        structuralEvents.set(cellId, pickup);
        pickupSources.push(pickup);
      }
      bar.chords.forEach(item => {
        if (!item.parsed || item.optionalOnly || item.holdOnly) return;
        const cellId = `${bar.barIndex}:${item.chordIndex}`;
        structuralEvents.set(cellId, { cellId, barIndex: bar.barIndex, chordIndex: item.chordIndex, bar, item, chord: item.parsed, kind: 'chord', sectionId: bar.sectionId, sectionLabel: bar.sectionLabel, optionalAlternate: item.optionalOnly });
      });
    });

    const events = [];
    const occurrences = new Map();
    const addEvent = (source, passIndex) => {
      const event = { ...source, passIndex, eventIndex: events.length };
      events.push(event);
      if (!occurrences.has(source.cellId)) occurrences.set(source.cellId, []);
      occurrences.get(source.cellId).push(event.eventIndex);
      return event;
    };
    // MIDI charts can begin with melody before their first harmony marker.
    // Give that lead-in a real event rather than lending it to chord one.
    pickupSources
      .slice()
      .sort((left, right) => left.pickupStartBeat - right.pickupStartBeat || left.barIndex - right.barIndex)
      .forEach(source => addEvent(source, -1));
    const playbackOrder = playbackBarIndices(song, bars, suppliedOrder);
    playbackOrder.forEach((barIndex, passIndex) => {
      const bar = bars[barIndex];
      bar.chords.forEach(item => {
        const cellId = `${barIndex}:${item.chordIndex}`;
        const source = structuralEvents.get(cellId);
        if (!source) return;
        addEvent(source, passIndex);
      });
    });

    if (!events.some(event => event.kind === 'chord')) {
      structuralEvents.forEach(source => {
        if (source.kind === 'pickup') return;
        addEvent(source, source.barIndex);
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

  function buildMidiChart(midi, melodyNotes = []) {
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
    const firstMarkerTick = Math.max(0, Number(markers[0].tick) || 0);
    // Own a pickup by its onset, just like every later chord event. A note
    // held over the first marker remains audible/visible there, but is not a
    // navigation step of the first harmony.
    const pickupNotes = (melodyNotes || []).filter(note => (
      Number(note?.tick) >= 0 && Number(note?.tick) < firstMarkerTick
    ));
    const hasPickupBar = Boolean(pickupNotes.length && firstMarkerTick > 0);
    const bars = [];
    const addBar = (tick, endTick, { pickup = false, pickupNotes: barPickupNotes = [], formStart = false } = {}) => {
      const meter = midiMeterAtTick(midi, tick);
      const label = 'MIDI';
      const barIndex = bars.length;
      bars.push({
        index: barIndex,
        barIndex,
        raw: '',
        chords: [],
        overflowChords: [],
        sectionId: 'MIDI@0',
        sectionLabel: label,
        sectionStarts: formStart,
        explicitSection: formStart ? label : '',
        annotationsText: '',
        roadmapMarks: [],
        endingText: '',
        timeSignature: meter,
        timeSignatureText: formStart ? `${meter.beats}/${meter.beatUnit}` : '',
        repeatStart: false,
        repeatEnd: false,
        noChord: false,
        pause: false,
        pickup,
        pickupNotes: pickup ? barPickupNotes : [],
        startTick: tick,
        endTick,
        startBeat: tick / ppq,
        endBeat: endTick / ppq
      });
    };
    if (hasPickupBar) {
      // A lead-in can occasionally span more than one bar. Keep each bar
      // containing an onset as its own selectable zero/pickup event; blank
      // bars stay rests rather than lending their melody to chord one.
      for (let tick = 0; tick < firstMarkerTick; tick += initialBarTicks) {
        const endTick = Math.min(firstMarkerTick, tick + initialBarTicks);
        const barPickupNotes = pickupNotes.filter(note => (
          Number(note.tick) >= tick && Number(note.tick) < endTick
        ));
        addBar(tick, endTick, {
          pickup: Boolean(barPickupNotes.length),
          pickupNotes: barPickupNotes
        });
      }
      for (let tick = firstMarkerTick, formStart = true; tick < finalTick; tick += initialBarTicks, formStart = false) {
        addBar(tick, Math.min(finalTick, tick + initialBarTicks), { formStart });
      }
    } else {
      for (let tick = 0, formStart = true; tick < finalTick; tick += initialBarTicks, formStart = false) {
        addBar(tick, Math.min(finalTick, tick + initialBarTicks), { formStart });
      }
    }

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
    const barIndexForTick = tick => {
      const index = bars.findIndex(bar => tick >= bar.startTick && tick < bar.endTick);
      return index >= 0 ? index : bars.length - 1;
    };
    markerSpans.forEach(span => {
      const firstBar = barIndexForTick(span.startTick);
      const lastBar = barIndexForTick(Math.max(span.startTick, span.endTick - .001));
      for (let barIndex = firstBar; barIndex <= lastBar; barIndex += 1) {
        const barStartTick = bars[barIndex].startTick;
        const barEndTick = bars[barIndex].endTick;
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
      title: midi.title || state.song?.title || 'MIDI'
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
      const tabPositions = notes.map(item => item?.tabPosition).filter(position => (
        position && Number.isInteger(Number(position.stringIndex)) && Number.isInteger(Number(position.fret))
      ));
      return {
        id: `melody-${note.trackIndex}-${note.tick}-${note.midi}`,
        midi: note.midi,
        tick: note.tick,
        endTick: Math.max(note.tick + 1, note.endTick),
        startBeat: note.tick / ppq,
        endBeat: Math.max(note.tick + 1, note.endTick) / ppq,
        durationBeats: Math.max(1, note.endTick - note.tick) / ppq,
        tabPositions,
        source: note
      };
    }).sort((left, right) => left.startBeat - right.startBeat || left.midi - right.midi);
  }

  function midiChorusesForNotes(notes) {
    const formBeats = Number(state.irealChart?.durationBeats);
    if (!Number.isFinite(formBeats) || formBeats <= 0 || !notes.length) return [];
    const lastEndBeat = Math.max(...notes.map(note => Number(note.endBeat)).filter(Number.isFinite));
    // A source can have a short release at the end. Only include a chorus if
    // it substantially covers a full chart form.
    const chorusCount = Math.floor((lastEndBeat + formBeats * .06) / formBeats);
    if (chorusCount < 1) return [];
    const ppq = Number(state.midi?.ppq) || 120;
    const choruses = [];
    for (let index = 0; index < chorusCount; index += 1) {
      const startBeat = index * formBeats;
      const endBeat = startBeat + formBeats;
      const chorusNotes = notes
        .filter(note => Number(note.startBeat) < endBeat - .0001 && Number(note.endBeat) > startBeat + .0001)
        .map(note => {
          const clippedStart = Math.max(startBeat, Number(note.startBeat));
          const clippedEnd = Math.min(endBeat, Number(note.endBeat));
          return {
            ...note,
            id: `${note.id}:chorus-${index}`,
            sourceStartBeat: Number(note.startBeat),
            sourceEndBeat: Number(note.endBeat),
            startBeat: clippedStart - startBeat,
            endBeat: clippedEnd - startBeat,
            durationBeats: Math.max(.001, clippedEnd - clippedStart),
            tick: Math.round((clippedStart - startBeat) * ppq),
            endTick: Math.round((clippedEnd - startBeat) * ppq)
          };
        })
        .sort((left, right) => left.startBeat - right.startBeat || left.midi - right.midi);
      if (chorusNotes.length) choruses.push({ index, startBeat, endBeat, notes: chorusNotes });
    }
    return choruses;
  }

  function soloStudyLabel(entry) {
    if (entry?.type === 'parkerize') return `Parkerize · ${entry.soloTitle || entry.title}`;
    if (entry?.type === 'parker-solo') return `Charlie Parker · ${entry.soloTitle || entry.title}`;
    if (entry?.type === 'wjazzd-solo') return `WJazzD · ${entry.performer || entry.title || 'Jazz legend'}`;
    return entry?.sourceLabel || entry?.title || 'MIDI study';
  }

  function syncMidiStudyControl() {
    if (!elements.midiStudyControl || !elements.midiStudy) return;
    const entries = state.midiEntries;
    elements.midiStudyControl.hidden = entries.length < 2;
    if (entries.length < 2) {
      elements.midiStudy.replaceChildren();
      return;
    }
    const fragment = document.createDocumentFragment();
    entries.forEach((entry, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = soloStudyLabel(entry);
      fragment.appendChild(option);
    });
    elements.midiStudy.replaceChildren(fragment);
    const selectedIndex = Math.max(0, entries.findIndex(entry => midiEntryKey(entry) === midiEntryKey(state.midiEntry)));
    elements.midiStudy.value = String(selectedIndex);
  }

  function clearMidiSource() {
    state.midi = null;
    state.melodyTrack = null;
    state.allMelodyNotes = [];
    state.melodyNotes = [];
    state.midiChoruses = [];
    state.midiChorusIndex = 0;
    state.midiChart = null;
    state.tabSource = null;
    state.melodyOverlayChartId = null;
    invalidateDerivedHarmony();
  }

  function selectMidiStudy(index) {
    const entries = state.midiEntries;
    const entry = entries[Math.max(0, Math.min(entries.length - 1, Number(index) || 0))];
    if (!entry || midiEntryKey(entry) === midiEntryKey(state.midiEntry)) return false;
    if (state.transport.playing) stopChartPlayback({ render: false });
    state.midiEntry = entry;
    clearMidiSource();
    activateChartSource('ireal', { transport: true });
    syncMidiStudyControl();
    void requestMidiSource({ showAfterLoad: true });
    return true;
  }

  function syncMidiChorusControl() {
    if (!elements.midiChorusControl || !elements.midiChorus) return;
    const choruses = state.midiChoruses;
    elements.midiChorusControl.hidden = choruses.length < 2;
    if (choruses.length < 2) {
      elements.midiChorus.replaceChildren();
      return;
    }
    const fragment = document.createDocumentFragment();
    choruses.forEach((chorus, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = index === 0 ? 'Chorus 1 · opening line' : `Chorus ${index + 1} · solo study`;
      fragment.appendChild(option);
    });
    elements.midiChorus.replaceChildren(fragment);
    elements.midiChorus.value = String(Math.max(0, Math.min(choruses.length - 1, state.midiChorusIndex)));
  }

  function selectMidiChorus(index) {
    if (!state.midiChoruses.length) return false;
    const nextIndex = Math.max(0, Math.min(state.midiChoruses.length - 1, Number(index) || 0));
    if (state.transport.playing) stopChartPlayback({ render: false });
    state.midiChorusIndex = nextIndex;
    state.melodyNotes = state.midiChoruses[nextIndex].notes;
    state.melodyOverlayChartId = 'ireal';
    invalidateDerivedHarmony();
    activateChartSource('ireal', { transport: true });
    syncMidiChorusControl();
    syncMidiSourceStatus();
    return true;
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

  function melodyNoteOverlapsEvent(note, event) {
    const timing = melodyTimingForEvent(event);
    if (!timing || !note) return false;
    return note.startBeat < timing.endBeat - .0001 && note.endBeat > timing.startBeat + .0001;
  }

  function melodyNotesForEvent(event) {
    if (!melodyMatchesChart() || !event || !state.melodyNotes.length) return [];
    const timing = melodyTimingForEvent(event);
    if (!timing) return [];
    // The manual arrows own notes by their onset. A lead-in has a
    // dedicated zero/pickup event, so its notes never become steps of the
    // first marked chord. A note held across a marker remains visually and
    // audibly present through that transition via melodyNotesDuringEvent().
    return state.melodyNotes.filter(note => {
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

  function setMelodyVisibility(visible, { persist = true } = {}) {
    state.showMelody = Boolean(visible);
    if (!persist) return;
    try {
      localStorage.setItem(MELODY_VISIBILITY_STORAGE_KEY, state.showMelody ? 'on' : 'off');
    } catch (_) {}
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
    // marker. It remains visible, but it is deliberately not a navigation step
    // for the later chord.
    if (state.transport.playing && state.activeMelodyNote && melodyNoteOverlapsEvent(state.activeMelodyNote, event)) return state.activeMelodyNote;
    if (!notes.length) return null;
    const index = melodyCursorIndex(event, notes);
    // In transport mode the melody marker should move only when that note is
    // actually sounding. Manual study still defaults to the first note so the
    // melody arrows are immediately useful.
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
    document.querySelectorAll('.chart-chord.active, .chart-alternate.active, .chart-pickup.active').forEach(button => {
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
      if (bar.pickup) measure.classList.add('pickup-measure');

      if (bar.pickup) {
        const pickup = document.createElement('span');
        pickup.className = 'pickup-mark';
        pickup.textContent = 'Pickup';
        measure.appendChild(pickup);
      }

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
          const tabBarMarker = Boolean(item.source?.tabPlaceholder);
          // Guitar Pro does not reliably carry harmony symbols.  Its internal
          // timing cells are intentionally still real chords so the transport
          // can use the shared chart engine, but the learner should see a
          // useful location marker rather than the synthetic C5 placeholder.
          const display = tabBarMarker ? `Bar ${bar.barIndex + 1}` : item.parsed?.display || item.raw;
          if (item.holdOnly) {
            button.className = 'chart-hold';
            button.dataset.holdFor = item.holdForCellId || '';
            button.textContent = '—';
            button.title = item.reharm
              ? `Hold ${display} · originally ${item.reharm.originalDisplay}`
              : `Hold ${display}`;
            button.setAttribute('aria-label', `Hold ${display}${item.reharm ? `, reharmonized from ${item.reharm.originalDisplay}` : ''} through bar ${bar.barIndex + 1}`);
            if (item.holdForCellId) button.addEventListener('click', () => selectCell(item.holdForCellId, true));
            stack.appendChild(button);
            chordWrap.appendChild(stack);
            return;
          }
          button.className = 'chart-chord';
          button.dataset.cellId = cellId;
          button.textContent = item.optionalOnly ? `(${display})` : display;
          button.setAttribute('aria-label', tabBarMarker
            ? `Bar ${bar.barIndex + 1} timing marker`
            : `${display}${item.reharm ? `, reharmonized from ${item.reharm.originalDisplay} using ${item.reharm.ruleLabel}` : ''}, bar ${bar.barIndex + 1}`);
          button.title = item.reharm
            ? `${item.reharm.originalDisplay} → ${display} · ${item.reharm.ruleLabel}`
            : display;
          if (tabBarMarker) button.classList.add('chart-bar-marker');
          if (item.reharm) {
            button.classList.add('reharmonized');
            button.dataset.originalChord = item.reharm.originalDisplay;
            button.dataset.reharmRule = item.reharm.ruleId;
          }
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
        const empty = document.createElement(bar.pickup ? 'button' : 'div');
        empty.className = `empty-measure${bar.pickup ? ' chart-pickup' : ''}`;
        if (bar.pickup) {
          const names = (bar.pickupNotes || []).slice(0, 4).map(note => Theory.midiName(note.midi, state.preferFlats));
          empty.classList.add('pickup-notes');
          empty.textContent = names.length ? names.join(' · ') : '—';
          empty.type = 'button';
          empty.dataset.cellId = `${bar.barIndex}:pickup`;
          empty.title = 'Study melody pickup';
          empty.setAttribute('aria-label', `Melody pickup before bar ${bar.barIndex + 2}`);
          empty.addEventListener('click', () => selectCell(empty.dataset.cellId, false));
        } else {
          empty.textContent = bar.noChord || bar.noChordText ? 'N.C.' : '—';
        }
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

  function pianoVoicingForChord(chord, scale, notes = []) {
    if (!chord) return [];
    if (typeof Theory.makePianoVoicing !== 'function') {
      return soundingVoicingForMelody(Theory.makeVoicing(chord), notes);
    }
    return Theory.makePianoVoicing(chord, {
      style: validPianoVoicingStyle(state.pianoVoicingStyle),
      scale,
      melodyMidis: melodyMidiValues(notes),
      low: ACCOMPANIMENT_LOW,
      high: ACCOMPANIMENT_HIGH
    });
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
    return `${state.chartSource}::solo-${soloStudyActive()}::${state.pianoVoicingStyle}::reharm-${state.reharmLevel}::${events}::${melody}`;
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
    if (!soloStudyActive()) {
      state.events.forEach(event => {
        // Use the exact held-note ownership rule used by the live card.  A
        // note crossing a marker can change the fitted accompaniment register.
        const eventMelody = melodyNotesDuringEvent(event);
        eventChordVariants(event).forEach(chord => {
          const scale = scaleForEvent({ ...event, chord }, state.events[event.eventIndex + 1] || null);
          const voicing = pianoVoicingForChord(chord, scale, eventMelody);
          const variantKey = `${event.eventIndex}:${chord.raw || chord.display}`;
          eventVoicings.set(variantKey, voicing);
          voicing.forEach(note => { if (Number.isFinite(note?.midi)) allMidis.push(note.midi); });
        });
      });
    }
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
    const soloFocus = soloStudyActive();
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
    if (elements.fretboardSoloOctave) {
      const available = view === 'fretboard' && soloFocus && !state.tabSource?.exactPositions;
      elements.fretboardSoloOctave.hidden = !available;
      elements.fretboardSoloOctave.disabled = !available;
      elements.fretboardSoloOctave.textContent = state.fretboardSoloOctaveDown
        ? 'Solo: Visual octave down'
        : 'Solo: Written octave';
      elements.fretboardSoloOctave.setAttribute('aria-pressed', String(state.fretboardSoloOctaveDown));
      elements.fretboardSoloOctave.setAttribute('aria-label', state.fretboardSoloOctaveDown
        ? 'Show the solo at its written fretboard octave; MIDI playback stays unchanged'
        : 'Show the solo one octave lower on the fretboard; MIDI playback stays unchanged');
      elements.fretboardSoloOctave.title = elements.fretboardSoloOctave.getAttribute('aria-label');
    }
    if (elements.pianoVoicingStyle) {
      elements.pianoVoicingStyle.value = validPianoVoicingStyle(state.pianoVoicingStyle);
      elements.pianoVoicingStyle.disabled = view === 'fretboard' || soloFocus;
      elements.pianoVoicingStyle.setAttribute('aria-label', soloFocus
        ? 'Piano voicing is kept audible but hidden during solo study'
        : view === 'fretboard'
        ? 'Piano voicing style, available in Keys view'
        : 'Piano voicing style');
    }
    if (elements.guitarVoicingStyle) {
      elements.guitarVoicingStyle.value = validGuitarVoicingStyle(state.guitarVoicingStyle);
      elements.guitarVoicingStyle.disabled = view !== 'fretboard' || soloFocus;
      elements.guitarVoicingStyle.setAttribute('aria-label', soloFocus
        ? 'Guitar chord fingering is hidden during solo study'
        : view === 'fretboard'
        ? 'Guitar chord voicing style'
        : 'Guitar voicing style, available in Frets view');
    }
    if (elements.reharmLevel) {
      elements.reharmLevel.value = String(state.reharmLevel);
      const definition = Reharm?.LEVELS?.[state.reharmLevel];
      elements.reharmLevel.title = definition?.concepts?.join(' · ') || 'Use the original harmony';
    }
    if (elements.piano) {
      elements.piano.hidden = view !== 'piano';
      elements.piano.dataset.instrumentView = view;
    }
    const rangeMode = soloFocus && activeKeyboardRangeMode() === 'split' ? 'compact' : activeKeyboardRangeMode();
    if (elements.keyboardStack) elements.keyboardStack.dataset.rangeMode = rangeMode;
    if (elements.melodyKeyboardPane) {
      elements.melodyKeyboardPane.hidden = view !== 'piano' || soloFocus || rangeMode !== 'split';
    }
    if (elements.melodyPiano) elements.melodyPiano.dataset.instrumentView = view;
    if (elements.fretboard) {
      elements.fretboard.hidden = view !== 'fretboard';
      elements.fretboard.dataset.instrumentView = view;
      if (view === 'fretboard' && elements.fretboard.dataset.extended === 'true') {
        keepFretboardCellVisible(elements.fretboard.querySelector('.fretboard-cell.melody-tone'));
      }
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
    const melody = (melodyMidis || []).map(Number).filter(Number.isFinite);
    const ranges = twoOctaveRanges();
    const contains = values => ranges.filter(range => values.every(midi => midi >= range.low && midi <= range.high));
    const choose = candidates => candidates.slice().sort((left, right) => (
      Math.abs(left.low - DISPLAY_LOW) - Math.abs(right.low - DISPLAY_LOW)
      || left.low - right.low
    ))[0];
    if (!voicingMidis.length) return choose(contains(melody)) || { low: DISPLAY_LOW, high: DISPLAY_HIGH };

    // Prefer showing both the accompaniment and all notes for this chord at
    // their sounding octave. When that will not fit in two octaves, preserve
    // the real accompaniment register and fold only the melody with its
    // actual octave badge.
    return choose(contains([...voicingMidis, ...melody]))
      || choose(contains(voicingMidis))
      || { low: DISPLAY_LOW, high: DISPLAY_HIGH };
  }

  function validToneMode(mode) {
    return ['scale', 'chord', 'voicing', 'none'].includes(mode) ? mode : 'scale';
  }

  function validPianoVoicingStyle(style) {
    return PIANO_VOICING_STYLES.has(style) ? style : 'root-shell';
  }

  function splitMelodyRangeFor(melodyNote) {
    const midi = Number(melodyNote?.midi);
    const previous = state.splitMelodyRange;
    if (!Number.isFinite(midi)) return previous || { low: DISPLAY_LOW, high: DISPLAY_HIGH, octaves: 2, melody: true };
    const clampLow = value => Math.max(0, Math.min(103, value));
    const targetLow = clampLow(Math.round((midi - 12) / 12) * 12);
    if (!previous) {
      state.splitMelodyRange = { low: targetLow, high: targetLow + 24, octaves: 2, melody: true };
      return state.splitMelodyRange;
    }
    // Keep the current two-octave window stable until a melody note would
    // leave it. When it must move, shift only enough to retain that note at
    // the edge, preserving as much of the previous view as possible.
    if (midi >= previous.low && midi <= previous.high) return previous;
    const shift = midi < previous.low ? midi - previous.low : midi - previous.high;
    const low = clampLow(previous.low + shift);
    state.splitMelodyRange = { low, high: low + 24, octaves: 2, melody: true };
    return state.splitMelodyRange;
  }

  function addToneClass(element, pc, toneMode, rootBassSet, chordSet, scaleSet, sounding) {
    if (toneMode === 'none' || (toneMode === 'voicing' && !sounding)) return;
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
    toneMode = chord ? validToneMode(toneMode) : 'none';
    const scaleSet = new Set((scale?.pcs || []).map(pc => Theory.mod(pc)));
    const chordSet = new Set(Theory.chordPitchClasses(chord));
    const rootBassSet = new Set();
    if (chord && Number.isFinite(Number(chord.root))) rootBassSet.add(Theory.mod(chord.root));
    if (chord?.slash != null) rootBassSet.add(Theory.mod(chord.slash));
    const scaleSpellingByPc = new Map();
    (scale?.notes || []).forEach(note => {
      const parsed = Theory.parseNoteSpelling(note);
      if (parsed) scaleSpellingByPc.set(parsed.pc, note);
    });
    (scale?.pcs || []).forEach(pc => {
      const pitchClass = Theory.mod(pc);
      if (!scaleSpellingByPc.has(pitchClass)) scaleSpellingByPc.set(pitchClass, Theory.noteName(pitchClass, state.preferFlats));
    });
    const chordSpellingByPc = new Map((chord?.spelledTones || []).map(tone => [Theory.mod(tone.pc), tone.spelling]));
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
      const toneVisible = melodyHere || (Boolean(chord) && (
        toneMode === 'scale'
        || Boolean(sounding)
        || (toneMode === 'chord' && (rootBassSet.has(pc) || chordSet.has(pc)))
      ));
      const key = document.createElement('button');
      key.type = 'button';
      key.className = `piano-key ${black ? 'black' : 'white'}`;
      if (chord) addToneClass(key, pc, toneMode, rootBassSet, chordSet, scaleSet, sounding);
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
    const pressed = surface === elements.melodyPiano ? pressedCounts.melody : pressedCounts.chord;
    pressed.forEach((count, midi) => {
      if (count > 0) surface.querySelector(`[data-midi="${midi}"]`)?.classList.add('playing');
    });
    return displayVoicing;
  }

  function renderPiano(chord, scale, voicing, melodyNote = null, melodyNotes = []) {
    const soloFocus = soloStudyActive();
    const melodyMidis = melodyMidiValues(melodyNotes);
    const soundingVoicing = typeof Theory.makePianoVoicing === 'function'
      ? voicing
      : soundingVoicingForMelody(voicing, melodyMidis);
    const rangeMode = activeKeyboardRangeMode();
    const toneMode = validToneMode(state.keyboardToneMode);
    const fullSongRange = rangeMode === 'full' ? fullSongKeyboardData()?.range : null;
    const baseRange = fullSongRange || (rangeMode === 'wide' ? { low: WIDE_LOW, high: WIDE_HIGH, octaves: 5, wide: true } : displayRangeForVoicing(soundingVoicing, melodyMidis));

    if (soloFocus) {
      const soloRange = fullSongRange
        || (rangeMode === 'wide' ? { low: WIDE_LOW, high: WIDE_HIGH, octaves: 5, wide: true } : displayRangeForVoicing([], melodyMidiValues(state.melodyNotes)));
      const soloRangeMode = rangeMode === 'split' ? 'compact' : rangeMode;
      if (elements.melodyPiano) elements.melodyPiano.replaceChildren();
      renderKeyboardSurface(elements.piano, null, null, {
        range: soloRange,
        rangeMode: soloRangeMode,
        toneMode: 'none',
        voicing: [],
        melodyNote,
        label: 'Solo line',
        updateDisplayState: true
      });
      elements.piano.closest('.study-card')?.querySelector('.color-legend')?.setAttribute('data-melody-visible', String(Boolean(melodyNote)));
      return;
    }

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
        range: splitMelodyRangeFor(melodyNote),
        rangeMode: 'compact',
        toneMode: 'none',
        voicing: [],
        melodyNote,
        label: state.showMelody ? 'Melody' : 'Melody (enable melody to show a note)'
      });
    } else {
      // A hidden split pane must not retain an old purple key: it is neither
      // audible nor part of the active compact/wide card, and leaving it in
      // the DOM confuses both assistive technology and visual state queries.
      if (elements.melodyPiano) elements.melodyPiano.replaceChildren();
      renderKeyboardSurface(elements.piano, chord, scale, {
        range: baseRange,
        rangeMode,
        toneMode,
        voicing: soundingVoicing,
        melodyNote,
        label: 'Chord and scale',
        updateDisplayState: true
      });
    }
    elements.piano.closest('.study-card')?.querySelector('.color-legend')?.setAttribute('data-melody-visible', String(Boolean(melodyNote)));
  }

  function fretboardCandidatesForMidi(value, { preferLowString = false, maxFret = fretboardMaxFret() } = {}) {
    const target = Number(value);
    if (!Number.isFinite(target)) return [];
    const lastFret = Math.max(FRETBOARD_MAX_FRET, Math.floor(Number(maxFret) || FRETBOARD_MAX_FRET));
    const candidates = [];
    activeFretboardStrings().forEach((string, stringIndex) => {
      for (let fret = 0; fret <= lastFret; fret += 1) {
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
    return candidates;
  }

  function fretboardPositionForMidi(value, options = {}) {
    return fretboardCandidatesForMidi(value, options)[0] || null;
  }

  function fretboardPositionKey(position) {
    return position ? `${position.stringIndex}:${position.fret}` : '';
  }

  function guitarVoiceKind(note) {
    if (note?.kind === 'melody') return 'melody';
    if (note?.bass) return 'bass';
    const role = safeText(note?.role);
    if (/^(?:3|♭3|4|7|♭7)$/.test(role)) return 'guide';
    if (role === '5') return 'fifth';
    return 'color';
  }

  function guitarVoiceDropPriority(voice) {
    if (voice.kind === 'melody') return -1;
    if (voice.kind === 'fifth') return 5;
    if (voice.kind === 'color') return 4;
    if (voice.kind === 'guide') return 3;
    return 1; // A root/bass is useful, but a compact shell beats no shape.
  }

  function guitarVoiceOmissionCost(voice) {
    if (!voice || voice.kind === 'melody') return Infinity;
    if (voice.kind === 'fifth') return .75;
    if (voice.kind === 'color') return 1.05;
    if (voice.kind === 'guide') return 2.35;
    return 3.1; // Preserve the root/bass unless a smaller shell is much easier.
  }

  function validGuitarVoicingStyle(style) {
    return GUITAR_VOICING_STYLES.has(style) ? style : 'chord-melody';
  }

  function guitarVoicesForStyle(voices, melodyPc) {
    const style = validGuitarVoicingStyle(state.guitarVoicingStyle);
    const melody = voices.filter(voice => voice.kind === 'melody');
    const bass = voices.filter(voice => voice.kind === 'bass');
    const guides = voices.filter(voice => voice.kind === 'guide');
    const thirds = guides.filter(voice => /^(?:3|♭3|4)$/.test(safeText(voice.role)));
    const sevenths = guides.filter(voice => /^(?:7|♭7)$/.test(safeText(voice.role)));
    const fifths = voices.filter(voice => voice.kind === 'fifth');
    const colors = voices.filter(voice => voice.kind === 'color');
    const withoutMelody = list => list.filter(voice => voice.kind !== 'melody');
    const distinct = list => {
      const seen = new Set();
      return list.filter(voice => {
        const key = `${voice.kind}:${voice.pc}:${voice.role}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const preserveMelody = list => distinct([...withoutMelody(list), ...melody]);

    // These are guitar-specific tone recipes. The position solver still
    // chooses the actual strings/frets, enforces its five-position/4-finger
    // limits, and can omit a low-priority tone when a written melody needs it.
    if (style === 'shell') return preserveMelody([...bass.slice(0, 1), ...guides.slice(0, 2)]);
    if (style === 'adjacent-strings') {
      // Start with enough harmonic material for a 3–5 string chord block.
      // The dedicated solver rule below then rejects any string skip, so this
      // becomes a compact top/middle/bottom string-set grip rather than a
      // scattered collection of individually convenient notes.
      return preserveMelody([
        ...bass.slice(0, 1),
        ...guides.slice(0, 2),
        ...fifths.slice(0, 1),
        ...colors.slice(0, 1)
      ]);
    }
    if (style === 'rootless') {
      const rootless = [...guides.slice(0, 2), ...colors.slice(0, 1)];
      return preserveMelody(rootless.length ? rootless : [...guides.slice(0, 1), ...fifths.slice(0, 1)]);
    }
    if (style === 'triads') {
      const third = thirds[0] || guides[0];
      const triad = [bass[0], third, fifths[0]].filter(Boolean);
      return preserveMelody(triad.length ? triad : [...bass.slice(0, 1), ...guides.slice(0, 1), ...colors.slice(0, 1)]);
    }
    if (style === 'drop-2') {
      // A four-note, inner-string recipe gives the solver the familiar
      // drop-2 density without hard-coding a particular inversion.
      return preserveMelody([
        ...bass.slice(0, 1),
        ...(thirds[0] ? [thirds[0]] : guides.slice(0, 1)),
        ...fifths.slice(0, 1),
        ...(sevenths[0] ? [sevenths[0]] : colors.slice(0, 1))
      ]);
    }
    if (style === 'spread') {
      return preserveMelody([
        ...bass.slice(0, 1),
        ...(thirds[0] ? [thirds[0]] : guides.slice(0, 1)),
        ...(sevenths[0] ? [sevenths[0]] : guides.slice(1, 2)),
        ...colors.slice(0, 1)
      ]);
    }
    // Balanced chord-melody retains the existing root + guide + color recipe.
    return preserveMelody(voices);
  }

  function guitarChordMelodyVoices(chord, voicing, melodyNote = null) {
    const voices = [];
    const usedPitchClasses = new Set();
    const source = (voicing || [])
      .filter(note => Number.isFinite(Number(note?.midi)))
      .slice()
      .sort((left, right) => Number(left.midi) - Number(right.midi));
    const melodyPc = Number.isFinite(Number(melodyNote?.midi)) ? Theory.mod(melodyNote.midi) : null;

    source.forEach(note => {
      const pc = Theory.mod(note.pc == null ? note.midi : note.pc);
      // The melody is the top note in a chord-melody shape. Do not duplicate
      // it as an unrelated chord dot when it already supplies that harmony.
      if (!note.bass && melodyPc != null && pc === melodyPc) return;
      if (!note.bass && usedPitchClasses.has(pc)) return;
      usedPitchClasses.add(pc);
      voices.push({
        ...note,
        pc,
        kind: guitarVoiceKind(note),
        sourceMidi: Number(note.midi),
        role: note.bass && chord?.slash != null && chord.slash !== chord.root ? 'Bass' : note.role || 'R'
      });
    });

    if (melodyPc != null) {
      voices.push({
        midi: Number(melodyNote.midi),
        sourceMidi: Number(melodyNote.midi),
        pc: melodyPc,
        role: 'M',
        spelling: Theory.noteName(melodyPc, state.preferFlats),
        name: Theory.noteName(melodyPc, state.preferFlats),
        bass: false,
        kind: 'melody',
        melody: true,
        melodyNote
      });
    }

    const styled = guitarVoicesForStyle(voices, melodyPc);
    // Keep a maximum of four visible guitar voices before the melody. This
    // gives a compact shell (usually bass + 3 + 7 + color) rather than trying
    // to translate every piano key literally to six strings.
    const maxVoices = melodyPc == null ? 4 : 5;
    const protectedVoices = styled.filter(voice => voice.kind === 'melody' || (voice.kind === 'bass' && validGuitarVoicingStyle(state.guitarVoicingStyle) !== 'rootless'));
    const optionalVoices = styled
      .filter(voice => !protectedVoices.includes(voice))
      .sort((left, right) => guitarVoiceDropPriority(left) - guitarVoiceDropPriority(right) || left.sourceMidi - right.sourceMidi);
    const reduced = [...protectedVoices, ...optionalVoices].slice(0, maxVoices);
    // Treat melody as the highest intended voice even when the source MIDI is
    // lower than a piano accompaniment octave. The solver will octave-fit the
    // accompaniment below it, just as a guitar chord-melody arranger does.
    return reduced.sort((left, right) => {
      if (left.kind === 'melody') return 1;
      if (right.kind === 'melody') return -1;
      return left.sourceMidi - right.sourceMidi || guitarVoiceDropPriority(left) - guitarVoiceDropPriority(right);
    });
  }

  function guitarMidiChoices(voice) {
    const target = Number(voice?.sourceMidi ?? voice?.midi);
    if (!Number.isFinite(target)) return [];
    const strings = activeFretboardStrings();
    const lowest = strings[strings.length - 1].midi;
    const highest = strings[0].midi + fretboardMaxFret();
    // Chord melody should preserve a melody note's written/sounding octave
    // whenever that note exists on the 0–12 fret board.  A playable D4 must
    // not silently become D5 just to save a fifth or color tone; the solver
    // can instead omit non-essential accompaniment. Notes beyond this fixed
    // board are the only case where an octave-equivalent display is needed.
    if (voice?.kind === 'melody' && target >= lowest && target <= highest) return [target];
    const choices = new Set();
    for (let shift = -36; shift <= 36; shift += 12) {
      const midi = target + shift;
      if (midi >= lowest && midi <= highest) choices.add(midi);
    }
    return [...choices];
  }

  function guitarMelodyAnchorPenalty(position, positionAnchor = state.fretboardPositionAnchor) {
    const anchor = validFretboardPositionAnchor(positionAnchor);
    if (anchor == null || !position) return 0;
    const distance = Math.abs(position.fret - anchor);
    // This is a preference tier, not a filter. A valid exact-pitch placement
    // at/above the chosen fret wins; when none forms a playable grip, every
    // below-anchor candidate remains available at its literal register.
    if (position.fret >= anchor) return distance * .12;
    return 32 + Math.min(3, distance * .18);
  }

  function guitarSmartCandidates(voice, positionAnchor = state.fretboardPositionAnchor) {
    const target = Number(voice?.sourceMidi ?? voice?.midi);
    const anchor = validFretboardPositionAnchor(positionAnchor);
    const strings = activeFretboardStrings();
    const lowest = strings[strings.length - 1].midi;
    const maxFret = fretboardMaxFret();
    const highest = strings[0].midi + maxFret;
    const literalMelody = voice?.kind === 'melody' && target >= lowest && target <= highest;
    const candidates = guitarMidiChoices(voice)
      .flatMap(midi => fretboardCandidatesForMidi(midi, { maxFret }).filter(position => !literalMelody || position.midi === midi))
      // A chosen fret is a floor for the accompaniment hand position, never
      // for the purple melody. The melody remains at its literal MIDI/fret
      // even when it passes below the learner's selected chord position.
      .filter(position => voice?.kind === 'melody' || anchor == null || position.fret >= anchor)
      .filter((position, index, all) => all.findIndex(item => fretboardPositionKey(item) === fretboardPositionKey(position)) === index);
    const candidateScore = position => {
      const octaveDistance = Math.abs(position.midi - target) / 12;
      const highFret = Math.max(0, position.fret - 9) * .24;
      if (voice.kind === 'melody') {
        // Guitar melody lives on the top three strings; do not default to an
        // open melody note when a fretted choice gives a usable hand shape.
        return octaveDistance * 1.35 + position.stringIndex * .78 + (position.fret === 0 ? 2.6 : 0) + highFret
          + guitarMelodyAnchorPenalty(position, anchor);
      }
      if (voice.kind === 'bass') {
        const anchorDistance = anchor == null ? 0 : Math.abs(position.fret - anchor) * 1.7;
        return octaveDistance * .25 + Math.max(0, 3 - position.stringIndex) * 1.1 + highFret * .35 + anchorDistance;
      }
      const anchorDistance = anchor == null ? 0 : Math.abs(position.fret - anchor) * 1.7;
      return octaveDistance * .58 + Math.max(0, 2 - position.stringIndex) * .36 + highFret + anchorDistance;
    };
    return candidates
      .sort((left, right) => candidateScore(left) - candidateScore(right) || left.fret - right.fret || left.stringIndex - right.stringIndex)
      .slice(0, FRETBOARD_CANDIDATES_PER_VOICE);
  }

  function guitarShapeCenter(selected) {
    const fretted = selected.map(item => item.position.fret).filter(fret => fret > 0);
    const values = fretted.length ? fretted : selected.map(item => item.position.fret);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function guitarFrettingFingerEstimate(selected) {
    // Open strings require no fretting finger. Notes on one fret can share a
    // partial/full barre unless a selected lower/open note between them would
    // be changed by that barre.
    const positions = selected.map(item => item.position);
    const selectedFretByString = new Map(positions.map(position => [position.stringIndex, position.fret]));
    const byFret = new Map();
    positions.filter(position => position.fret > 0).forEach(position => {
      const strings = byFret.get(position.fret) || [];
      strings.push(position.stringIndex);
      byFret.set(position.fret, strings);
    });
    let fingers = 0;
    byFret.forEach((strings, fret) => {
      strings.sort((left, right) => left - right);
      if (!strings.length) return;
      fingers += 1;
      for (let index = 1; index < strings.length; index += 1) {
        let blocked = false;
        for (let stringIndex = strings[index - 1] + 1; stringIndex < strings[index]; stringIndex += 1) {
          const selectedFret = selectedFretByString.get(stringIndex);
          if (selectedFret != null && selectedFret < fret) {
            blocked = true;
            break;
          }
        }
        if (blocked) fingers += 1;
      }
    });
    return fingers;
  }

  function guitarHandShiftPenalty(center, previousCenter, anchored = false) {
    if (!Number.isFinite(center)) return Infinity;
    const target = Number.isFinite(previousCenter) ? previousCenter : 5;
    const distance = Math.abs(center - target);
    const weight = anchored ? .6 : 1.65;
    return distance * weight + Math.max(0, distance - FRETBOARD_MAX_FRETTED_SPAN) * (anchored ? 1.4 : 4.2);
  }

  function scoreGuitarChordMelodyShape(selected, previousCenter = null, positionAnchor = state.fretboardPositionAnchor, options = {}) {
    if (!selected.length) return Infinity;
    const strings = selected.map(item => item.position.stringIndex);
    if (new Set(strings).size !== strings.length) return Infinity;
    // Our voices are low-to-high while the visual strings are high-to-low.
    // Reject any crossed guitar grip before scoring its musical niceties.
    for (let index = 1; index < selected.length; index += 1) {
      if (selected[index - 1].position.stringIndex <= selected[index].position.stringIndex) return Infinity;
      if (selected[index - 1].position.midi >= selected[index].position.midi) return Infinity;
    }
    const melody = selected.find(item => item.voice.kind === 'melody') || null;
    if (melody) {
      if (selected.some(item => item !== melody && item.position.midi > melody.position.midi)) return Infinity;
      if (selected.some(item => item !== melody && item.position.stringIndex <= melody.position.stringIndex)) return Infinity;
    }
    const adjacentStrings = Boolean(options.adjacentStrings);
    const stringsSpread = Math.max(...strings) - Math.min(...strings);
    // Adjacent-string mode deliberately chooses an unbroken, familiar string
    // set (three, four, or five neighboring strings). This is what avoids a
    // left hand needing to leap over muted strings while keeping the melody
    // as the top voice at the harmony's downbeat.
    if (adjacentStrings && (selected.length < 3 || stringsSpread !== selected.length - 1)) return Infinity;
    const fretted = selected.map(item => item.position.fret).filter(fret => fret > 0);
    const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
    if (span > FRETBOARD_MAX_FRETTED_SPAN) return Infinity;
    const fingerEstimate = guitarFrettingFingerEstimate(selected);
    if (fingerEstimate > 4) return Infinity;
    const center = guitarShapeCenter(selected);
    const anchor = validFretboardPositionAnchor(positionAnchor);
    const accompanimentPositions = selected
      .filter(item => item.voice.kind !== 'melody')
      .map(item => item.position);
    if (anchor != null && accompanimentPositions.some(position => position.fret < anchor)) return Infinity;
    const accompanimentFrets = accompanimentPositions.map(position => position.fret);
    const chordFloor = accompanimentFrets.length ? Math.min(...accompanimentFrets) : anchor;
    const chordCenter = accompanimentFrets.length
      ? accompanimentFrets.reduce((sum, value) => sum + value, 0) / accompanimentFrets.length
      : anchor;
    const anchorPenalty = anchor == null || chordFloor == null
      ? 0
      : Math.abs(chordFloor - anchor) * 4 + Math.abs(chordCenter - (anchor + 1.75)) * .65;
    const motion = guitarHandShiftPenalty(center, previousCenter, anchor != null);
    const octaveShift = selected.reduce((sum, item) => {
      const weight = item.voice.kind === 'melody' ? 1.35 : item.voice.kind === 'bass' ? .25 : .58;
      return sum + Math.abs(item.position.midi - item.voice.sourceMidi) / 12 * weight;
    }, 0);
    const openPenalty = selected.reduce((sum, item) => {
      if (item.position.fret !== 0) return sum;
      if (item.voice.kind === 'melody') return sum + 4.4;
      return sum + (item.voice.kind === 'bass' || item.position.stringIndex >= 3 ? .12 : 1.1);
    }, 0);
    const melodyStringPenalty = melody ? melody.position.stringIndex * 1.25 : 0;
    const melodyFretPenalty = melody && melody.position.fret > 0 ? Math.max(0, Math.abs(melody.position.fret - center) - 2) * 1.35 : 0;
    const melodyAnchorPenalty = melody ? guitarMelodyAnchorPenalty(melody.position, anchor) : 0;
    const stretchPenalty = span >= FRETBOARD_MAX_FRETTED_SPAN
      ? 2.2 + Math.max(0, 5 - Math.min(...fretted)) * .35
      : 0;
    const fingerPenalty = Math.max(0, fingerEstimate - 3) * .8;
    return motion + anchorPenalty + span * 1.7 + stretchPenalty + fingerPenalty + stringsSpread * .14 + octaveShift + openPenalty + melodyStringPenalty + melodyFretPenalty + melodyAnchorPenalty;
  }

  function chooseGuitarChordMelodyShape(voices, previousCenter = null, positionAnchor = state.fretboardPositionAnchor, options = {}) {
    const candidateSets = voices.map(voice => guitarSmartCandidates(voice, positionAnchor));
    if (!voices.length || candidateSets.some(candidates => !candidates.length)) return null;
    let best = null;
    const visit = (index, selected) => {
      if (index === voices.length) {
        const score = scoreGuitarChordMelodyShape(selected, previousCenter, positionAnchor, options);
        if (!Number.isFinite(score)) return;
        if (!best || score < best.score) best = { score, selected: selected.slice() };
        return;
      }
      candidateSets[index].forEach(position => {
        if (selected.some(item => item.position.stringIndex === position.stringIndex)) return;
        selected.push({ voice: voices[index], position });
        visit(index + 1, selected);
        selected.pop();
      });
    };
    visit(0, []);
    return best;
  }

  function guitarChordMelodyShape(chord, voicing, melodyNote = null, previousCenter = null, positionAnchor = state.fretboardPositionAnchor, options = {}) {
    let voices = guitarChordMelodyVoices(chord, voicing, melodyNote);
    const adjacentStrings = options.adjacentStrings ?? validGuitarVoicingStyle(state.guitarVoicingStyle) === 'adjacent-strings';
    const omitted = [];
    let omissionCost = 0;
    let bestResult = null;
    while (voices.length) {
      const shape = chooseGuitarChordMelodyShape(voices, previousCenter, positionAnchor, { adjacentStrings });
      if (shape) {
        const notes = new Map(shape.selected.map(({ voice, position }) => [fretboardPositionKey(position), {
          ...voice,
          displayMidi: position.midi,
          folded: position.midi !== voice.sourceMidi,
          melody: voice.kind === 'melody'
        }]));
        const accompanimentCount = shape.selected.filter(item => item.voice.kind !== 'melody').length;
        const minimumAccompaniment = melodyNote ? 2 : 3;
        const sparseChordPenalty = Math.max(0, minimumAccompaniment - accompanimentCount) * 12;
        const candidate = {
          notes,
          center: guitarShapeCenter(shape.selected),
          score: shape.score + omissionCost + sparseChordPenalty,
          omitted: omitted.slice(),
          fingerEstimate: guitarFrettingFingerEstimate(shape.selected),
          accompanimentCount,
          coverageMet: accompanimentCount >= minimumAccompaniment
        };
        // A chord-melody grip must remain a chord whenever a playable shell
        // exists. Do not trade bass/guide-tone coverage for a superficially
        // smaller motion score; use a sparse result only as the strict-anchor
        // or literal-register fallback when no two-tone shell can be formed.
        if (!bestResult
          || (candidate.coverageMet && !bestResult.coverageMet)
          || (candidate.coverageMet === bestResult.coverageMet && candidate.score < bestResult.score)) {
          bestResult = candidate;
        }
      }
      const removable = voices
        .map((voice, index) => ({ voice, index }))
        .filter(({ voice }) => voice.kind !== 'melody')
        .sort((left, right) => guitarVoiceDropPriority(right.voice) - guitarVoiceDropPriority(left.voice) || right.voice.sourceMidi - left.voice.sourceMidi)[0];
      if (!removable) break;
      omitted.push(removable.voice.role);
      omissionCost += guitarVoiceOmissionCost(removable.voice);
      voices = voices.filter((_, index) => index !== removable.index);
    }
    if (bestResult) return bestResult;
    // Very high/low written melodies can occasionally make every literal
    // adjacent-string block impossible within the four-fret hand window. In
    // that rare case retain a playable chord instead of showing nothing, and
    // mark it so the fretboard can describe the graceful fallback.
    if (adjacentStrings) {
      const fallback = guitarChordMelodyShape(chord, voicing, melodyNote, previousCenter, positionAnchor, { adjacentStrings: false });
      return { ...fallback, adjacentFallback: true };
    }
    return { notes: new Map(), center: previousCenter, score: Infinity, omitted, fingerEstimate: 0 };
  }

  function guitarMelodyAnchorForEvent(event) {
    if (!state.showMelody || !event) return null;
    // A new harmony should be arranged around the melody note that *starts*
    // with it.  An old note can legitimately ring over the barline, but using
    // that held note as the next grip's top voice puts the new melody down in
    // a random spare string/octave.  Pick a held note only when the new chord
    // truly has no new melody onset of its own.
    const ownedNotes = melodyNotesForEvent(event);
    if (ownedNotes.length) return ownedNotes[0];
    return melodyNotesDuringEvent(event)[0] || null;
  }

  function guitarMelodyNotesForEvent(event) {
    // The chord-melody register follows notes that begin under this harmony.
    // Only a melody-rest chord uses a carried note as its fallback reference.
    const ownedNotes = melodyNotesForEvent(event);
    return ownedNotes.length ? ownedNotes : melodyNotesDuringEvent(event);
  }

  function guitarPositionFromKey(key) {
    if (!key) return null;
    const [stringIndex, fret] = key.split(':').map(Number);
    const strings = activeFretboardStrings();
    if (!Number.isInteger(stringIndex) || !Number.isInteger(fret) || !strings[stringIndex]) return null;
    return { stringIndex, fret, midi: strings[stringIndex].midi + fret };
  }

  function guitarMelodyPositionMetrics(position, accompanimentEntries) {
    const held = accompanimentEntries
      .map(([key, note]) => ({ key, note, position: guitarPositionFromKey(key) }))
      .filter(item => item.position);
    const occupied = held.find(item => item.position.stringIndex === position.stringIndex)?.position || null;
    // The chord has already sounded on the downbeat. As the melody descends,
    // release any sustained chord tone above it, plus the finger being moved
    // on its chosen string, so the purple note remains the real top voice.
    const mandatoryReleased = new Set(held.filter(item => (
      item.position.midi > position.midi
      || (item.position.stringIndex === position.stringIndex && item.position.fret !== position.fret)
    )).map(item => item.key));
    const eligible = held.filter(item => !mandatoryReleased.has(item.key));
    let bestSubset = null;
    // A later melody leap is allowed to shift the fretting hand, but a held
    // chord dot cannot remain lit across an impossible reach. There are at
    // most a handful of accompaniment tones, so examine every retained
    // subset and preserve the most harmonically useful playable shell.
    for (let mask = 0; mask < (1 << eligible.length); mask += 1) {
      const activeItems = eligible.filter((_, index) => mask & (1 << index));
      const activePositions = activeItems.map(item => item.position);
      if (!activePositions.some(item => fretboardPositionKey(item) === fretboardPositionKey(position))) {
        activePositions.push(position);
      }
      const fretted = activePositions.map(item => item.fret).filter(fret => fret > 0);
      const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
      const fingerEstimate = guitarFrettingFingerEstimate(activePositions.map(activePosition => ({ position: activePosition })));
      if (span > FRETBOARD_MAX_FRETTED_SPAN || fingerEstimate > 4) continue;
      const retainedValue = activeItems.reduce((sum, item) => {
        const value = guitarVoiceOmissionCost(item.note);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      const score = retainedValue * 10 + activeItems.length - span * .12 - fingerEstimate * .05;
      if (!bestSubset || score > bestSubset.score) {
        bestSubset = { activeItems, activePositions, span, fingerEstimate, score };
      }
    }
    const activeItems = bestSubset?.activeItems || [];
    const activePositions = bestSubset?.activePositions || [position];
    const activeKeys = new Set(activeItems.map(item => item.key));
    const releasedKeys = new Set(held.filter(item => !activeKeys.has(item.key)).map(item => item.key));
    const span = bestSubset?.span || 0;
    const fingerEstimate = bestSubset?.fingerEstimate || (position.fret > 0 ? 1 : 0);
    const activeAccompaniment = activeItems.map(item => item.position);
    const topAccompanimentMidi = activeAccompaniment.length
      ? Math.max(...activeAccompaniment.map(item => item.midi))
      : -Infinity;
    const displaced = occupied && occupied.fret !== position.fret ? occupied : null;
    const releasedValue = held
      .filter(item => releasedKeys.has(item.key))
      .reduce((sum, item) => {
        const value = guitarVoiceOmissionCost(item.note);
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
    return {
      span,
      fingerEstimate,
      playable: true,
      displaced,
      displacedDistance: displaced ? Math.abs(displaced.fret - position.fret) : 0,
      releasedKeys: [...releasedKeys],
      releasedValue,
      topAccompanimentMidi
    };
  }

  function guitarMelodyDisplayPosition(melodyNote, voicingByPosition, handCenter = null, previousPosition = null) {
    if (!Number.isFinite(Number(melodyNote?.midi))) return null;
    const targetMidi = Number(melodyNote.midi);
    const strings = activeFretboardStrings();
    const lowest = strings[strings.length - 1].midi;
    const maxFret = fretboardMaxFret();
    const highest = strings[0].midi + maxFret;
    const literalOnBoard = targetMidi >= lowest && targetMidi <= highest;
    const melodyPc = Theory.mod(targetMidi);
    // When the current melody is the note that chose this grip, keep it on
    // that held top voice. For later notes, use an available string position so
    // the chord diagram stays stable while only purple melody moves.
    const anchorEntry = [...voicingByPosition.entries()].find(([, note]) => {
      if (!note.melody || Theory.mod(note.pc) !== melodyPc) return false;
      return !literalOnBoard || Number(note.displayMidi ?? note.midi) === targetMidi;
    });
    if (anchorEntry) return guitarPositionFromKey(anchorEntry[0]);
    const accompanimentEntries = [...voicingByPosition.entries()]
      .filter(([, note]) => !note.melody && note.kind !== 'melody');
    const accompanimentPositions = accompanimentEntries
      .map(([key]) => guitarPositionFromKey(key))
      .filter(Boolean);
    const topCanonicalAccompanimentString = accompanimentPositions.length
      ? Math.min(...accompanimentPositions.map(position => position.stringIndex))
      : strings.length - 1;
    const occupiedFretsByString = new Map(accompanimentEntries.map(([key]) => {
      const position = guitarPositionFromKey(key);
      return [position.stringIndex, position.fret];
    }));
    const heldMidis = [...voicingByPosition.values()].map(note => Number(note.displayMidi ?? note.midi)).filter(Number.isFinite);
    const topHeldMidi = heldMidis.length ? Math.max(...heldMidis) : Number(melodyNote.midi);
    // This is a live melodic cursor laid over the downbeat grip. Preserve its
    // literal register, but allow the guitarist to release one held finger and
    // move it a fret or two instead of jumping to a distant "free" string.
    const candidates = guitarMidiChoices({ kind: 'melody', sourceMidi: targetMidi })
      .flatMap(midi => fretboardCandidatesForMidi(midi, { maxFret }).filter(position => !literalOnBoard || position.midi === midi))
      .filter((position, index, all) => all.findIndex(item => fretboardPositionKey(item) === fretboardPositionKey(position)) === index);
    const positionAnchor = validFretboardPositionAnchor(state.fretboardPositionAnchor);
    const preferredCenter = Number.isFinite(handCenter)
      ? handCenter
      : positionAnchor == null ? null : positionAnchor + 1.75;
    const evaluated = candidates.map(position => ({
      position,
      metrics: guitarMelodyPositionMetrics(position, accompanimentEntries)
    }));
    const playable = evaluated.filter(item => item.metrics.playable);
    const anchored = positionAnchor == null || !literalOnBoard ? [] : playable.filter(({ position, metrics }) => (
      position.fret >= positionAnchor
      && (!Number.isFinite(preferredCenter) || Math.abs(position.fret - preferredCenter) <= FRETBOARD_MAX_FRETTED_SPAN)
      // A fret anchor describes the chord hand, not permission to put the
      // melody on an arbitrary bass string. Keep an anchored melody on or
      // above the canonical accompaniment's highest string; if that cannot
      // be done literally, the normal upper-string placement may fall below
      // the anchor instead.
      && (position.stringIndex <= topCanonicalAccompanimentString
        || occupiedFretsByString.get(position.stringIndex) === position.fret)
      && (position.midi >= metrics.topAccompanimentMidi
        || occupiedFretsByString.get(position.stringIndex) === position.fret)
    ));
    const topVoicePlayable = playable.filter(({ position, metrics }) => (
      position.midi >= metrics.topAccompanimentMidi
      || occupiedFretsByString.get(position.stringIndex) === position.fret
    ));
    const upperStringPlayable = topVoicePlayable.filter(({ position }) => position.stringIndex <= 3);
    // With a selected fret, prefer a playable upper-string melody at/above
    // that position. Otherwise every exact placement that keeps the active
    // hand inside its five-position window competes on local finger motion.
    const preferred = anchored;
    const conventional = evaluated.filter(({ position }) => {
      const occupiedFret = occupiedFretsByString.get(position.stringIndex);
      return occupiedFret == null || occupiedFret === position.fret;
    });
    // If there is no in-window position, prefer a free string or the exact
    // same chord-tone cell before considering a larger temporary shift.
    const pool = preferred.length
      ? preferred
      : upperStringPlayable.length ? upperStringPlayable
      : topVoicePlayable.length ? topVoicePlayable
      : playable.length ? playable
      : conventional.length ? conventional
      : evaluated;
    const choice = pool.sort((left, right) => {
      const score = ({ position, metrics }) => {
        const belowTop = Math.max(0, topHeldMidi - position.midi);
        const upperString = Math.min(3, position.stringIndex);
        const handDistance = Number.isFinite(handCenter) && position.fret > 0 ? Math.abs(position.fret - handCenter) : 0;
        const melodyTravel = previousPosition && position.fret > 0
          ? Math.abs(position.fret - previousPosition.fret) * 1.05
            + Math.abs(position.stringIndex - previousPosition.stringIndex) * .3
          : 0;
        const octaveDistance = Math.abs(position.midi - targetMidi) / 12;
        const anchorDistance = preferred.length ? Math.abs(position.fret - positionAnchor) : 0;
        const reach = Math.max(0, metrics.span - FRETBOARD_MAX_FRETTED_SPAN) * 9;
        const fingers = Math.max(0, metrics.fingerEstimate - 4) * 8;
        const displaced = metrics.displaced
          ? .35 + metrics.displacedDistance * 1.35
          : 0;
        const released = metrics.releasedKeys.length * .35 + metrics.releasedValue * .55;
        return belowTop * 2.8 + upperString * .72 + handDistance * .48 + melodyTravel
          + anchorDistance * .12 + octaveDistance * .35 + reach + fingers + displaced + released;
      };
      return score(left) - score(right)
        || left.position.stringIndex - right.position.stringIndex
        || left.position.fret - right.position.fret;
    })[0] || null;
    if (!choice) return null;
    return {
      ...choice.position,
      releasedKeys: choice.metrics.releasedKeys,
      activeSpan: choice.metrics.span,
      fingerEstimate: choice.metrics.fingerEstimate
    };
  }

  function guitarMelodyPathForEvent(notes, voicingByPosition, handCenter) {
    const positions = new Map();
    let previousPosition = null;
    const releasedKeys = new Set();
    (notes || []).forEach(note => {
      const position = guitarMelodyDisplayPosition(note, voicingByPosition, handCenter, previousPosition);
      if (!position) return;
      (position.releasedKeys || []).forEach(key => releasedKeys.add(key));
      // A returning melody note can re-articulate a previously released chord
      // cell. Other released chord fingers remain off until the next harmony
      // rather than visually reappearing without being sounded again.
      releasedKeys.delete(fretboardPositionKey(position));
      const plannedPosition = { ...position, releasedKeys: [...releasedKeys] };
      positions.set(note.id, plannedPosition);
      previousPosition = plannedPosition;
    });
    const finalFret = previousPosition?.fret > 0 ? previousPosition.fret : null;
    const exitCenter = Number.isFinite(finalFret)
      ? Number.isFinite(handCenter) && Math.abs(finalFret - handCenter) <= FRETBOARD_MAX_FRETTED_SPAN
        ? handCenter * .35 + finalFret * .65
        : finalFret
      : handCenter;
    return { positions, exitCenter };
  }

  function guitarPlanOneEvent(event, previousCenter, positionAnchor) {
    if (!event?.chord) return null;
    const planMelody = guitarMelodyAnchorForEvent(event);
    const planMelodyNotes = state.showMelody ? guitarMelodyNotesForEvent(event) : [];
    const planVoicing = state.showMelody
      ? soundingVoicingForMelody(Theory.makeVoicing(event.chord), planMelodyNotes)
      : Theory.makeVoicing(event.chord);
    let shape = guitarChordMelodyShape(event.chord, planVoicing, planMelody, previousCenter, positionAnchor);
    const melodyPath = state.showMelody
      ? guitarMelodyPathForEvent(planMelodyNotes, shape.notes, shape.center)
      : { positions: new Map(), exitCenter: shape.center };
    shape = {
      ...shape,
      melodyPositions: melodyPath.positions,
      exitCenter: melodyPath.exitCenter
    };
    return shape;
  }

  function currentGuitarPlanCache() {
    const positionAnchor = validFretboardPositionAnchor(state.fretboardPositionAnchor);
    const maxFret = fretboardMaxFret();
    const cache = state.guitarPlanCache;
    if (cache
      && cache.events === state.events
      && cache.melodyNotes === state.melodyNotes
      && cache.showMelody === state.showMelody
      && cache.voicingStyle === validGuitarVoicingStyle(state.guitarVoicingStyle)
      && cache.positionAnchor === positionAnchor
      && cache.maxFret === maxFret) {
      return cache;
    }
    state.guitarPlanCache = {
      events: state.events,
      melodyNotes: state.melodyNotes,
      showMelody: state.showMelody,
      voicingStyle: validGuitarVoicingStyle(state.guitarVoicingStyle),
      positionAnchor,
      maxFret,
      plans: [],
      exitCenters: []
    };
    return state.guitarPlanCache;
  }

  function guitarChordMelodyPlan(event) {
    const activeIndex = Math.max(0, state.activeIndex);
    const cache = currentGuitarPlanCache();
    const automaticStart = cache.positionAnchor == null ? null : cache.positionAnchor + 1.75;
    // Build the hand path once in form order, then reuse it while the learner
    // steps through later melody notes. This is intentionally independent of
    // the selected piano range.
    for (let index = cache.plans.length; index <= activeIndex; index += 1) {
      const previousCenter = index > 0 ? cache.exitCenters[index - 1] : automaticStart;
      const plan = guitarPlanOneEvent(state.events[index], previousCenter, cache.positionAnchor);
      cache.plans[index] = plan;
      cache.exitCenters[index] = Number.isFinite(plan?.exitCenter)
        ? plan.exitCenter
        : Number.isFinite(plan?.center) ? plan.center : previousCenter;
    }
    const baseEvent = state.events[activeIndex];
    if (event === baseEvent) {
      return cache.plans[activeIndex]
        || { notes: new Map(), melodyPositions: new Map(), center: null, exitCenter: null, score: Infinity, omitted: [] };
    }
    const previousCenter = activeIndex > 0 ? cache.exitCenters[activeIndex - 1] : automaticStart;
    return guitarPlanOneEvent(event, previousCenter, cache.positionAnchor)
      || { notes: new Map(), melodyPositions: new Map(), center: null, exitCenter: null, score: Infinity, omitted: [] };
  }

  function renderFretboard(event, scale, melodyNote = null) {
    // The planner deliberately considers previous chart events. Avoid doing
    // that work while the player is studying Keys; switching to Frets always
    // triggers a fresh render through the instrument control handler.
    if (!elements.fretboard || state.instrumentView !== 'fretboard') return;
    const soloFocus = soloStudyActive();
    const exactTabPositions = soloFocus ? exactTabPositionsForNote(melodyNote) : [];
    const exactTabByKey = new Map(exactTabPositions.map(position => [fretboardPositionKey(position), position]));
    const hasExactTabPositions = exactTabByKey.size > 0;
    const fretboardMelodyNote = hasExactTabPositions
      ? melodyNote
      : soloFocus ? fretboardSoloDisplayNote(melodyNote) : melodyNote;
    const chord = soloFocus ? null : event?.chord || null;
    const toneMode = chord ? validToneMode(state.fretboardToneMode) : 'none';
    const guitarVoicingStyle = validGuitarVoicingStyle(state.guitarVoicingStyle);
    const scaleSet = new Set((scale?.pcs || []).map(pc => Theory.mod(pc)));
    const chordSet = new Set(Theory.chordPitchClasses(chord));
    const rootBassSet = new Set();
    if (chord && Number.isFinite(Number(chord.root))) rootBassSet.add(Theory.mod(chord.root));
    if (chord?.slash != null) rootBassSet.add(Theory.mod(chord.slash));
    const scaleSpellingByPc = new Map();
    (scale?.notes || []).forEach(note => {
      const parsed = Theory.parseNoteSpelling(note);
      if (parsed) scaleSpellingByPc.set(parsed.pc, note);
    });
    (scale?.pcs || []).forEach(pc => {
      const pitchClass = Theory.mod(pc);
      if (!scaleSpellingByPc.has(pitchClass)) scaleSpellingByPc.set(pitchClass, Theory.noteName(pitchClass, state.preferFlats));
    });
    const chordSpellingByPc = new Map((chord?.spelledTones || []).map(tone => [Theory.mod(tone.pc), tone.spelling]));
    const chordMelody = chord ? guitarChordMelodyPlan(event) : { notes: new Map(), center: null };
    const voicingByPosition = chordMelody.notes;
    const melodyPosition = hasExactTabPositions
      ? exactTabPositions.find(position => position.midi === Number(melodyNote?.midi)) || exactTabPositions[0]
      : chordMelody.melodyPositions?.get(melodyNote?.id)
        || guitarMelodyDisplayPosition(fretboardMelodyNote, voicingByPosition, chordMelody.center);
    const melodyPositionKey = fretboardPositionKey(melodyPosition);
    const melodyPositionKeys = hasExactTabPositions
      ? new Set(exactTabByKey.keys())
      : new Set(melodyPositionKey ? [melodyPositionKey] : []);
    const releasedVoicingKeys = new Set(melodyPosition?.releasedKeys || []);
    // The first-onset melody is part of the canonical grip. Once the purple
    // cursor moves to a later pitch, that original melody finger is released
    // just like any other displaced chord finger. Its ghosted dot keeps the
    // downbeat shape understandable without implying both notes are held.
    if (melodyPositionKey) {
      voicingByPosition.forEach((note, key) => {
        if (note.melody && key !== melodyPositionKey) releasedVoicingKeys.add(key);
      });
    }
    const releasedChordMidis = [...releasedVoicingKeys]
      .map(key => voicingByPosition.get(key))
      .filter(note => note && !note.melody && note.kind !== 'melody')
      .map(note => Number(note.displayMidi ?? note.midi))
      .filter(Number.isFinite);
    stopReleasedFretboardChordVoices(releasedChordMidis);
    // Keep the physical fretboard shape and the chart's sounding register as
    // separate values.  A shape may use an octave-equivalent guitar position,
    // but visual octave controls must never transpose the backing chord MIDI.
    // Melody is auditioned/scheduled as its own purple voice; a later melody
    // can temporarily replace a held chord finger on that string, so omit
    // that released tone from replay too.
    state.fretboardVoicing = [...voicingByPosition.entries()]
      .filter(([key, note]) => !releasedVoicingKeys.has(key) && !note.melody && note.kind !== 'melody')
      .map(([, note]) => note)
      .map(note => {
        const displayMidi = Number(note.displayMidi ?? note.midi);
        const soundingMidi = Number(note.sourceMidi ?? note.midi);
        return {
          ...note,
          midi: Number.isFinite(soundingMidi) ? soundingMidi : displayMidi,
          displayMidi
        };
      })
      .filter(note => Number.isFinite(note.midi))
      .sort((left, right) => left.midi - right.midi);
    const strings = activeFretboardStrings();
    const maxFret = fretboardMaxFret();
    const columnCount = maxFret + 1;
    const extendedNeck = maxFret > FRETBOARD_MAX_FRET;
    elements.fretboard.dataset.lowMidi = String(strings[strings.length - 1].midi);
    elements.fretboard.dataset.highMidi = String(strings[0].midi + maxFret);
    elements.fretboard.dataset.firstFret = '0';
    elements.fretboard.dataset.lastFret = String(maxFret);
    elements.fretboard.dataset.stringCount = String(strings.length);
    elements.fretboard.dataset.extended = String(extendedNeck);
    elements.fretboard.dataset.rangeMode = 'fretboard';
    elements.fretboard.dataset.toneMode = toneMode;
    elements.fretboard.dataset.voicingStyle = soloFocus ? 'solo-line' : guitarVoicingStyle;
    elements.fretboard.dataset.melodyMidi = melodyNote ? String(melodyNote.midi) : '';
    elements.fretboard.dataset.visualMelodyMidi = fretboardMelodyNote ? String(fretboardMelodyNote.midi) : '';
    elements.fretboard.dataset.soloOctaveDown = String(Boolean(soloFocus && !hasExactTabPositions && state.fretboardSoloOctaveDown));
    elements.fretboard.dataset.activeFretSpan = Number.isFinite(melodyPosition?.activeSpan)
      ? String(melodyPosition.activeSpan)
      : '';
    elements.fretboard.dataset.releasedVoicingKeys = [...releasedVoicingKeys].join(',');
    elements.fretboard.dataset.positionAnchor = state.fretboardPositionAnchor == null
      ? ''
      : String(state.fretboardPositionAnchor);
    elements.fretboard.dataset.gripEventKey = melodyEventKey(event) || `${state.chartSource}:${state.activeIndex}`;
    elements.fretboard.dataset.arrangement = soloFocus
      ? 'solo-line'
      : event?.kind === 'pickup'
      ? 'melody-pickup'
      : melodyNote ? 'chord-melody' : 'guitar-voicing';
    elements.fretboard.style.setProperty('--fretboard-column-count', String(columnCount));
    elements.fretboard.style.setProperty('--fretboard-string-count', String(strings.length));
    // Keep every extended fret large enough to tap/read. The surrounding
    // instrument stage owns horizontal scrolling, so this never widens the
    // mobile document itself.
    elements.fretboard.style.setProperty('--fretboard-min-width', `${columnCount * 27}px`);
    elements.fretboard.setAttribute('aria-colcount', String(columnCount));
    const positionDescription = hasExactTabPositions
      ? 'authored tab positions'
      : state.fretboardPositionAnchor == null
      ? soloFocus ? 'automatic solo position' : 'automatic chord position'
      : `${soloFocus ? 'solo' : 'chord'} position anchored at fret ${state.fretboardPositionAnchor}`;
    const adjacentDescription = guitarVoicingStyle === 'adjacent-strings'
      ? chordMelody.adjacentFallback
        ? ' · closest playable fallback when an adjacent string block is impossible'
        : ' · neighboring-string chord block'
      : '';
    elements.fretboard.setAttribute('aria-label', soloFocus
      ? `Guitar fretboard from the open strings through fret ${maxFret}, showing only the solo line, ${positionDescription}${!hasExactTabPositions && state.fretboardSoloOctaveDown ? '; visual octave down is on while MIDI playback remains at the written octave' : ''}; harmony remains audible in playback`
      : event?.kind === 'pickup'
      ? `Guitar fretboard from the open strings through fret ${maxFret}, showing the melody pickup only`
      : melodyNote
      ? `Guitar chord-melody fretboard from the open strings through fret ${maxFret}, with melody on top and chord tones below, ${positionDescription}${adjacentDescription}`
      : `Guitar fretboard from the open strings through fret ${maxFret}, showing chord, scale, and compact voicing, ${positionDescription}${adjacentDescription}`);

    const board = document.createElement('div');
    board.className = 'fretboard-grid';
    const positionSelector = document.createElement('div');
    positionSelector.className = 'fret-position-selector';
    positionSelector.hidden = hasExactTabPositions;
    positionSelector.setAttribute('role', 'toolbar');
    positionSelector.setAttribute('aria-label', `Choose the ${soloFocus ? 'solo' : 'chord'} position; press the selected fret again for automatic positioning`);
    for (let fret = 0; fret <= maxFret; fret += 1) {
      const positionButton = document.createElement('button');
      const selected = state.fretboardPositionAnchor === fret;
      positionButton.type = 'button';
      positionButton.className = 'fret-position-button';
      positionButton.dataset.fret = String(fret);
      positionButton.textContent = String(fret);
      positionButton.setAttribute('aria-pressed', String(selected));
      positionButton.setAttribute('aria-label', selected
        ? `Fret ${fret} is the ${soloFocus ? 'solo' : 'chord'} position; press again for automatic positioning`
        : `Use fret ${fret} as the ${soloFocus ? 'solo' : 'chord'} position`);
      positionSelector.appendChild(positionButton);
    }
    board.appendChild(positionSelector);
    strings.forEach((string, stringIndex) => {
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
      for (let fret = 0; fret <= maxFret; fret += 1) {
        const midi = string.midi + fret;
        const pc = Theory.mod(midi);
        const cellKey = `${stringIndex}:${fret}`;
        const sounding = voicingByPosition.get(cellKey);
        const exactTabPosition = exactTabByKey.get(cellKey);
        const melodyHere = hasExactTabPositions ? Boolean(exactTabPosition) : melodyPositionKeys.has(cellKey);
        const releasedForMelody = Boolean(sounding && releasedVoicingKeys.has(cellKey));
        const toneVisible = melodyHere || (Boolean(chord) && (
          toneMode === 'scale'
          || Boolean(sounding)
          || (toneMode === 'chord' && (rootBassSet.has(pc) || chordSet.has(pc)))
        ));
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'fretboard-cell';
        cell.setAttribute('role', 'gridcell');
        if (fret === 0) cell.classList.add('open-string');
        if (chord) addToneClass(cell, pc, toneMode, rootBassSet, chordSet, scaleSet, sounding);
        if (sounding) cell.classList.add('voicing', 'chord-melody-tone');
        if (releasedForMelody) cell.classList.add('released-for-melody');
        if (sounding?.bass) cell.classList.add('bass');
        if (exactTabPosition) cell.classList.add('tab-authored-position');
        if (melodyHere) {
          cell.classList.add('melody-tone');
          cell.dataset.melodyMidi = String(exactTabPosition?.midi ?? melodyNote.midi);
        }
        cell.dataset.string = String(stringIndex);
        cell.dataset.fret = String(fret);
        cell.dataset.midi = String(midi);
        const spelling = sounding?.spelling || chordSpellingByPc.get(pc) || scaleSpellingByPc.get(pc) || Theory.noteName(pc, state.preferFlats);
        const name = spelling ? Theory.spelledMidiName(midi, spelling, state.preferFlats) : Theory.midiName(midi, state.preferFlats);
        const visualOctaveDown = Boolean(!hasExactTabPositions && melodyHere && fretboardMelodyNote && fretboardMelodyNote.midi !== melodyNote?.midi);
        const foldedMelody = Boolean(!hasExactTabPositions && melodyHere && melodyPosition.midi !== fretboardMelodyNote?.midi);
        cell.setAttribute('aria-label', `${string.name} string, fret ${fret}, ${name}${sounding ? `, chord-melody ${sounding.role}` : ''}${releasedForMelody ? ', released for the current melody note' : ''}${melodyHere ? `, melody ${melodyLabel(melodyNote)}${exactTabPosition ? ', authored tab fingering' : visualOctaveDown ? ', displayed one octave lower; playback remains at written pitch' : foldedMelody ? ', shown on this fretboard octave' : ''}` : ''}`);
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
        if (foldedMelody || visualOctaveDown) {
          const octave = document.createElement('span');
          octave.className = 'melody-octave';
          octave.textContent = visualOctaveDown ? '8va↓' : melodyLabel(melodyNote);
          octave.setAttribute('aria-hidden', 'true');
          cell.appendChild(octave);
        }
        row.appendChild(cell);
      }
      board.appendChild(row);
    });
    const positionMarkers = document.createElement('div');
    positionMarkers.className = 'fretboard-position-markers';
    fretboardMarkerFrets(maxFret).forEach(fret => {
      const marker = document.createElement('i');
      marker.className = `fretboard-position-marker${fret % 12 === 0 ? ' double' : ''}`;
      marker.style.left = `${(fret + .5) / columnCount * 100}%`;
      marker.setAttribute('aria-hidden', 'true');
      positionMarkers.appendChild(marker);
    });
    board.appendChild(positionMarkers);
    elements.fretboard.replaceChildren(board);
    pressedCounts.fretboard.forEach((count, storedKey) => {
      if (!count) return;
      const [midiText, exactKey] = String(storedKey).split('@');
      const position = exactKey
        ? guitarPositionFromKey(exactKey)
        : fretboardPositionForMidi(Number(midiText), { maxFret });
      if (position) elements.fretboard.querySelector(`[data-string="${position.stringIndex}"][data-fret="${position.fret}"]`)?.classList.add('playing');
    });
    pressedCounts.fretboardChord.forEach((count, midi) => {
      if (!count) return;
      fretboardPressedCell(midi, 'fretboard-chord')?.classList.add('playing');
    });
    keepFretboardMelodyVisible(melodyPosition, { extendedNeck });
  }

  function keepFretboardMelodyVisible(melodyPosition, { extendedNeck = false } = {}) {
    if (!extendedNeck || !melodyPosition || !elements.fretboard) return;
    // renderFretboard runs just before syncInstrumentControls unhides Frets.
    // Wait one frame in that switch so measurements reflect the scrollable
    // neck instead of a zero-sized hidden surface.
    if (elements.fretboard.hidden) {
      window.requestAnimationFrame(() => keepFretboardMelodyVisible(melodyPosition, { extendedNeck }));
      return;
    }
    const cell = elements.fretboard.querySelector(
      `[data-string="${melodyPosition.stringIndex}"][data-fret="${melodyPosition.fret}"]`
    );
    keepFretboardCellVisible(cell);
  }

  function keepFretboardCellVisible(cell) {
    const stage = elements.fretboard?.closest('.instrument-stage');
    if (!stage || !cell) return;
    const stageRect = stage.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    if (cellRect.left >= stageRect.left && cellRect.right <= stageRect.right) return;
    const target = stage.scrollLeft + (cellRect.left + cellRect.width / 2) - (stageRect.left + stageRect.width / 2);
    stage.scrollLeft = Math.max(0, target);
  }

  function activeChartEvent() {
    const baseEvent = state.events[state.activeIndex];
    if (!baseEvent) return null;
    const alternate = state.activeAlternateCellId === baseEvent.cellId
      ? baseEvent.item?.alternates?.[state.activeAlternateIndex]
      : null;
    return alternate?.parsed ? { ...baseEvent, chord: alternate.parsed, optionalAlternate: true } : baseEvent;
  }

  function syncMelodyControls(event, notes, melodyNote) {
    const ready = Boolean(state.midi && state.melodyNotes.length);
    const melodyMatchesActiveChart = melodyMatchesChart();
    const canShowMelody = ready || Boolean(state.midiEntry);
    const soloLabel = isSoloStudyEntry() ? 'solo' : 'melody';
    elements.toggleMelody.textContent = state.showMelody ? `Hide ${soloLabel}` : canShowMelody ? `Show ${soloLabel}` : 'No melody MIDI';
    elements.toggleMelody.setAttribute('aria-pressed', String(state.showMelody));
    elements.toggleMelody.setAttribute('aria-label', state.showMelody
      ? `Hide ${soloLabel} from the instrument`
      : canShowMelody
        ? isSoloStudyEntry() ? 'Show the solo line while keeping harmony audible' : 'Show melody over the chord'
        : 'No matching melody MIDI is available');
    // Keep the toggle available to turn an already-enabled preference back
    // off, even on a chart that does not have a matching MIDI file.
    elements.toggleMelody.disabled = !canShowMelody && state.midiCatalogReady && !state.showMelody;
    elements.playMelody.disabled = !ready || !melodyMatchesActiveChart;
    elements.playMelody.checked = state.transport.playMelody;
    // A study chorus is aligned to the standard's iReal form on purpose.
    // Do not offer a marker-chart switch that would reintroduce the full
    // MIDI timeline and disconnect the selected solo chorus.
    elements.chartSourceLabel.hidden = !state.midiChart || isSoloStudyEntry();
    if (state.midiChart && !isSoloStudyEntry()) elements.chartSource.value = state.chartSource;

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
    const preparingStream = state.transport.playing && state.transport.streamMode && streamTransport.rendering;
    elements.playChart.textContent = preparingStream ? 'Preparing…' : state.transport.playing ? 'Stop chart' : 'Play chart';
    elements.playChart.setAttribute('aria-pressed', String(state.transport.playing));
    elements.playChart.setAttribute('aria-label', preparingStream
      ? 'Preparing the stable audio stream; tap to cancel'
      : state.transport.playing
        ? 'Stop the current chart'
        : state.transport.streamMode
          ? 'Play the current chart in Stream mode'
          : 'Play the current chart');
    elements.playChart.title = preparingStream
      ? 'Preparing stream · tap to cancel'
      : state.transport.streamMode
        ? 'Play chart as one stable media stream'
        : 'Play chart';
    elements.playChart.disabled = !state.transport.playing && !state.timeline.length;
    if (elements.autoAdvanceRandom) {
      const generatedParkerize = parkerizeActive() && state.parkerize.harmonyMode === 'generated';
      const standardParkerize = parkerizeActive() && state.parkerize.harmonyMode === 'standard';
      elements.autoAdvanceRandom.checked = state.transport.autoAdvanceRandom;
      elements.autoAdvanceRandom.setAttribute('aria-label', state.transport.autoAdvanceRandom
        ? generatedParkerize
          ? 'At the end of the chart, generate a new original bebop chart and solo and keep playing'
          : standardParkerize
            ? 'At the end of the chart, Parkerize a random standard and keep playing'
            : 'At the end of the chart, choose a random chart from the selected bank and keep playing'
        : 'At the end of the chart, loop this chart from the beginning');
      elements.autoAdvanceRandom.parentElement.title = state.transport.autoAdvanceRandom
        ? generatedParkerize
          ? 'New generated chart is on: Parkerize creates another composition with the saved complexity settings.'
          : standardParkerize
            ? 'Random next chart is on: Parkerize creates a new solo over another standard.'
            : 'Random next chart is on: the selected bank supplies the next chart.'
        : 'Random next chart is off: this chart loops from the beginning.';
      if (elements.autoAdvanceRandomLabel) elements.autoAdvanceRandomLabel.textContent = generatedParkerize ? 'Generate next tune' : standardParkerize ? 'Parkerize next chart' : 'Random next chart';
    }
    syncStreamModeControl();
    syncStreamVisualDelayControl();
    syncTempoControls();
  }

  function renderStudy({ keepVisible = true } = {}) {
    const event = activeChartEvent();
    if (!event) return;
    const pickup = event.kind === 'pickup';
    const tabBarMarker = Boolean(event.item?.source?.tabPlaceholder);
    const displayChord = tabBarMarker ? null : event.chord;
    const nextEvent = state.events[state.activeIndex + 1] || null;
    const section = pickup ? null : state.sections.get(event.sectionId);
    const scale = pickup || tabBarMarker ? null : scaleForEvent(event, nextEvent);
    const melodyNotes = melodyNotesForEvent(event);
    const melodyNotesOnCard = melodyNotesDuringEvent(event);
    const voicing = pickup || tabBarMarker ? [] : pianoVoicingForChord(displayChord, scale, melodyNotesOnCard);
    if (state.activeMelodyNote && !melodyNotesOnCard.some(note => note.id === state.activeMelodyNote.id)) state.activeMelodyNote = null;
    const melodyNote = activeMelodyForEvent(event);
    state.scale = scale;
    state.voicing = voicing;

    const chordTotal = state.events.filter(candidate => candidate.kind !== 'pickup').length;
    const chordPosition = state.events.slice(0, state.activeIndex + 1).filter(candidate => candidate.kind !== 'pickup').length;
    elements.selectedChord.textContent = pickup
      ? 'Pickup'
      : tabBarMarker
      ? `Bar ${event.barIndex + 1}`
      : `${event.optionalAlternate ? '(' : ''}${event.chord.display}${event.optionalAlternate ? ')' : ''}`;
    elements.selectedChord.title = event.item?.reharm
      ? `${event.item.reharm.originalDisplay} → ${event.chord.display} · ${event.item.reharm.ruleLabel}`
      : pickup ? 'Melody pickup' : tabBarMarker ? `Timing marker for bar ${event.barIndex + 1}` : event.chord.display;
    elements.selectedChord.dataset.originalChord = event.item?.reharm?.originalDisplay || '';
    elements.selectedChord.dataset.reharmLevel = String(state.reharmLevel);
    elements.chordProgress.textContent = pickup ? `0 / ${chordTotal}` : `${chordPosition} / ${chordTotal}`;
    elements.sectionReadout.textContent = pickup ? 'MIDI · pickup' : displaySection(event.sectionLabel, section);
    if (pickup) {
      elements.scaleName.textContent = 'Melody pickup';
      elements.chartStatus.textContent = `Pickup · before bar ${event.barIndex + 2}`;
    } else {
      if (tabBarMarker) {
        elements.scaleName.textContent = 'Tab timing';
        elements.chartStatus.textContent = `Bar ${event.barIndex + 1} · tab score`;
        renderPiano(null, null, [], melodyNote, melodyNotesOnCard);
        renderFretboard(event, null, melodyNote);
        syncInstrumentControls();
        syncMelodyControls(event, melodyNotes, melodyNote);
        syncTransportControls();
        setChartButtonState(event);
        if (keepVisible) keepMeasureVisible(event);
        return;
      }
      const parentSuffix = scale.sectionBased ? ` · ${Theory.contextName(section, state.preferFlats)} section` : '';
      const scaleRoot = scale.rootText ? Theory.displayNoteSpelling(scale.rootText) : Theory.noteName(scale.root, state.preferFlats);
      elements.scaleName.textContent = `${scaleRoot} ${scale.name}${parentSuffix}`;
      const reharmStatus = state.reharmLevel
        ? ` · Reharm ${state.reharmLevel}${event.item?.reharm ? ` · ${event.item.reharm.ruleLabel}` : ''}`
        : '';
      elements.chartStatus.textContent = `Bar ${event.barIndex + 1} · ${event.sectionLabel || 'form'}${reharmStatus}`;
    }
    renderPiano(displayChord, scale, voicing, melodyNote, melodyNotesOnCard);
    renderFretboard(event, scale, melodyNote);
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
      tempoBpm: Number(options.tempoBpm) || null,
      explicitTiming: Boolean(options.explicitTiming),
      reharmLevel: Number(options.reharmLevel) || 0,
      reharmChanged: Number(options.reharmChanged) || 0
    };
  }

  function invalidateDerivedHarmony() {
    state.reharmCharts.clear();
    state.guitarPlanCache = null;
    state.fullSongKeyboard = { key: '', range: null, eventVoicings: new Map(), midis: [] };
  }

  function melodyPcsByCellForChart(chart, source) {
    const result = new Map();
    if (!chart || !state.midi || !state.melodyNotes.length || state.melodyOverlayChartId !== source) return result;
    chart.events.forEach(event => {
      if (!event?.chord) return;
      const startBeat = Number(source === 'ireal' ? event.playbackStartBeat : event.sourceStartBeat);
      const endBeat = Number(source === 'ireal' ? event.playbackEndBeat : event.sourceEndBeat);
      if (!Number.isFinite(startBeat) || !Number.isFinite(endBeat) || endBeat <= startBeat) return;
      const pcs = result.get(event.cellId) || new Set();
      state.melodyNotes.forEach(note => {
        const noteStart = Number(note.startBeat);
        const noteEnd = Number(note.endBeat);
        if (Number.isFinite(noteStart) && Number.isFinite(noteEnd)
          && noteStart < endBeat - .0001 && noteEnd > startBeat + .0001) {
          pcs.add(Theory.mod(note.midi));
        }
      });
      if (pcs.size) result.set(event.cellId, pcs);
    });
    return new Map([...result].map(([cellId, pcs]) => [cellId, [...pcs]]));
  }

  function chartForSource(source) {
    const base = source === 'midi' ? state.midiChart : state.irealChart;
    const level = Reharm?.normalizeLevel?.(state.reharmLevel) ?? 0;
    if (!base || !level || !Reharm) return base;
    const melodyKey = state.melodyOverlayChartId === source
      ? state.melodyNotes.map(note => `${note.id}:${note.midi}:${note.startBeat}:${note.endBeat}`).join('|')
      : '';
    const cached = state.reharmCharts.get(source);
    if (cached?.base === base && cached.level === level && cached.melodyKey === melodyKey) return cached.chart;
    const reharmonized = Reharm.reharmonizeBars(base.bars, {
      level,
      contexts: base.sections,
      melodyPcsByCell: melodyPcsByCellForChart(base, source),
      seed: `${state.song?.title || ''}:${state.song?.composer || ''}:${source}`
    });
    const chart = createChartData(`${base.id}:reharm-${level}`, reharmonized.bars, base.playbackOrder, {
      explicitTiming: base.explicitTiming,
      sourceKey: base.sourceKey,
      tempoBpm: base.tempoBpm,
      reharmLevel: level,
      reharmChanged: reharmonized.changed
    });
    chart.reharmPlan = reharmonized.plan;
    chart.originalChart = base;
    state.reharmCharts.set(source, { base, level, melodyKey, chart });
    return chart;
  }

  function currentOccurrenceSnapshot() {
    const event = state.events[state.activeIndex];
    return event ? { cellId: event.cellId, passIndex: event.passIndex, eventIndex: event.eventIndex } : null;
  }

  function occurrenceIndexForSnapshot(events, snapshot) {
    if (!snapshot || !events.length) return 0;
    const exact = events.findIndex(event => event.cellId === snapshot.cellId && event.passIndex === snapshot.passIndex);
    if (exact >= 0) return exact;
    const sameCell = events.findIndex(event => event.cellId === snapshot.cellId);
    if (sameCell >= 0) return sameCell;
    return Math.max(0, Math.min(events.length - 1, Number(snapshot.eventIndex) || 0));
  }

  function syncMidiSourceStatus() {
    if (!state.song) {
      if (elements.midiAttribution) elements.midiAttribution.hidden = true;
      if (elements.midiStudyControl) elements.midiStudyControl.hidden = true;
      if (elements.midiChorusControl) elements.midiChorusControl.hidden = true;
      return;
    }
    if (elements.midiAttribution) {
      const sourceUrl = state.midiEntry?.sourceUrl;
      elements.midiAttribution.hidden = !sourceUrl;
      if (sourceUrl) {
        elements.midiAttribution.href = sourceUrl;
        elements.midiAttribution.textContent = state.midiEntry.sourceLabel || 'MIDI source';
      }
    }
    syncMidiStudyControl();
    syncMidiChorusControl();
    if (state.midi) {
      const chordEventCount = state.midiChart?.events.filter(event => event.kind !== 'pickup').length || 0;
      const pickupSuffix = state.midiChart?.events.some(event => event.kind === 'pickup') ? ' · pickup' : '';
      const markerText = state.midiEntry?.type === 'wjazzd-solo'
        ? 'source-harmony timing'
        : state.melodyOverlayChartId === 'ireal'
        ? `${soloStudyActive() ? 'solo' : 'melody'} over iReal timing`
        : state.midiChart
        ? `${chordEventCount} chord markers${pickupSuffix}`
        : 'melody over iReal timing';
      const tempo = Number(state.midi.tempos?.[0]?.bpm);
      const caution = !state.midiChart && !['parkerize', 'wjazzd-solo', 'tab-file'].includes(state.midiEntry?.type) ? ' · check the form matches' : '';
      const chorusText = state.midiChoruses.length > 1
        ? ` · chorus ${state.midiChorusIndex + 1} of ${state.midiChoruses.length}`
        : '';
      const studyText = state.midiEntry?.type === 'tab-file'
        ? 'tab study · original positions'
        : state.midiEntry?.type === 'parkerize'
        ? `Parkerize solo ${state.parkerize.soloComplexity}`
        : state.midiEntry?.type === 'wjazzd-solo'
        ? 'WJazzD solo study'
        : soloStudyActive() ? 'solo study' : state.midiEntry?.type === 'parker-solo' ? 'Parker transcription' : 'MIDI';
      elements.midiStatus.textContent = `${studyText} · ${markerText}${chorusText}${Number.isFinite(tempo) ? ` · ${Math.round(tempo)} BPM` : ''}${caution}`;
      return;
    }
    if (state.midiCatalogLoading) {
      elements.midiStatus.textContent = 'Looking for a matching MIDI…';
      return;
    }
    if (state.midiEntry) {
      elements.midiStatus.textContent = 'Matching melody MIDI available · markers, melody, and tempo';
      return;
    }
    if (state.midiCatalogReady) {
      elements.midiStatus.textContent = 'No matching melody MIDI available for this standard';
    }
  }

  function activateChartSource(source, options = {}) {
    const chart = chartForSource(source);
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
    state.activeIndex = occurrenceIndexForSnapshot(chart.events, options.preserveEvent);
    state.activeAlternateCellId = null;
    state.activeAlternateIndex = -1;
    state.splitMelodyRange = null;
    state.guitarPlanCache = null;
    state.fullSongKeyboard = { key: '', range: null, eventVoicings: new Map(), midis: [] };
    resetMelodySelection();
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

  function directXmlChild(node, tagName) {
    return [...(node?.children || [])].find(child => child.localName === tagName) || null;
  }

  function directXmlText(node, tagName) {
    return safeText(directXmlChild(node, tagName)?.textContent);
  }

  function musicXmlPitchName(step, alter) {
    const value = safeText(step).toUpperCase();
    const adjustment = Number(alter) || 0;
    if (!/^[A-G]$/.test(value)) return '';
    if (adjustment === -1) return `${value}b`;
    if (adjustment === 1) return `${value}#`;
    return value;
  }

  function musicXmlHarmonySymbol(harmony) {
    const root = directXmlChild(harmony, 'root');
    const rootName = musicXmlPitchName(directXmlText(root, 'root-step'), directXmlText(root, 'root-alter'));
    if (!rootName) return '';
    const kind = directXmlChild(harmony, 'kind');
    let quality = safeText(kind?.getAttribute('text'));
    // The Omnibook export spells half-diminished chords in two compatible
    // forms. Keyer's parser uses the latter form consistently.
    if (quality === '-7b5') quality = 'm7b5';
    const bass = directXmlChild(harmony, 'bass');
    const bassName = musicXmlPitchName(directXmlText(bass, 'bass-step'), directXmlText(bass, 'bass-alter'));
    if (quality.startsWith('/')) return `${rootName}${quality}`;
    return `${rootName}${quality}${bassName ? `/${bassName}` : ''}`;
  }

  function musicXmlKeyFromFifths(value) {
    const fifths = Number(value);
    const names = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B'];
    return Number.isInteger(fifths) && fifths >= -6 && fifths <= 6 ? names[fifths + 6] : '';
  }

  function parseParkerMusicXmlSong(source, song) {
    if (typeof DOMParser !== 'function') throw new Error('This browser cannot read the Parker source chart.');
    const document = new DOMParser().parseFromString(source, 'application/xml');
    if (document.querySelector('parsererror')) throw new Error('The Parker source chord chart could not be read.');
    const measures = [...document.querySelectorAll('part > measure')];
    if (!measures.length) throw new Error('The Parker source chord chart has no measures.');
    let divisions = 1;
    let meter = { beats: 4, beatUnit: 4 };
    let cursorBeat = 0;
    let key = '';
    let bpm = 0;
    let previousChord = '';
    const bars = measures.map((measure, index) => {
      const measureStart = cursorBeat;
      let localCursor = 0;
      let meterChanged = false;
      const changes = [];
      [...measure.children].forEach(child => {
        if (child.localName === 'attributes') {
          const nextDivisions = Number(directXmlText(child, 'divisions'));
          if (Number.isFinite(nextDivisions) && nextDivisions > 0) divisions = nextDivisions;
          const time = directXmlChild(child, 'time');
          const beats = Number(directXmlText(time, 'beats'));
          const beatUnit = Number(directXmlText(time, 'beat-type'));
          if (Number.isFinite(beats) && beats > 0 && Number.isFinite(beatUnit) && beatUnit > 0) {
            meter = { beats, beatUnit };
            meterChanged = true;
          }
          const keyElement = directXmlChild(child, 'key');
          if (!key) key = musicXmlKeyFromFifths(directXmlText(keyElement, 'fifths'));
          return;
        }
        if (child.localName === 'direction' && !bpm) {
          const tempo = Number(child.querySelector('per-minute')?.textContent);
          if (Number.isFinite(tempo) && tempo >= 30) bpm = tempo;
          return;
        }
        if (child.localName === 'harmony') {
          const raw = musicXmlHarmonySymbol(child);
          if (!raw || !Theory.parseChordSymbol(raw)) return;
          const offset = Number(directXmlText(child, 'offset'));
          const position = Math.max(0, localCursor + (Number.isFinite(offset) ? offset : 0));
          changes.push({ raw, startBeat: measureStart + position / divisions });
          return;
        }
        const duration = Number(directXmlText(child, 'duration'));
        if (!Number.isFinite(duration)) return;
        if (child.localName === 'backup') localCursor = Math.max(0, localCursor - duration);
        else if (child.localName === 'forward') localCursor += duration;
        else if (child.localName === 'note' && !directXmlChild(child, 'chord')) localCursor += duration;
      });
      const measureBeats = meter.beats * 4 / meter.beatUnit;
      const measureEnd = measureStart + measureBeats;
      const chords = changes.map((change, chordIndex) => ({
        raw: change.raw,
        chordIndex,
        startBeat: Math.min(measureEnd - .001, change.startBeat),
        endBeat: chordIndex + 1 < changes.length
          ? Math.min(measureEnd, changes[chordIndex + 1].startBeat)
          : measureEnd
      }));
      // A few transcriptions have a fully sustained measure. Re-articulate
      // the last named harmony for audible backing while keeping the source
      // timing intact.
      if (!chords.length && previousChord) chords.push({
        raw: previousChord,
        chordIndex: 0,
        startBeat: measureStart,
        endBeat: measureEnd,
        inherited: true
      });
      if (chords.length) previousChord = chords[chords.length - 1].raw;
      cursorBeat = measureEnd;
      return {
        index,
        chords,
        overflowChords: [],
        section: String.fromCharCode(65 + Math.floor(index / 8) % 26),
        sectionMarker: index % 8 === 0 ? String.fromCharCode(65 + Math.floor(index / 8) % 26) : null,
        timeSignature: meter,
        timeSignatureChange: meterChanged ? meter : null,
        annotations: [],
        comments: [],
        repeatStart: false,
        repeatEnd: false,
        noChord: false,
        pause: false,
        startBeat: measureStart,
        endBeat: measureEnd
      };
    });
    if (!bars.some(bar => bar.chords.length)) throw new Error('The Parker source chart has no readable chord symbols.');
    return {
      ...song,
      bars,
      playbackOrder: bars.map((_, index) => index),
      key: song.key || key,
      bpm: song.bpm || bpm,
      parkerXmlTiming: true
    };
  }

  async function hydrateParkerSong(song) {
    if (!song?.parkerXmlUrl || Array.isArray(song.bars) && song.bars.length) return song;
    const xml = await fetchFirst([song.parkerXmlUrl], 'text');
    return parseParkerMusicXmlSong(xml, song);
  }

  function applyLoadedSong(song, { transport = false, preloadedMidi = null } = {}) {
    const bars = normalizeBars(song);
    if (!bars.length) return false;
    // Random-next keeps one Stream session alive from the previous ending
    // through final MIDI resolution and the next media play. Do not tear down
    // its media source or kick off a provisional render here: the caller will
    // await the selected MIDI, then render exactly once from final chart data.
    const deferStreamPreparation = Boolean(
      transport && state.transport.streamMode && streamTransport.transitioning
    );
    if (transport) {
      clearTransportTimers();
      [...voices.keys()].filter(id => String(id).startsWith('chart-')).forEach(id => stopVoice(id, true));
    } else {
      stopChartPlayback({ render: false });
    }
    // A rendered media file belongs to the exact chart, source, tempo, and
    // MIDI selection it was built from. Never let an old stream keep playing
    // underneath a newly loaded song.
    if (!deferStreamPreparation) invalidateStreamAsset();
    invalidateDerivedHarmony();
    state.song = song;
    if (!song?.tabSource) state.tabSession = null;
    state.irealChart = createChartData('ireal', bars, song.playbackOrder, {
      sourceKey: song.key,
      tempoBpm: song.bpm,
      explicitTiming: Boolean(song.parkerXmlTiming || song.wjazzdChartTiming || song.tabTiming)
    });
    if (!state.irealChart.events.length) return false;
    clearMidiSource();
    const generatedPractice = parkerizeActive();
    state.preferSoloChorus = generatedPractice || Boolean(song.tabSource) || ['solos', 'parker', 'legends'].includes(state.songAvailabilityFilter);
    state.midiEntries = generatedPractice ? [] : midiEntriesForSong(song);
    state.midiEntry = state.midiEntries[0] || null;

    if (state.preferSoloChorus && state.midiEntry) setMelodyVisibility(true, { persist: false });

    elements.songTitle.textContent = song.title || 'Untitled standard';
    elements.songComposer.textContent = song.parkerizeGenerated
      ? 'Parkerize · original generated composition'
      : song.tabSource
      ? 'Tab import · original string and fret positions'
      : state.midiEntry?.type === 'parker-solo'
      ? `${song.composer || 'Charlie Parker'} · Parker solo study`
      : state.midiEntry?.type === 'wjazzd-solo'
      ? `${state.midiEntry.performer || song.composer || 'Jazz legend'} · WJazzD solo study`
      : song.composer || 'Unknown composer';
    elements.songMeta.textContent = [song.style, song.key ? `Key ${song.key}` : '', `${bars.length} bars`].filter(Boolean).join(' · ');
    elements.search.value = '';
    state.searchPickerPrimed = false;
    syncFavoriteSongButton();
    elements.lesson.hidden = false;
    elements.errorCard.hidden = true;
    hideSearchResults();
    activateChartSource('ireal', { transport: true });
    syncMidiSourceStatus();
    // "Show melody" is a learner preference, not a property of one chart.
    // Keep it on through Random/song selection and quietly load the next
    // compatible melody when the catalog has a match.
    if (generatedPractice) installParkerizedSolo({ transport });
    else if ((state.showMelody || state.preferSoloChorus) && state.midiEntry && !preloadedMidi && !deferStreamPreparation) {
      void requestMidiSource({ showAfterLoad: true, transport });
    }
    if (!song.parkerizeGenerated && !song.tabSource) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          title: song.title,
          composer: song.composer,
          key: song.key,
          azMidiFile: song.azMidiEntry?.file || '',
          wjazzdMidiFile: song.wjazzdSoloEntry?.file || ''
        }));
      } catch (_) {}
    }
    syncParkerizePanel();
    syncTabTrackControl();
    // When Stream mode was previously latched on, prepare the selected song
    // before the user presses Play. That keeps the eventual media play call
    // inside a direct tap on iOS instead of waiting for an offline render.
    if (state.transport.streamMode && !deferStreamPreparation) void prepareStreamAsset();
    return true;
  }

  async function hydrateAzMidiSong(song) {
    const entry = song?.azMidiEntry;
    if (!entry || !MiditarMidi) throw new Error('This A–Z MIDI entry could not be opened.');
    const buffer = await fetchFirst(entry.urls, 'arrayBuffer');
    const midi = MiditarMidi.parseMidi(buffer, entry.file);
    const melodyTrack = MiditarMidi.chooseMelodyTrack(midi);
    const melodyNotes = buildMelodyNotes(midi, melodyTrack);
    const chart = buildMidiChart(midi, melodyNotes);
    if (!chart?.bars?.length || !chart.playbackOrder?.length) {
      throw new Error(`${entry.title} has no readable chord-marker chart.`);
    }
    return {
      midi,
      song: {
        ...song,
        title: entry.title || midi.title || song.title,
        bpm: Number(chart.tempoBpm) || entry.bpm || song.bpm,
        bars: chart.bars,
        playbackOrder: chart.playbackOrder,
        key: chart.sourceKey || song.key || ''
      }
    };
  }

  function inflateWJazzdBars(entry) {
    const encodedBars = Array.isArray(entry?.chart) ? entry.chart : [];
    let cursor = 0;
    let currentSection = 'Solo';
    return encodedBars.map((encoded, index) => {
      const beats = Math.max(1, Number(encoded?.[0]) || 4);
      const beatUnit = Math.max(1, Number(encoded?.[1]) || 4);
      const marker = safeText(encoded?.[2]);
      const duration = beats * 4 / beatUnit;
      if (marker) currentSection = marker;
      const chords = (Array.isArray(encoded?.[3]) ? encoded[3] : []).map(cell => ({
        raw: safeText(cell?.[0]),
        startBeat: cursor + Math.max(0, Math.min(duration, Number(cell?.[1]) || 0)),
        endBeat: cursor + Math.max(0.01, Math.min(duration, Number(cell?.[2]) || duration))
      })).filter(chord => chord.raw && chord.endBeat > chord.startBeat);
      const bar = {
        index,
        chords,
        overflowChords: [],
        section: currentSection,
        sectionMarker: marker || null,
        timeSignature: { beats, beatUnit },
        timeSignatureChange: index === 0 ? { beats, beatUnit } : null,
        annotations: [],
        comments: [],
        repeatStart: false,
        repeatEnd: false,
        noChord: !chords.length,
        pause: false
      };
      cursor += duration;
      return bar;
    });
  }

  function hydrateWJazzdSoloSong(song) {
    const entry = song?.wjazzdSoloEntry;
    if (!entry || Array.isArray(song.bars) && song.bars.length) return song;
    const bars = inflateWJazzdBars(entry);
    if (!bars.length || !bars.some(bar => bar.chords.length)) throw new Error(`${entry.name || song.title} has no readable source harmony.`);
    return {
      ...song,
      bars,
      playbackOrder: bars.map((_, index) => index),
      key: song.key || entry.key || '',
      bpm: Number(song.bpm) || Number(entry.bpm) || DEFAULT_TEMPO,
      wjazzdChartTiming: true
    };
  }

  function tabSongForCatalogEntry(entry) {
    const extension = safeText(entry?.extension).toUpperCase();
    const direct = Boolean(entry?.direct);
    return {
      title: entry?.title || TabImport?.titleFromFileName?.(entry?.file) || 'Untitled tab',
      composer: entry?.artist || 'Personal tab library',
      style: direct
        ? `Tab · ${extension} · original string/fret positions`
        : `Tab · ${extension} · convert to GP or MusicXML`,
      key: '',
      bpm: Number(entry?.bpm) || 120,
      bars: [],
      playbackOrder: [],
      tabCatalogEntry: {
        ...entry,
        type: 'tab-file',
        name: entry?.file || entry?.title || 'tab',
        sourceLabel: direct ? 'Personal tab · original fingering' : 'Power Tab conversion needed',
        urls: entry?.url ? [entry.url] : []
      }
    };
  }

  function frettedTabTrackIndexes(parsed) {
    return (parsed?.tracks || []).filter(track => track?.fretted).map(track => track.index);
  }

  function guitarTabTrackIndexes(parsed) {
    const fretted = frettedTabTrackIndexes(parsed);
    const namedGuitars = fretted.filter(index => /guitar|lead|rhythm|electric|acoustic|nylon/i.test(parsed?.tracks?.[index]?.name || ''));
    if (namedGuitars.length) return namedGuitars;
    const nonBass = fretted.filter(index => !/bass/i.test(parsed?.tracks?.[index]?.name || ''));
    return nonBass.length ? nonBass : fretted;
  }

  function syncTabTrackControl() {
    const session = state.tabSession;
    const available = frettedTabTrackIndexes(session?.parsed);
    const guitarTracks = session?.guitarTrackIndexes || guitarTabTrackIndexes(session?.parsed);
    if (elements.tabTrackControl && elements.tabTrack) {
      elements.tabTrackControl.hidden = !session || available.length < 2;
      if (!session || available.length < 2) {
        elements.tabTrack.replaceChildren();
      } else {
        const fragment = document.createDocumentFragment();
        available.forEach(index => {
          const track = session.parsed.tracks[index];
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = `${track.name} · ${track.stringCount} strings`;
          fragment.appendChild(option);
        });
        elements.tabTrack.replaceChildren(fragment);
        elements.tabTrack.value = String(session.trackIndex);
      }
    }
    if (!elements.tabMixControl || !elements.tabPlayAllTracks) return;
    const canMix = Boolean(session && guitarTracks.length > 1);
    elements.tabMixControl.hidden = !canMix;
    elements.tabPlayAllTracks.disabled = !canMix;
    elements.tabPlayAllTracks.checked = Boolean(session?.playAllTracks && canMix);
    elements.tabPlayAllTracks.title = canMix
      ? `Hear ${guitarTracks.length} guitar tracks together; the fretboard stays on the selected Tab track.`
      : '';
  }

  function installParsedTab(parsed, entry, requestedTrackIndex = parsed?.preferredTrackIndex, options = {}) {
    if (!TabImport) throw new Error('The Guitar Pro reader did not load. Reload Keyer and try again.');
    const fretted = frettedTabTrackIndexes(parsed);
    if (!fretted.length) throw new Error('This tab has no fretted guitar or bass track.');
    const preferred = fretted.includes(Number(requestedTrackIndex)) ? Number(requestedTrackIndex) : fretted[0];
    const guitarTracks = guitarTabTrackIndexes(parsed);
    const sameScore = state.tabSession?.parsed === parsed;
    const playAllTracks = typeof options.playAllTracks === 'boolean'
      ? options.playAllTracks
      : sameScore && typeof state.tabSession?.playAllTracks === 'boolean'
      ? state.tabSession.playAllTracks
      : guitarTracks.length > 1;
    // The selected track always remains audible.  When the mix is on, add
    // every identified guitar part (rhythm/lead/etc.) at its authored time.
    const playbackTracks = playAllTracks
      ? [...new Set([preferred, ...guitarTracks])]
      : [preferred];
    const midi = typeof TabImport.midiForTracks === 'function'
      ? TabImport.midiForTracks(parsed, playbackTracks, preferred)
      : TabImport.midiForTrack(parsed, preferred);
    const song = TabImport.songForParsedTab(parsed, entry, preferred);
    const loaded = applyLoadedSong(song, { ...options, preloadedMidi: midi });
    if (!loaded) return false;
    state.tabSession = { parsed, entry, trackIndex: preferred, guitarTrackIndexes: guitarTracks, playAllTracks };
    installMidiSource(midi, entry, { transport: Boolean(options.transport) });
    syncTabTrackControl();
    const mixStatus = playAllTracks && playbackTracks.length > 1
      ? ` · playing ${playbackTracks.length} guitar tracks together`
      : '';
    elements.libraryStatus.textContent = `${song.title} · ${parsed.tracks[preferred].name} on fretboard${mixStatus} · original tab positions`;
    return true;
  }

  async function loadTabCatalogSong(song, options = {}) {
    const entry = song?.tabCatalogEntry;
    if (!TabImport) throw new Error('The Guitar Pro reader did not load. Reload Keyer and try again.');
    if (!entry?.direct) throw new Error(TabImport.supportedFileMessage(entry?.file || entry?.name));
    const urls = Array.isArray(entry.urls) && entry.urls.length ? entry.urls : [];
    if (!urls.length) throw new Error('This tab library entry has no readable file URL.');
    const buffer = await fetchFirst(urls, 'arrayBuffer');
    const parsed = TabImport.parseScore(buffer, entry.name || entry.file);
    return installParsedTab(parsed, entry, parsed.preferredTrackIndex, options);
  }

  async function loadLocalTabFile(file) {
    if (!file) return false;
    if (!TabImport) throw new Error('The Guitar Pro reader did not load. Reload Keyer and try again.');
    if (!TabImport.isDirectlySupported(file.name)) throw new Error(TabImport.supportedFileMessage(file.name));
    const entry = {
      type: 'tab-file',
      name: file.name,
      title: TabImport.titleFromFileName(file.name),
      sourceLabel: 'Local tab · original fingering',
      local: true,
      direct: true
    };
    const parsed = TabImport.parseScore(await file.arrayBuffer(), file.name);
    return installParsedTab(parsed, entry, parsed.preferredTrackIndex);
  }

  function selectTabTrack(value) {
    const session = state.tabSession;
    if (!session) return false;
    const nextIndex = Number(value);
    if (!frettedTabTrackIndexes(session.parsed).includes(nextIndex) || nextIndex === session.trackIndex) return false;
    return installParsedTab(session.parsed, session.entry, nextIndex, { playAllTracks: session.playAllTracks });
  }

  function setTabPlayAllTracks(value) {
    const session = state.tabSession;
    if (!session || guitarTabTrackIndexes(session.parsed).length < 2) return false;
    if (Boolean(value) === Boolean(session.playAllTracks)) return false;
    return installParsedTab(session.parsed, session.entry, session.trackIndex, { playAllTracks: Boolean(value) });
  }

  async function loadSong(song, options = {}) {
    const request = ++songLoadSequence;
    try {
      if (song?.tabCatalogEntry) {
        elements.libraryStatus.textContent = `Loading ${song.title}'s tab…`;
        const loaded = await loadTabCatalogSong(song, options);
        return request === songLoadSequence ? loaded : false;
      }
      let preloadedMidi = null;
      if (song?.azMidiEntry && (!Array.isArray(song.bars) || !song.bars.length)) {
        elements.libraryStatus.textContent = `Loading ${song.title}'s A–Z MIDI chart…`;
        const hydrated = await hydrateAzMidiSong(song);
        if (request !== songLoadSequence) return false;
        Object.assign(song, hydrated.song);
        preloadedMidi = hydrated.midi;
      }
      if (song?.wjazzdSoloEntry && (!Array.isArray(song.bars) || !song.bars.length)) {
        elements.libraryStatus.textContent = `Reading ${song.wjazzdSoloEntry.performer || song.composer || 'jazz legend'}'s solo chart…`;
        const hydrated = hydrateWJazzdSoloSong(song);
        if (request !== songLoadSequence) return false;
        Object.assign(song, hydrated);
      }
      if (song?.parkerXmlUrl && (!Array.isArray(song.bars) || !song.bars.length)) {
        elements.libraryStatus.textContent = `Loading ${song.title}'s Parker chord chart…`;
        const hydrated = await hydrateParkerSong(song);
        if (request !== songLoadSequence) return false;
        Object.assign(song, hydrated);
      }
      if (request !== songLoadSequence
        || options.transportSession != null && !transportSessionActive(options.transportSession)) return false;
      const loaded = applyLoadedSong(song, { ...options, preloadedMidi });
      if (loaded && preloadedMidi) installMidiSource(preloadedMidi, song.azMidiEntry, { transport: Boolean(options.transport) });
      return loaded;
    } catch (error) {
      if (request === songLoadSequence) {
        console.error(error);
        elements.libraryStatus.textContent = error?.message || `Could not load ${song?.title || 'this chart'}.`;
      }
      return false;
    }
  }

  function favoriteKeyForSong(song) {
    return [song?.title, song?.composer, song?.key].map(value => safeText(value).trim().toLocaleLowerCase()).join('::');
  }

  function isFavoriteSong(song) {
    return Boolean(song && state.favoriteSongKeys.has(favoriteKeyForSong(song)));
  }

  function persistFavoriteSongs() {
    try { localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...state.favoriteSongKeys])); } catch (_) {}
  }

  function syncFavoriteSongButton() {
    const button = elements.favoriteSong;
    if (!button) return;
    const favorite = isFavoriteSong(state.song);
    button.disabled = !state.song;
    button.textContent = favorite ? '★' : '☆';
    button.setAttribute('aria-pressed', String(favorite));
    button.setAttribute('aria-label', favorite ? 'Remove this standard from favorites' : 'Add this standard to favorites');
    button.title = favorite ? 'Remove from favorites' : 'Add to favorites';
  }

  function toggleFavoriteSong() {
    if (!state.song) return;
    const key = favoriteKeyForSong(state.song);
    if (state.favoriteSongKeys.has(key)) state.favoriteSongKeys.delete(key);
    else state.favoriteSongKeys.add(key);
    persistFavoriteSongs();
    syncFavoriteSongButton();
    if (state.songAvailabilityFilter === 'favorites' && !elements.searchResults.hidden) renderSearchResults();
  }

  function matchingSongs(query) {
    const q = safeText(query).toLowerCase();
    const bank = state.songAvailabilityFilter === 'tab-files'
      ? state.tabSongs
      : state.songAvailabilityFilter === 'az-midi'
      ? state.azMidiSongs
      : state.songAvailabilityFilter === 'legends'
        ? state.legendSoloSongs.filter(song => !isParkerSoloSong(song))
      : state.songAvailabilityFilter === 'solos'
        ? [...state.legendSoloSongs, ...state.songs.filter(song => parkerSolosForSong(song).length > 0 || SoloCatalog?.isMiditarMultiChorus?.(song.title))]
      : state.songAvailabilityFilter === 'parker'
        ? [...state.legendSoloSongs.filter(isParkerSoloSong), ...state.songs.filter(song => parkerSolosForSong(song).length > 0)]
      : state.songAvailabilityFilter === 'favorites'
        ? [...state.songs, ...state.azMidiSongs, ...state.legendSoloSongs]
        : state.songs;
    const source = q
      ? bank.filter(song => `${song.title} ${song.composer} ${song.style} ${song.azMidiEntry?.file || ''} ${song.wjazzdSoloEntry?.file || ''} ${song.tabCatalogEntry?.file || ''}`.toLowerCase().includes(q))
      : bank;
    if (state.songAvailabilityFilter === 'all') return source;
    if (state.songAvailabilityFilter === 'solos') return source.filter(isJazzSoloSong);
    if (state.songAvailabilityFilter === 'parker') return source.filter(isParkerSoloSong);
    if (state.songAvailabilityFilter === 'legends') return source;
    if (state.songAvailabilityFilter === 'az-midi') return source;
    if (state.songAvailabilityFilter === 'tab-files') return source;
    if (state.songAvailabilityFilter === 'parkerize') return source;
    if (state.songAvailabilityFilter === 'favorites') return source.filter(isFavoriteSong);
    if (!state.midiCatalogReady) return [];
    return source.filter(song => {
      const hasMelody = Boolean(midiEntryForSong(song));
      return state.songAvailabilityFilter === 'melody' ? hasMelody : !hasMelody;
    });
  }

  function randomSelectionSongs() {
    // Search is for narrowing the result list only. Random always draws from
    // the currently selected library bank (all charts, MIDI melody, or charts
    // only), so a typed title can never trap the button on that one song.
    const songs = matchingSongs('');
    return state.songAvailabilityFilter === 'tab-files'
      ? songs.filter(song => song.tabCatalogEntry?.direct)
      : songs;
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
      const sourceLabel = state.songAvailabilityFilter === 'tab-files'
        ? song.tabCatalogEntry?.direct ? `Tab · ${safeText(song.tabCatalogEntry?.extension).toUpperCase()} · exact positions` : 'Power Tab · convert to GP or MusicXML'
        : state.songAvailabilityFilter === 'az-midi'
        ? `A–Z MIDI · ${song.azMidiEntry?.file || ''}`
        : state.songAvailabilityFilter === 'legends'
        ? `WJazzD · ${song.wjazzdSoloEntry?.instrument || 'solo'}`
        : state.songAvailabilityFilter === 'parker'
        ? 'Parker solo'
        : state.songAvailabilityFilter === 'solos'
          ? isParkerSoloSong(song) ? 'Parker solo' : song.wjazzdSoloEntry ? 'Jazz legend solo' : 'Multi-chorus study'
          : state.songAvailabilityFilter === 'parkerize'
            ? 'Generate a new solo'
          : '';
      sub.textContent = [sourceLabel, song.composer, song.style].filter(Boolean).join(' · ');
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
    const requiresMidiCatalog = ['melody', 'chords'].includes(state.songAvailabilityFilter);
    if (requiresMidiCatalog && !state.midiCatalogReady) {
      elements.libraryStatus.textContent = 'Finding MIDI melody availability…';
    } else {
      const label = state.songAvailabilityFilter === 'favorites' ? 'favorite standards'
        : state.songAvailabilityFilter === 'melody' ? 'with MIDI melody'
        : state.songAvailabilityFilter === 'chords' ? 'chord charts only'
        : state.songAvailabilityFilter === 'solos' ? 'jazz solo studies'
        : state.songAvailabilityFilter === 'parker' ? 'Charlie Parker solo studies'
        : state.songAvailabilityFilter === 'legends' ? 'jazz legend solo studies'
        : state.songAvailabilityFilter === 'az-midi' ? 'in the A–Z MIDI bank'
        : state.songAvailabilityFilter === 'parkerize' ? 'available to Parkerize'
        : state.songAvailabilityFilter === 'tab-files' ? 'in your tab files bank'
        : '';
      const available = state.songAvailabilityFilter === 'az-midi'
        ? state.azMidiSongs.length
        : state.songAvailabilityFilter === 'tab-files'
        ? state.tabSongs.length
        : ['solos', 'parker', 'legends'].includes(state.songAvailabilityFilter) ? bank.length
        : state.songs.length;
      elements.libraryStatus.textContent = `${songs.length.toLocaleString()} match${songs.length === 1 ? '' : 'es'}${label ? ` ${label}` : ''} · ${available.toLocaleString()} charts available`;
    }
  }

  function hideSearchResults() {
    elements.searchResults.hidden = true;
    elements.search.setAttribute('aria-expanded', 'false');
    state.searchIndex = -1;
    state.searchPickerPrimed = false;
    if (state.songs.length) {
      const multiChorusCount = SoloCatalog?.multiChorusCount || 0;
      const parkerCount = SoloCatalog?.parkerSolos?.length || 0;
      const wjazzdCount = WJazzDSoloCatalog?.entryCount || 0;
      const azCount = AzMidiCatalog?.playableCount || 0;
      const tabCount = state.tabSongs.length;
      elements.libraryStatus.textContent = `${state.songs.length.toLocaleString()} jazz-standard charts · ${wjazzdCount} Jazzomat legend solos · ${parkerCount} Parker Omnibook solos · ${multiChorusCount} multi-chorus studies · ${azCount.toLocaleString()} A–Z MIDI songs · ${tabCount.toLocaleString()} tab files`;
    }
  }

  function restoredSong() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved) return null;
      const candidates = [...state.songs, ...state.azMidiSongs, ...state.legendSoloSongs];
      return candidates.find(song => (
        song.title === saved.title
        && song.composer === saved.composer
        && song.key === saved.key
        && (!saved.azMidiFile || song.azMidiEntry?.file === saved.azMidiFile)
        && (!saved.wjazzdMidiFile || song.wjazzdSoloEntry?.file === saved.wjazzdMidiFile)
      )) || null;
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

  function parkerSolosForSong(song) {
    if (!song) return [];
    if (typeof SoloCatalog?.findParkerSolos === 'function') return SoloCatalog.findParkerSolos(song.title);
    const entry = SoloCatalog?.findParkerSolo?.(song.title);
    return entry ? [entry] : [];
  }

  function parkerSoloForSong(song) {
    return parkerSolosForSong(song)[0] || null;
  }

  function normalizedSoloTitle(value) {
    const source = safeText(value);
    const normalized = typeof source.normalize === 'function' ? source.normalize('NFKD') : source;
    return normalized
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’‘`]/g, "'")
      .replace(/&/g, ' and ')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .toLowerCase()
      .trim()
      .replace(/^(?:the|an|a)\s+/, '')
      .replace(/\s+/g, ' ');
  }

  function wjazzdSolosForSong(song) {
    if (!song) return [];
    if (song.wjazzdSoloEntry) return [song.wjazzdSoloEntry];
    const key = normalizedSoloTitle(song.title);
    if (!key) return [];
    return (WJazzDSoloCatalog?.entries || []).filter(entry => normalizedSoloTitle(entry.title) === key).map(entry => ({
      ...entry,
      name: entry.name || `${entry.performer || 'Jazz legend'} — ${entry.title}.mid`,
      type: 'wjazzd-solo',
      sourceLabel: `WJazzD · ${entry.performer || 'Jazz legend'}`,
      sourceUrl: WJazzDSoloCatalog?.sourceUrl || 'https://jazzomat.hfm-weimar.de/download/download.html',
      urls: [`jazz-solo-midi/wjazzd/${encodeURIComponent(entry.file)}`]
    }));
  }

  function miditarEntryForSong(song) {
    if (!song || !MiditarMidi || !state.midiCatalog.length) return null;
    const entry = MiditarMidi.findCatalogMatch(song.title, state.midiCatalog);
    return entry ? {
      ...entry,
      type: 'miditar',
      sourceLabel: 'Miditar MIDI collection',
      sourceUrl: 'https://github.com/santismo/miditar'
    } : null;
  }

  function midiEntriesForSong(song) {
    if (song?.tabEntry) return [song.tabEntry];
    if (song?.azMidiEntry || song?.wjazzdSoloEntry) return [song.azMidiEntry || song.wjazzdSoloEntry];
    // Give purpose-built Parker transcriptions precedence, while preserving
    // the Jazzomat and Miditar alternatives as selectable study sources.
    const parker = parkerSolosForSong(song);
    const wjazzd = wjazzdSolosForSong(song);
    const miditar = miditarEntryForSong(song);
    return [...parker, ...wjazzd, ...(miditar ? [miditar] : [])];
  }

  function midiEntryForSong(song) {
    return midiEntriesForSong(song)[0] || null;
  }

  function midiEntryKey(entry) {
    return `${entry?.type || 'midi'}:${entry?.name || entry?.title || ''}`;
  }

  function isParkerSoloSong(song) {
    // A WJazzD study is categorized by the actual soloist, not merely by the
    // tune title (for example, Art Pepper's Anthropology belongs with the
    // legend studies even though Parker also recorded Anthropology).
    if (song?.wjazzdSoloEntry) return song.wjazzdSoloEntry.performer === 'Charlie Parker';
    return parkerSolosForSong(song).length > 0;
  }

  function isJazzSoloSong(song) {
    return Boolean(song?.wjazzdSoloEntry) || isParkerSoloSong(song) || Boolean(SoloCatalog?.isMiditarMultiChorus?.(song?.title));
  }

  function isSoloStudyEntry(entry = state.midiEntry) {
    return entry?.type === 'tab-file'
      || entry?.type === 'parker-solo'
      || entry?.type === 'wjazzd-solo'
      || entry?.type === 'parkerize'
      || Boolean(state.preferSoloChorus && SoloCatalog?.isMiditarMultiChorus?.(state.song?.title));
  }

  function soloStudyActive() {
    return Boolean(state.midi && state.showMelody && (
      state.midiEntry?.type === 'tab-file'
      || state.midiEntry?.type === 'parker-solo'
      || state.midiEntry?.type === 'wjazzd-solo'
      || state.midiEntry?.type === 'parkerize'
      || (state.midiChoruses.length > 1 && state.midiChorusIndex > 0)
    ));
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
      state.midiCatalogTitles = new Set(state.midiCatalog.map(entry => MiditarMidi.normalizeCatalogTitle(entry.title)).filter(Boolean));
      state.midiCatalogReady = true;
      if (state.song) {
        const selectedKey = midiEntryKey(state.midiEntry);
        state.midiEntries = midiEntriesForSong(state.song);
        state.midiEntry = state.midiEntries.find(entry => midiEntryKey(entry) === selectedKey) || state.midiEntries[0] || null;
        if ((state.showMelody || state.preferSoloChorus) && state.midiEntry && !state.midi) void requestMidiSource({ showAfterLoad: true });
      }
    } catch (error) {
      console.warn('Miditar catalog unavailable', error);
      state.midiCatalogReady = true;
    } finally {
      state.midiCatalogLoading = false;
      syncMidiSourceStatus();
      if (!elements.searchResults.hidden) renderSearchResults();
      if (state.song) renderStudy({ keepVisible: false });
    }
  }

  function songMetaText() {
    if (!state.song) return '';
    const chart = state.chartSource === 'midi' ? state.midiChart : state.irealChart;
    const source = state.chartSource === 'midi' ? 'MIDI markers' : '';
    const key = state.chartSource === 'midi'
      ? chart?.sourceKey ? `Key ${chart.sourceKey}` : 'MIDI form'
      : chart?.sourceKey ? `Key ${chart.sourceKey}` : state.song.key ? `Key ${state.song.key}` : '';
    const solo = state.midiEntry?.type === 'tab-file'
      ? 'Original tab fingering'
      : state.midiEntry?.type === 'parkerize'
      ? 'Parkerize solo'
      : state.midiEntry?.type === 'parker-solo'
      ? 'Parker solo'
      : state.midiEntry?.type === 'wjazzd-solo'
      ? 'Jazz legend solo'
      : soloStudyActive() ? 'Solo study' : '';
    return [state.song.style, key, `${chart?.bars?.length || 0} bars`, solo, source].filter(Boolean).join(' · ');
  }

  function midiUrlsForEntry(entry) {
    if (Array.isArray(entry?.urls) && entry.urls.length) return entry.urls;
    const encodedName = encodeURIComponent(entry.name);
    return MIDITAR_MIDI_BASE_URLS.map(base => `${base}${encodedName}`);
  }

  function installMidiSource(midi, entry = null, { transport = false } = {}) {
    // A matched MIDI can arrive after Stream mode has already begun. Stop and
    // rebuild in that case so the rendered WAV, chord highlighting, and new
    // source timing always stay in sync. Transport-driven random-next loads
    // are between tracks, so their caller starts the new stream afterward.
    const restartStream = state.transport.playing && state.transport.streamMode
      && (!transport || !streamTransport.transitioning);
    if (restartStream) stopChartPlayback({ render: false });
    const melodyTrack = MiditarMidi?.chooseMelodyTrack?.(midi);
    const melodyNotes = buildMelodyNotes(midi, melodyTrack);
    if (!melodyNotes.length) throw new Error('This MIDI has no readable melody track.');
    const chart = buildMidiChart(midi, melodyNotes);
    state.midi = midi;
    state.midiEntry = entry || state.midiEntry;
    state.tabSource = midi?.tabSource || null;
    state.melodyTrack = melodyTrack;
    state.allMelodyNotes = melodyNotes;
    invalidateDerivedHarmony();
    state.midiChart = chart?.bars?.length && chart.playbackOrder.length
      ? createChartData('midi', chart.bars, chart.playbackOrder, {
        explicitTiming: true,
        sourceKey: chart.sourceKey,
        tempoBpm: chart.tempoBpm
      })
      : null;
    const studyTiming = isSoloStudyEntry(state.midiEntry);
    state.midiChoruses = studyTiming ? midiChorusesForNotes(melodyNotes) : [];
    state.midiChorusIndex = state.midiChoruses.length > 1 && state.preferSoloChorus ? 1 : 0;
    state.melodyNotes = state.midiChoruses[state.midiChorusIndex]?.notes || melodyNotes;
    // Solo studies intentionally use the iReal form for harmony so the
    // selected chorus can loop against the chart and audible accompaniment.
    state.melodyOverlayChartId = studyTiming ? 'ireal' : state.midiChart ? 'midi' : 'ireal';
    setMelodyVisibility(true);
    activateChartSource(state.melodyOverlayChartId, { transport: true });
    elements.songMeta.textContent = songMetaText();
    syncMidiChorusControl();
    syncMidiSourceStatus();
    // A MIDI file may finish loading after the chart itself. Pre-render its
    // final voicings while stopped so the next Play tap has a ready asset.
    if (state.transport.streamMode && !state.transport.playing) void prepareStreamAsset();
    if (restartStream) startChartPlayback();
  }

  async function loadMatchedMiditarMidi(entry = state.midiEntry, expectedSong = state.song, { transport = false } = {}) {
    if (!MiditarMidi) throw new Error('The MIDI melody reader did not load.');
    if (!entry) throw new Error('No matching melody MIDI was found.');
    elements.toggleMelody.disabled = true;
    const studyName = entry.type === 'parker-solo' ? 'Parker solo'
      : entry.type === 'wjazzd-solo' ? `${entry.performer || 'jazz legend'} solo`
      : 'melody';
    elements.midiStatus.textContent = `Loading ${studyName} MIDI for ${entry.title}…`;
    try {
      const buffer = await fetchFirst(midiUrlsForEntry(entry), 'arrayBuffer');
      // Random can be pressed while another melody download is in flight.
      // Never install the earlier song's MIDI on the new chart.
      if (state.song !== expectedSong || state.midiEntry !== entry) return false;
      installMidiSource(MiditarMidi.parseMidi(buffer, entry.name), entry, { transport });
      return true;
    } finally {
      elements.toggleMelody.disabled = false;
      syncMidiSourceStatus();
    }
  }

  async function requestMidiSource({ showAfterLoad = false, transport = false } = {}) {
    try {
      if (!MiditarMidi) throw new Error('The MIDI melody reader did not load.');
      if (state.midi) {
        if (state.midiChart && state.chartSource !== 'midi' && !isSoloStudyEntry()) activateChartSource('midi');
        if (showAfterLoad) {
          setMelodyVisibility(true);
          resetMelodySelection();
          renderStudy({ keepVisible: false });
        }
        return;
      }
      if (state.midiEntry) {
        await loadMatchedMiditarMidi(state.midiEntry, state.song, { transport });
        return;
      }
      elements.midiStatus.textContent = 'No matching melody MIDI is available for this standard.';
    } catch (error) {
      console.error(error);
      elements.midiStatus.textContent = error?.message || 'Could not load this MIDI source.';
    }
  }

  async function toggleMelody() {
    const restartStream = state.transport.playing && state.transport.streamMode;
    if (restartStream) stopChartPlayback({ render: false });
    if (state.showMelody) {
      setMelodyVisibility(false);
      resetMelodySelection();
      renderStudy({ keepVisible: false });
      if (restartStream) startChartPlayback();
      return;
    }
    setMelodyVisibility(true);
    await requestMidiSource({ showAfterLoad: true });
    if (restartStream) startChartPlayback();
  }

  async function loadCatalog() {
    if (state.loading) return;
    state.loading = true;
    elements.errorCard.hidden = true;
    elements.libraryStatus.textContent = 'Loading jazz standards…';
    elements.randomSong.disabled = true;
    try {
      if (!Theory || !IReal || typeof IReal.parsePlaylist !== 'function' || !Parkerize) throw new Error('The standards parser did not load.');
      const text = await fetchCatalog();
      elements.libraryStatus.textContent = 'Reading chart forms and chord symbols…';
      await new Promise(resolve => requestAnimationFrame(resolve));
      const parsed = IReal.parsePlaylist(text);
      const catalogSongs = Array.isArray(parsed) ? parsed : parsed?.songs || [];
      const supplementalParkerSongs = typeof SoloCatalog?.parkerSupplementalSongs === 'function'
        ? SoloCatalog.parkerSupplementalSongs()
        : [];
      const knownTitles = new Set(catalogSongs.map(song => safeText(song?.title).toLocaleLowerCase()));
      state.songs = [...catalogSongs, ...supplementalParkerSongs.filter(song => !knownTitles.has(safeText(song?.title).toLocaleLowerCase()))];
      state.azMidiSongs = (AzMidiCatalog?.playableEntries || []).map(entry => {
        const midiEntry = {
          ...entry,
          name: entry.file,
          type: 'az-midi',
          sourceLabel: 'A–Z MIDI bank',
          sourceUrl: 'https://github.com/santismo/Keyer/tree/main/a-z-midi',
          urls: [`a-z-midi/${encodeURIComponent(entry.file)}`]
        };
        return {
          title: entry.title,
          composer: 'A–Z MIDI bank',
          style: `MIDI chart · ${entry.chordMarkers} chord markers`,
          key: '',
          bpm: entry.bpm,
          bars: [],
          playbackOrder: [],
          azMidiEntry: midiEntry
        };
      });
      state.legendSoloSongs = (WJazzDSoloCatalog?.entries || []).map(entry => {
        const midiEntry = {
          ...entry,
          name: entry.name || `${entry.performer || 'Jazz legend'} — ${entry.title}.mid`,
          type: 'wjazzd-solo',
          sourceLabel: `WJazzD · ${entry.performer || 'Jazz legend'}`,
          sourceUrl: WJazzDSoloCatalog?.sourceUrl || 'https://jazzomat.hfm-weimar.de/download/download.html',
          urls: [`jazz-solo-midi/wjazzd/${encodeURIComponent(entry.file)}`]
        };
        return {
          title: entry.title,
          composer: entry.performer || 'Jazz legend',
          style: [entry.style, 'WJazzD solo transcription'].filter(Boolean).join(' · '),
          key: entry.key || '',
          bpm: Number(entry.bpm) || DEFAULT_TEMPO,
          bars: [],
          playbackOrder: [],
          wjazzdSoloEntry: midiEntry,
          wjazzdChartTiming: true
        };
      });
      state.tabSongs = (TabLibraryCatalog?.entries || []).map(tabSongForCatalogEntry);
      if (!state.songs.length) throw new Error('No readable standards were found in the catalog.');
      state.songs.sort((a, b) => safeText(a.title).localeCompare(safeText(b.title), undefined, { sensitivity: 'base' }));
      const legendHarmonySongs = state.legendSoloSongs.map(song => ({
        ...song,
        bars: inflateWJazzdBars(song.wjazzdSoloEntry),
        playbackOrder: song.wjazzdSoloEntry.playbackOrder || song.wjazzdSoloEntry.chart.map((_, index) => index)
      }));
      state.parkerize.corpus = Parkerize.learnHarmonyCorpus([...state.songs, ...legendHarmonySongs]);
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

  function resumeAudioContext(context = audioContext) {
    if (!context || context.state === 'closed' || context.state === 'running') return Promise.resolve(context);
    if (audioResumePromise) return audioResumePromise;
    // Keep one resume in flight. iOS can fire several route/focus events while
    // it hands audio over to a car or Bluetooth receiver.
    audioResumePromise = context.resume()
      .catch(() => null)
      .finally(() => { audioResumePromise = null; });
    return audioResumePromise;
  }

  function recoverAudioOutput() {
    if (document.visibilityState === 'hidden') return;
    requestPlaybackAudioSession();
    const streamAudio = streamTransport.audio;
    if (state.transport.playing && state.transport.streamMode) {
      if (streamAudio?.paused && !streamAudio.ended
        && !streamTransport.waitingForGesture && !streamTransport.transitioning) {
        void streamAudio.play().catch(() => {});
      }
      // A Stream session is media-element playback. Do not wake the old live
      // Web Audio graph underneath it while iOS is changing output routes.
      return;
    }
    if (!audioContext || audioContext.state === 'running') return;
    void resumeAudioContext(audioContext);
  }

  function requestPlaybackAudioSession() {
    // Safari 17+ exposes this small part of the iOS audio-session API. It is
    // safe to ignore elsewhere, but asking for media playback prevents a web
    // synth from being treated like a transient interactive sound route.
    const session = navigator?.audioSession;
    if (!session || !('type' in session)) return;
    try { session.type = 'playback'; } catch (_) {}
  }

  function streamModeAvailable() {
    const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    return Boolean(OfflineAudioContextClass && window.Audio && window.Blob && window.URL?.createObjectURL);
  }

  function streamModeDescription() {
    if (!streamModeAvailable()) return 'Stream mode is unavailable in this browser; normal playback will be used.';
    if (!state.transport.streamMode) return 'Use a single stable rendered audio stream for car and Bluetooth playback.';
    if (streamTransport.rendering) return 'Preparing this chart as one stable audio stream. Tap Stop chart to cancel.';
    if (streamTransport.transitioning) return 'Loading the next chart as a stable audio stream.';
    if (streamTransport.waitingForGesture) return 'Stream is ready. Tap Play chart once more to begin media playback.';
    if (streamTransport.error) return `Stream mode could not prepare this chart: ${streamTransport.error}`;
    return 'Stream mode is on. It stays on for repeats and the next chart.';
  }

  function normalizeStreamVisualDelayMs(value) {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? parsed : DEFAULT_STREAM_VISUAL_DELAY_MS;
    const clamped = Math.max(STREAM_VISUAL_DELAY_MIN_MS, Math.min(STREAM_VISUAL_DELAY_MAX_MS, safeValue));
    return Math.round(clamped / STREAM_VISUAL_DELAY_STEP_MS) * STREAM_VISUAL_DELAY_STEP_MS;
  }

  function streamVisualDelayLabel(value = state.transport.streamVisualDelayMs) {
    const milliseconds = normalizeStreamVisualDelayMs(value);
    if (!milliseconds) return 'Off';
    if (milliseconds < 1000) return `${milliseconds} ms`;
    return `${(milliseconds / 1000).toFixed(milliseconds % 1000 ? 2 : 0)} s`;
  }

  function syncStreamModeControl() {
    if (!elements.streamMode) return;
    const available = streamModeAvailable();
    elements.streamMode.checked = Boolean(state.transport.streamMode && available);
    elements.streamMode.disabled = !available;
    elements.streamMode.setAttribute('aria-label', available
      ? state.transport.streamMode
        ? 'Turn off Stream mode and use normal live playback'
        : 'Turn on Stream mode for stable car and Bluetooth playback'
      : 'Stream mode is unavailable in this browser');
    const label = elements.streamMode.closest('label');
    if (label) label.title = streamModeDescription();
  }

  function syncStreamVisualDelayControl() {
    if (!elements.streamVisualDelay) return;
    const available = streamModeAvailable();
    const enabled = available && state.transport.streamMode;
    const delay = normalizeStreamVisualDelayMs(state.transport.streamVisualDelayMs);
    state.transport.streamVisualDelayMs = delay;
    elements.streamVisualDelay.value = String(delay);
    elements.streamVisualDelay.disabled = !enabled;
    elements.streamVisualDelay.setAttribute('aria-label', enabled
      ? `Delay Stream mode visuals by ${streamVisualDelayLabel(delay)} to match car or Bluetooth audio`
      : 'Turn on Stream mode to adjust visual sync delay');
    if (elements.streamVisualDelayValue) elements.streamVisualDelayValue.textContent = streamVisualDelayLabel(delay);
    const label = elements.streamVisualDelay.closest('label');
    if (label) {
      label.title = enabled
        ? 'Delays chord and melody highlighting only, so the display can match your car or Bluetooth audio latency.'
        : 'Turn on Stream mode to adjust visual sync delay.';
    }
  }

  function updateStreamMediaSession(playing = false) {
    if (!navigator?.mediaSession) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: state.song?.title || 'Keyer chart',
        artist: state.song?.composer || 'Keyer',
        album: 'Keyer Song Mode'
      });
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    } catch (_) {}
  }

  function streamAudioElement() {
    if (streamTransport.audio) return streamTransport.audio;
    const audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.tabIndex = -1;
    audio.style.cssText = 'position:fixed;inline-size:1px;block-size:1px;opacity:0;pointer-events:none;';
    audio.setAttribute('playsinline', '');
    audio.setAttribute('x-webkit-airplay', 'allow');
    audio.setAttribute('aria-hidden', 'true');
    audio.addEventListener('ended', handleStreamEnded);
    document.body.appendChild(audio);
    streamTransport.audio = audio;
    return audio;
  }

  function waitForStreamMediaReady(audio) {
    if (!audio) return Promise.resolve(false);
    if (Number(audio.readyState) >= 3) return Promise.resolve(true);
    return new Promise(resolve => {
      let settled = false;
      let timeoutId = 0;
      const cleanUp = () => {
        audio.removeEventListener('canplay', ready);
        audio.removeEventListener('loadeddata', ready);
        audio.removeEventListener('error', failed);
        if (timeoutId) window.clearTimeout(timeoutId);
      };
      const finish = readyToPlay => {
        if (settled) return;
        settled = true;
        cleanUp();
        resolve(Boolean(readyToPlay));
      };
      const ready = () => {
        if (Number(audio.readyState) >= 3) finish(true);
      };
      const failed = () => finish(false);
      audio.addEventListener('canplay', ready);
      audio.addEventListener('loadeddata', ready);
      audio.addEventListener('error', failed);
      timeoutId = window.setTimeout(() => finish(Number(audio.readyState) >= 2), STREAM_MEDIA_READY_TIMEOUT_MS);
      ready();
    });
  }

  function stopStreamVisualLoop() {
    if (streamTransport.rafId) window.cancelAnimationFrame(streamTransport.rafId);
    streamTransport.rafId = 0;
    streamTransport.lastVisualBeat = -1;
    streamTransport.lastVisualAudioTime = 0;
    streamTransport.visualLoopOffsetSeconds = 0;
  }

  function stopStreamPlayback() {
    stopStreamVisualLoop();
    streamTransport.transitioning = false;
    const audio = streamTransport.audio;
    if (!audio) return;
    try { audio.pause(); } catch (_) {}
    updateStreamMediaSession(false);
  }

  function invalidateStreamAsset() {
    const stream = streamTransport;
    stream.generation += 1;
    stream.readyKey = '';
    stream.preparingKey = '';
    stream.preparePromise = null;
    stream.rendering = false;
    stream.error = '';
    stream.waitingForGesture = false;
    stream.session = 0;
    stream.secondsPerBeat = 0;
    stream.chartEndBeat = 0;
    stopStreamVisualLoop();
    const audio = stream.audio;
    if (audio) {
      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch (_) {}
    }
    if (stream.objectUrl) {
      try { URL.revokeObjectURL(stream.objectUrl); } catch (_) {}
    }
    stream.objectUrl = '';
    updateStreamMediaSession(false);
  }

  function ensureAudio({ resume = true } = {}) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (audioContext?.state === 'closed') {
      audioContext = null;
      audioInput = null;
      audioKeepAlive = null;
    }
    if (!audioContext) {
      // "playback" trades a few milliseconds of touch latency for a larger,
      // steadier render buffer. That is the useful tradeoff for long MIDI
      // charts sent through higher-latency car and Bluetooth routes.
      try {
        audioContext = new AudioContextClass({ latencyHint: AUDIO_LATENCY_HINT });
      } catch (_) {
        // Older WebKit versions accept only the no-argument constructor.
        audioContext = new AudioContextClass();
      }
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
      // Keep a virtually silent source connected between chart events. Some
      // iOS external-output routes aggressively idle a graph made entirely of
      // short oscillators, which can make sustained MIDI playback drop in and
      // out. This is below audibility but keeps the audio route alive.
      const keepAliveSource = audioContext.createConstantSource();
      const keepAliveGain = audioContext.createGain();
      keepAliveGain.gain.value = .00001;
      keepAliveSource.connect(keepAliveGain);
      keepAliveGain.connect(master);
      keepAliveSource.start();
      audioKeepAlive = { source: keepAliveSource, gain: keepAliveGain };
      const context = audioContext;
      context.addEventListener('statechange', () => {
        if (context !== audioContext || context.state === 'running' || !state.transport.playing) return;
        recoverAudioOutput();
      });
    }
    if (resume && audioContext.state !== 'running') void resumeAudioContext(audioContext);
    return audioContext;
  }

  function streamRenderKey() {
    const tempo = Math.round(currentTempo() * 1000) / 1000;
    const timeline = state.timeline.map(entry => {
      const event = Number.isInteger(entry.eventIndex) ? state.events[entry.eventIndex] : null;
      // Timing IDs are intentionally stable across reharmonization. Include
      // the sounding symbol too, so a cached WAV can never survive a harmony
      // change that keeps the same form and bar timing.
      const chord = event?.chord?.raw || event?.chord?.display || '';
      return [
        entry.type,
        entry.id,
        entry.eventIndex,
        entry.startBeat,
        entry.endBeat,
        entry.durationBeats,
        chord
      ].join(':');
    }).join('|');
    // Melody notes also shape fitted accompaniment voicings, even when their
    // own audio is muted. Keep them in the key so a newly loaded study cannot
    // reuse a stream rendered against an earlier melody line.
    const melody = melodyMatchesChart()
      ? state.melodyNotes.map(note => {
        const tab = tabPositionsForNote(note).map(position => `${position.trackIndex}:${position.stringIndex}:${position.fret}:${position.midi}`).join(',');
        return [note.id, note.midi, note.startBeat, note.endBeat, note.durationBeats, tab].join(':');
      }).join('|')
      : '';
    return [
      STREAM_RENDER_VERSION,
      state.song?.title || '',
      state.song?.composer || '',
      state.chartSource,
      state.reharmLevel,
      tempo,
      state.instrumentView,
      state.pianoVoicingStyle,
      state.guitarVoicingStyle,
      state.fretboardPositionAnchor ?? '',
      Boolean(state.showMelody),
      Boolean(state.transport.playMelody),
      state.tabSource?.trackIndex ?? '',
      state.tabSource?.displayTrackIndex ?? '',
      state.tabSession?.playAllTracks ?? '',
      timeline,
      melody
    ].join('\u0001');
  }

  function streamChordVoicingForEvent(event, eventIndex) {
    if (!event?.chord || state.tabSource?.exactPositions) return [];
    const nextEvent = state.events[eventIndex + 1] || null;
    const scale = scaleForEvent(event, nextEvent);
    const melody = melodyNotesDuringEvent(event);
    if (state.instrumentView !== 'fretboard' || soloStudyActive()) {
      return pianoVoicingForChord(event.chord, scale, melody);
    }
    // The normal live fretboard player uses a planned guitar grip instead of
    // the piano voicing. Build the same plan without rendering a DOM frame so
    // the rendered stream keeps the chosen guitar sound/register.
    const priorIndex = state.activeIndex;
    try {
      state.activeIndex = eventIndex;
      const plan = guitarChordMelodyPlan(event);
      return [...(plan?.notes?.entries?.() || [])]
        .filter(([, note]) => note && !note.melody && note.kind !== 'melody')
        .map(([, note]) => ({
          ...note,
          midi: Number(note.sourceMidi ?? note.midi)
        }))
        .filter(note => Number.isFinite(note.midi))
        .sort((left, right) => left.midi - right.midi);
    } finally {
      state.activeIndex = priorIndex;
    }
  }

  function scheduleStreamVoice(context, destination, midi, startTime, duration) {
    const pitch = Number(midi);
    if (!Number.isFinite(pitch)) return;
    const start = Math.max(0, Number(startTime) || 0);
    const hold = Math.max(.032, Number(duration) || .032);
    const end = start + hold;
    const attack = Math.min(.014, Math.max(.006, hold * .3));
    const release = Math.min(.2, Math.max(.014, hold * .23));
    const releaseStart = Math.max(start + attack + .003, end - release);
    const settle = Math.min(start + .55, releaseStart);
    const oscillator = context.createOscillator();
    const color = context.createOscillator();
    const colorGain = context.createGain();
    const envelope = context.createGain();
    const frequency = 440 * (2 ** ((pitch - 69) / 12));
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency;
    color.type = 'sine';
    color.frequency.value = frequency * 2;
    colorGain.gain.value = .1;
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(.13, start + attack);
    envelope.gain.exponentialRampToValueAtTime(.07, settle);
    envelope.gain.setValueAtTime(.07, releaseStart);
    envelope.gain.exponentialRampToValueAtTime(.0001, end);
    oscillator.connect(envelope);
    color.connect(colorGain);
    colorGain.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    color.start(start);
    oscillator.stop(end + .01);
    color.stop(end + .01);
  }

  function renderOfflineContext(context) {
    return new Promise((resolve, reject) => {
      let complete = false;
      const finish = buffer => {
        if (complete) return;
        complete = true;
        resolve(buffer);
      };
      context.oncomplete = event => finish(event.renderedBuffer);
      try {
        const rendered = context.startRendering();
        if (rendered?.then) rendered.then(finish, reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  function audioBufferToWavBlob(buffer) {
    const channels = Math.max(1, buffer.numberOfChannels || 1);
    const frames = Math.max(0, buffer.length || 0);
    const bytesPerSample = 2;
    const bytesPerFrame = channels * bytesPerSample;
    const bytes = new ArrayBuffer(44 + frames * bytesPerFrame);
    const view = new DataView(bytes);
    const writeText = (offset, text) => {
      for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
    };
    writeText(0, 'RIFF');
    view.setUint32(4, 36 + frames * bytesPerFrame, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * bytesPerFrame, true);
    view.setUint16(32, bytesPerFrame, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeText(36, 'data');
    view.setUint32(40, frames * bytesPerFrame, true);
    const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
    let offset = 44;
    for (let frame = 0; frame < frames; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = Math.max(-1, Math.min(1, data[channel][frame] || 0));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += bytesPerSample;
      }
    }
    return new Blob([bytes], { type: 'audio/wav' });
  }

  async function renderStreamAudio() {
    const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineAudioContextClass) throw new Error('This browser cannot render an offline audio stream.');
    const finalEntry = state.timeline[state.timeline.length - 1];
    const chartEndBeat = Math.max(0, Number(finalEntry?.endBeat) || 0);
    const secondsPerBeat = 60 / currentTempo();
    const durationSeconds = chartEndBeat * secondsPerBeat + STREAM_RENDER_TAIL_SECONDS;
    if (!chartEndBeat || !Number.isFinite(durationSeconds)) throw new Error('This chart has no playable timeline.');
    if (durationSeconds > STREAM_MAX_SECONDS) throw new Error('This chart is too long to render as one phone-friendly stream.');
    const frameLength = Math.ceil(durationSeconds * STREAM_SAMPLE_RATE);
    const context = new OfflineAudioContextClass(STREAM_CHANNELS, frameLength, STREAM_SAMPLE_RATE);
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 15;
    compressor.ratio.value = 5;
    compressor.attack.value = .006;
    compressor.release.value = .22;
    const master = context.createGain();
    master.gain.value = .56;
    master.connect(compressor);
    compressor.connect(context.destination);

    state.timeline.forEach(entry => {
      if (entry.type !== 'chord' || !Number.isInteger(entry.eventIndex)) return;
      const event = state.events[entry.eventIndex];
      if (!event) return;
      const start = Math.max(0, Number(entry.startBeat) || 0) * secondsPerBeat;
      const reachesChartEnd = Number(entry.endBeat) >= chartEndBeat - .0001;
      const duration = Math.max(.032, (Number(entry.durationBeats) || 0) * secondsPerBeat * (reachesChartEnd ? 1 : .92));
      streamChordVoicingForEvent(event, entry.eventIndex).forEach(note => {
        scheduleStreamVoice(context, master, note.midi, start, duration);
      });
    });

    if (state.transport.playMelody && melodyMatchesChart()) {
      state.melodyNotes.forEach(note => {
        const startBeat = Math.max(0, Number(note.startBeat) || 0);
        if (startBeat >= chartEndBeat - .0001) return;
        const nativeDuration = Number(note.durationBeats)
          || Math.max(0, Number(note.endBeat) - startBeat);
        const durationBeats = Math.max(.06, Math.min(nativeDuration || .06, chartEndBeat - startBeat));
        const midis = tabPositionsForNote(note).map(position => position.midi);
        (midis.length ? midis : [note.midi]).forEach(midi => {
          scheduleStreamVoice(context, master, midi, startBeat * secondsPerBeat, durationBeats * secondsPerBeat * .94);
        });
      });
    }

    const buffer = await renderOfflineContext(context);
    return { buffer, secondsPerBeat, chartEndBeat };
  }

  async function prepareStreamAsset() {
    if (!streamModeAvailable()) {
      streamTransport.error = 'This browser does not support offline media rendering.';
      syncTransportControls();
      return false;
    }
    const key = streamRenderKey();
    if (streamTransport.readyKey === key && streamTransport.objectUrl) return true;
    if (streamTransport.rendering && streamTransport.preparingKey === key && streamTransport.preparePromise) {
      return streamTransport.preparePromise;
    }
    invalidateStreamAsset();
    const generation = streamTransport.generation;
    streamTransport.rendering = true;
    streamTransport.preparingKey = key;
    streamTransport.error = '';
    streamTransport.waitingForGesture = false;
    syncTransportControls();
    const work = (async () => {
      let url = '';
      try {
        const rendered = await renderStreamAudio();
        if (generation !== streamTransport.generation || streamTransport.preparingKey !== key) return false;
        url = URL.createObjectURL(audioBufferToWavBlob(rendered.buffer));
        const audio = streamAudioElement();
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.src = url;
          audio.load();
        } catch (error) {
          URL.revokeObjectURL(url);
          throw error;
        }
        const mediaReady = await waitForStreamMediaReady(audio);
        if (generation !== streamTransport.generation || streamTransport.preparingKey !== key) {
          URL.revokeObjectURL(url);
          return false;
        }
        if (!mediaReady) throw new Error('The rendered stream did not become ready for playback.');
        streamTransport.objectUrl = url;
        streamTransport.readyKey = key;
        streamTransport.secondsPerBeat = rendered.secondsPerBeat;
        streamTransport.chartEndBeat = rendered.chartEndBeat;
        return true;
      } catch (error) {
        if (generation === streamTransport.generation) {
          const audio = streamTransport.audio;
          try {
            audio?.pause();
            audio?.removeAttribute('src');
            audio?.load();
          } catch (_) {}
          if (url) {
            try { URL.revokeObjectURL(url); } catch (_) {}
          }
          streamTransport.error = safeText(error?.message) || 'Could not render this chart.';
        }
        return false;
      } finally {
        if (generation === streamTransport.generation && streamTransport.preparingKey === key) {
          streamTransport.rendering = false;
          streamTransport.preparingKey = '';
          streamTransport.preparePromise = null;
          syncTransportControls();
        }
      }
    })();
    streamTransport.preparePromise = work;
    return work;
  }

  function streamTimelineEntryAtBeat(beat) {
    const target = Math.max(0, Number(beat) || 0);
    return state.timeline.find(entry => (
      target >= Number(entry.startBeat) - .0001
      && target < Number(entry.endBeat) - .0001
    )) || state.timeline[state.timeline.length - 1] || null;
  }

  function streamMelodyAtBeat(beat) {
    if (!state.transport.playMelody || !melodyMatchesChart()) return null;
    const target = Math.max(0, Number(beat) || 0);
    return state.melodyNotes.find(note => (
      target >= Number(note.startBeat) - .0001
      && target < Number(note.endBeat) - .0001
    )) || null;
  }

  function syncStreamVisuals(session, force = false) {
    if (!transportSessionActive(session) || streamTransport.session !== session) return;
    // A MIDI source or synthesis setting may finish changing after this WAV
    // was prepared. Never let the media keep running against a new chart;
    // the setting handler will restart Stream mode with a fresh render.
    if (streamTransport.readyKey !== streamRenderKey()) {
      stopChartPlayback({ render: false });
      return;
    }
    const audio = streamTransport.audio;
    const secondsPerBeat = streamTransport.secondsPerBeat;
    if (!audio || !Number.isFinite(secondsPerBeat) || secondsPerBeat <= 0) return;
    const maxBeat = Math.max(0, streamTransport.chartEndBeat - .0001);
    const audioSeconds = Math.max(0, Number(audio.currentTime) || 0);
    const chartSeconds = Math.max(0, streamTransport.chartEndBeat * secondsPerBeat);
    // Native media looping resets currentTime to zero. Keep a monotonic visual
    // clock across that boundary so a user-selected delay continues showing
    // the tail of the previous repeat while CarPlay/Bluetooth drains it.
    if (audio.loop && chartSeconds > 0 && audioSeconds + .05 < streamTransport.lastVisualAudioTime) {
      streamTransport.visualLoopOffsetSeconds += chartSeconds;
    }
    streamTransport.lastVisualAudioTime = audioSeconds;
    const delayedSeconds = Math.max(0,
      audioSeconds + streamTransport.visualLoopOffsetSeconds - state.transport.streamVisualDelayMs / 1000
    );
    const visualSeconds = audio.loop && chartSeconds > 0 ? delayedSeconds % chartSeconds : delayedSeconds;
    const beat = Math.min(maxBeat, visualSeconds / secondsPerBeat);
    const entry = streamTimelineEntryAtBeat(beat);
    let changed = force;
    if (entry && Number.isInteger(entry.eventIndex) && state.activeIndex !== entry.eventIndex) {
      state.activeIndex = entry.eventIndex;
      state.activeAlternateCellId = null;
      state.activeAlternateIndex = -1;
      changed = true;
    }
    const note = streamMelodyAtBeat(beat);
    if ((state.activeMelodyNote?.id || '') !== (note?.id || '')) {
      state.activeMelodyNote = note;
      const activeNotes = melodyNotesForEvent(activeChartEvent());
      const cursor = note ? activeNotes.findIndex(candidate => candidate.id === note.id) : -1;
      if (cursor >= 0) {
        state.melodyCursor = cursor;
        state.melodyCursorEventKey = melodyEventKey(activeChartEvent());
      }
      changed = true;
    }
    if (changed) renderStudy({ keepVisible: false });
    streamTransport.lastVisualBeat = beat;
  }

  function startStreamVisualLoop(session) {
    stopStreamVisualLoop();
    streamTransport.lastVisualAudioTime = Math.max(0, Number(streamTransport.audio?.currentTime) || 0);
    let lastSyncTime = 0;
    const tick = timestamp => {
      if (!transportSessionActive(session) || streamTransport.session !== session) return;
      if (!lastSyncTime || timestamp - lastSyncTime >= STREAM_VISUAL_FRAME_INTERVAL_MS) {
        syncStreamVisuals(session);
        lastSyncTime = timestamp;
      }
      if (!transportSessionActive(session) || streamTransport.session !== session) return;
      streamTransport.rafId = window.requestAnimationFrame(tick);
    };
    syncStreamVisuals(session, true);
    streamTransport.rafId = window.requestAnimationFrame(tick);
  }

  function visualTargets(visual = 'all') {
    if (visual === 'none') return [];
    if (visual === 'chord') return ['chord', 'fretboard'];
    if (visual === 'melody') return ['melody', 'fretboard'];
    if (visual === 'fretboard') return ['fretboard'];
    if (visual === 'fretboard-chord') return ['fretboardChord'];
    return ['chord', 'melody', 'fretboard'];
  }

  function fretboardPressedCell(midi, visual, authoredPosition = null) {
    if (authoredPosition && Number.isInteger(Number(authoredPosition.stringIndex)) && Number.isInteger(Number(authoredPosition.fret))) {
      return elements.fretboard?.querySelector(
        `[data-string="${Number(authoredPosition.stringIndex)}"][data-fret="${Number(authoredPosition.fret)}"]`
      );
    }
    const pitchClass = Theory.mod(midi);
    const selector = visual === 'fretboard-chord'
      ? '.fretboard-cell.voicing:not(.melody-tone)'
      : visual === 'chord'
      ? '.fretboard-cell.voicing'
      : visual === 'melody'
      ? '.fretboard-cell.melody-tone'
      : '.fretboard-cell';
    const candidates = [...(elements.fretboard?.querySelectorAll(selector) || [])];
    const shapedCell = candidates.find(cell => Number(cell.dataset.midi) === Number(midi))
      || (visual === 'fretboard-chord' ? null : candidates.find(cell => Theory.mod(Number(cell.dataset.midi)) === pitchClass));
    if (shapedCell) return shapedCell;
    if (visual === 'fretboard-chord') return null;
    const position = fretboardPositionForMidi(midi);
    return position
      ? elements.fretboard?.querySelector(`[data-string="${position.stringIndex}"][data-fret="${position.fret}"]`)
      : null;
  }

  function markPressed(midi, direction, visual = 'all', authoredPosition = null) {
    if (!Number.isFinite(Number(midi))) return;
    visualTargets(visual).forEach(target => {
      const counts = pressedCounts[target];
      const physicalKey = target === 'fretboard' && authoredPosition
        ? `${midi}@${fretboardPositionKey(authoredPosition)}`
        : midi;
      const next = Math.max(0, (counts.get(physicalKey) || 0) + direction);
      if (next) counts.set(physicalKey, next);
      else counts.delete(physicalKey);
      if (target === 'chord') {
        elements.piano?.querySelectorAll(`[data-midi="${midi}"]`).forEach(key => key.classList.toggle('playing', next > 0));
      } else if (target === 'melody') {
        elements.melodyPiano?.querySelectorAll(`[data-midi="${midi}"]`).forEach(key => key.classList.toggle('playing', next > 0));
      } else {
        fretboardPressedCell(midi, visual, authoredPosition)?.classList.toggle('playing', next > 0);
      }
    });
  }

  function armVoiceTimer(id, voice, duration, lead = 0) {
    if (!duration) return;
    voice.timerId = window.setTimeout(() => {
      if (voices.get(id) === voice) stopVoice(id);
    }, (duration + lead) * 1000);
  }

  function startVoice(id, midi, duration = null, displayMidi = midi, visual = 'all', authoredPosition = null) {
    stopVoice(id, true);
    const context = ensureAudio({ resume: false });
    markPressed(displayMidi, 1, visual, authoredPosition);
    if (!context || !audioInput) {
      const voice = { midi, displayMidi, visual, authoredPosition, silent: true, timerId: null };
      voices.set(id, voice);
      armVoiceTimer(id, voice, duration);
      return;
    }
    const voice = { midi, displayMidi, visual, authoredPosition, pending: true, timerId: null };
    voices.set(id, voice);
    const begin = () => {
      if (voices.get(id) !== voice) return;
      // Do not start a source against a paused route: its JavaScript timeout
      // would expire while Web Audio time is frozen, producing the exact
      // chopped/stuttering behavior reported on CarPlay and Bluetooth.
      if (context.state !== 'running') {
        voice.pending = false;
        voice.silent = true;
        armVoiceTimer(id, voice, duration);
        return;
      }
      const now = context.currentTime + AUDIO_START_LEAD_SECONDS;
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
      voice.pending = false;
      voice.envelope = envelope;
      voice.oscillators = [oscillator, color];
      voice.startedAt = now;
      armVoiceTimer(id, voice, duration, AUDIO_START_LEAD_SECONDS);
    };
    if (context.state === 'running') begin();
    else void resumeAudioContext(context).then(begin);
  }

  function stopVoice(id, immediate = false) {
    const voice = voices.get(id);
    if (!voice) return;
    voices.delete(id);
    if (voice.timerId != null) window.clearTimeout(voice.timerId);
    markPressed(voice.displayMidi ?? voice.midi, -1, voice.visual, voice.authoredPosition);
    if (voice.pending || voice.silent || !audioContext || !voice.envelope) return;
    const now = audioContext.currentTime;
    const release = immediate ? .025 : .2;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(.06, now);
    voice.envelope.gain.exponentialRampToValueAtTime(.0001, now + release);
    voice.oscillators.forEach(oscillator => oscillator.stop(now + release + .03));
  }

  function stopReleasedFretboardChordVoices(midis) {
    const released = new Set((midis || []).map(Number).filter(Number.isFinite));
    if (!released.size) return;
    [...voices.entries()].forEach(([id, voice]) => {
      if (voice.visual !== 'fretboard-chord') return;
      if (released.has(Number(voice.displayMidi ?? voice.midi))) stopVoice(id, true);
    });
  }

  function playVoicing(voicing, duration = 1.35, prefix = 'preview', visual = 'chord') {
    if (!voicing.length) return;
    [...voices.keys()].filter(id => String(id).startsWith(`${prefix}-`)).forEach(id => stopVoice(id, true));
    voicing.forEach((note, index) => startVoice(`${prefix}-${index}`, note.midi, duration, note.displayMidi ?? note.midi, visual));
  }

  function currentChordPlayback() {
    // Solo study intentionally removes the visual chord grip. The harmonic
    // accompaniment remains part of playback, including while Frets is open.
    // Imported tabs supply their own notes and use placeholder chart cells only
    // to provide navigation/timing, so never add a synthetic C5 underneath.
    if (state.tabSource?.exactPositions) return { voicing: [], visual: 'chord' };
    if (soloStudyActive()) return { voicing: state.voicing, visual: 'chord' };
    if (state.instrumentView === 'fretboard') {
      return { voicing: state.fretboardVoicing, visual: 'fretboard-chord' };
    }
    return {
      voicing: state.displayVoicing.length ? state.displayVoicing : state.voicing,
      visual: 'chord'
    };
  }

  function playCurrentVoicing(duration = 1.35, prefix = 'preview') {
    const { voicing, visual } = currentChordPlayback();
    if (!voicing.length) return;
    playVoicing(voicing, duration, prefix, visual);
  }

  function melodyNavigationEnabled() {
    return state.showMelody && state.melodyNotes.length > 0 && melodyMatchesChart();
  }

  function setChordNavigationLabel(element, label) {
    element.setAttribute('aria-label', label);
    element.title = label;
  }

  function syncMelodyNavigationLabels(event, suppliedNotes = null) {
    if (!melodyNavigationEnabled()) {
      setChordNavigationLabel(elements.previousChord, 'Previous chord');
      setChordNavigationLabel(elements.nextChord, 'Next chord');
      return;
    }
    const notes = suppliedNotes || melodyNotesForEvent(event);
    const pickup = event?.kind === 'pickup';
    if (!notes.length) {
      setChordNavigationLabel(elements.previousChord, 'Previous chord');
      setChordNavigationLabel(
        elements.nextChord,
        state.melodyNavigationEventKey === melodyEventKey(event)
          ? 'Next chord'
          : pickup ? 'Play pickup melody' : 'Play this chord'
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
      ? pickup ? 'Play pickup melody' : 'Play this chord and first melody note'
      : cursor >= notes.length - 1
        ? nextHasMelody
          ? nextEvent?.kind === 'pickup' ? 'Next pickup melody' : 'Next chord and first melody note'
          : 'Next chord'
        : 'Next melody note';
    const previousLabel = cursor <= 0
      ? previousHasMelody
        ? previousEvent?.kind === 'pickup' ? 'Previous pickup melody' : 'Previous chord’s last melody note'
        : 'Previous chord'
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

  function selectMelodyNavigationEvent(index, direction) {
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
    // Forward entry is a harmony downbeat unless this is the unaccompanied
    // pickup. Reverse entry intentionally lands on the preceding event's
    // final melodic event.
    auditionManualMelodyStep(event, notes, cursor, { playChord: direction > 0 && event?.kind !== 'pickup' });
  }

  function navigateChord(direction) {
    const step = Number(direction) < 0 ? -1 : 1;
    if (!state.events.length) return;
    if (!melodyNavigationEnabled()) {
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

    // The first forward press from a newly selected chord is its
    // downbeat, not a skipped preview. Once that note has sounded, arrows
    // advance or rewind one melody note at a time inside the same chord.
    if (step > 0 && state.melodyNavigationEventKey !== eventKey) {
      if (notes.length) {
        auditionManualMelodyStep(event, notes, cursor, { playChord: event?.kind !== 'pickup' });
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
    selectMelodyNavigationEvent(state.activeIndex + step, step);
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
    stopStreamPlayback();
    [...voices.keys()].filter(id => String(id).startsWith('chart-')).forEach(id => stopVoice(id, true));
    if (wasPlaying) state.activeMelodyNote = null;
    if (render && state.events.length) renderStudy({ keepVisible: false });
    else syncTransportControls();
  }

  function transportSessionActive(session) {
    return state.transport.playing && state.transport.session === session;
  }

  function firstTimelineIndex() {
    return state.timeline.findIndex(entry => entry.type === 'chord' || entry.type === 'pickup');
  }

  function restartChartFromBeginning(session) {
    if (!transportSessionActive(session)) return;
    if (state.transport.streamMode) {
      void restartStreamChartFromBeginning(session);
      return;
    }
    const startIndex = firstTimelineIndex();
    if (startIndex < 0) {
      stopChartPlayback();
      return;
    }
    state.activeIndex = 0;
    state.activeAlternateCellId = null;
    state.activeAlternateIndex = -1;
    resetMelodySelection();
    renderStudy({ keepVisible: false });
    playTimelineEntry(startIndex, session, 60 / currentTempo());
  }

  async function restartStreamChartFromBeginning(session) {
    if (!transportSessionActive(session)) return false;
    const startIndex = firstTimelineIndex();
    if (startIndex < 0) {
      stopChartPlayback();
      return false;
    }
    if (streamTransport.readyKey !== streamRenderKey() || !streamTransport.objectUrl) {
      return startStreamChartPlayback({ session, startIndex, continuation: true });
    }
    const audio = streamAudioElement();
    streamTransport.session = session;
    streamTransport.waitingForGesture = false;
    audio.loop = !state.transport.autoAdvanceRandom;
    const mediaReady = await waitForStreamMediaReady(audio);
    if (!transportSessionActive(session)) return false;
    if (!mediaReady) {
      streamTransport.error = 'The Stream audio was not ready to repeat.';
      stopChartPlayback({ render: false });
      return false;
    }
    try {
      audio.currentTime = 0;
      requestPlaybackAudioSession();
      await audio.play();
    } catch (_) {
      if (transportSessionActive(session)) {
        state.transport.playing = false;
        streamTransport.waitingForGesture = true;
        streamTransport.transitioning = false;
        stopStreamVisualLoop();
        updateStreamMediaSession(false);
        syncTransportControls();
      }
      return false;
    }
    streamTransport.transitioning = false;
    updateStreamMediaSession(true);
    startStreamVisualLoop(session);
    return true;
  }

  function randomAutoplaySong() {
    const eligible = randomSelectionSongs();
    if (!eligible.length) return null;
    const alternatives = eligible.filter(song => song !== state.song);
    const pool = alternatives.length ? alternatives : eligible;
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }

  async function continueWithRandomChart(session) {
    if (!transportSessionActive(session)) return;
    let loaded = false;
    if (parkerizeActive() && state.parkerize.harmonyMode === 'generated') {
      loaded = generateParkerizedChart({ transport: true });
    } else {
      const nextSong = randomAutoplaySong();
      if (!nextSong) {
        restartChartFromBeginning(session);
        return;
      }
      loaded = await loadSong(nextSong, { transport: true, transportSession: session });
    }
    if (!loaded || !transportSessionActive(session)) {
      if (transportSessionActive(session)) stopChartPlayback({ render: false });
      return;
    }
    const startIndex = firstTimelineIndex();
    if (startIndex < 0) {
      restartChartFromBeginning(session);
      return;
    }
    state.activeIndex = 0;
    resetMelodySelection();
    renderStudy({ keepVisible: false });
    if (state.transport.streamMode) {
      // applyLoadedSong intentionally deferred this during a Stream handoff.
      // Wait for the selected MIDI (when one is wanted) so the next WAV is
      // rendered once from the final chart rather than restarting mid-song
      // when a late melody download arrives.
      if (!state.midi && state.midiEntry && (state.showMelody || state.preferSoloChorus)) {
        await requestMidiSource({ showAfterLoad: true, transport: true });
        if (!transportSessionActive(session)) return;
      }
      await startStreamChartPlayback({ session, startIndex, continuation: true });
      return;
    }
    playTimelineEntry(startIndex, session, 60 / currentTempo());
  }

  function continueAfterChart(session) {
    if (!transportSessionActive(session)) return;
    if (state.transport.autoAdvanceRandom) {
      void continueWithRandomChart(session);
      return;
    }
    restartChartFromBeginning(session);
  }

  function handleStreamEnded() {
    const session = streamTransport.session;
    if (!state.transport.streamMode || !transportSessionActive(session) || streamTransport.transitioning) return;
    // Native looping is deliberately owned by the media element. A few WebKit
    // routes can emit an ended event around a loop boundary; never reload the
    // source or restart the Stream session in response to that spurious event.
    if (streamTransport.audio?.loop) return;
    stopStreamVisualLoop();
    state.activeMelodyNote = null;
    if (state.transport.autoAdvanceRandom) {
      // Prevent focus/route recovery from replaying the just-ended asset
      // while the next song and its WAV are being prepared.
      streamTransport.transitioning = true;
      void continueWithRandomChart(session);
      return;
    }
    void restartStreamChartFromBeginning(session);
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
    const authoredPositions = tabPositionsForNote(note);
    if (authoredPositions.length) {
      const visiblePositions = exactTabPositionsForNote(note);
      const positionKey = position => `${position.trackIndex ?? 'unknown'}:${position.stringIndex}:${position.fret}:${position.midi}`;
      const visibleKeys = new Set(visiblePositions.map(positionKey));
      authoredPositions.forEach((position, index) => {
        // A Guitar Pro score can contain lead and rhythm guitars at the same
        // beat.  Sound every selected part, but only light the selected Tab
        // track's authored frets so the diagram remains a readable fingering.
        const visible = visibleKeys.has(positionKey(position));
        startVoice(`${id}-tab-${index}`, position.midi, duration, position.midi, visible ? 'melody' : 'none', visible ? position : null);
      });
      return;
    }
    const displayMidi = foldedMidiForDisplay(note.midi);
    startVoice(id, note.midi, duration, displayMidi == null ? note.midi : displayMidi, 'melody');
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
    if ((entry.type === 'chord' || entry.type === 'pickup') && Number.isInteger(entry.eventIndex)) {
      selectEvent(entry.eventIndex, false, { transport: true });
      const event = activeChartEvent();
      if (event) {
        if (entry.type === 'chord') {
          const duration = Math.max(.06, entry.durationBeats * secondsPerBeat * .92);
          playCurrentVoicing(duration, `chart-chord-${entry.id}`);
        }
        scheduleMelodyForSegment(entry, secondsPerBeat, session);
      }
    } else {
      state.activeMelodyNote = null;
      renderStudy({ keepVisible: false });
      scheduleMelodyForSegment(entry, secondsPerBeat, session);
    }
    const next = state.timeline[timelineIndex + 1];
    if (!next) {
      scheduleTransport(() => continueAfterChart(session), Math.max(.06, entry.durationBeats * secondsPerBeat) * 1000, session);
      return;
    }
    const delayBeats = Math.max(.01, next.startBeat - entry.startBeat);
    scheduleTransport(() => playTimelineEntry(timelineIndex + 1, session, secondsPerBeat), delayBeats * secondsPerBeat * 1000, session);
  }

  function timelineIndexForSelection() {
    const activeIndex = Number(state.activeIndex);
    if (!Number.isInteger(activeIndex)) return state.timeline.findIndex(entry => entry.type === 'chord');
    const directMatch = state.timeline.findIndex(entry => (
      Number(entry?.eventIndex) === activeIndex
      && (entry.type === 'chord' || entry.type === 'pickup')
    ));
    if (directMatch >= 0) return directMatch;
    const mapped = state.timelineByEventIndex.get(activeIndex);
    if (mapped) {
      const byReference = state.timeline.indexOf(mapped);
      if (byReference >= 0) return byReference;
      const byIdentity = state.timeline.findIndex(entry => (
        entry.id === mapped.id
        && Number(entry.startBeat) === Number(mapped.startBeat)
        && Number(entry.endBeat) === Number(mapped.endBeat)
      ));
      if (byIdentity >= 0) return byIdentity;
    }
    return state.timeline.findIndex(entry => entry.type === 'chord');
  }

  async function startStreamChartPlayback({ session = null, startIndex = null, continuation = false, attempt = 0 } = {}) {
    if (!state.timeline.length) return;
    if (!streamModeAvailable()) {
      state.transport.streamMode = false;
      try { localStorage.removeItem(STREAM_MODE_STORAGE_KEY); } catch (_) {}
      syncTransportControls();
      if (continuation) {
        const fallbackStartIndex = Number.isInteger(startIndex) ? startIndex : firstTimelineIndex();
        stopChartPlayback({ render: false });
        startLiveChartPlayback({ startIndex: fallbackStartIndex });
      } else {
        startLiveChartPlayback();
      }
      return false;
    }
    if (!Number.isInteger(startIndex)) startIndex = continuation ? firstTimelineIndex() : timelineIndexForSelection();
    if (startIndex < 0) return;
    if (!continuation) {
      if (state.transport.playMelody && melodyMatchesChart()) setMelodyVisibility(true, { persist: false });
      state.activeMelodyNote = null;
      state.transport.playing = true;
      state.transport.session += 1;
      session = state.transport.session;
    } else if (!transportSessionActive(session)) {
      return false;
    }
    if (!transportSessionActive(session)) return false;
    renderStudy({ keepVisible: false });
    const ready = await prepareStreamAsset();
    if (!transportSessionActive(session)) return false;
    if (!ready) {
      // A generation can become stale while a MIDI source is resolving. Retry
      // that race once or twice, but never quietly fall back to the live Web
      // Audio scheduler while Stream mode is latched on.
      if (!streamTransport.error && attempt < 2) {
        return startStreamChartPlayback({ session, startIndex, continuation: true, attempt: attempt + 1 });
      }
      streamTransport.error ||= 'Could not prepare this chart as a stable media stream.';
      stopChartPlayback({ render: false });
      return false;
    }
    // A MIDI download or a setting change can complete while OfflineAudioContext
    // is rendering. Render again from the final state instead of starting an
    // asset whose notes no longer match the displayed chart.
    if (streamTransport.readyKey !== streamRenderKey()) {
      if (attempt < 2) {
        return startStreamChartPlayback({ session, startIndex, continuation: true, attempt: attempt + 1 });
      }
      streamTransport.error = 'The chart changed while its Stream audio was preparing.';
      stopChartPlayback({ render: false });
      return false;
    }
    const entry = state.timeline[startIndex] || state.timeline[firstTimelineIndex()];
    const audio = streamAudioElement();
    streamTransport.session = session;
    streamTransport.waitingForGesture = false;
    streamTransport.error = '';
    audio.loop = !state.transport.autoAdvanceRandom;
    audio.playbackRate = 1;
    const startSeconds = Math.max(0, Number(entry?.startBeat) || 0) * streamTransport.secondsPerBeat;
    try {
      audio.currentTime = startSeconds;
      requestPlaybackAudioSession();
      await audio.play();
    } catch (_) {
      if (transportSessionActive(session)) {
        state.transport.playing = false;
        streamTransport.waitingForGesture = true;
        streamTransport.transitioning = false;
        stopStreamVisualLoop();
        updateStreamMediaSession(false);
        syncTransportControls();
      }
      return false;
    }
    streamTransport.transitioning = false;
    updateStreamMediaSession(true);
    startStreamVisualLoop(session);
    return true;
  }

  function startLiveChartPlayback({ startIndex = null } = {}) {
    if (!state.timeline.length) return;
    const timelineIndex = Number.isInteger(startIndex) ? startIndex : timelineIndexForSelection();
    if (timelineIndex < 0) return;
    if (state.transport.playMelody && melodyMatchesChart()) setMelodyVisibility(true, { persist: false });
    state.activeMelodyNote = null;
    state.transport.playing = true;
    state.transport.session += 1;
    const session = state.transport.session;
    const secondsPerBeat = 60 / currentTempo();
    renderStudy({ keepVisible: false });
    const begin = () => {
      if (!state.transport.playing || state.transport.session !== session) return;
      playTimelineEntry(timelineIndex, session, secondsPerBeat);
    };
    // Start from the click gesture, then wait for a suspended browser audio
    // context before scheduling the MIDI timeline. This prevents a first
    // timer tick from being silently lost while an audio context wakes up.
    const context = ensureAudio({ resume: false });
    if (context && context.state !== 'running') {
      resumeAudioContext(context).then(begin, begin);
    } else {
      begin();
    }
  }

  function startChartPlayback() {
    if (!state.timeline.length) return;
    if (state.transport.playing) {
      stopChartPlayback();
      return;
    }
    requestPlaybackAudioSession();
    if (state.transport.streamMode) {
      void startStreamChartPlayback();
      return;
    }
    startLiveChartPlayback();
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

  elements.search.addEventListener('pointerdown', event => {
    if (document.activeElement === elements.search || state.searchPickerPrimed) {
      state.searchPickerPrimed = false;
      return;
    }
    // On touch devices the first tap is a browse gesture: show the song list
    // without focusing the input and bringing up the software keyboard.
    event.preventDefault();
    state.searchPickerPrimed = true;
    renderSearchResults();
  });
  elements.search.addEventListener('focus', () => {
    state.searchPickerPrimed = false;
    renderSearchResults();
  });
  elements.search.addEventListener('input', () => { state.searchIndex = -1; renderSearchResults(); });
  elements.songAvailabilityFilter?.addEventListener('change', () => {
    state.songAvailabilityFilter = ['favorites', 'melody', 'chords', 'solos', 'parker', 'legends', 'az-midi', 'tab-files', 'parkerize'].includes(elements.songAvailabilityFilter.value)
      ? elements.songAvailabilityFilter.value
      : 'all';
    state.parkerize.active = state.songAvailabilityFilter === 'parkerize';
    state.searchIndex = -1;
    syncParkerizePanel();
    if (parkerizeActive()) {
      setMelodyVisibility(true, { persist: false });
      if (state.parkerize.harmonyMode === 'generated') generateParkerizedChart();
      else if (state.song?.parkerizeGenerated && state.parkerize.baseSong) void loadSong(state.parkerize.baseSong);
      else installParkerizedSolo();
    }
    renderSearchResults();
  });
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
    if (!event.target.closest('.search-wrap')) {
      state.searchPickerPrimed = false;
      hideSearchResults();
    }
  });
  elements.randomSong.addEventListener('click', () => {
    if (parkerizeActive() && state.parkerize.harmonyMode === 'generated') {
      generateParkerizedChart();
      return;
    }
    const songs = randomSelectionSongs();
    if (!songs.length) return;
    loadSong(songs[Math.floor(Math.random() * songs.length)]);
  });
  elements.openTabFile?.addEventListener('click', () => { elements.tabFileInput?.click(); });
  elements.tabFileInput?.addEventListener('change', event => {
    const file = event.target?.files?.[0];
    event.target.value = '';
    if (!file) return;
    elements.libraryStatus.textContent = `Opening ${file.name}…`;
    void loadLocalTabFile(file).catch(error => {
      console.error(error);
      elements.libraryStatus.textContent = error?.message || `Could not open ${file.name}.`;
    });
  });
  elements.tabTrack?.addEventListener('change', () => { selectTabTrack(elements.tabTrack.value); });
  elements.tabPlayAllTracks?.addEventListener('change', () => { setTabPlayAllTracks(elements.tabPlayAllTracks.checked); });
  elements.parkerizeHarmonyMode?.addEventListener('change', () => {
    state.parkerize.harmonyMode = elements.parkerizeHarmonyMode.value === 'generated' ? 'generated' : 'standard';
    try { localStorage.setItem(PARKERIZE_HARMONY_STORAGE_KEY, state.parkerize.harmonyMode); } catch (_) {}
    syncParkerizePanel();
    syncTransportControls();
    if (!parkerizeActive()) return;
    if (state.parkerize.harmonyMode === 'generated') generateParkerizedChart();
    else if (state.song?.parkerizeGenerated && state.parkerize.baseSong) void loadSong(state.parkerize.baseSong);
    else installParkerizedSolo();
  });
  elements.parkerizeChartComplexity?.addEventListener('input', () => {
    state.parkerize.chartComplexity = Parkerize?.clampLevel?.(elements.parkerizeChartComplexity.value) || 3;
    try { localStorage.setItem(PARKERIZE_CHART_COMPLEXITY_STORAGE_KEY, String(state.parkerize.chartComplexity)); } catch (_) {}
    syncParkerizePanel();
  });
  elements.parkerizeSoloComplexity?.addEventListener('input', () => {
    state.parkerize.soloComplexity = Parkerize?.clampLevel?.(elements.parkerizeSoloComplexity.value) || 3;
    try { localStorage.setItem(PARKERIZE_SOLO_COMPLEXITY_STORAGE_KEY, String(state.parkerize.soloComplexity)); } catch (_) {}
    syncParkerizePanel();
  });
  elements.generateParkerize?.addEventListener('click', () => {
    if (state.parkerize.harmonyMode === 'generated') generateParkerizedChart();
    else installParkerizedSolo();
  });
  elements.regenerateParkerizeSolo?.addEventListener('click', () => { installParkerizedSolo(); });
  elements.exportParkerizeMidi?.addEventListener('click', exportParkerizedMidi);
  elements.favoriteSong?.addEventListener('click', toggleFavoriteSong);
  elements.previousChord.addEventListener('click', () => navigateChord(-1));
  elements.nextChord.addEventListener('click', () => navigateChord(1));
  elements.toggleNoteNames.addEventListener('click', toggleNoteNames);
  elements.keyboardRangeMode?.addEventListener('change', () => {
    const selected = ['full', 'split', 'wide'].includes(elements.keyboardRangeMode.value) ? elements.keyboardRangeMode.value : 'compact';
    state.keyboardRangeMode = selected === 'full' && !fullSongKeyboardData()?.range ? 'compact' : selected;
    try { localStorage.setItem(keyboardRangeStorageKey(), state.keyboardRangeMode); } catch (_) {}
    renderStudy({ keepVisible: false });
  });
  elements.pianoVoicingStyle?.addEventListener('change', () => {
    if (state.transport.playing) stopChartPlayback({ render: false });
    state.pianoVoicingStyle = validPianoVoicingStyle(elements.pianoVoicingStyle.value);
    state.fullSongKeyboard = { key: '', range: null, eventVoicings: new Map(), midis: [] };
    try { localStorage.setItem(PIANO_VOICING_STORAGE_KEY, state.pianoVoicingStyle); } catch (_) {}
    renderStudy({ keepVisible: false });
  });
  elements.guitarVoicingStyle?.addEventListener('change', () => {
    if (state.transport.playing) stopChartPlayback({ render: false });
    state.guitarVoicingStyle = validGuitarVoicingStyle(elements.guitarVoicingStyle.value);
    state.guitarPlanCache = null;
    try { localStorage.setItem(GUITAR_VOICING_STORAGE_KEY, state.guitarVoicingStyle); } catch (_) {}
    renderStudy({ keepVisible: false });
  });
  elements.reharmLevel?.addEventListener('change', () => {
    const level = Reharm?.normalizeLevel?.(elements.reharmLevel.value) ?? 0;
    if (level === state.reharmLevel) return;
    const preserveEvent = currentOccurrenceSnapshot();
    if (state.transport.playing) stopChartPlayback({ render: false });
    state.reharmLevel = level;
    try { localStorage.setItem(REHARM_LEVEL_STORAGE_KEY, String(level)); } catch (_) {}
    invalidateDerivedHarmony();
    activateChartSource(state.chartSource, { transport: true, preserveEvent });
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
  elements.fretboardSoloOctave?.addEventListener('click', () => {
    if (!soloStudyActive() || state.instrumentView !== 'fretboard') return;
    state.fretboardSoloOctaveDown = !state.fretboardSoloOctaveDown;
    try { localStorage.setItem(FRETBOARD_SOLO_OCTAVE_STORAGE_KEY, state.fretboardSoloOctaveDown ? 'down' : 'written'); } catch (_) {}
    renderStudy({ keepVisible: false });
  });
  elements.instrumentView?.addEventListener('change', () => {
    const restartStream = state.transport.playing && state.transport.streamMode;
    if (restartStream) stopChartPlayback({ render: false });
    state.instrumentView = elements.instrumentView.value === 'fretboard' ? 'fretboard' : 'piano';
    try { localStorage.setItem(INSTRUMENT_VIEW_STORAGE_KEY, state.instrumentView); } catch (_) {}
    renderStudy({ keepVisible: false });
    if (restartStream) startChartPlayback();
  });
  elements.toggleMelody.addEventListener('click', () => { toggleMelody(); });
  elements.midiStudy?.addEventListener('change', () => { selectMidiStudy(elements.midiStudy.value); });
  elements.midiChorus?.addEventListener('change', () => { selectMidiChorus(elements.midiChorus.value); });
  elements.chartSource.addEventListener('change', () => {
    if (elements.chartSource.value === state.chartSource) return;
    activateChartSource(elements.chartSource.value);
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
    const restartStream = state.transport.playing && state.transport.streamMode;
    if (restartStream) stopChartPlayback({ render: false });
    state.transport.playMelody = elements.playMelody.checked;
    if (state.transport.playMelody && melodyMatchesChart()) {
      setMelodyVisibility(true);
      renderStudy({ keepVisible: false });
    }
    if (restartStream) startChartPlayback();
  });
  elements.autoAdvanceRandom?.addEventListener('change', () => {
    state.transport.autoAdvanceRandom = Boolean(elements.autoAdvanceRandom.checked);
    try { localStorage.setItem(AUTO_ADVANCE_RANDOM_STORAGE_KEY, state.transport.autoAdvanceRandom ? 'on' : 'off'); } catch (_) {}
    if (state.transport.playing && state.transport.streamMode && streamTransport.audio) {
      streamTransport.audio.loop = !state.transport.autoAdvanceRandom;
    }
    syncTransportControls();
  });
  elements.streamMode?.addEventListener('change', () => {
    const resume = state.transport.playing;
    if (resume) stopChartPlayback({ render: false });
    state.transport.streamMode = Boolean(elements.streamMode.checked && streamModeAvailable());
    try {
      if (state.transport.streamMode) localStorage.setItem(STREAM_MODE_STORAGE_KEY, 'on');
      else localStorage.removeItem(STREAM_MODE_STORAGE_KEY);
    } catch (_) {}
    syncTransportControls();
    // Render when the toggle is chosen instead of waiting for the next Play
    // tap. This keeps the actual Play action a direct media gesture on iOS.
    if (state.transport.streamMode && state.timeline.length) void prepareStreamAsset();
    if (resume) startChartPlayback();
  });
  elements.streamVisualDelay?.addEventListener('input', () => {
    state.transport.streamVisualDelayMs = normalizeStreamVisualDelayMs(elements.streamVisualDelay.value);
    try { localStorage.setItem(STREAM_VISUAL_DELAY_STORAGE_KEY, String(state.transport.streamVisualDelayMs)); } catch (_) {}
    syncStreamVisualDelayControl();
    if (state.transport.playing && state.transport.streamMode) {
      syncStreamVisuals(streamTransport.session, true);
    }
  });
  elements.retryLoad.addEventListener('click', loadCatalog);

  function instrumentPointerDown(surface, event) {
    const key = event.target.closest('.piano-key[data-midi], .fretboard-cell[data-midi]');
    if (!key || !surface?.contains(key)) return;
    // A real horizontal swipe must scroll a long keyboard/neck, not get
    // captured as a held key. A short release is still an audible tap.
    const longKeyboard = (surface === elements.piano || surface === elements.melodyPiano)
      && ['full', 'wide'].includes(surface.dataset.rangeMode);
    const extendedFretboard = surface === elements.fretboard && surface.dataset.extended === 'true';
    if (longKeyboard || extendedFretboard) {
      const visual = surface === elements.melodyPiano ? 'melody' : surface === elements.piano ? 'chord' : 'fretboard';
      deferredFullKeyboardTaps.set(event.pointerId, {
        midi: Number(key.dataset.midi), x: event.clientX, y: event.clientY, visual
      });
      return;
    }
    event.preventDefault();
    surface.setPointerCapture(event.pointerId);
    const visual = surface === elements.melodyPiano ? 'melody' : surface === elements.piano ? 'chord' : 'fretboard';
    startVoice(`pointer-${event.pointerId}`, Number(key.dataset.midi), null, Number(key.dataset.midi), visual);
  }
  function releaseInstrumentPointer(surface, event) {
    const deferred = deferredFullKeyboardTaps.get(event.pointerId);
    if (deferred) {
      deferredFullKeyboardTaps.delete(event.pointerId);
      const distance = Math.hypot(event.clientX - deferred.x, event.clientY - deferred.y);
      if (event.type === 'pointerup' && distance < 10) {
        startVoice(`pointer-${event.pointerId}`, deferred.midi, .62, deferred.midi, deferred.visual || 'chord');
      }
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
  elements.fretboard?.addEventListener('click', event => {
    const button = event.target.closest('.fret-position-button[data-fret]');
    if (!button || !elements.fretboard.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    const fret = validFretboardPositionAnchor(button.dataset.fret);
    if (fret == null) return;
    const restartStream = state.transport.playing && state.transport.streamMode;
    if (restartStream) stopChartPlayback({ render: false });
    state.fretboardPositionAnchor = state.fretboardPositionAnchor === fret ? null : fret;
    try {
      if (state.fretboardPositionAnchor == null) localStorage.removeItem(FRETBOARD_POSITION_STORAGE_KEY);
      else localStorage.setItem(FRETBOARD_POSITION_STORAGE_KEY, String(state.fretboardPositionAnchor));
    } catch (_) {}
    renderStudy({ keepVisible: false });
    window.requestAnimationFrame(() => {
      const visibleFret = Math.min(fret, fretboardMaxFret());
      const renderedButton = elements.fretboard?.querySelector(`.fret-position-button[data-fret="${visibleFret}"]`);
      renderedButton?.focus({ preventScroll: true });
      keepFretboardCellVisible(renderedButton);
    });
    if (restartStream) startChartPlayback();
  });

  elements.studyCard.addEventListener('pointerdown', event => {
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
    if (event.key === ' ' || event.key === 'Space' || event.key === 'Spacebar' || event.code === 'Space' || event.keyCode === 32) {
      // Space is the global chart transport even after a button or link was
      // used. Preserve native editing/select behavior for form fields.
      if (event.target.closest('input, select, textarea, [contenteditable]')) return;
      event.preventDefault();
      startChartPlayback();
      return;
    }
    if (event.target.closest('button, input, a, select, textarea, [contenteditable]')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigateChord(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); navigateChord(1); }
  });
  // `touch-action: manipulation` handles current mobile browsers without
  // disabling pinch or scroll.  This small fallback also prevents a stray
  // double-click from turning into a browser zoom gesture on older WebKit.
  document.addEventListener('dblclick', event => {
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
  }, { passive: false });
  // CarPlay and Bluetooth can briefly suspend Web Audio while iOS swaps the
  // output route. Do not restart the chart or reset its position; simply
  // resume the existing graph when the page becomes active again.
  window.addEventListener('pageshow', recoverAudioOutput);
  window.addEventListener('focus', recoverAudioOutput);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recoverAudioOutput();
  });
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
  try { state.fretboardSoloOctaveDown = localStorage.getItem(FRETBOARD_SOLO_OCTAVE_STORAGE_KEY) === 'down'; } catch (_) {}
  try { state.pianoVoicingStyle = validPianoVoicingStyle(localStorage.getItem(PIANO_VOICING_STORAGE_KEY)); } catch (_) {}
  try { state.guitarVoicingStyle = validGuitarVoicingStyle(localStorage.getItem(GUITAR_VOICING_STORAGE_KEY)); } catch (_) {}
  try { state.showMelody = localStorage.getItem(MELODY_VISIBILITY_STORAGE_KEY) === 'on'; } catch (_) {}
  try { state.transport.autoAdvanceRandom = localStorage.getItem(AUTO_ADVANCE_RANDOM_STORAGE_KEY) === 'on'; } catch (_) {}
  try { state.transport.streamMode = streamModeAvailable() && localStorage.getItem(STREAM_MODE_STORAGE_KEY) === 'on'; } catch (_) {}
  try { state.transport.streamVisualDelayMs = normalizeStreamVisualDelayMs(localStorage.getItem(STREAM_VISUAL_DELAY_STORAGE_KEY)); } catch (_) {}
  try { state.parkerize.harmonyMode = localStorage.getItem(PARKERIZE_HARMONY_STORAGE_KEY) === 'generated' ? 'generated' : 'standard'; } catch (_) {}
  try { state.parkerize.chartComplexity = Parkerize?.clampLevel?.(localStorage.getItem(PARKERIZE_CHART_COMPLEXITY_STORAGE_KEY)) || 3; } catch (_) {}
  try { state.parkerize.soloComplexity = Parkerize?.clampLevel?.(localStorage.getItem(PARKERIZE_SOLO_COMPLEXITY_STORAGE_KEY)) || 3; } catch (_) {}
  try { state.reharmLevel = Reharm?.normalizeLevel?.(localStorage.getItem(REHARM_LEVEL_STORAGE_KEY)) ?? 0; } catch (_) {}
  try {
    const savedFavorites = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
    state.favoriteSongKeys = new Set(Array.isArray(savedFavorites) ? savedFavorites.filter(value => typeof value === 'string') : []);
  } catch (_) {}
  try { state.fretboardPositionAnchor = validFretboardPositionAnchor(localStorage.getItem(FRETBOARD_POSITION_STORAGE_KEY)); } catch (_) {}
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
  syncParkerizePanel();
  window.KeyerStandardsDebug = {
    state,
    loadSong,
    selectEvent,
    scaleForEvent,
    toggleNoteNames,
    buildMidiChart,
    midiChorusesForNotes,
    selectMidiStudy,
    selectMidiChorus,
    soloStudyActive,
    parkerizeActive,
    installParkerizedSolo,
    generateParkerizedChart,
    exportParkerizedMidi,
    installMidiSource,
    startChartPlayback,
    startStreamChartPlayback,
    stopChartPlayback,
    prepareStreamAsset,
    streamModeAvailable,
    streamTransport,
    melodyNotesForEvent,
    navigateChord,
    fullSongKeyboardData,
    snapFullKeyboardRange,
    timelineIndexForSelection,
    fretboardPositionForMidi,
    validFretboardPositionAnchor,
    activeKeyboardRangeMode
  };
  loadCatalog();
})();
