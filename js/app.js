/* =========================================================
   Round It! — Build 1
   Core architecture rule: every question produces ONE
   problem object, and the question text, answer choices,
   number line, marker, midpoint, hint, digit check, and
   explanation are ALL rendered from that same object.
   ========================================================= */

(function () {
  "use strict";

  // ---------- Level configuration ----------

  const LEVELS = {
    ten: {
      place: 10,
      placeWord: "ten",
      displayName: "Nearest Ten",
      min: 10,
      max: 999,
      // which digit decides the rounding (offset from the right, 0 = ones)
      checkDigitIndex: 0,
      checkDigitName: "ones",
      placeDigitName: "tens"
    },
    hundred: {
      place: 100,
      placeWord: "hundred",
      displayName: "Nearest Hundred",
      min: 100,
      max: 9999,
      checkDigitIndex: 1,
      checkDigitName: "tens",
      placeDigitName: "hundreds"
    },
    thousand: {
      place: 1000,
      placeWord: "thousand",
      displayName: "Nearest Thousand",
      min: 1000,
      max: 99999,
      checkDigitIndex: 2,
      checkDigitName: "hundreds",
      placeDigitName: "thousands"
    }
  };

  const QUESTIONS_PER_SESSION = 10;
  const MIDPOINT_CHANCE = 0.15; // halfway problems appear occasionally on purpose

  // ---------- Session state ----------

  const state = {
    levelKey: "hundred",
    problem: null,          // the single source-of-truth problem object
    questionIndex: 0,       // 0-based
    correctCount: 0,        // first-try correct
    missedCount: 0,         // needed more than one try
    answered: false,        // current question solved
    firstAttempt: true,     // no wrong guesses yet on current question
    usedKeys: new Set(),    // "number-place" combos used this session
    results: []             // per-question: "correct" | "missed"
  };

  // ---------- DOM references ----------

  const els = {
    levelCards: Array.from(document.querySelectorAll(".level-card")),
    progressLabel: document.getElementById("progress-label"),
    progressDots: document.getElementById("progress-dots"),
    qNumber: document.getElementById("q-number"),
    qPlace: document.getElementById("q-place"),
    answerA: document.getElementById("answer-a"),
    answerB: document.getElementById("answer-b"),
    feedback: document.getElementById("feedback"),
    hintBtn: document.getElementById("hint-btn"),
    speakBtn: document.getElementById("speak-btn"),
    learningSection: document.getElementById("learning-section"),
    numberline: document.getElementById("numberline"),
    nlTicks: document.getElementById("nl-ticks"),
    nlMarker: document.getElementById("nl-marker"),
    nlMarkerLabel: document.getElementById("nl-marker-label"),
    nlLabelLower: document.getElementById("nl-label-lower"),
    nlLabelMid: document.getElementById("nl-label-mid"),
    nlLabelUpper: document.getElementById("nl-label-upper"),
    nlDotLower: document.getElementById("nl-dot-lower"),
    nlDotMid: document.getElementById("nl-dot-mid"),
    nlDotUpper: document.getElementById("nl-dot-upper"),
    hintPanel: document.getElementById("hint-panel"),
    hintList: document.getElementById("hint-list"),
    answerPanel: document.getElementById("answer-panel"),
    answerList: document.getElementById("answer-list"),
    digitPanel: document.getElementById("digit-panel"),
    digitDisplay: document.getElementById("digit-display"),
    digitList: document.getElementById("digit-list"),
    nextBtn: document.getElementById("next-btn"),
    practiceCard: document.getElementById("practice-card"),
    summaryCard: document.getElementById("summary-card"),
    summaryLevel: document.getElementById("summary-level"),
    statCorrect: document.getElementById("stat-correct"),
    statMissed: document.getElementById("stat-missed"),
    statPercent: document.getElementById("stat-percent"),
    summaryMessage: document.getElementById("summary-message"),
    againBtn: document.getElementById("again-btn")
  };

  // ---------- Formatting helpers ----------

  function formatNumber(n) {
    return n.toLocaleString("en-US");
  }

  const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven",
    "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
    "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty",
    "seventy", "eighty", "ninety"];

  // Converts 0–999,999 into spoken words for the Read Aloud feature.
  function numberToWords(n) {
    if (n < 20) return ONES[n];
    if (n < 100) {
      const t = TENS[Math.floor(n / 10)];
      const r = n % 10;
      return r ? t + "-" + ONES[r] : t;
    }
    if (n < 1000) {
      const h = ONES[Math.floor(n / 100)] + " hundred";
      const r = n % 100;
      return r ? h + " " + numberToWords(r) : h;
    }
    const th = numberToWords(Math.floor(n / 1000)) + " thousand";
    const r = n % 1000;
    return r ? th + " " + numberToWords(r) : th;
  }

  // ---------- Core rounding engine ----------

  /**
   * Given a number and rounding place, compute every value the UI needs.
   * All rendering reads from the object this returns.
   */
  function calculateRoundingData(number, place) {
    const lower = Math.floor(number / place) * place;
    const upper = lower + place;
    const midpoint = lower + place / 2;
    // Halfway numbers round UP (number >= midpoint → upper).
    const answer = number < midpoint ? lower : upper;
    // Proportional marker position along the line, 0–100%.
    const position = ((number - lower) / (upper - lower)) * 100;
    return { number, place, lower, upper, midpoint, answer, position };
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generates one fresh problem object for the current level.
   * - Skips numbers already sitting exactly on a rounding endpoint
   *   (they teach nothing).
   * - Occasionally produces an exact-midpoint number on purpose.
   * - Avoids repeating a number/place combo within a session.
   */
  function generateProblem() {
    const level = LEVELS[state.levelKey];
    const { place, min, max } = level;

    for (let attempt = 0; attempt < 200; attempt++) {
      let number;

      if (Math.random() < MIDPOINT_CHANCE) {
        // Build an exact halfway number: lower + place/2.
        const lowerBase = Math.floor(randomInt(min, max) / place) * place;
        number = lowerBase + place / 2;
      } else {
        number = randomInt(min, max);
      }

      if (number < min || number > max) continue;
      if (number % place === 0) continue; // trivial: already rounded

      const key = number + "-" + place;
      if (state.usedKeys.has(key)) continue;

      state.usedKeys.add(key);
      return calculateRoundingData(number, place);
    }

    // Extremely unlikely fallback: accept a repeat rather than loop forever.
    let number;
    do { number = randomInt(min, max); } while (number % place === 0);
    return calculateRoundingData(number, place);
  }

  // ---------- Rendering ----------

  function renderProgress() {
    els.progressLabel.textContent =
      "Question " + (state.questionIndex + 1) + " of " + QUESTIONS_PER_SESSION;

    els.progressDots.innerHTML = "";
    for (let i = 0; i < QUESTIONS_PER_SESSION; i++) {
      const dot = document.createElement("span");
      dot.className = "progress-dot";
      if (i < state.results.length) {
        dot.classList.add(state.results[i] === "correct" ? "done-correct" : "done-missed");
      } else if (i === state.questionIndex) {
        dot.classList.add("current");
      }
      els.progressDots.appendChild(dot);
    }
  }

  function renderProblem() {
    const p = state.problem;
    const level = LEVELS[state.levelKey];

    els.qNumber.textContent = formatNumber(p.number);
    els.qPlace.textContent = level.placeWord;

    // Randomize which side each benchmark lands on.
    const values = Math.random() < 0.5 ? [p.lower, p.upper] : [p.upper, p.lower];
    [els.answerA, els.answerB].forEach((btn, i) => {
      btn.textContent = formatNumber(values[i]);
      btn.dataset.value = String(values[i]);
      btn.disabled = false;
      btn.className = "answer-btn";
      btn.removeAttribute("aria-describedby");
    });

    els.feedback.textContent = "";
    els.feedback.className = "feedback";
    els.nextBtn.disabled = true;
    els.nextBtn.textContent =
      state.questionIndex === QUESTIONS_PER_SESSION - 1 ? "See my results →" : "Next question →";

    // Learning content stays hidden until Hint or a correct answer.
    els.learningSection.hidden = true;
    els.hintPanel.hidden = true;
    els.answerPanel.hidden = true;
    els.digitPanel.hidden = true;

    renderNumberLine();
    renderProgress();
  }

  function renderNumberLine() {
    const p = state.problem;

    // Endpoint / midpoint labels come straight from the problem object.
    els.nlLabelLower.textContent = formatNumber(p.lower);
    els.nlLabelMid.textContent = formatNumber(p.midpoint);
    els.nlLabelUpper.textContent = formatNumber(p.upper);
    els.nlLabelLower.className = "nl-label nl-label-lower";
    els.nlLabelUpper.className = "nl-label nl-label-upper";
    els.nlDotLower.classList.remove("destination");
    els.nlDotUpper.classList.remove("destination");

    // Marker: exact proportional position (verified 0–100 by the engine).
    els.nlMarker.style.left = p.position + "%";
    els.nlMarkerLabel.textContent = formatNumber(p.number);

    // Ten equal divisions between the endpoints; middle tick is major.
    els.nlTicks.innerHTML = "";
    for (let i = 1; i < 10; i++) {
      const tick = document.createElement("span");
      tick.className = "nl-tick" + (i === 5 ? " major" : "");
      tick.style.left = i * 10 + "%";
      els.nlTicks.appendChild(tick);
    }

    els.numberline.setAttribute("aria-label",
      "Number line from " + formatNumber(p.lower) + " to " + formatNumber(p.upper) +
      " with the halfway point at " + formatNumber(p.midpoint) +
      ". A marker shows " + formatNumber(p.number) + ".");
  }

  // ---------- Hint & explanations ----------

  function buildList(listEl, lines) {
    listEl.innerHTML = "";
    lines.forEach(html => {
      const li = document.createElement("li");
      li.innerHTML = html;
      listEl.appendChild(li);
    });
  }

  function showHint() {
    const p = state.problem;
    const f = formatNumber;
    const lines = [
      "<strong>" + f(p.number) + "</strong> is between <strong>" + f(p.lower) +
        "</strong> and <strong>" + f(p.upper) + "</strong>.",
      "The halfway point is <strong>" + f(p.midpoint) + "</strong>."
    ];
    if (p.number === p.midpoint) {
      lines.push(f(p.number) + " sits <strong>exactly on the halfway point</strong>. What is the rule for halfway numbers?");
    } else if (p.number < p.midpoint) {
      lines.push(f(p.number) + " is <strong>less than</strong> " + f(p.midpoint) + ". Which endpoint is it closer to?");
    } else {
      lines.push(f(p.number) + " is <strong>greater than</strong> " + f(p.midpoint) + ". Which endpoint is it closer to?");
    }
    buildList(els.hintList, lines);

    els.learningSection.hidden = false;
    els.hintPanel.hidden = false;
  }

  function showExplanation() {
    const p = state.problem;
    const f = formatNumber;
    let lines;

    if (p.number === p.midpoint) {
      lines = [
        "<strong>" + f(p.number) + "</strong> is exactly halfway between <strong>" +
          f(p.lower) + "</strong> and <strong>" + f(p.upper) + "</strong>.",
        "Numbers at the halfway point <strong>round up</strong>.",
        "<strong>" + f(p.number) + "</strong> rounds to <strong>" + f(p.answer) + "</strong>."
      ];
    } else {
      const closer = p.answer === p.lower ? "less than" : "greater than";
      lines = [
        "<strong>" + f(p.number) + "</strong> is between <strong>" + f(p.lower) +
          "</strong> and <strong>" + f(p.upper) + "</strong>.",
        "<strong>" + f(p.midpoint) + "</strong> is halfway.",
        f(p.number) + " is " + closer + " " + f(p.midpoint) +
          ", so it is closer to <strong>" + f(p.answer) + "</strong>.",
        "<strong>" + f(p.number) + "</strong> rounds to <strong>" + f(p.answer) + "</strong>."
      ];
    }
    buildList(els.answerList, lines);
    renderDigitHint();

    els.learningSection.hidden = false;
    els.answerPanel.hidden = false;
    els.digitPanel.hidden = false;

    highlightDestination();
  }

  // Marks the correct endpoint in green on the number line.
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

  // Traditional place-value rule, generated from the same problem object.
  function renderDigitHint() {
    const p = state.problem;
    const level = LEVELS[state.levelKey];
    const digits = String(p.number).split("");
    const checkPos = digits.length - 1 - level.checkDigitIndex;   // digit to inspect
    const placePos = checkPos - 1;                                 // digit being rounded
    const checkDigit = Number(digits[checkPos]);

    // Build the digit display with commas, highlighting the key digits.
    els.digitDisplay.innerHTML = "";
    digits.forEach((d, i) => {
      const span = document.createElement("span");
      span.textContent = d;
      if (i === checkPos) span.className = "check-digit";
      if (i === placePos) span.className = "place-digit";
      els.digitDisplay.appendChild(span);
      // Insert a comma between groups of three (e.g. 1,249).
      const fromRight = digits.length - 1 - i;
      if (fromRight > 0 && fromRight % 3 === 0) {
        els.digitDisplay.appendChild(document.createTextNode(","));
      }
    });

    const direction = checkDigit <= 4 ? "round down" : "round up";
    buildList(els.digitList, [
      "Look one place to the right of the <strong>" + level.placeDigitName + "</strong> digit.",
      "The <strong>" + level.checkDigitName + "</strong> digit is <strong>" + checkDigit + "</strong>.",
      "0–4 round down. 5–9 round up.",
      "<strong>" + checkDigit + "</strong> means we <strong>" + direction + "</strong> to <strong>" +
        formatNumber(p.answer) + "</strong>."
    ]);
  }

  // ---------- Answer checking ----------

  function checkAnswer(button) {
    if (state.answered) return;

    const chosen = Number(button.dataset.value);
    const p = state.problem;

    if (chosen === p.answer) {
      state.answered = true;
      state.results.push(state.firstAttempt ? "correct" : "missed");
      if (state.firstAttempt) state.correctCount++;
      else state.missedCount++;

      button.className = "answer-btn correct";
      [els.answerA, els.answerB].forEach(b => {
        b.disabled = true;
        if (b !== button) b.classList.add("dimmed");
      });

      els.feedback.textContent = pickPraise();
      els.feedback.className = "feedback good";

      showExplanation();
      els.nextBtn.disabled = false;
      els.nextBtn.focus();
      renderProgress();
    } else {
      state.firstAttempt = false;
      button.classList.add("incorrect");
      els.feedback.textContent = "Almost! Take another look at where the number sits. Try the 💡 Hint.";
      els.feedback.className = "feedback try";
      // Clear the wiggle so it can replay on another wrong tap.
      setTimeout(() => button.classList.remove("incorrect"), 700);
    }
  }

  const PRAISE = [
    "Nice rounding! 🎯",
    "You got it! ⭐",
    "Exactly right! 🙌",
    "Great thinking! 🧠",
    "That's it! 🎉"
  ];
  function pickPraise() {
    return PRAISE[Math.floor(Math.random() * PRAISE.length)];
  }

  // ---------- Session flow ----------

  function startSession() {
    state.questionIndex = 0;
    state.correctCount = 0;
    state.missedCount = 0;
    state.results = [];
    state.usedKeys.clear();

    els.summaryCard.hidden = true;
    els.practiceCard.hidden = false;

    nextQuestion(true);
  }

  function nextQuestion(isFirst) {
    if (!isFirst) {
      if (state.questionIndex >= QUESTIONS_PER_SESSION - 1) {
        finishSession();
        return;
      }
      state.questionIndex++;
    }
    state.answered = false;
    state.firstAttempt = true;
    state.problem = generateProblem();
    renderProblem();
  }

  function finishSession() {
    const total = QUESTIONS_PER_SESSION;
    const pct = Math.round((state.correctCount / total) * 100);

    els.summaryLevel.textContent = LEVELS[state.levelKey].displayName;
    els.statCorrect.textContent = state.correctCount;
    els.statMissed.textContent = state.missedCount;
    els.statPercent.textContent = pct + "%";

    let message;
    if (pct === 100) message = "Perfect score — you're a rounding champion!";
    else if (pct >= 80) message = "Fantastic work! You really know your benchmarks.";
    else if (pct >= 60) message = "Good effort! A little more practice and you'll master it.";
    else message = "Keep going! Use the number line to see where each number sits.";
    els.summaryMessage.textContent = message;

    els.practiceCard.hidden = true;
    els.summaryCard.hidden = false;
    els.againBtn.focus();
  }

  // ---------- Level switching ----------

  function selectLevel(levelKey) {
    if (!LEVELS[levelKey]) return;
    state.levelKey = levelKey;
    els.levelCards.forEach(card => {
      card.setAttribute("aria-checked", String(card.dataset.level === levelKey));
    });
    // A level change always starts a fresh session.
    startSession();
  }

  // ---------- Read aloud ----------

  function speakQuestion() {
    if (!("speechSynthesis" in window)) {
      els.feedback.textContent = "Read aloud isn't available on this device.";
      els.feedback.className = "feedback";
      return;
    }
    const p = state.problem;
    const level = LEVELS[state.levelKey];
    const text = "Round " + numberToWords(p.number) +
      " to the nearest " + level.placeWord + ".";
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      // Fail silently — speech is a bonus, never a blocker.
    }
  }

  // ---------- Wire up events ----------

  els.levelCards.forEach(card => {
    card.addEventListener("click", () => selectLevel(card.dataset.level));
  });

  els.answerA.addEventListener("click", () => checkAnswer(els.answerA));
  els.answerB.addEventListener("click", () => checkAnswer(els.answerB));
  els.hintBtn.addEventListener("click", showHint);
  els.speakBtn.addEventListener("click", speakQuestion);
  els.nextBtn.addEventListener("click", () => nextQuestion(false));
  els.againBtn.addEventListener("click", startSession);

  // ---------- Go ----------

  selectLevel("hundred");

})();
