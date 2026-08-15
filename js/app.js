/* =========================================================
   Round It! — Build 4
   Modes: Learn (tutorial) / Practice (with help) / Test (solo)
   Flow: Home -> Skill -> Mode -> Learn|Practice|Test -> Results

   Single source of truth: calculateRoundingData() returns ONE
   object carrying rounding values AND place-value metadata
   (targetDigit, checkDigit, direction, digit positions). Every
   screen — question, digits, arrows, decide rule, digit animation,
   number line, hints, feedback — reads from that one object.
   The rounded answer always comes from the math engine, so
   carries (950 -> 1,000, 9,950 -> 10,000) are always correct.
   ========================================================= */

(function () {
  "use strict";

  /* Single source of truth for the release label. */
  const BUILD_NUMBER = "Build 4";

  /* ---------- Level config with place-value metadata ---------- */
  const LEVELS = {
    ten: {
      place: 10, placeWord: "ten", displayName: "Nearest Ten",
      min: 10, max: 999, targetIndex: 1, checkIndex: 0,
      targetPlaceName: "tens", checkPlaceName: "ones"
    },
    hundred: {
      place: 100, placeWord: "hundred", displayName: "Nearest Hundred",
      min: 100, max: 9999, targetIndex: 2, checkIndex: 1,
      targetPlaceName: "hundreds", checkPlaceName: "tens"
    },
    thousand: {
      place: 1000, placeWord: "thousand", displayName: "Nearest Thousand",
      min: 1000, max: 99999, targetIndex: 3, checkIndex: 2,
      targetPlaceName: "thousands", checkPlaceName: "hundreds"
    }
  };

  const SESSION_LEN = 10;
  const MIDPOINT_CHANCE = 0.15;

  /* ---------- App state ---------- */
  const state = {
    levelKey: null,
    mode: null,
    problem: null,
    // shared session counters (practice/test)
    qIndex: 0, correct: 0, missed: 0, answered: false, firstTry: true,
    usedKeys: new Set(), results: [],
    hintStep: 0,
    // learn
    learnSet: [], learnIndex: 0, learnStep: 1, learnTargetOk: false, learnCheckOk: false,
    // test
    testMisses: []
  };

  /* ---------- DOM helper ---------- */
  const el = id => document.getElementById(id);

  /* ---------- Formatting ---------- */
  const fmt = n => n.toLocaleString("en-US");
  const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  function words(n){
    if(n<20)return ONES[n];
    if(n<100){const t=TENS[Math.floor(n/10)],r=n%10;return r?t+"-"+ONES[r]:t;}
    if(n<1000){const h=ONES[Math.floor(n/100)]+" hundred",r=n%100;return r?h+" "+words(r):h;}
    const th=words(Math.floor(n/1000))+" thousand",r=n%1000;return r?th+" "+words(r):th;
  }

  /* ---------- Core engine (source of truth) ---------- */
  function digitAt(number, indexFromRight){
    return Math.floor(number / Math.pow(10, indexFromRight)) % 10;
  }
  function calculateRoundingData(number, levelKey){
    const L = LEVELS[levelKey];
    const place = L.place;
    const lower = Math.floor(number / place) * place;
    const upper = lower + place;
    const midpoint = lower + place / 2;
    const answer = number < midpoint ? lower : upper;          // halfway rounds UP
    const position = ((number - lower) / (upper - lower)) * 100;
    const targetDigit = digitAt(number, L.targetIndex);
    const checkDigit  = digitAt(number, L.checkIndex);
    const direction   = checkDigit >= 5 ? "up" : "down";
    return {
      number, levelKey, place, lower, midpoint, upper, answer, position,
      targetIndex: L.targetIndex, checkIndex: L.checkIndex,
      targetPlaceName: L.targetPlaceName, checkPlaceName: L.checkPlaceName,
      targetDigit, checkDigit, direction, isMidpoint: number === midpoint
    };
  }
  const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;

  function generateProblem(){
    const L = LEVELS[state.levelKey], place = L.place;
    for(let i=0;i<200;i++){
      let n;
      if(Math.random()<MIDPOINT_CHANCE){
        n = Math.floor(randInt(L.min,L.max)/place)*place + place/2;
      } else {
        n = randInt(L.min,L.max);
      }
      if(n<L.min||n>L.max) continue;
      if(n%place===0) continue;
      const key = n+"-"+place;
      if(state.usedKeys.has(key)) continue;
      state.usedKeys.add(key);
      return calculateRoundingData(n, state.levelKey);
    }
    let n; do{ n=randInt(L.min,L.max); }while(n%place===0);
    return calculateRoundingData(n, state.levelKey);
  }

  /* Build a deliberate 4-example tutorial set for Learn:
     round-down, round-up, near-the-middle, exact-halfway. */
  function buildLearnSet(){
    const L = LEVELS[state.levelKey], place = L.place;
    const pick = pred => {
      for(let i=0;i<400;i++){
        const n = randInt(L.min, L.max);
        if(n%place===0) continue;
        const p = calculateRoundingData(n, state.levelKey);
        if(pred(p)) return p;
      }
      return calculateRoundingData(randInt(L.min,L.max)+1, state.levelKey);
    };
    const set = [];
    set.push(pick(p => p.checkDigit>=1 && p.checkDigit<=3 && !p.isMidpoint));      // clear down
    set.push(pick(p => p.checkDigit>=6 && p.checkDigit<=9));                        // clear up
    set.push(pick(p => p.checkDigit===4));                                          // near the middle
    // exact halfway
    const base = Math.floor(randInt(L.min,L.max)/place)*place + place/2;
    set.push(calculateRoundingData(Math.min(Math.max(base,L.min),L.max), state.levelKey));
    return set;
  }

  /* ---------- Screen management ---------- */
  const SCREENS = ["home","modes","learn","learn-done","practice","test","results"];
  function showScreen(name){
    SCREENS.forEach(s => { const node = el("screen-"+s); if(node) node.hidden = (s!==name); });
    window.scrollTo(0,0);
  }

  /* ================= HOME ================= */
  const skillCards = Array.from(document.querySelectorAll(".skill-card"));
  function selectSkill(levelKey){
    if(!LEVELS[levelKey]) return;
    state.levelKey = levelKey;
    skillCards.forEach(c => c.setAttribute("aria-checked", String(c.dataset.level===levelKey)));
    el("to-modes-btn").disabled = false;
  }
  function goModes(){
    if(!state.levelKey) return;
    el("modes-skill").textContent = LEVELS[state.levelKey].displayName;
    var _mt = el("modes-skill-tag"); if(_mt) _mt.textContent = LEVELS[state.levelKey].displayName;
    showScreen("modes");
  }
  function goHome(){ stopSpeech(); showScreen("home"); }

  /* ================= MODE PICK ================= */
  function pickMode(mode){
    state.mode = mode;
    if(mode==="learn") startLearn();
    else if(mode==="practice") startPractice();
    else if(mode==="test") startTest();
  }

  /* ======================================================
     LEARN MODE
     ====================================================== */
  function startLearn(){
    state.learnSet = buildLearnSet();
    state.learnIndex = 0;
    el("learn-skill").textContent = LEVELS[state.levelKey].displayName;
    loadLearnExample();
    showScreen("learn");
  }

  function loadLearnExample(){
    state.problem = state.learnSet[state.learnIndex];
    state.learnStep = 1;
    state.learnTargetOk = false;
    state.learnCheckOk = false;
    el("learn-tutorial").textContent = "Example " + (state.learnIndex+1) + " of " + state.learnSet.length;
    renderLearnStep();
  }

  function renderDigits(container, p, opts){
    // opts: { onClick(index), targetIndex, checkIndex, showTarget, showCheck }
    container.innerHTML = "";
    const str = String(p.number);
    const len = str.length;
    str.split("").forEach((d, i) => {
      const idxFromRight = len - 1 - i;
      const cell = document.createElement(opts.onClick ? "button" : "span");
      cell.className = "digit-cell";
      cell.textContent = d;
      if(opts.onClick){
        cell.type = "button";
        cell.setAttribute("aria-label", "digit " + d);
        cell.addEventListener("click", () => opts.onClick(idxFromRight, cell));
      }
      if(opts.showTarget && idxFromRight===p.targetIndex) cell.classList.add("digit-target");
      if(opts.showCheck && idxFromRight===p.checkIndex) cell.classList.add("digit-check");
      // comma separators
      container.appendChild(cell);
      if(idxFromRight>0 && idxFromRight%3===0){
        const c = document.createElement("span");
        c.className = "digit-comma"; c.textContent = ","; c.setAttribute("aria-hidden","true");
        container.appendChild(c);
      }
    });
  }

  function setStepTrack(step){
    Array.from(el("step-track").children).forEach(li => {
      const s = Number(li.dataset.step);
      li.classList.toggle("done", s < step);
      li.classList.toggle("current", s === step);
    });
  }

  function renderLearnStep(){
    const p = state.problem, L = LEVELS[state.levelKey];
    const step = state.learnStep;
    setStepTrack(step);

    // reset shared UI
    el("learn-feedback").textContent = "";
    el("learn-feedback").className = "learn-feedback";
    el("place-labels").hidden = true;
    el("decide-block").hidden = true;
    el("roundit-block").hidden = true;
    el("seewhy-block").hidden = true;
    el("digit-row").hidden = false;
    if(el("look-arrow")) el("look-arrow").hidden = true;
    el("learn-step-label").textContent = "Step " + step + " of 5";
    el("learn-question").innerHTML = "Round <strong>" + fmt(p.number) + "</strong> to the nearest " + L.placeWord;
    el("learn-prev").hidden = (step===1);
    const next = el("learn-next");
    next.hidden = false;

    if(step===1){
      el("learn-step-title").textContent = "Find the place";
      el("learn-instruction").textContent = "We're rounding to the nearest " + L.placeWord + ". Tap the digit in the " + p.targetPlaceName + " place.";
      renderDigits(el("digit-row"), p, { onClick: onTapTarget, showTarget:false, showCheck:false });
      next.disabled = true;
      next.textContent = "Next step \u2192";
    }
    else if(step===2){
      el("learn-step-title").textContent = "Look right";
      el("learn-instruction").textContent = "Now look one place to the right. Tap the digit we need to check.";
      renderDigits(el("digit-row"), p, { onClick: onTapCheck, showTarget:true, showCheck:false });
      positionLookArrow(p);
      next.disabled = true;
    }
    else if(step===3){
      el("learn-step-title").textContent = "Up or down?";
      el("learn-instruction").innerHTML = "The " + p.checkPlaceName + " digit is <strong>" + p.checkDigit + "</strong>. Does it tell us to round up or down?";
      renderDigits(el("digit-row"), p, { showTarget:true, showCheck:true });
      el("decide-block").hidden = false;
      el("down-digits").className = "decide-digits";
      el("up-digits").className = "decide-digits";
      el("decide-down").disabled = false; el("decide-up").disabled = false;
      next.disabled = true;
    }
    else if(step===4){
      el("learn-step-title").textContent = "Round it!";
      el("learn-instruction").textContent = state.problem.direction==="up"
        ? "The checking digit is " + p.checkDigit + ", so we round up."
        : "The checking digit is " + p.checkDigit + ", so we round down.";
      el("digit-row").hidden = true;
      el("roundit-block").hidden = false;
      el("roundit-from").textContent = fmt(p.number);
      el("roundit-to").textContent = fmt(p.answer);
      el("roundit-to").classList.remove("pop");
      void el("roundit-to").offsetWidth; // reflow to replay animation
      el("roundit-to").classList.add("pop");
      el("roundit-note").innerHTML = "Digits to the right of the " + p.targetPlaceName +
        " place become zero. <strong>" + fmt(p.number) + " rounds to " + fmt(p.answer) + ".</strong>";
      next.disabled = false;
    }
    else if(step===5){
      el("learn-step-title").textContent = "See why";
      el("learn-instruction").textContent = "The number line shows why.";
      el("digit-row").hidden = true;
      el("seewhy-block").hidden = false;
      renderNumberLine("learn", p, true);
      const list = el("seewhy-list");
      list.innerHTML = "";
      const lines = p.isMidpoint
        ? [fmt(p.number)+" is between "+fmt(p.lower)+" and "+fmt(p.upper)+".",
           fmt(p.number)+" is <strong>exactly halfway</strong>.",
           "Numbers at the halfway point <strong>round up</strong>.",
           "So "+fmt(p.number)+" rounds to <strong>"+fmt(p.answer)+"</strong>."]
        : [fmt(p.number)+" is between "+fmt(p.lower)+" and "+fmt(p.upper)+".",
           "The halfway point is "+fmt(p.midpoint)+".",
           fmt(p.number)+" is closer to <strong>"+fmt(p.answer)+"</strong>.",
           "So "+fmt(p.number)+" rounds to <strong>"+fmt(p.answer)+"</strong>."];
      lines.forEach(t => { const li=document.createElement("li"); li.innerHTML=t; list.appendChild(li); });
      next.disabled = false;
      next.textContent = (state.learnIndex < state.learnSet.length-1) ? "Next example \u2192" : "Finish \u2713";
    }
  }


  // Draws the "look one place right" arrow from the target digit to the checking digit.
  function positionLookArrow(p){
    var arrow = el("look-arrow");
    if(!arrow) return;
    var cells = Array.from(el("digit-row").querySelectorAll(".digit-cell"));
    if(!cells.length) return;
    var len = cells.length;
    var targetCell = cells[len-1-p.targetIndex];
    var checkCell  = cells[len-1-p.checkIndex];
    if(!targetCell || !checkCell) return;
    var area = el("digit-row").parentElement; // .digit-area
    var ar = area.getBoundingClientRect();
    var tr = targetCell.getBoundingClientRect();
    var cr = checkCell.getBoundingClientRect();
    // In jsdom rects are 0; guard so tests don't error and real browser positions correctly.
    var startX = (tr.left + tr.width/2) - ar.left;
    var endX = (cr.left + cr.width/2) - ar.left;
    arrow.hidden = false;
    arrow.style.left = startX + "px";
    arrow.style.width = Math.max(0, endX - startX) + "px";
  }

  function onTapTarget(idxFromRight, cell){
    const p = state.problem;
    if(idxFromRight===p.targetIndex){
      state.learnTargetOk = true;
      cell.classList.add("digit-target");
      el("learn-feedback").textContent = "Yes! " + p.targetDigit + " is in the " + p.targetPlaceName + " place.";
      el("learn-feedback").className = "learn-feedback good";
      el("place-labels").hidden = true;
      el("learn-next").disabled = false;
      lockDigits();
    } else {
      el("learn-feedback").textContent = "Almost! We're looking for the " + p.targetPlaceName + " place.";
      el("learn-feedback").className = "learn-feedback try";
      showPlaceLabels(p);
    }
  }
  function onTapCheck(idxFromRight, cell){
    const p = state.problem;
    if(idxFromRight===p.checkIndex){
      state.learnCheckOk = true;
      cell.classList.add("digit-check");
      el("learn-feedback").textContent = "The " + p.checkPlaceName + " digit is " + p.checkDigit + ".";
      el("learn-feedback").className = "learn-feedback good";
      el("learn-next").disabled = false;
      lockDigits();
    } else {
      el("learn-feedback").textContent = "Look just one place to the right of the " + p.targetPlaceName + " digit.";
      el("learn-feedback").className = "learn-feedback try";
      showPlaceLabels(p);
    }
  }
  function lockDigits(){
    Array.from(el("digit-row").querySelectorAll("button.digit-cell")).forEach(b => b.disabled = true);
  }
  function showPlaceLabels(p){
    // Build place-value labels above the digits (Hundreds Tens Ones ...)
    const names = ["ones","tens","hundreds","thousands","ten-thousands"];
    const len = String(p.number).length;
    const parts = [];
    for(let i=len-1;i>=0;i--){ parts.push(names[i].charAt(0).toUpperCase()+names[i].slice(1)); }
    el("place-labels").textContent = parts.join("   ");
    el("place-labels").hidden = false;
  }

  function onDecide(dir){
    const p = state.problem;
    if(dir===p.direction){
      el("decide-"+dir).classList.add("chosen");
      el((dir==="up"?"up":"down")+"-digits").classList.add("hot");
      el("learn-feedback").textContent = "Right! " + p.checkDigit + " means round " + dir + ".";
      el("learn-feedback").className = "learn-feedback good";
      el("decide-down").disabled = true; el("decide-up").disabled = true;
      el("learn-next").disabled = false;
    } else {
      el("learn-feedback").innerHTML = "Take another look. Is " + p.checkDigit + " in <strong>0&ndash;4</strong> or <strong>5&ndash;9</strong>?";
      el("learn-feedback").className = "learn-feedback try";
    }
  }

  function learnNext(){
    if(el("learn-next").disabled) return;
    if(state.learnStep < 5){
      state.learnStep++;
      renderLearnStep();
    } else {
      // finished this example
      if(state.learnIndex < state.learnSet.length-1){
        state.learnIndex++;
        loadLearnExample();
      } else {
        finishLearn();
      }
    }
  }
  function learnPrev(){
    if(state.learnStep>1){ state.learnStep--; renderLearnStep(); }
  }
  function finishLearn(){
    el("ld-message").textContent = "You learned how to round to the nearest " + LEVELS[state.levelKey].placeWord + ".";
    showScreen("learn-done");
  }

  /* ======================================================
     Shared number-line renderer (prefix "practice" or "learn")
     ====================================================== */
  function renderNumberLine(scope, p, markDestination){
    const pre = scope==="learn" ? "lnl" : "nl";
    el(pre+"-label-lower").textContent = fmt(p.lower);
    el(pre+"-label-mid").textContent = fmt(p.midpoint);
    el(pre+"-label-upper").textContent = fmt(p.upper);
    el(pre+"-label-lower").className = "nl-label nl-label-lower";
    el(pre+"-label-mid").className = "nl-label nl-label-mid";
    el(pre+"-label-upper").className = "nl-label nl-label-upper";
    el(pre+"-dot-lower").className = "nl-dot nl-dot-lower";
    el(pre+"-dot-mid").className = "nl-dot nl-dot-mid";
    el(pre+"-dot-upper").className = "nl-dot nl-dot-upper";

    el(pre+"-marker").style.left = p.position + "%";
    el(pre+"-marker-label").textContent = fmt(p.number);

    const ticks = el(pre+"-ticks");
    ticks.innerHTML = "";
    for(let i=1;i<10;i++){
      const t=document.createElement("span");
      t.className="nl-tick"+(i===5?" major":"");
      t.style.left=(i*10)+"%";
      ticks.appendChild(t);
    }
    const nlId = scope==="learn" ? "learn-numberline" : "numberline";
    el(nlId).setAttribute("aria-label",
      "Number line from "+fmt(p.lower)+" to "+fmt(p.upper)+", halfway "+fmt(p.midpoint)+", marker at "+fmt(p.number)+".");

    if(markDestination){
      if(p.answer===p.lower){ el(pre+"-dot-lower").classList.add("destination"); el(pre+"-label-lower").classList.add("destination"); }
      else { el(pre+"-dot-upper").classList.add("destination"); el(pre+"-label-upper").classList.add("destination"); }
    }
  }

  /* ======================================================
     PRACTICE MODE
     ====================================================== */
  function startPractice(){
    resetSession();
    el("ph-skill").textContent = LEVELS[state.levelKey].displayName;
    showScreen("practice");
    loadPracticeQuestion(true);
  }
  function resetSession(){
    state.qIndex=0; state.correct=0; state.missed=0;
    state.results=[]; state.usedKeys.clear(); state.testMisses=[];
  }
  function loadPracticeQuestion(first){
    if(!first) state.qIndex++;
    state.answered=false; state.firstTry=true; state.hintStep=0;
    state.problem = generateProblem();
    renderPractice();
  }
  function renderPractice(){
    const p=state.problem, L=LEVELS[state.levelKey];
    el("ph-progress-label").textContent = "Question "+(state.qIndex+1)+" of "+SESSION_LEN;
    el("ph-progress-fill").style.width = ((state.qIndex/SESSION_LEN)*100+10)+"%";
    el("q-number").textContent = fmt(p.number);
    el("q-place").textContent = "nearest "+L.placeWord;

    const vals = Math.random()<0.5 ? [p.lower,p.upper] : [p.upper,p.lower];
    [el("answer-a"),el("answer-b")].forEach((b,i)=>{
      b.textContent=fmt(vals[i]); b.dataset.value=String(vals[i]);
      b.disabled=false; b.className="answer-tile";
    });
    el("feedback").textContent=""; el("feedback").className="feedback";
    el("next-btn").disabled=true;
    el("next-btn").textContent = state.qIndex===SESSION_LEN-1 ? "See my results \u2192" : "Next question \u2192";

    el("hint-list").innerHTML=""; el("hint-empty").hidden=false;
    el("hint-btn").disabled=false; el("hint-btn").textContent="Show a clue";
    el("think-empty").hidden=false;
    el("answer-list").hidden=true; el("answer-list").innerHTML="";
    el("digit-block").hidden=true;

    renderNumberLine("practice", p, false);
  }

  /* Practice hint escalates through the same framework as Learn:
     find place -> look right -> up/down rule -> number line. */
  function practiceHint(){
    const p=state.problem;
    state.hintStep++;
    el("hint-empty").hidden=true;
    const list=el("hint-list"); list.innerHTML="";
    const lines=[];
    if(state.hintStep>=1) lines.push("<strong>Find the place.</strong> Which digit is in the "+p.targetPlaceName+" place? (It's "+p.targetDigit+".)");
    if(state.hintStep>=2) lines.push("<strong>Look right.</strong> The "+p.checkPlaceName+" digit is <strong>"+p.checkDigit+"</strong>.");
    if(state.hintStep>=3) lines.push("<strong>Decide.</strong> 0&ndash;4 round down \u00b7 5&ndash;9 round up.");
    if(state.hintStep>=4){
      lines.push("<strong>Round it.</strong> "+fmt(p.number)+" is between "+fmt(p.lower)+" and "+fmt(p.upper)+"; halfway is "+fmt(p.midpoint)+".");
      renderNumberLine("practice", p, false);
    }
    lines.forEach(t=>{const li=document.createElement("li");li.innerHTML=t;list.appendChild(li);});
    if(state.hintStep>=4){ el("hint-btn").disabled=true; el("hint-btn").textContent="That's every clue"; }
    else el("hint-btn").textContent="Show another clue";
  }

  const PRAISE=["Great job!","You got it!","Exactly right!","Nice rounding!","Well done!"];
  function practiceAnswer(btn){
    if(state.answered) return;
    const chosen=Number(btn.dataset.value), p=state.problem;
    if(chosen===p.answer){
      state.answered=true;
      state.results.push(state.firstTry?"correct":"missed");
      if(state.firstTry) state.correct++; else state.missed++;
      btn.className="answer-tile correct";
      [el("answer-a"),el("answer-b")].forEach(b=>{b.disabled=true; if(b!==btn)b.classList.add("dimmed");});
      el("feedback").textContent=PRAISE[randInt(0,PRAISE.length-1)]+" "+fmt(p.number)+" rounds to "+fmt(p.answer)+".";
      el("feedback").className="feedback good";
      practiceExplain();
      el("next-btn").disabled=false; el("next-btn").focus();
    } else {
      state.firstTry=false;
      btn.classList.add("incorrect");
      el("feedback").textContent="Almost! Let's look at it again \u2014 where does "+fmt(p.number)+" sit?";
      el("feedback").className="feedback try";
      setTimeout(()=>btn.classList.remove("incorrect"),700);
    }
  }
  function practiceExplain(){
    const p=state.problem;
    el("think-empty").hidden=true;
    const al=el("answer-list"); al.hidden=false; al.innerHTML="";
    const lines = p.isMidpoint
      ? [fmt(p.number)+" is exactly halfway between "+fmt(p.lower)+" and "+fmt(p.upper)+".",
         "Numbers at the halfway point <strong>round up</strong>.",
         fmt(p.number)+" rounds to <strong>"+fmt(p.answer)+"</strong>."]
      : [fmt(p.number)+" is between "+fmt(p.lower)+" and "+fmt(p.upper)+".",
         fmt(p.midpoint)+" is halfway.",
         fmt(p.number)+" is "+(p.answer===p.lower?"less":"more")+" than "+fmt(p.midpoint)+", so it rounds to <strong>"+fmt(p.answer)+"</strong>."];
    lines.forEach(t=>{const li=document.createElement("li");li.innerHTML=t;al.appendChild(li);});
    renderDigitExplain(p);
    el("digit-block").hidden=false;
    renderNumberLine("practice", p, true);
  }
  function renderDigitExplain(p){
    const disp=el("digit-display"); disp.innerHTML="";
    const str=String(p.number), len=str.length;
    str.split("").forEach((d,i)=>{
      const idxR=len-1-i;
      const s=document.createElement("span"); s.textContent=d;
      if(idxR===p.checkIndex) s.className="check-digit";
      if(idxR===p.targetIndex) s.className="place-digit";
      disp.appendChild(s);
      if(idxR>0 && idxR%3===0) disp.appendChild(document.createTextNode(","));
    });
    const dl=el("digit-list"); dl.innerHTML="";
    [ "Look at the digit right after the <strong>"+p.targetPlaceName+"</strong> place.",
      "The <strong>"+p.checkPlaceName+"</strong> digit is <strong>"+p.checkDigit+"</strong>.",
      "0\u20134 round down \u00b7 5\u20139 round up.",
      "So we round "+p.direction+" to <strong>"+fmt(p.answer)+"</strong>."
    ].forEach(t=>{const li=document.createElement("li");li.innerHTML=t;dl.appendChild(li);});
  }
  function practiceNext(){
    if(el("next-btn").disabled) return;
    el("next-btn").disabled=true; stopSpeech();
    if(state.qIndex>=SESSION_LEN-1) finishSession("practice");
    else loadPracticeQuestion(false);
  }

  /* ======================================================
     TEST MODE — no assistance during questions
     ====================================================== */
  function startTest(){
    resetSession();
    el("test-skill").textContent = LEVELS[state.levelKey].displayName;
    showScreen("test");
    loadTestQuestion(true);
  }
  function loadTestQuestion(first){
    if(!first) state.qIndex++;
    state.answered=false;
    state.problem = generateProblem();
    renderTest();
  }
  function renderTest(){
    const p=state.problem, L=LEVELS[state.levelKey];
    el("test-progress-label").textContent="Question "+(state.qIndex+1)+" of "+SESSION_LEN;
    el("test-progress-fill").style.width=((state.qIndex/SESSION_LEN)*100+10)+"%";
    el("test-q-number").textContent=fmt(p.number);
    el("test-q-place").textContent="nearest "+L.placeWord;
    const vals = Math.random()<0.5 ? [p.lower,p.upper] : [p.upper,p.lower];
    [el("test-answer-a"),el("test-answer-b")].forEach((b,i)=>{
      b.textContent=fmt(vals[i]); b.dataset.value=String(vals[i]);
      b.disabled=false; b.className="answer-tile";
    });
    el("test-feedback").textContent=""; el("test-feedback").className="feedback";
    el("test-next").disabled=true;
    el("test-next").textContent = state.qIndex===SESSION_LEN-1 ? "Finish test \u2192" : "Next question \u2192";
  }
  function testAnswer(btn){
    if(state.answered) return;
    state.answered=true;
    const chosen=Number(btn.dataset.value), p=state.problem;
    const ok = chosen===p.answer;
    if(ok) state.correct++;
    else { state.missed++; state.testMisses.push(p); }
    state.results.push(ok?"correct":"missed");
    // neutral feedback only — no teaching
    [el("test-answer-a"),el("test-answer-b")].forEach(b=>{
      b.disabled=true;
      if(Number(b.dataset.value)===chosen) b.classList.add(ok?"correct":"picked-wrong");
    });
    el("test-feedback").textContent="Answer recorded.";
    el("test-feedback").className="feedback";
    el("test-next").disabled=false; el("test-next").focus();
  }
  function testNext(){
    if(el("test-next").disabled) return;
    el("test-next").disabled=true; stopSpeech();
    if(state.qIndex>=SESSION_LEN-1) finishSession("test");
    else loadTestQuestion(false);
  }

  /* ======================================================
     RESULTS  (+ Test review)
     ====================================================== */
  function finishSession(mode){
    const pct=Math.round((state.correct/SESSION_LEN)*100);
    el("results-skill").textContent = LEVELS[state.levelKey].displayName + " \u00b7 " + (mode==="test"?"Test":"Practice");
    el("stat-correct").textContent=state.correct;
    el("stat-missed").textContent=SESSION_LEN-state.correct;
    el("stat-percent").textContent=pct+"%";
    el("results-ring").style.setProperty("--pct",pct);
    el("results-heading").textContent = mode==="test" ? "Test complete!" : "Session complete!";

    let msg,emoji;
    if(pct===100){msg="Perfect score \u2014 you're a rounding champion!";emoji="\uD83C\uDFC6";}
    else if(pct>=80){msg="Fantastic work! You really know your benchmarks.";emoji="\uD83C\uDF89";}
    else if(pct>=60){msg="Good effort! A little more practice and you'll master it.";emoji="\uD83D\uDC4D";}
    else {msg="Keep going! The number line shows where each number sits.";emoji="\uD83D\uDCAA";}
    el("results-message").textContent=msg; el("results-emoji").textContent=emoji;

    // Review (test only, with misses)
    const review=el("review-block");
    if(mode==="test" && state.testMisses.length){
      review.hidden=false;
      const list=el("review-list"); list.innerHTML="";
      state.testMisses.forEach(p=>{
        const card=document.createElement("div");
        card.className="review-item";
        card.innerHTML =
          "<p class='review-q'>Round <strong>"+fmt(p.number)+"</strong> to the nearest "+LEVELS[p.levelKey].placeWord+"</p>"+
          "<p class='review-a'>Answer: <strong>"+fmt(p.answer)+"</strong></p>"+
          "<p class='review-why'>The "+p.checkPlaceName+" digit is "+p.checkDigit+" \u2192 round "+p.direction+
          ". "+fmt(p.number)+" is between "+fmt(p.lower)+" and "+fmt(p.upper)+" (halfway "+fmt(p.midpoint)+").</p>";
        list.appendChild(card);
      });
    } else {
      review.hidden=true;
    }

    // Action buttons vary by mode
    const actions=el("results-actions"); actions.innerHTML="";
    const mk=(label,cls,fn)=>{const b=document.createElement("button");b.type="button";b.className=cls;b.textContent=label;b.addEventListener("click",fn);return b;};
    if(mode==="test"){
      if(state.testMisses.length) actions.appendChild(mk("Practice my misses","next-btn",practiceMisses));
      actions.appendChild(mk("Test again","ghost-btn",startTest));
      actions.appendChild(mk("Choose another mode","ghost-btn",goModes));
      actions.appendChild(mk("Home","ghost-btn",goHome));
    } else {
      actions.appendChild(mk("Practice again","next-btn",startPractice));
      actions.appendChild(mk("Choose another mode","ghost-btn",goModes));
      actions.appendChild(mk("Choose another skill","ghost-btn",goHome));
    }
    showScreen("results");
  }

  // Take the missed test problems into Practice-style support.
  function practiceMisses(){
    const misses = state.testMisses.slice();
    resetSession();
    state.mode="practice";
    el("ph-skill").textContent = LEVELS[state.levelKey].displayName;
    // queue the missed problems by seeding usedKeys is not enough; drive directly
    state._queue = misses;
    showScreen("practice");
    state.qIndex=0; state.answered=false; state.firstTry=true; state.hintStep=0;
    state.problem = state._queue.shift() || generateProblem();
    // shorten the session to the number of misses
    renderPractice();
    // patch progress label to reflect the miss set length
    el("ph-progress-label").textContent = "Review 1 of " + (misses.length);
    state._reviewTotal = misses.length; state._reviewIndex = 0; state._reviewMode = true;
  }

  /* ======================================================
     Read aloud
     ====================================================== */
  function stopSpeech(){ if("speechSynthesis" in window){ try{window.speechSynthesis.cancel();}catch(e){} } }
  function speakQuestion(){
    if(!("speechSynthesis" in window)){
      el("feedback").textContent="Read aloud isn't available on this device.";
      el("feedback").className="feedback"; return;
    }
    const p=state.problem, L=LEVELS[state.levelKey];
    try{
      window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance("Round "+words(p.number)+" to the nearest "+L.placeWord+".");
      u.rate=0.92; window.speechSynthesis.speak(u);
    }catch(e){}
  }

  /* Override practiceNext when reviewing misses so it walks the queue. */
  const _origPracticeNext = practiceNext;
  function practiceNextRouter(){
    if(state._reviewMode){
      if(el("next-btn").disabled) return;
      el("next-btn").disabled=true; stopSpeech();
      state._reviewIndex++;
      if(state._reviewIndex >= state._reviewTotal){ state._reviewMode=false; finishSession("practice"); return; }
      state.answered=false; state.firstTry=true; state.hintStep=0;
      state.problem = state._queue.shift() || generateProblem();
      renderPractice();
      el("ph-progress-label").textContent = "Review "+(state._reviewIndex+1)+" of "+state._reviewTotal;
      return;
    }
    _origPracticeNext();
  }

  /* ======================================================
     Wire events
     ====================================================== */
  skillCards.forEach(c=>c.addEventListener("click",()=>selectSkill(c.dataset.level)));
  el("to-modes-btn").addEventListener("click",goModes);
  el("modes-back").addEventListener("click",goHome);
  var _mh=el("modes-home"); if(_mh) _mh.addEventListener("click",goHome);
  document.querySelectorAll(".mode-card").forEach(c=>c.addEventListener("click",()=>pickMode(c.dataset.mode)));

  // Learn
  el("learn-back").addEventListener("click",goModes);
  el("learn-next").addEventListener("click",learnNext);
  el("learn-prev").addEventListener("click",learnPrev);
  el("decide-down").addEventListener("click",()=>onDecide("down"));
  el("decide-up").addEventListener("click",()=>onDecide("up"));
  el("ld-practice").addEventListener("click",startPractice);
  el("ld-again").addEventListener("click",startLearn);
  el("ld-modes").addEventListener("click",goModes);
  var _ldh=el("ld-home"); if(_ldh) _ldh.addEventListener("click",goHome);

  // Practice
  el("answer-a").addEventListener("click",()=>practiceAnswer(el("answer-a")));
  el("answer-b").addEventListener("click",()=>practiceAnswer(el("answer-b")));
  el("hint-btn").addEventListener("click",practiceHint);
  el("speak-btn").addEventListener("click",speakQuestion);
  el("next-btn").addEventListener("click",practiceNextRouter);
  el("practice-modes").addEventListener("click",goModes);

  // Test
  el("test-answer-a").addEventListener("click",()=>testAnswer(el("test-answer-a")));
  el("test-answer-b").addEventListener("click",()=>testAnswer(el("test-answer-b")));
  el("test-next").addEventListener("click",testNext);
  el("test-home").addEventListener("click",goHome);

  /* ---------- Expose a tiny hook for automated audits ---------- */
  window.__roundit = { calculateRoundingData, LEVELS, state, BUILD_NUMBER };

  /* ---------- Boot ---------- */
  (function stampBuild(){
    const b = el("build-badge");
    if(b) b.textContent = "Round It! \u2014 " + BUILD_NUMBER;
  })();
  showScreen("home");

})();
