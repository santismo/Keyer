(() => {
  'use strict';

  const Theory = window.KeyerJazzTheory;
  const IReal = window.KeyerIReal;
  const CATALOG_URLS = [
    'https://raw.githubusercontent.com/santismo/fakebot/main/real%20playlist.txt',
    'https://cdn.jsdelivr.net/gh/santismo/fakebot@main/real%20playlist.txt'
  ];
  const STORAGE_KEY = 'keyer-jazz-standard';
  const NOTE_NAMES_STORAGE_KEY = 'keyer-jazz-note-names';
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
    structuralEvents: new Map(),
    occurrenceIndices: new Map(),
    sections: new Map(),
    activeIndex: 0,
    preferFlats: true,
    searchIndex: -1,
    voicing: [],
    displayVoicing: [],
    scale: null,
    activeAlternateCellId: null,
    activeAlternateIndex: -1,
    showNoteNames: true,
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

  function playbackBarIndices(song, bars) {
    const rawOrder = Array.isArray(song?.playbackOrder) ? song.playbackOrder : [];
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
      bar.chords.forEach(item => { if (item.parsed && !item.optionalOnly) groups.get(bar.sectionId).push(item.parsed); });
    });
    const contexts = new Map();
    groups.forEach((chords, id) => contexts.set(id, Theory.inferSectionContext(chords, songKey)));
    return contexts;
  }

  function buildEvents(song, bars) {
    const structuralEvents = new Map();
    bars.forEach(bar => {
      bar.chords.forEach(item => {
        if (!item.parsed || item.optionalOnly) return;
        const cellId = `${bar.barIndex}:${item.chordIndex}`;
        structuralEvents.set(cellId, { cellId, barIndex: bar.barIndex, chordIndex: item.chordIndex, bar, item, chord: item.parsed, sectionId: bar.sectionId, sectionLabel: bar.sectionLabel, optionalAlternate: item.optionalOnly });
      });
    });

    const events = [];
    const occurrences = new Map();
    playbackBarIndices(song, bars).forEach((barIndex, passIndex) => {
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
    return { events, structuralEvents, occurrences };
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
    const margin = 14;
    if (measure.offsetTop < view.scrollTop + margin) {
      view.scrollTo({ top: Math.max(0, measure.offsetTop - margin), behavior: 'smooth' });
    } else if (measure.offsetTop + measure.offsetHeight > view.scrollTop + view.clientHeight - margin) {
      view.scrollTo({ top: measure.offsetTop + measure.offsetHeight - view.clientHeight + margin, behavior: 'smooth' });
    }
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
          button.className = 'chart-chord';
          const cellId = `${bar.barIndex}:${item.chordIndex}`;
          const display = item.parsed?.display || item.raw;
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

  function renderPiano(chord, scale, voicing) {
    const LOW = 48;
    const HIGH = 72;
    const whiteMidis = [];
    for (let midi = LOW; midi <= HIGH; midi += 1) if (!BLACK_PCS.has(Theory.mod(midi))) whiteMidis.push(midi);
    const whiteCount = whiteMidis.length;
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
    const fitted = Theory.fitVoicingToRange(voicing, LOW, HIGH);
    const displayVoicing = fitted.length === voicing.length ? fitted : voicing.filter(note => note.midi >= LOW && note.midi <= HIGH);
    const voicingByMidi = new Map(displayVoicing.map(note => [note.midi, note]));
    state.displayVoicing = displayVoicing;
    elements.piano.dataset.voicingCount = String(displayVoicing.length);
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
      key.setAttribute('aria-label', `${name}${sounding ? `, suggested ${sounding.role}` : ''}`);
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
      fragment.appendChild(key);
    }
    elements.piano.replaceChildren(fragment);
  }

  function renderStudy({ keepVisible = true } = {}) {
    const baseEvent = state.events[state.activeIndex];
    if (!baseEvent) return;
    const alternate = state.activeAlternateCellId === baseEvent.cellId
      ? baseEvent.item.alternates?.[state.activeAlternateIndex]
      : null;
    const event = alternate?.parsed ? { ...baseEvent, chord: alternate.parsed, optionalAlternate: true } : baseEvent;
    const nextEvent = state.events[state.activeIndex + 1] || null;
    const section = state.sections.get(event.sectionId);
    const scale = scaleForEvent(event, nextEvent);
    const voicing = Theory.makeVoicing(event.chord);
    state.scale = scale;
    state.voicing = voicing;

    elements.selectedChord.textContent = `${event.optionalAlternate ? '(' : ''}${event.chord.display}${event.optionalAlternate ? ')' : ''}`;
    elements.chordProgress.textContent = `${state.activeIndex + 1} / ${state.events.length}`;
    elements.sectionReadout.textContent = displaySection(event.sectionLabel, section);
    const parentSuffix = scale.sectionBased ? ` · ${Theory.contextName(section, state.preferFlats)} section` : '';
    const scaleRoot = scale.rootText ? Theory.displayNoteSpelling(scale.rootText) : Theory.noteName(scale.root, state.preferFlats);
    elements.scaleName.textContent = `${scaleRoot} ${scale.name}${parentSuffix}`;
    elements.chartStatus.textContent = `Bar ${event.barIndex + 1} · ${event.sectionLabel || 'form'}`;
    renderPiano(event.chord, scale, voicing);
    setChartButtonState(event);
    if (keepVisible) keepMeasureVisible(event);
  }

  function selectEvent(index, preview = false) {
    if (!state.events.length) return;
    state.activeIndex = Theory.mod(index, state.events.length);
    state.activeAlternateCellId = null;
    state.activeAlternateIndex = -1;
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
    state.activeIndex = indices.find(index => index >= state.activeIndex) ?? indices[0];
    state.activeAlternateCellId = cellId;
    state.activeAlternateIndex = alternateIndex;
    renderStudy();
    if (preview) playCurrentVoicing();
  }

  function loadSong(song) {
    const bars = normalizeBars(song);
    const built = buildEvents(song, bars);
    if (!bars.length || !built.events.length) return false;
    state.song = song;
    state.bars = bars;
    state.events = built.events;
    state.structuralEvents = built.structuralEvents;
    state.occurrenceIndices = built.occurrences;
    state.sections = buildSectionContexts(bars, song.key);
    state.activeIndex = 0;
    state.activeAlternateCellId = null;
    state.activeAlternateIndex = -1;
    state.preferFlats = Theory.preferFlatsForKey(song.key);

    elements.songTitle.textContent = song.title || 'Untitled standard';
    elements.songComposer.textContent = song.composer || 'Unknown composer';
    elements.songMeta.textContent = [song.style, song.key ? `Key ${song.key}` : '', `${bars.length} bars`].filter(Boolean).join(' · ');
    elements.search.value = song.title || '';
    elements.lesson.hidden = false;
    elements.errorCard.hidden = true;
    hideSearchResults();
    renderChart();
    renderStudy({ keepVisible: false });
    elements.chartScroll.scrollTo({ top: 0, left: 0 });
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
    const next = Math.max(0, (pressedCounts.get(midi) || 0) + direction);
    if (next) pressedCounts.set(midi, next);
    else pressedCounts.delete(midi);
    elements.piano.querySelector(`[data-midi="${midi}"]`)?.classList.toggle('playing', next > 0);
  }

  function startVoice(id, midi, duration = null) {
    stopVoice(id, true);
    const context = ensureAudio();
    markPressed(midi, 1);
    if (!context || !audioInput) {
      const voice = { midi, silent: true, timerId: null };
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
    const voice = { midi, envelope, oscillators: [oscillator, color], startedAt: now, timerId: null };
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
    markPressed(voice.midi, -1);
    if (voice.silent || !audioContext) return;
    const now = audioContext.currentTime;
    const release = immediate ? .025 : .2;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(.06, now);
    voice.envelope.gain.exponentialRampToValueAtTime(.0001, now + release);
    voice.oscillators.forEach(oscillator => oscillator.stop(now + release + .03));
  }

  function playCurrentVoicing() {
    const voicing = state.displayVoicing.length ? state.displayVoicing : state.voicing;
    if (!voicing.length) return;
    [...voices.keys()].filter(id => String(id).startsWith('preview-')).forEach(id => stopVoice(id, true));
    voicing.forEach((note, index) => startVoice(`preview-${index}`, note.midi, 1.35));
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
  window.addEventListener('pagehide', () => [...voices.keys()].forEach(id => stopVoice(id, true)));

  try { state.showNoteNames = localStorage.getItem(NOTE_NAMES_STORAGE_KEY) !== 'off'; } catch (_) {}
  syncNoteNameToggle();
  window.KeyerStandardsDebug = { state, loadSong, selectEvent, scaleForEvent, toggleNoteNames };
  loadCatalog();
})();
