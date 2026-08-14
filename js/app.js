/* =========================================================
   Round It! — Build 2
   Application states: Home -> Practice -> Results
   Rounding engine preserved from Build 1. Every problem has
   ONE source-of-truth object; question, answers, ruler,
   marker, midpoint, hint, digit check, explanation, feedback
   and Read Aloud all derive from it.
   ========================================================= */

(function () {
  "use strict";

  // ---------- Level configuration ----------
  const LEVELS = {
    ten: {
      place: 10, placeWord: "ten", displayName: "Nearest Ten",
      min: 10, max: 999, checkDigitIndex: 0,
      checkDigitName: "ones", placeDigitName: "tens"
    },
    hundred: {
      place: 100, placeWord: "hundred", displayName: "Nearest Hundred",
      min: 100, max: 9999, checkDigitIndex: 1,
      checkDigitName: "tens", placeDigitName: "hundreds"
    },
    thousand: {
      place: 1000, placeWord: "thousand", displayName: "Nearest Thousand",
      min: 1000, max: 99999, checkDigitIndex: 2,
      checkDigitName: "hundreds", placeDigitName: "thousands"
    }
  };

  const QUESTIONS_PER_SESSION = 10;
  const MIDPOINT_CHANCE = 0.15;

  // ---------- Session state ----------
  const state = {
    levelKey: null,
    problem: null,
    questionIndex: 0,
    correctCount: 0,
    missedCount: 0,
    answered: false,
    firstAttempt: true,
    hintStep: 0,          // staged hint progress (0..3)
    usedKeys: new Set(),
    results: []
  };

  // ---------- DOM ----------
  const el = id => document.getElementById(id);
  const els = {
    screens: {
      home: el("screen-home"),
      practice: el("screen-practice"),
      results: el("screen-results")
    },
    skillCards: Array.from(document.querySelectorAll(".skill-card")),
    startBtn: el("start-btn"),
    phSkill: el("ph-skill"),
    phProgressLabel: el("ph-progress-label"),
    phProgressFill: el("ph-progress-fill"),
    phHome: el("ph-home"),
    qNumber: el("q-number"),
    qPlace: el("q-place"),
    answerA: el("answer-a"),
    answerB: el("answer-b"),
    feedback: el("feedback"),
    numberline: el("numberline"),
    nlTicks: el("nl-ticks"),
    nlMarker: el("nl-marker"),
    nlMarkerLabel: el("nl-marker-label"),
    nlLabelLower: el("nl-label-lower"),
    nlLabelMid: el("nl-label-mid"),
    nlLabelUpper: el("nl-label-upper"),
    nlDotLower: el("nl-dot-lower"),
    nlDotMid: el("nl-dot-mid"),
    nlDotUpper: el("nl-dot-upper"),
    hintEmpty: el("hint-empty"),
    hintList: el("hint-list"),
    hintBtn: el("hint-btn"),
    thinkEmpty: el("think-empty"),
    answerList: el("answer-list"),
    digitBlock: el("digit-block"),
    digitDisplay: el("digit-display"),
    digitList: el("digit-list"),
    speakBtn: el("speak-btn"),
    nextBtn: el("next-btn"),
    resultsSkill: el("results-skill"),
    resultsRing: el("results-ring"),
    statPercent: el("stat-percent"),
    statCorrect: el("stat-correct"),
    statMissed: el("stat-missed"),
    resultsMessage: el("results-message"),
    resultsEmoji: el("results-emoji"),
    againBtn: el("again-btn"),
    chooseBtn: el("choose-btn")
  };

  // ---------- Formatting ----------
  function formatNumber(n) { return n.toLocaleString("en-US"); }

  const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine",
    "ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  function numberToWords(n) {
    if (n < 20) return ONES[n];
    if (n < 100) { const t = TENS[Math.floor(n/10)], r = n%10; return r ? t+"-"+ONES[r] : t; }
    if (n < 1000) { const h = ONES[Math.floor(n/100)]+" hundred", r = n%100; return r ? h+" "+numberToWords(r) : h; }
    const th = numberToWords(Math.floor(n/1000))+" thousand", r = n%1000;
    return r ? th+" "+numberToWords(r) : th;
  }

  // ---------- Core rounding engine (preserved) ----------
  function calculateRoundingData(number, place) {
    const lower = Math.floor(number / place) * place;
    const upper = lower + place;
    const midpoint = lower + place / 2;
    // Halfway numbers round UP (number >= midpoint -> upper).
    const answer = number < midpoint ? lower : upper;
    // Proportional marker position along the line, 0-100%.
    const position = ((number - lower) / (upper - lower)) * 100;
    return { number, place, lower, upper, midpoint, answer, position };
  }

  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function generateProblem() {
    const { place, min, max } = LEVELS[state.levelKey];
    for (let attempt = 0; attempt < 200; attempt++) {
      let number;
      if (Math.random() < MIDPOINT_CHANCE) {
        const lowerBase = Math.floor(randomInt(min, max) / place) * place;
        number = lowerBase + place / 2;
      } else {
        number = randomInt(min, max);
      }
      if (number < min || number > max) continue;
      if (number % place === 0) continue;         // skip trivial already-rounded
      const key = number + "-" + place;
      if (state.usedKeys.has(key)) continue;      // no repeats within a session
      state.usedKeys.add(key);
      return calculateRoundingData(number, place);
    }
    let number;
    do { number = randomInt(min, max); } while (number % place === 0);
    return calculateRoundingData(number, place);
  }

  // ---------- Screen management ----------
  function showScreen(name) {
    Object.keys(els.screens).forEach(k => {
      els.screens[k].hidden = (k !== name);
    });
    window.scrollTo(0, 0);
  }

  // ---------- Home ----------
  function selectSkill(levelKey) {
    if (!LEVELS[levelKey]) return;
    state.levelKey = levelKey;
    els.skillCards.forEach(c => c.setAttribute("aria-checked", String(c.dataset.level === levelKey)));
    els.startBtn.disabled = false;
  }

  function goHome() {
    stopSpeech();
    showScreen("home");
    // keep last selection highlighted; nothing else to reset until Start
  }

  // ---------- Session ----------
  function startSession() {
    state.questionIndex = 0;
    state.correctCount = 0;
    state.missedCount = 0;
    state.results = [];
    state.usedKeys.clear();
    els.phSkill.textContent = LEVELS[state.levelKey].displayName;
    showScreen("practice");
    loadQuestion(true);
  }

  function loadQuestion(isFirst) {
    if (!isFirst) state.questionIndex++;
    state.answered = false;
    state.firstAttempt = true;
    state.hintStep = 0;
    state.problem = generateProblem();
    renderProblem();
  }

  // ---------- Rendering ----------
  function renderProblem() {
    const p = state.problem;
    const level = LEVELS[state.levelKey];

    // Header progress
    els.phProgressLabel.textContent = "Question " + (state.questionIndex + 1) + " of " + QUESTIONS_PER_SESSION;
    els.phProgressFill.style.width = (((state.questionIndex) / QUESTIONS_PER_SESSION) * 100 + 10) + "%";

    // Question
    els.qNumber.textContent = formatNumber(p.number);
    els.qPlace.textContent = "nearest " + level.placeWord;

    // Answers, randomized sides
    const values = Math.random() < 0.5 ? [p.lower, p.upper] : [p.upper, p.lower];
    [els.answerA, els.answerB].forEach((btn, i) => {
      btn.textContent = formatNumber(values[i]);
      btn.dataset.value = String(values[i]);
      btn.disabled = false;
      btn.className = "answer-tile";
    });

    // Reset feedback + actions
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
    els.nextBtn.disabled = true;
    els.nextBtn.textContent =
      state.questionIndex === QUESTIONS_PER_SESSION - 1 ? "See my results \u2192" : "Next question \u2192";

    // Reset hint panel
    els.hintList.innerHTML = "";
    els.hintEmpty.hidden = false;
    els.hintBtn.disabled = false;
    els.hintBtn.textContent = "Show a clue";

    // Reset think panel
    els.thinkEmpty.hidden = false;
    els.answerList.hidden = true;
    els.answerList.innerHTML = "";
    els.digitBlock.hidden = true;

    renderNumberLine();
  }

  function renderNumberLine() {
    const p = state.problem;

    els.nlLabelLower.textContent = formatNumber(p.lower);
    els.nlLabelMid.textContent = formatNumber(p.midpoint);
    els.nlLabelUpper.textContent = formatNumber(p.upper);

    // Reset label / dot states
    els.nlLabelLower.className = "nl-label nl-label-lower";
    els.nlLabelMid.className = "nl-label nl-label-mid";
    els.nlLabelUpper.className = "nl-label nl-label-upper";
    els.nlDotLower.className = "nl-dot nl-dot-lower";
    els.nlDotMid.className = "nl-dot nl-dot-mid";
    els.nlDotUpper.className = "nl-dot nl-dot-upper";

    // Marker: exact proportional position from the SAME problem object.
    els.nlMarker.style.left = p.position + "%";
    els.nlMarkerLabel.textContent = formatNumber(p.number);
    els.nlMarker.classList.remove("hidden-marker");

    // Ten equal divisions, middle tick major.
    els.nlTicks.innerHTML = "";
    for (let i = 1; i < 10; i++) {
      const tick = document.createElement("span");
      tick.className = "nl-tick" + (i === 5 ? " major" : "");
      tick.style.left = (i * 10) + "%";
      els.nlTicks.appendChild(tick);
    }

    els.numberline.setAttribute("aria-label",
      "Number line from " + formatNumber(p.lower) + " to " + formatNumber(p.upper) +
      ", halfway point " + formatNumber(p.midpoint) +
      ", marker at " + formatNumber(p.number) + ".");
  }

  // ---------- Staged hint ----------
  function buildList(listEl, lines) {
    listEl.innerHTML = "";
    lines.forEach(html => {
      const li = document.createElement("li");
      li.innerHTML = html;
      listEl.appendChild(li);
    });
  }

  // Reveals landmarks one step at a time; does not give the answer away
  // unless the student has already answered.
  function showHint() {
    const p = state.problem, f = formatNumber;
    state.hintStep++;
    els.hintEmpty.hidden = true;

    const lines = [];
    if (state.hintStep >= 1) {
      lines.push(f(p.number) + " is <strong>between " + f(p.lower) + " and " + f(p.upper) + "</strong>.");
      els.nlDotLower.classList.add("pulse");
      els.nlDotUpper.classList.add("pulse");
      els.nlLabelLower.classList.add("highlight");
      els.nlLabelUpper.classList.add("highlight");
    }
    if (state.hintStep >= 2) {
      lines.push("<strong>" + f(p.midpoint) + "</strong> is halfway.");
      els.nlDotMid.classList.add("pulse");
      els.nlLabelMid.classList.add("highlight");
    }
    if (state.hintStep >= 3) {
      if (p.number === p.midpoint) {
        lines.push(f(p.number) + " is <strong>exactly on the halfway point</strong>. Halfway numbers round up.");
      } else if (p.number < p.midpoint) {
        lines.push(f(p.number) + " sits <strong>before</strong> the halfway point.");
      } else {
        lines.push(f(p.number) + " sits <strong>past</strong> the halfway point.");
      }
    }
    buildList(els.hintList, lines);

    if (state.hintStep >= 3) {
      els.hintBtn.disabled = true;
      els.hintBtn.textContent = "That's every clue";
    } else {
      els.hintBtn.textContent = "Show another clue";
    }
  }

  // ---------- Explanation after answering ----------
  function showExplanation() {
    const p = state.problem, f = formatNumber;
    let lines;
    if (p.number === p.midpoint) {
      lines = [
        "<strong>" + f(p.number) + "</strong> is exactly halfway between " + f(p.lower) + " and " + f(p.upper) + ".",
        "Numbers at the halfway point <strong>round up</strong>.",
        "<strong>" + f(p.number) + "</strong> rounds to <strong>" + f(p.answer) + "</strong>."
      ];
    } else {
      const rel = p.answer === p.lower ? "less than" : "greater than";
      lines = [
        "<strong>" + f(p.number) + "</strong> is between " + f(p.lower) + " and " + f(p.upper) + ".",
        "<strong>" + f(p.midpoint) + "</strong> is halfway.",
        f(p.number) + " is " + rel + " " + f(p.midpoint) + ", so it is closer to <strong>" + f(p.answer) + "</strong>.",
        "<strong>" + f(p.number) + "</strong> rounds to <strong>" + f(p.answer) + "</strong>."
      ];
    }
    els.thinkEmpty.hidden = true;
    els.answerList.hidden = false;
    buildList(els.answerList, lines);

    renderDigitHint();
    els.digitBlock.hidden = false;

    highlightDestination();
  }

  function highlightDestination() {
    const p = state.problem;
    if (p.answer === p.lower) {
      els.nlDotLower.classList.add("destination");
      els.nlLabelLower.classList.add("destination");
    } else {
      els.nlDotUpper.classList.add("destination");
      els.nlLabelUpper.classList.add("destination");
    }
  }

  function renderDigitHint() {
    const p = state.problem;
    const level = LEVELS[state.levelKey];
    const digits = String(p.number).split("");
    const checkPos = digits.length - 1 - level.checkDigitIndex;
    const placePos = checkPos - 1;
    const checkDigit = Number(digits[checkPos]);

    els.digitDisplay.innerHTML = "";
    digits.forEach((d, i) => {
      const span = document.createElement("span");
      span.textContent = d;
      if (i === checkPos) span.className = "check-digit";
      if (i === placePos) span.className = "place-digit";
      els.digitDisplay.appendChild(span);
      const fromRight = digits.length - 1 - i;
      if (fromRight > 0 && fromRight % 3 === 0) {
        els.digitDisplay.appendChild(document.createTextNode(","));
      }
    });

    const direction = checkDigit <= 4 ? "round down" : "round up";
    buildList(els.digitList, [
      "Look at the digit right after the <strong>" + level.placeDigitName + "</strong> place.",
      "The <strong>" + level.checkDigitName + "</strong> digit is <strong>" + checkDigit + "</strong>.",
      "0\u20134 round down \u00b7 5\u20139 round up.",
      "So we <strong>" + direction + "</strong> to <strong>" + formatNumber(p.answer) + "</strong>."
    ]);
  }

  // ---------- Answer checking ----------
  const PRAISE = ["Great job!", "You got it!", "Exactly right!", "Nice rounding!", "Well done!"];

  function checkAnswer(button) {
    if (state.answered) return;                 // guard against double scoring
    const chosen = Number(button.dataset.value);
    const p = state.problem;

    if (chosen === p.answer) {
      state.answered = true;
      state.results.push(state.firstAttempt ? "correct" : "missed");
      if (state.firstAttempt) state.correctCount++; else state.missedCount++;

      button.className = "answer-tile correct";
      [els.answerA, els.answerB].forEach(b => {
        b.disabled = true;
        if (b !== button) b.classList.add("dimmed");
      });

      const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
      els.feedback.textContent = praise + " " + formatNumber(p.number) + " rounds to " + formatNumber(p.answer) + ".";
      els.feedback.className = "feedback good";

      showExplanation();
      els.nextBtn.disabled = false;
      els.nextBtn.focus();
    } else {
      state.firstAttempt = false;
      button.classList.add("incorrect");
      els.feedback.textContent = "Almost! Look at where " + formatNumber(p.number) + " sits compared with the halfway point.";
      els.feedback.className = "feedback try";
      setTimeout(() => button.classList.remove("incorrect"), 700);
    }
  }

  // ---------- Next question (single advance) ----------
  function handleNext() {
    if (els.nextBtn.disabled) return;
    els.nextBtn.disabled = true;                // prevents double-click skipping
    stopSpeech();
    if (state.questionIndex >= QUESTIONS_PER_SESSION - 1) {
      finishSession();
    } else {
      loadQuestion(false);
    }
  }

  // ---------- Results ----------
  function finishSession() {
    const pct = Math.round((state.correctCount / QUESTIONS_PER_SESSION) * 100);
    els.resultsSkill.textContent = LEVELS[state.levelKey].displayName;
    els.statCorrect.textContent = state.correctCount;
    els.statMissed.textContent = QUESTIONS_PER_SESSION - state.correctCount;
    els.statPercent.textContent = pct + "%";
    els.resultsRing.style.setProperty("--pct", pct);

    let msg, emoji;
    if (pct === 100) { msg = "Perfect score \u2014 you're a rounding champion!"; emoji = "\uD83C\uDFC6"; }
    else if (pct >= 80) { msg = "Fantastic work! You really know your benchmarks."; emoji = "\uD83C\uDF89"; }
    else if (pct >= 60) { msg = "Good effort! A little more practice and you'll master it."; emoji = "\uD83D\uDC4D"; }
    else { msg = "Keep going! Use the number line to see where each number sits."; emoji = "\uD83D\uDCAA"; }
    els.resultsMessage.textContent = msg;
    els.resultsEmoji.textContent = emoji;

    showScreen("results");
  }

  // ---------- Read aloud ----------
  function stopSpeech() {
    if ("speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }
  function speakQuestion() {
    if (!("speechSynthesis" in window)) {
      els.feedback.textContent = "Read aloud isn't available on this device.";
      els.feedback.className = "feedback";
      return;
    }
    const p = state.problem, level = LEVELS[state.levelKey];
    const text = "Round " + numberToWords(p.number) + " to the nearest " + level.placeWord + ".";
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is a bonus, never a blocker */ }
  }

  // ---------- Events ----------
  els.skillCards.forEach(card => {
    card.addEventListener("click", () => selectSkill(card.dataset.level));
  });
  els.startBtn.addEventListener("click", () => { if (state.levelKey) startSession(); });
  els.phHome.addEventListener("click", goHome);
  els.answerA.addEventListener("click", () => checkAnswer(els.answerA));
  els.answerB.addEventListener("click", () => checkAnswer(els.answerB));
  els.hintBtn.addEventListener("click", showHint);
  els.speakBtn.addEventListener("click", speakQuestion);
  els.nextBtn.addEventListener("click", handleNext);
  els.againBtn.addEventListener("click", startSession);
  els.chooseBtn.addEventListener("click", goHome);

  // ---------- Boot ----------
  showScreen("home");

})();
