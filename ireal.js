/*
 * Keyer iReal playlist reader.
 *
 * The file is deliberately dependency-free: it runs as `window.KeyerIReal` in
 * the browser and as a CommonJS module in the small Node test suite.  The
 * unscrambling and repeat expansion are based on the public iReal reader
 * format used by Fakebot, while the token model keeps the chart markings that
 * a Real Book-style renderer needs.
 */
(function attachKeyerIReal(root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.KeyerIReal = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function makeKeyerIReal() {
  "use strict";

  var MUSIC_PREFIX = "1r34LbKcu7";
  var MAX_CHORDS_PER_BAR = 4;
  var MAX_PLAYBACK_BARS = 4096;

  function obfuscate50(value) {
    var source = String(value || "");
    var chars = source.split("");
    for (var i = 0; i < 5; i += 1) {
      chars[49 - i] = source[i];
      chars[i] = source[49 - i];
    }
    for (var j = 10; j < 24; j += 1) {
      chars[49 - j] = source[j];
      chars[j] = source[49 - j];
    }
    return chars.join("");
  }

  function unscramble(value) {
    var remaining = String(value || "");
    var result = "";
    while (remaining.length > 50) {
      var part = remaining.slice(0, 50);
      remaining = remaining.slice(50);
      result += remaining.length < 2 ? part : obfuscate50(part);
    }
    return result + remaining;
  }

  function cleanNumber(value) {
    if (value == null || String(value).trim() === "") return null;
    var number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? number : null;
  }

  function parseTimeSignature(raw) {
    var digits = String(raw || "").replace(/^T/, "");
    if (!digits) return null;
    if (digits === "12") {
      return { raw: "T" + digits, value: digits, beats: 12, beatUnit: 8 };
    }
    if (digits.length === 2) {
      return {
        raw: "T" + digits,
        value: digits,
        beats: Number.parseInt(digits[0], 10),
        beatUnit: Number.parseInt(digits[1], 10)
      };
    }
    var midpoint = Math.max(1, digits.length - 1);
    return {
      raw: "T" + digits,
      value: digits,
      beats: Number.parseInt(digits.slice(0, midpoint), 10),
      beatUnit: Number.parseInt(digits.slice(midpoint), 10)
    };
  }

  function ordinalNumber(value) {
    var normalized = String(value || "").toLowerCase();
    if (normalized === "1st" || normalized === "first") return 1;
    if (normalized === "2nd" || normalized === "second") return 2;
    if (normalized === "3rd" || normalized === "third") return 3;
    return null;
  }

  function ordinalLabel(value) {
    if (value === 1) return "1st";
    if (value === 2) return "2nd";
    if (value === 3) return "3rd";
    return String(value || "");
  }

  /*
   * Roadmap instructions arrive as free-form comments.  Match the directive
   * anywhere in the comment so catalog notes such as "After solos, D.C. al
   * Fine" retain their full text while still yielding a playable roadmap.
   */
  function parseRoadmapDirective(value) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return null;
    var match = text.match(/d\.?\s*([cs])\.?\s*(?:al|to)\s*(fine|coda|(?:1st|2nd|3rd|first|second|third)\s*(?:ending|end\.?))/i);
    if (!match) return null;

    var jump = match[1].toLowerCase() === "s" ? "ds" : "dc";
    var targetText = match[2].toLowerCase().replace(/\.$/, "").trim();
    var endingMatch = targetText.match(/^(1st|2nd|3rd|first|second|third)/);
    var ending = endingMatch ? ordinalNumber(endingMatch[1]) : null;
    var target = ending != null ? "ending" : targetText;
    var kind = jump === "ds" ? "d.s." : "d.c.";
    kind += target === "ending"
      ? " al " + ordinalLabel(ending) + " ending"
      : " al " + target;

    return {
      type: jump,
      target: target,
      ending: ending,
      kind: kind,
      text: text,
      afterSolos: /after\s+solos?\b/i.test(text)
    };
  }

  function qualityFamily(quality) {
    var value = String(quality || "").toLowerCase();
    if (/sus/.test(value)) return "suspended";
    if (/(^|[^a-z])h|m7b5|half/.test(value)) return "half-diminished";
    if (/o|dim/.test(value)) return "diminished";
    if (/^-|^m(?!aj)|min/.test(value)) return "minor";
    if (/\+|aug/.test(value)) return "augmented";
    if (/\^|maj/.test(value)) return "major";
    if (/7|9|11|13|alt/.test(value)) return "dominant";
    return "major";
  }

  function findClosingParen(text, start) {
    var depth = 0;
    for (var i = start; i < text.length; i += 1) {
      if (text[i] === "(") depth += 1;
      if (text[i] === ")") {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function chordParts(raw) {
    var text = String(raw || "").trim();
    if (!text) return null;
    if (text === "n") {
      return {
        raw: text,
        symbol: "N.C.",
        root: null,
        literalRoot: null,
        quality: "",
        qualityFamily: "none",
        bass: null,
        alternateRaw: null,
        alternate: null,
        isNoChord: true,
        isPause: false,
        invisibleRoot: false
      };
    }
    if (text === "p") {
      return {
        raw: text,
        symbol: "/",
        root: null,
        literalRoot: null,
        quality: "",
        qualityFamily: "pause",
        bass: null,
        alternateRaw: null,
        alternate: null,
        isNoChord: false,
        isPause: true,
        invisibleRoot: false
      };
    }

    var match = text.match(/^([A-GW](?:b|#)?)(.*)$/);
    if (!match) return null;
    var literalRoot = match[1];
    var rest = match[2] || "";
    var alternateRaw = null;
    var alternate = null;
    var open = rest.indexOf("(");
    if (open >= 0) {
      var close = findClosingParen(rest, open);
      if (close === rest.length - 1) {
        alternateRaw = rest.slice(open + 1, close).trim() || null;
        rest = rest.slice(0, open);
        if (alternateRaw) alternate = chordParts(alternateRaw);
      }
    }

    var bass = null;
    var slashMatch = rest.match(/\/([A-G](?:b|#)?)$/);
    if (slashMatch) {
      bass = slashMatch[1];
      rest = rest.slice(0, slashMatch.index);
    }

    return {
      raw: text,
      symbol: text,
      root: literalRoot === "W" ? null : literalRoot,
      literalRoot: literalRoot,
      quality: rest,
      qualityFamily: qualityFamily(rest),
      bass: bass,
      alternateRaw: alternateRaw,
      alternate: alternate,
      isNoChord: false,
      isPause: false,
      invisibleRoot: literalRoot === "W"
    };
  }

  function parseChordSymbol(raw, previousChord) {
    var chord = chordParts(raw);
    if (!chord) return null;
    if (!chord.invisibleRoot) return chord;

    var previous = typeof previousChord === "string"
      ? chordParts(previousChord)
      : previousChord;
    if (!previous || !previous.root) return chord;

    chord.root = previous.root;
    if (!chord.quality) chord.quality = previous.quality || "";
    chord.qualityFamily = qualityFamily(chord.quality);
    chord.inheritedRoot = true;
    chord.resolvedRaw = chord.root + chord.quality + (chord.bass ? "/" + chord.bass : "");
    chord.symbol = chord.resolvedRaw;
    return chord;
  }

  function isQualityCharacter(char) {
    return /[+\-^0-9hob#suadltmM]/.test(char);
  }

  function readChord(text, start, previousChord) {
    var first = text[start];
    if (!/[A-GW]/.test(first || "")) return null;
    var index = start + 1;
    if (text[index] === "b" || text[index] === "#") index += 1;

    while (index < text.length) {
      if (text[index] === "*" && text.indexOf("*", index + 1) >= 0) {
        index = text.indexOf("*", index + 1) + 1;
        continue;
      }
      if (!isQualityCharacter(text[index])) break;
      index += 1;
    }

    if (text[index] === "/" && /[A-G]/.test(text[index + 1] || "")) {
      index += 2;
      if (text[index] === "b" || text[index] === "#") index += 1;
    }

    if (text[index] === "(") {
      var close = findClosingParen(text, index);
      if (close >= 0) index = close + 1;
    }

    var raw = text.slice(start, index);
    return { raw: raw, length: index - start, chord: parseChordSymbol(raw, previousChord) };
  }

  function cloneChord(chord, inheritedFrom) {
    var copy = {};
    Object.keys(chord || {}).forEach(function copyField(key) {
      if (key === "alternate" && chord.alternate) copy.alternate = cloneChord(chord.alternate, inheritedFrom);
      else copy[key] = chord[key];
    });
    copy.inherited = true;
    copy.inheritedFrom = inheritedFrom;
    return copy;
  }

  function parseChart(input, options) {
    var opts = options || {};
    var sourceRaw = String(input || "");
    var raw = sourceRaw;
    var prefixIndex = raw.indexOf(MUSIC_PREFIX);
    if (prefixIndex >= 0) {
      raw = unscramble(raw.slice(prefixIndex + MUSIC_PREFIX.length));
    } else if (opts.scrambled) {
      raw = unscramble(raw);
    }
    raw = raw.trim();

    var sourceBars = [];
    var timeline = [];
    var warnings = [];
    var flatAnnotations = [];
    var repeatSections = [];
    var activeSection = null;
    var activeTimeSignature = null;
    var lastChord = null;
    var repeatStartPosition = null;
    var firstEndingPosition = null;
    var pendingRoadmaps = [];
    var deferredRoadmaps = [];

    function newBar() {
      var bar = {
        index: sourceBars.length,
        raw: "",
        rawTokens: [],
        chords: [],
        overflowChords: [],
        section: activeSection,
        sectionMarker: null,
        sectionMarkers: [],
        timeSignature: activeTimeSignature,
        timeSignatureChange: null,
        annotations: [],
        comments: [],
        ending: null,
        endings: [],
        repeatStart: false,
        repeatEnd: false,
        repeatSymbol: null,
        resolvedFrom: [],
        noChord: false,
        pause: false,
        segno: false,
        coda: false,
        fine: false,
        end: false,
        barline: { left: null, right: null }
      };
      sourceBars.push(bar);
      timeline.push(bar.index);
      return bar;
    }

    var current = newBar();

    function barHasContent(bar) {
      return Boolean(
        bar.chords.length ||
        bar.overflowChords.length ||
        bar.annotations.length ||
        bar.repeatSymbol ||
        bar.repeatStart ||
        bar.repeatEnd ||
        bar.ending != null ||
        bar.noChord ||
        bar.pause
      );
    }

    function barHasMusic(bar) {
      return Boolean(
        bar.chords.length ||
        bar.overflowChords.length ||
        bar.repeatSymbol ||
        bar.noChord ||
        bar.pause ||
        bar.barline.right
      );
    }

    function addRaw(token) {
      current.rawTokens.push(token);
      current.raw += token;
    }

    function advanceBar() {
      if (!barHasContent(current)) return current;
      current = newBar();
      return current;
    }

    function setLeftBarline(value) {
      // Section, meter, and ending marks commonly precede a left barline in
      // the compact iReal stream.  Keep that structural prelude on the same
      // musical bar; only advance when a bar already contains music.
      if (barHasMusic(current)) advanceBar();
      current.barline.left = value;
      addRaw(value);
    }

    function endBar(value) {
      current.barline.right = value;
      addRaw(value);
      advanceBar();
    }

    function annotation(type, token, detail) {
      var value = { type: type, raw: token };
      Object.keys(detail || {}).forEach(function assignDetail(key) { value[key] = detail[key]; });
      current.annotations.push(value);
      flatAnnotations.push({ barIndex: current.index, annotation: value });
      if (token) addRaw(token);
      return value;
    }

    function appendChord(chord, token) {
      if (!chord) {
        warnings.push({ barIndex: current.index, token: token, message: "Unrecognized chord symbol" });
        addRaw(token);
        return;
      }
      if (current.chords.length < MAX_CHORDS_PER_BAR) current.chords.push(chord);
      else current.overflowChords.push(chord);
      if (chord.isNoChord) current.noChord = true;
      if (chord.isPause) current.pause = true;
      if (!chord.isNoChord && !chord.isPause) lastChord = chord;
      addRaw(token);
    }

    function priorPlayableBars(count) {
      var out = [];
      for (var i = sourceBars.length - 2; i >= 0 && out.length < count; i -= 1) {
        if (sourceBars[i].chords.length) out.unshift(sourceBars[i]);
      }
      return out;
    }

    function inheritBar(source, symbol, ordinal) {
      if (!source) return;
      var localAlternates = current.chords.filter(function keepLocalAlternate(chord) {
        return chord && chord.isAlternateOnly;
      });
      var sourceChords = source.chords.filter(function keepMainChord(chord) {
        return chord && !chord.isAlternateOnly;
      });
      if (!sourceChords.length) sourceChords = source.chords;
      current.repeatSymbol = symbol;
      current.resolvedFrom.push(source.index);
      current.chords = sourceChords.slice(0, MAX_CHORDS_PER_BAR).map(function clone(value) {
        return cloneChord(value, source.index);
      });
      localAlternates.forEach(function restoreAlternate(chord) {
        if (current.chords.length < MAX_CHORDS_PER_BAR) current.chords.push(chord);
        else current.overflowChords.push(chord);
      });
      current.noChord = source.noChord;
      current.pause = source.pause;
      addRaw(ordinal ? symbol + ":" + ordinal : symbol);
    }

    function appendTimelineSlice(start, end, kind) {
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      var safeStart = Math.max(0, Math.min(start, timeline.length));
      var safeEnd = Math.max(safeStart, Math.min(end, timeline.length));
      if (safeEnd <= safeStart) return;
      var copied = timeline.slice(safeStart, safeEnd);
      timeline.push.apply(timeline, copied);
      repeatSections.push({
        kind: kind || "repeat",
        startPosition: safeStart,
        endPosition: safeEnd,
        sourceBarIndices: copied.slice()
      });
    }

    function repeatToEndMarker() {
      var start = repeatStartPosition == null ? 0 : repeatStartPosition;
      var end = firstEndingPosition == null ? timeline.length : firstEndingPosition;
      appendTimelineSlice(start, end, "repeat");
    }

    function queuePendingRoadmaps() {
      if (!pendingRoadmaps.length) return;
      pendingRoadmaps.forEach(function queueRoadmap(item) {
        deferredRoadmaps.push({
          directive: item.directive,
          sourceBarIndex: item.sourceBarIndex,
          triggerPosition: timeline.length
        });
      });
      pendingRoadmaps = [];
    }

    function noteComment(token) {
      var text = token.slice(1, -1).replace(/XyQ/g, "   ").trim();
      var roadmap = parseRoadmapDirective(text);
      var detail = { text: text };
      if (roadmap) detail.roadmap = roadmap;
      annotation("comment", token, detail);
      current.comments.push(text);
      if (/^fine[.!]?$/i.test(text)) {
        current.fine = true;
      }
      if (roadmap) {
        pendingRoadmaps.push({ directive: roadmap, sourceBarIndex: current.index });
      }
    }

    var index = 0;
    while (index < raw.length) {
      var remaining = raw.slice(index);
      var tokenMatch;

      if (/^[\s,]/.test(remaining)) {
        index += 1;
        continue;
      }
      if (remaining.indexOf("XyQ") === 0) {
        index += 3;
        continue;
      }
      if (remaining.indexOf("Kcl") === 0) {
        current.barline.right = "|";
        addRaw("Kcl");
        // Kcl renders as a barline followed by a one-bar repeat of the bar
        // that just ended.  At this point that bar is still `current`.
        var kclPrevious = current.chords.length ? current : priorPlayableBars(1)[0];
        advanceBar();
        inheritBar(kclPrevious, "x", null);
        index += 3;
        continue;
      }
      if ((tokenMatch = remaining.match(/^\*[A-Za-z]/))) {
        var marker = tokenMatch[0];
        activeSection = marker.slice(1);
        current.section = activeSection;
        current.sectionMarker = activeSection;
        current.sectionMarkers.push(activeSection);
        annotation("section", marker, { label: activeSection });
        index += marker.length;
        continue;
      }
      if ((tokenMatch = remaining.match(/^<.*?>/))) {
        noteComment(tokenMatch[0]);
        index += tokenMatch[0].length;
        continue;
      }
      if ((tokenMatch = remaining.match(/^T(\d+)/))) {
        var signature = parseTimeSignature(tokenMatch[0]);
        activeTimeSignature = signature;
        current.timeSignature = signature;
        current.timeSignatureChange = signature;
        annotation("timeSignature", tokenMatch[0], { value: signature ? signature.value : null });
        index += tokenMatch[0].length;
        continue;
      }
      if ((tokenMatch = remaining.match(/^N(\d+)/))) {
        var ending = Number.parseInt(tokenMatch[1], 10);
        current.ending = ending;
        current.endings.push(ending);
        annotation("ending", tokenMatch[0], { number: ending });
        if (ending === 1) firstEndingPosition = timeline.length - 1;
        index += tokenMatch[0].length;
        continue;
      }
      if (remaining.indexOf("LZ|") === 0) {
        endBar("|");
        index += 3;
        continue;
      }
      if (remaining.indexOf("LZ") === 0) {
        endBar("|");
        index += 2;
        continue;
      }

      var char = remaining[0];
      if (char === "{") {
        setLeftBarline("{");
        current.repeatStart = true;
        repeatStartPosition = timeline.length - 1;
        firstEndingPosition = null;
        annotation("repeatStart", "", {});
        index += 1;
        continue;
      }
      if (char === "}") {
        current.repeatEnd = true;
        current.barline.right = "}";
        addRaw("}");
        annotation("repeatEnd", "", {});
        repeatToEndMarker();
        queuePendingRoadmaps();
        advanceBar();
        index += 1;
        continue;
      }
      if (char === "[") {
        setLeftBarline("[");
        index += 1;
        continue;
      }
      if (char === "]") {
        current.barline.right = "]";
        addRaw("]");
        queuePendingRoadmaps();
        advanceBar();
        index += 1;
        continue;
      }
      if (char === "|") {
        endBar("|");
        index += 1;
        continue;
      }
      if (char === "Z") {
        current.barline.right = "Z";
        current.end = true;
        annotation("end", "Z", {});
        queuePendingRoadmaps();
        index += 1;
        continue;
      }
      if (char === "S") {
        current.segno = true;
        annotation("segno", "S", {});
        index += 1;
        continue;
      }
      if (char === "Q") {
        current.coda = true;
        annotation("coda", "Q", {});
        index += 1;
        continue;
      }
      if (char === "U") {
        current.end = true;
        annotation("playerEnd", "U", {});
        index += 1;
        continue;
      }
      if (char === "f") {
        annotation("fermata", "f", {});
        index += 1;
        continue;
      }
      if (char === "s" || char === "l") {
        annotation("chordSize", char, { size: char === "s" ? "small" : "normal" });
        index += 1;
        continue;
      }
      if (char === "Y") {
        tokenMatch = remaining.match(/^Y+/);
        annotation("verticalSpacer", tokenMatch[0], { count: tokenMatch[0].length });
        index += tokenMatch[0].length;
        continue;
      }
      if (char === "x") {
        var previous = priorPlayableBars(1)[0];
        inheritBar(previous, "x", null);
        index += 1;
        continue;
      }
      if (char === "r") {
        var priorTwo = priorPlayableBars(2);
        if (priorTwo.length === 2) {
          inheritBar(priorTwo[0], "r", 1);
          advanceBar();
          inheritBar(priorTwo[1], "r", 2);
        } else {
          addRaw("r");
          warnings.push({ barIndex: current.index, token: "r", message: "Two-bar repeat has no two preceding bars" });
        }
        index += 1;
        continue;
      }
      if (char === "n" || char === "p") {
        appendChord(parseChordSymbol(char, lastChord), char);
        index += 1;
        continue;
      }
      if (char === "(") {
        var alternateClose = findClosingParen(raw, index);
        if (alternateClose >= 0) {
          var alternateToken = raw.slice(index, alternateClose + 1);
          var alternateText = alternateToken.slice(1, -1).trim();
          var alternateChord = parseChordSymbol(alternateText, lastChord);
          appendChord({
            raw: alternateToken,
            symbol: alternateToken,
            root: null,
            literalRoot: null,
            quality: "",
            qualityFamily: "alternate",
            bass: null,
            alternateRaw: alternateText || null,
            alternate: alternateChord,
            isAlternateOnly: true,
            isNoChord: false,
            isPause: false,
            invisibleRoot: false
          }, alternateToken);
          index = alternateClose + 1;
          continue;
        }
      }

      var parsedChord = readChord(raw, index, lastChord);
      if (parsedChord && parsedChord.length > 0) {
        appendChord(parsedChord.chord, parsedChord.raw);
        index += parsedChord.length;
        continue;
      }

      warnings.push({ barIndex: current.index, token: char, message: "Unrecognized chart token" });
      addRaw(char);
      index += 1;
    }

    // Some exports place a roadmap comment after the final Z token.  Flush it
    // here so "...Z<After solos, D.C. al Fine>" is not silently ignored.
    queuePendingRoadmaps();

    var keep = new Map();
    var bars = [];
    sourceBars.forEach(function keepBar(bar) {
      if (!barHasContent(bar)) return;
      var nextIndex = bars.length;
      keep.set(bar.index, nextIndex);
      bar.index = nextIndex;
      bars.push(bar);
    });

    var playbackOrder = timeline
      .map(function mapIndex(oldIndex) { return keep.get(oldIndex); })
      .filter(function validIndex(value) { return value != null; });

    flatAnnotations = flatAnnotations
      .map(function remapEntry(entry) {
        var mapped = keep.get(entry.barIndex);
        return mapped == null ? null : { barIndex: mapped, annotation: entry.annotation };
      })
      .filter(Boolean);

    repeatSections.forEach(function remapRepeat(section) {
      section.barIndices = section.sourceBarIndices
        .map(function mapRepeatIndex(oldIndex) { return keep.get(oldIndex); })
        .filter(function validRepeatIndex(value) { return value != null; });
      delete section.sourceBarIndices;
    });

    function inclusiveRange(start, end) {
      var result = [];
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return result;
      for (var rangeIndex = start; rangeIndex <= end; rangeIndex += 1) result.push(rangeIndex);
      return result;
    }

    function roadmapStart(directive, sourceBarIndex) {
      if (directive.type === "dc") return 0;
      var found = null;
      for (var barIndex = 0; barIndex <= sourceBarIndex; barIndex += 1) {
        if (bars[barIndex] && bars[barIndex].segno) found = barIndex;
      }
      return found;
    }

    /*
     * Build a linear path to a point while selecting the last numbered ending
     * that precedes that point.  This avoids playing both N1 and N2 on a D.C.
     * or D.S. pass whose Fine/To-Coda lies in or after the second ending.
     */
    function pathToPoint(start, target) {
      var endingStarts = [];
      for (var barIndex = start; barIndex <= target; barIndex += 1) {
        if (bars[barIndex] && bars[barIndex].ending != null) endingStarts.push(barIndex);
      }
      if (!endingStarts.length) return inclusiveRange(start, target);
      var firstEnding = endingStarts[0];
      var selectedEnding = endingStarts[endingStarts.length - 1];
      return inclusiveRange(start, firstEnding - 1).concat(inclusiveRange(selectedEnding, target));
    }

    function endingSegmentEnd(start) {
      for (var barIndex = start; barIndex < bars.length; barIndex += 1) {
        var bar = bars[barIndex];
        if (!bar) break;
        if (barIndex > start && bar.ending != null) return barIndex - 1;
        if (barIndex > start && bar.sectionMarker) return barIndex - 1;
        if (bar.fine || bar.repeatEnd || bar.end || bar.barline.right === "]" || bar.barline.right === "Z") {
          return barIndex;
        }
      }
      return bars.length - 1;
    }

    function routeForRoadmap(item, addWarning) {
      var directive = item;
      var sourceBarIndex = item.barIndex;
      var start = roadmapStart(directive, sourceBarIndex);
      if (start == null) {
        addWarning(item, "D.S. has no preceding Segno marker; using chart start");
        start = 0;
      }

      if (directive.target === "fine") {
        var fine = null;
        for (var fineIndex = start; fineIndex <= sourceBarIndex; fineIndex += 1) {
          if (bars[fineIndex] && bars[fineIndex].fine) {
            fine = fineIndex;
            break;
          }
        }
        if (fine == null) {
          addWarning(item, directive.kind + " has no reachable Fine marker");
          return [];
        }
        return pathToPoint(start, fine);
      }

      if (directive.target === "coda") {
        var toCoda = null;
        var targetCoda = null;
        for (var codaIndex = start; codaIndex < bars.length; codaIndex += 1) {
          if (!bars[codaIndex] || !bars[codaIndex].coda) continue;
          if (codaIndex <= sourceBarIndex) toCoda = codaIndex;
          else if (targetCoda == null) targetCoda = codaIndex;
        }
        // Many iReal charts only mark the printed Coda after the instruction.
        // In that form the instruction bar itself is the second-pass cutoff.
        var cutoff = toCoda == null ? sourceBarIndex : toCoda;
        if (targetCoda == null && toCoda == null) {
          addWarning(item, directive.kind + " has no Coda marker");
          return [];
        }
        return pathToPoint(start, cutoff);
      }

      if (directive.target === "ending") {
        var firstEnding = null;
        var selectedEnding = null;
        for (var endingIndex = start; endingIndex < bars.length; endingIndex += 1) {
          if (!bars[endingIndex] || bars[endingIndex].ending == null) continue;
          if (firstEnding == null) firstEnding = endingIndex;
          if (bars[endingIndex].ending === directive.ending && selectedEnding == null) selectedEnding = endingIndex;
        }
        if (selectedEnding == null) {
          addWarning(item, directive.kind + " has no matching numbered ending");
          return [];
        }
        var body = inclusiveRange(start, (firstEnding == null ? selectedEnding : firstEnding) - 1);
        // Third endings are commonly printed after the D.C./D.S. instruction;
        // leave that physical tail in place and insert only the return body.
        if (selectedEnding > sourceBarIndex) return body;
        return body.concat(inclusiveRange(selectedEnding, endingSegmentEnd(selectedEnding)));
      }

      return [];
    }

    function mappedTimelineLength(position) {
      var length = 0;
      var limit = Math.max(0, Math.min(position, timeline.length));
      for (var timelineIndex = 0; timelineIndex < limit; timelineIndex += 1) {
        if (keep.get(timeline[timelineIndex]) != null) length += 1;
      }
      return length;
    }

    var roadmapWarnings = [];
    var roadmapDirectives = deferredRoadmaps.map(function remapRoadmap(item) {
      return {
        barIndex: keep.get(item.sourceBarIndex),
        triggerPosition: mappedTimelineLength(item.triggerPosition),
        type: item.directive.type,
        target: item.directive.target,
        ending: item.directive.ending,
        kind: item.directive.kind,
        text: item.directive.text,
        afterSolos: item.directive.afterSolos
      };
    }).filter(function validRoadmap(item) {
      return item.barIndex != null;
    }).filter(function dedupeRoadmap(item, index, list) {
      return list.findIndex(function sameRoadmap(other) {
        return other.barIndex === item.barIndex && other.kind === item.kind && other.text === item.text;
      }) === index;
    }).sort(function sortRoadmaps(a, b) {
      return a.triggerPosition - b.triggerPosition;
    });

    var requestedCap = Number(opts.maxPlaybackBars);
    var playbackCap = Number.isFinite(requestedCap) && requestedCap > 0
      ? Math.min(100000, Math.floor(requestedCap))
      : MAX_PLAYBACK_BARS;
    if (playbackOrder.length > playbackCap) {
      playbackOrder = playbackOrder.slice(0, playbackCap);
      roadmapWarnings.push({
        barIndex: null,
        token: "roadmap",
        message: "Playback order capped at " + playbackCap + " bars"
      });
    }

    var insertedBars = 0;
    roadmapDirectives.forEach(function insertRoadmap(item) {
      var route = routeForRoadmap(item, function roadmapWarning(directive, message) {
        roadmapWarnings.push({ barIndex: directive.barIndex, token: directive.text, message: message });
      });
      if (!route.length) return;
      var insertion = Math.max(0, Math.min(item.triggerPosition + insertedBars, playbackOrder.length));
      var available = Math.max(0, playbackCap - playbackOrder.length);
      var safeRoute = route.slice(0, available);
      item.insertPosition = insertion;
      item.route = safeRoute.slice();
      if (safeRoute.length) playbackOrder.splice.apply(playbackOrder, [insertion, 0].concat(safeRoute));
      repeatSections.push({
        kind: item.kind,
        startPosition: insertion,
        endPosition: insertion + safeRoute.length,
        barIndices: safeRoute.slice(),
        roadmap: true,
        sourceBarIndex: item.barIndex
      });
      insertedBars += safeRoute.length;
      if (safeRoute.length < route.length) {
        roadmapWarnings.push({
          barIndex: item.barIndex,
          token: item.text,
          message: "Playback order capped at " + playbackCap + " bars"
        });
      }
    });

    warnings = warnings.map(function remapWarning(warning) {
      var mapped = keep.get(warning.barIndex);
      return {
        barIndex: mapped == null ? warning.barIndex : mapped,
        token: warning.token,
        message: warning.message
      };
    }).concat(roadmapWarnings);

    var sections = [];
    bars.forEach(function collectSections(bar) {
      bar.sectionMarkers.forEach(function addSection(label) {
        sections.push({ label: label, raw: "*" + label, barIndex: bar.index });
      });
    });

    return {
      raw: raw,
      sourceRaw: sourceRaw,
      timeSignature: bars.length ? bars[0].timeSignature : activeTimeSignature,
      bars: bars,
      playbackOrder: playbackOrder,
      sections: sections,
      annotations: flatAnnotations,
      repeatSections: repeatSections,
      roadmapDirectives: roadmapDirectives,
      warnings: warnings
    };
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  }

  function songFromChunk(chunk, index) {
    var fields = String(chunk || "").split("=");
    var musicIndex = fields.findIndex(function findMusic(field) {
      return String(field || "").indexOf(MUSIC_PREFIX) === 0;
    });
    if (musicIndex < 0) return null;

    var title;
    var composer;
    var extra;
    var style;
    var key;
    var transpose;
    var musicField;
    var compStyle;
    var bpm;
    var repeats;

    if (musicIndex === 6) {
      title = fields[0];
      composer = fields[1];
      extra = fields[2];
      style = fields[3];
      key = fields[4];
      transpose = fields[5];
      musicField = fields[6];
      compStyle = fields[7];
      bpm = fields[8];
      repeats = fields[9];
    } else {
      var compact = fields.filter(function nonempty(field) { return field !== ""; });
      var compactMusic = compact.findIndex(function findCompactMusic(field) {
        return String(field || "").indexOf(MUSIC_PREFIX) === 0;
      });
      if (compactMusic < 4) return null;
      title = compact[0];
      composer = compact[1];
      style = compact[2];
      key = compact[3];
      musicField = compact[compactMusic];
      var tail = compact.slice(compactMusic + 1);
      compStyle = tail.length >= 3 ? tail[0] : null;
      bpm = tail.length >= 2 ? tail[tail.length - 2] : null;
      repeats = tail.length ? tail[tail.length - 1] : null;
      transpose = compactMusic > 4 ? compact[4] : null;
      extra = null;
    }

    title = String(title || "").trim();
    if (!title || !musicField) return null;
    var music = parseChart(musicField);
    var song = {
      index: index,
      title: title,
      composer: String(composer || "").trim(),
      style: String(style || "").trim(),
      key: String(key || "").trim(),
      transpose: cleanNumber(transpose),
      compStyle: compStyle == null ? null : String(compStyle).trim(),
      bpm: cleanNumber(bpm),
      repeats: cleanNumber(repeats),
      extra: extra == null ? null : String(extra),
      rawChunk: String(chunk || ""),
      rawMusic: musicField,
      music: music,
      bars: music.bars,
      playbackOrder: music.playbackOrder,
      sections: music.sections
    };
    return song;
  }

  function extractPayloads(text) {
    var source = String(text || "");
    var urls = source.match(/irealb:\/\/[^\s\]"'<>]+/g) || [];
    if (urls.length) {
      return urls.map(function decodeUrl(url) {
        return safeDecode(url.slice("irealb://".length));
      });
    }
    if (source.indexOf(MUSIC_PREFIX) >= 0) return [safeDecode(source.replace(/^irealb:\/\//, ""))];
    return [];
  }

  function parsePlaylist(text) {
    var payloads = extractPayloads(text);
    var songs = [];
    var errors = [];
    var names = [];

    payloads.forEach(function parsePayload(payload, payloadIndex) {
      var chunks = payload.split("===");
      chunks.forEach(function parseChunk(chunk) {
        if (!chunk) return;
        if (chunk.indexOf(MUSIC_PREFIX) < 0) {
          var name = chunk.replace(/\[?\/?url.*$/i, "").trim();
          if (name) names.push(name);
          return;
        }
        try {
          var song = songFromChunk(chunk, songs.length);
          if (song) songs.push(song);
          else errors.push({ payloadIndex: payloadIndex, chunk: chunk.slice(0, 80), message: "Invalid song record" });
        } catch (error) {
          errors.push({
            payloadIndex: payloadIndex,
            chunk: chunk.slice(0, 80),
            message: error && error.message ? error.message : "Could not parse song"
          });
        }
      });
    });

    return {
      name: names.length ? names[names.length - 1] : undefined,
      names: names,
      songs: songs,
      errors: errors
    };
  }

  function parseIrealPlaylist(text) {
    return parsePlaylist(text).songs;
  }

  function expandPlayback(chart) {
    var bars = chart && Array.isArray(chart.bars) ? chart.bars : [];
    var order = chart && Array.isArray(chart.playbackOrder)
      ? chart.playbackOrder
      : bars.map(function indexBar(_, index) { return index; });
    return order.map(function playbackBar(index, playbackIndex) {
      return { playbackIndex: playbackIndex, barIndex: index, bar: bars[index] };
    }).filter(function hasBar(entry) { return Boolean(entry.bar); });
  }

  return {
    MUSIC_PREFIX: MUSIC_PREFIX,
    MAX_CHORDS_PER_BAR: MAX_CHORDS_PER_BAR,
    MAX_PLAYBACK_BARS: MAX_PLAYBACK_BARS,
    unscramble: unscramble,
    parseRoadmapDirective: parseRoadmapDirective,
    parseChordSymbol: parseChordSymbol,
    parseChart: parseChart,
    parseIrealBars: parseChart,
    parsePlaylist: parsePlaylist,
    parseIrealPlaylist: parseIrealPlaylist,
    expandPlayback: expandPlayback
  };
});
