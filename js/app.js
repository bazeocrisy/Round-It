/* =========================================================
   Round It! — Build 5
   Wizard: Skill -> Number Size -> Mode -> Learn/Practice/Test
   ONE active problem drives every current-problem element.
   Learn containers start EMPTY in HTML; all values come from
   the active problem object. Future-step blocks stay [hidden]
   (guarded by [hidden]{display:none!important}) until reached.
   ========================================================= */

(function () {
  "use strict";

  const BUILD_NUMBER = "Build 5";

  /* ---------- Config ---------- */
  const LEVELS = {
    ten:      { place:10,   placeWord:"ten",      displayName:"Nearest Ten",      targetIndex:1, checkIndex:0, targetPlaceName:"tens",      checkPlaceName:"ones" },
    hundred:  { place:100,  placeWord:"hundred",  displayName:"Nearest Hundred",  targetIndex:2, checkIndex:1, targetPlaceName:"hundreds",  checkPlaceName:"tens" },
    thousand: { place:1000, placeWord:"thousand", displayName:"Nearest Thousand", targetIndex:3, checkIndex:2, targetPlaceName:"thousands", checkPlaceName:"hundreds" }
  };
  // Number-size options per skill and the digit lengths each maps to.
  const SIZE_OPTIONS = {
    ten:      [ ["2","2 Digits","59, 74, 83"], ["3","3 Digits","313, 745, 892"], ["4","4 Digits","2,347, 8,561"], ["mixed","Mixed","a mix of sizes"] ],
    hundred:  [ ["3","3 Digits","347, 681, 950"], ["4","4 Digits","2,347, 7,681"], ["mixed","Mixed","a mix of sizes"] ],
    thousand: [ ["4","4 Digits","2,420, 7,650"], ["5","5 Digits — Challenge","15,499, 38,700"], ["mixed","Mixed","a mix of sizes"] ]
  };
  const SIZE_LENGTHS = {
    ten:      { "2":[2], "3":[3], "4":[4], mixed:[2,3,4] },
    hundred:  { "3":[3], "4":[4], mixed:[3,4] },
    thousand: { "4":[4], "5":[5], mixed:[4,5] }
  };
  const SESSION_LEN = 10;

  /* ---------- State ---------- */
  const state = {
    levelKey:null, size:null, mode:null,
    problem:null,
    // practice/test session
    qIndex:0, correct:0, missed:0, answered:false, firstTry:true, hintStep:0,
    usedKeys:new Set(), results:[], testMisses:[],
    // learn
    learnSet:[], learnIndex:0, learnStep:1,
    // review queue (practice my misses)
    reviewMode:false, reviewQueue:[], reviewIndex:0, reviewTotal:0,
    // where "Back"/"Home" should confirm
    pendingExit:null
  };

  const el = id => document.getElementById(id);
  const fmt = n => n.toLocaleString("en-US");

  /* ---------- Speech ---------- */
  const ONES=["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const TENS=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  function words(n){
    if(n<20)return ONES[n];
    if(n<100){const t=TENS[Math.floor(n/10)],r=n%10;return r?t+"-"+ONES[r]:t;}
    if(n<1000){const h=ONES[Math.floor(n/100)]+" hundred",r=n%100;return r?h+" "+words(r):h;}
    const th=words(Math.floor(n/1000))+" thousand",r=n%1000;return r?th+" "+words(r):th;
  }
  function stopSpeech(){ if("speechSynthesis"in window){try{window.speechSynthesis.cancel();}catch(e){}} }
  function speak(){
    if(!("speechSynthesis"in window)){ el("feedback").textContent="Read aloud isn't available on this device."; return; }
    const p=state.problem,L=LEVELS[state.levelKey];
    try{ window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance("Round "+words(p.number)+" to the nearest "+L.placeWord+"."); u.rate=0.92; window.speechSynthesis.speak(u);}catch(e){}
  }

  /* ---------- Engine ---------- */
  function digitAt(n,i){ return Math.floor(n/Math.pow(10,i))%10; }
  function calc(number, levelKey){
    const L=LEVELS[levelKey], place=L.place;
    const lower=Math.floor(number/place)*place, upper=lower+place, midpoint=lower+place/2;
    const answer=number<midpoint?lower:upper;
    const position=((number-lower)/(upper-lower))*100;
    return { number, levelKey, place, lower, midpoint, upper, answer, position,
      targetIndex:L.targetIndex, checkIndex:L.checkIndex, targetPlaceName:L.targetPlaceName, checkPlaceName:L.checkPlaceName,
      targetDigit:digitAt(number,L.targetIndex), checkDigit:digitAt(number,L.checkIndex),
      direction:digitAt(number,L.checkIndex)>=5?"up":"down", isMidpoint:number===midpoint };
  }
  const randInt=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const rangeForLength=len=>[Math.pow(10,len-1), Math.pow(10,len)-1];

  function generateProblem(){
    const place=LEVELS[state.levelKey].place;
    const lengths=SIZE_LENGTHS[state.levelKey][state.size];
    for(let i=0;i<300;i++){
      const len=lengths[randInt(0,lengths.length-1)];
      const [mn,mx]=rangeForLength(len);
      let n=randInt(mn,mx);
      if(n%place===0) continue;
      if(String(n).length!==len) continue;
      const key=n+"-"+place;
      if(state.usedKeys.has(key)) continue;
      state.usedKeys.add(key);
      return calc(n, state.levelKey);
    }
    const len=lengths[0], [mn,mx]=rangeForLength(len);
    let n; do{ n=randInt(mn,mx);}while(n%place===0);
    return calc(n, state.levelKey);
  }

  // Deliberate 4-example Learn sequence honoring number size.
  function buildLearnSet(){
    const place=LEVELS[state.levelKey].place;
    const lengths=SIZE_LENGTHS[state.levelKey][state.size];
    const pick=pred=>{
      for(let i=0;i<600;i++){
        const len=lengths[randInt(0,lengths.length-1)];
        const [mn,mx]=rangeForLength(len);
        const n=randInt(mn,mx);
        if(n%place===0) continue;
        if(String(n).length!==len) continue;
        const p=calc(n,state.levelKey);
        if(pred(p)) return p;
      }
      return calc(rangeForLength(lengths[0])[0]+Math.floor(place/2)+1, state.levelKey);
    };
    const set=[];
    set.push(pick(p=>p.checkDigit>=1&&p.checkDigit<=3&&!p.isMidpoint)); // clear down
    set.push(pick(p=>p.checkDigit>=6&&p.checkDigit<=9));                // clear up
    set.push(pick(p=>p.checkDigit===4));                               // near midpoint
    // exact midpoint of an allowed length
    set.push(pick(p=>p.isMidpoint) || (function(){
      const len=lengths[0], base=Math.floor(rangeForLength(len)[0]/place)*place+place/2; return calc(base,state.levelKey);
    })());
    return set;
  }

  /* ---------- Screens ---------- */
  const SCREENS=["wizard","learn","learn-done","practice","test","results"];
  function showScreen(name){
    SCREENS.forEach(s=>{const n=el("screen-"+s); if(n)n.hidden=(s!==name);});
    window.scrollTo(0,0);
  }

  /* ---------- Wizard ---------- */
  function startWizard(){
    state.levelKey=null; state.size=null; state.mode=null;
    setWizardStep(1);
    showScreen("wizard");
  }
  function setWizardStep(step){
    ["1","2","3"].forEach(s=>{ el("wiz-step-"+s).hidden = (s!==String(step)); });
    Array.from(el("wiz-progress").querySelectorAll("[data-wstep]")).forEach(li=>{
      const s=Number(li.dataset.wstep);
      li.classList.toggle("done", s<step);
      li.classList.toggle("current", s===step);
    });
    el("wiz-back").hidden = (step===1);
    state.wizStep=step;
    // reflect selections
    if(step===1){
      Array.from(document.querySelectorAll(".skill-grid .pick-card")).forEach(c=>c.setAttribute("aria-checked", String(c.dataset.level===state.levelKey)));
    }
  }
  function chooseSkill(levelKey){
    state.levelKey=levelKey; state.size=null;
    renderSizeOptions();
    setWizardStep(2);
  }
  function renderSizeOptions(){
    const L=LEVELS[state.levelKey];
    el("size-context").textContent = "For "+L.displayName+", pick how many digits.";
    const grid=el("size-grid"); grid.innerHTML="";
    SIZE_OPTIONS[state.levelKey].forEach(([val,label,ex])=>{
      const b=document.createElement("button");
      b.type="button"; b.className="pick-card size-card"; b.dataset.size=val;
      b.setAttribute("role","radio"); b.setAttribute("aria-checked","false");
      b.innerHTML='<span class="size-label">'+label+'</span><span class="pick-sub">e.g. '+ex+'</span>';
      b.addEventListener("click",()=>chooseSize(val,b));
      grid.appendChild(b);
    });
  }
  function chooseSize(val,btn){
    state.size=val;
    Array.from(el("size-grid").children).forEach(c=>c.setAttribute("aria-checked", String(c===btn)));
    setWizardStep(3);
  }
  function chooseMode(mode){
    state.mode=mode;
    if(mode==="learn") startLearn();
    else if(mode==="practice") startPractice();
    else startTest();
  }
  function wizardBack(){
    if(state.wizStep===3) setWizardStep(2);
    else if(state.wizStep===2) setWizardStep(1);
  }

  function skillChipText(){ return LEVELS[state.levelKey].displayName; }
  function sizeChipText(){
    const found=SIZE_OPTIONS[state.levelKey].find(o=>o[0]===state.size);
    return found ? found[1].replace(" — Challenge","") : "";
  }
  function stampChips(prefix){
    if(el(prefix+"-skill-chip")) el(prefix+"-skill-chip").textContent=skillChipText();
    if(el(prefix+"-size-chip")) el(prefix+"-size-chip").textContent=sizeChipText();
  }

  /* ---------- Shared number line ---------- */
  function renderNumberLine(scope,p,markDest){
    const pre = scope==="learn" ? "lnl" : "nl";
    el(pre+"-label-lower").textContent=fmt(p.lower);
    el(pre+"-label-mid").textContent=fmt(p.midpoint);
    el(pre+"-label-upper").textContent=fmt(p.upper);
    el(pre+"-label-lower").className="nl-label nl-label-lower";
    el(pre+"-label-mid").className="nl-label nl-label-mid";
    el(pre+"-label-upper").className="nl-label nl-label-upper";
    el(pre+"-dot-lower").className="nl-dot nl-dot-lower";
    el(pre+"-dot-mid").className="nl-dot nl-dot-mid";
    el(pre+"-dot-upper").className="nl-dot nl-dot-upper";
    el(pre+"-marker").style.left=p.position+"%";
    el(pre+"-marker-label").textContent=fmt(p.number);
    const ticks=el(pre+"-ticks"); ticks.innerHTML="";
    for(let i=1;i<10;i++){const t=document.createElement("span");t.className="nl-tick"+(i===5?" major":"");t.style.left=(i*10)+"%";ticks.appendChild(t);}
    const nlId = scope==="learn"?"learn-numberline":"numberline";
    el(nlId).setAttribute("aria-label","Number line from "+fmt(p.lower)+" to "+fmt(p.upper)+", halfway "+fmt(p.midpoint)+", marker at "+fmt(p.number)+".");
    if(markDest){
      if(p.answer===p.lower){el(pre+"-dot-lower").classList.add("destination");el(pre+"-label-lower").classList.add("destination");}
      else {el(pre+"-dot-upper").classList.add("destination");el(pre+"-label-upper").classList.add("destination");}
    }
  }
  function buildList(listEl,lines){ listEl.innerHTML=""; lines.forEach(h=>{const li=document.createElement("li");li.innerHTML=h;listEl.appendChild(li);}); }

  /* ---------- Digit rendering (Learn) ---------- */
  function renderDigits(container,p,opts){
    container.innerHTML="";
    const str=String(p.number), len=str.length;
    str.split("").forEach((d,i)=>{
      const idxR=len-1-i;
      const cell=document.createElement(opts.onClick?"button":"span");
      cell.className="digit-cell"; cell.textContent=d;
      if(opts.onClick){ cell.type="button"; cell.setAttribute("aria-label","digit "+d); cell.addEventListener("click",()=>opts.onClick(idxR,cell)); }
      if(opts.showTarget&&idxR===p.targetIndex) cell.classList.add("digit-target");
      if(opts.showCheck&&idxR===p.checkIndex) cell.classList.add("digit-check");
      container.appendChild(cell);
      if(idxR>0&&idxR%3===0){const c=document.createElement("span");c.className="digit-comma";c.textContent=",";c.setAttribute("aria-hidden","true");container.appendChild(c);}
    });
  }

  /* ====================================================
     LEARN
     ==================================================== */
  function startLearn(){
    state.learnSet=buildLearnSet();
    state.learnIndex=0;
    stampChips("learn");
    loadLearnExample();
    showScreen("learn");
  }
  function loadLearnExample(){
    state.problem=state.learnSet[state.learnIndex];
    state.learnStep=1;
    el("learn-example").textContent="Example "+(state.learnIndex+1)+" of "+state.learnSet.length;
    renderLearnStep();
  }
  function setStepTrack(step){
    Array.from(el("step-track").children).forEach(li=>{
      const s=Number(li.dataset.step);
      li.classList.toggle("done",s<step);
      li.classList.toggle("current",s===step);
    });
  }
  function renderLearnStep(){
    const p=state.problem,L=LEVELS[state.levelKey],step=state.learnStep;
    setStepTrack(step);

    // Reset — hide every step-specific block; only reveal what belongs to `step`.
    el("learn-feedback").textContent=""; el("learn-feedback").className="learn-feedback";
    el("place-labels").hidden=true;
    el("learn-digit-area").hidden=true;
    el("look-arrow").hidden=true;
    el("decide-block").hidden=true;
    el("roundit-block").hidden=true;
    el("seewhy-block").hidden=true;

    el("learn-step-label").textContent="Step "+step+" of 5";
    el("learn-question").innerHTML="Round <strong>"+fmt(p.number)+"</strong> to the nearest "+L.placeWord;
    el("learn-back").innerHTML='<span aria-hidden="true">\u2190</span> Back';
    const next=el("learn-next");

    if(step===1){
      el("learn-step-title").textContent="Find the place";
      el("learn-instruction").textContent="We're rounding to the nearest "+L.placeWord+". Tap the digit in the "+p.targetPlaceName+" place.";
      el("learn-digit-area").hidden=false;
      renderDigits(el("digit-row"),p,{onClick:onTapTarget});
      next.disabled=true; next.textContent="Next step \u2192";
    } else if(step===2){
      el("learn-step-title").textContent="Look right";
      el("learn-instruction").textContent="Now look one place to the right. Tap the digit we need to check.";
      el("learn-digit-area").hidden=false;
      renderDigits(el("digit-row"),p,{onClick:onTapCheck,showTarget:true});
      positionLookArrow(p);
      next.disabled=true; next.textContent="Next step \u2192";
    } else if(step===3){
      el("learn-step-title").textContent="Up or down?";
      el("learn-instruction").innerHTML="The "+p.checkPlaceName+" digit is <strong>"+p.checkDigit+"</strong>. Does it tell us to round up or down?";
      el("learn-digit-area").hidden=false;
      renderDigits(el("digit-row"),p,{showTarget:true,showCheck:true});
      el("decide-block").hidden=false;
      el("down-digits").className="decide-digits"; el("up-digits").className="decide-digits";
      el("decide-down").disabled=false; el("decide-up").disabled=false;
      el("decide-down").classList.remove("chosen"); el("decide-up").classList.remove("chosen");
      next.disabled=true; next.textContent="Next step \u2192";
    } else if(step===4){
      el("learn-step-title").textContent="Round it!";
      el("learn-instruction").textContent = p.direction==="up"
        ? "The checking digit is "+p.checkDigit+", so we round up."
        : "The checking digit is "+p.checkDigit+", so we round down.";
      el("roundit-block").hidden=false;
      el("roundit-from").textContent=fmt(p.number);
      el("roundit-to").textContent=fmt(p.answer);
      el("roundit-to").classList.remove("pop"); void el("roundit-to").offsetWidth; el("roundit-to").classList.add("pop");
      el("roundit-note").innerHTML = p.direction==="up"
        ? "The "+p.targetPlaceName+" place goes up and digits to the right become 0. <strong>"+fmt(p.number)+" rounds to "+fmt(p.answer)+".</strong>"
        : "The "+p.targetPlaceName+" digit stays the same and digits to the right become 0. <strong>"+fmt(p.number)+" rounds to "+fmt(p.answer)+".</strong>";
      next.disabled=false; next.textContent="Next step \u2192";
    } else if(step===5){
      el("learn-step-title").textContent="See why";
      el("learn-instruction").textContent="The number line shows why.";
      el("seewhy-block").hidden=false;
      renderNumberLine("learn",p,true);
      const lines = p.isMidpoint
        ? [fmt(p.number)+" is between "+fmt(p.lower)+" and "+fmt(p.upper)+".", fmt(p.number)+" is <strong>exactly halfway</strong>.", "Numbers at the halfway point <strong>round up</strong>.", "So "+fmt(p.number)+" rounds to <strong>"+fmt(p.answer)+"</strong>."]
        : [fmt(p.number)+" is between "+fmt(p.lower)+" and "+fmt(p.upper)+".", "The halfway point is "+fmt(p.midpoint)+".", fmt(p.number)+" is "+(p.answer===p.lower?"before":"past")+" "+fmt(p.midpoint)+", so it is closer to <strong>"+fmt(p.answer)+"</strong>.", "So "+fmt(p.number)+" rounds to <strong>"+fmt(p.answer)+"</strong>."];
      buildList(el("seewhy-list"),lines);
      next.disabled=false;
      next.textContent=(state.learnIndex<state.learnSet.length-1)?"Next example \u2192":"Finish \u2713";
    }
  }
  function positionLookArrow(p){
    const arrow=el("look-arrow"); if(!arrow) return;
    const cells=Array.from(el("digit-row").querySelectorAll(".digit-cell")); if(!cells.length) return;
    const len=cells.length, tCell=cells[len-1-p.targetIndex], cCell=cells[len-1-p.checkIndex];
    if(!tCell||!cCell) return;
    const area=el("learn-digit-area").getBoundingClientRect();
    const tr=tCell.getBoundingClientRect(), cr=cCell.getBoundingClientRect();
    arrow.hidden=false;
    arrow.style.left=((tr.left+tr.width/2)-area.left)+"px";
    arrow.style.width=Math.max(0,((cr.left+cr.width/2)-area.left)-((tr.left+tr.width/2)-area.left))+"px";
  }
  function onTapTarget(idxR,cell){
    const p=state.problem;
    if(idxR===p.targetIndex){
      cell.classList.add("digit-target");
      el("learn-feedback").textContent="Yes! "+p.targetDigit+" is in the "+p.targetPlaceName+" place.";
      el("learn-feedback").className="learn-feedback good";
      el("place-labels").hidden=true;
      lockDigits(); el("learn-next").disabled=false;
    } else {
      el("learn-feedback").textContent="Almost! We're looking for the "+p.targetPlaceName+" place.";
      el("learn-feedback").className="learn-feedback try";
      showPlaceLabels(p);
    }
  }
  function onTapCheck(idxR,cell){
    const p=state.problem;
    if(idxR===p.checkIndex){
      cell.classList.add("digit-check");
      el("learn-feedback").textContent="Right! The "+p.checkPlaceName+" digit is "+p.checkDigit+".";
      el("learn-feedback").className="learn-feedback good";
      lockDigits(); el("learn-next").disabled=false;
    } else {
      el("learn-feedback").textContent="Look just one place to the right of the "+p.targetPlaceName+" digit.";
      el("learn-feedback").className="learn-feedback try";
    }
  }
  function lockDigits(){ Array.from(el("digit-row").querySelectorAll("button.digit-cell")).forEach(b=>b.disabled=true); }
  function showPlaceLabels(p){
    const names=["ones","tens","hundreds","thousands","ten-thousands"];
    const len=String(p.number).length, parts=[];
    for(let i=len-1;i>=0;i--){ parts.push(names[i].charAt(0).toUpperCase()+names[i].slice(1)); }
    el("place-labels").textContent=parts.join("   "); el("place-labels").hidden=false;
  }
  function onDecide(dir){
    const p=state.problem;
    if(dir===p.direction){
      el("decide-"+dir).classList.add("chosen");
      el((dir==="up"?"up":"down")+"-digits").classList.add("hot");
      el("learn-feedback").textContent="Yes! "+p.checkDigit+" means round "+dir+".";
      el("learn-feedback").className="learn-feedback good";
      el("decide-down").disabled=true; el("decide-up").disabled=true;
      el("learn-next").disabled=false;
    } else {
      el("learn-feedback").innerHTML="Take another look. Is "+p.checkDigit+" in <strong>0&ndash;4</strong> or <strong>5&ndash;9</strong>?";
      el("learn-feedback").className="learn-feedback try";
    }
  }
  function learnNext(){
    if(el("learn-next").disabled) return;
    if(state.learnStep<5){ state.learnStep++; renderLearnStep(); }
    else if(state.learnIndex<state.learnSet.length-1){ state.learnIndex++; loadLearnExample(); }
    else finishLearn();
  }
  function learnBack(){
    if(state.learnStep>1){ state.learnStep--; renderLearnStep(); }
    else startWizardAtMode();   // Step 1 Back -> mode selection
  }
  function startWizardAtMode(){
    stopSpeech();
    renderSizeOptions();
    // ensure selections reflected
    showScreen("wizard"); setWizardStep(3);
    Array.from(document.querySelectorAll(".skill-grid .pick-card")).forEach(c=>c.setAttribute("aria-checked",String(c.dataset.level===state.levelKey)));
  }
  function finishLearn(){
    el("ld-message").textContent="You learned how to round to the nearest "+LEVELS[state.levelKey].placeWord+"!";
    showScreen("learn-done");
  }

  /* ====================================================
     PRACTICE
     ==================================================== */
  function resetSession(){ state.qIndex=0; state.correct=0; state.missed=0; state.results=[]; state.usedKeys.clear(); state.testMisses=[]; state.reviewMode=false; }
  function startPractice(){
    resetSession(); stampChips("practice");
    showScreen("practice"); loadPractice(true);
  }
  function loadPractice(first){
    if(!first) state.qIndex++;
    state.answered=false; state.firstTry=true; state.hintStep=0;
    state.problem = state.reviewMode ? state.problem : generateProblem();
    renderPractice();
  }
  function renderPractice(){
    const p=state.problem,L=LEVELS[state.levelKey];
    if(state.reviewMode){ el("ph-progress-label").textContent="Review "+(state.reviewIndex+1)+" of "+state.reviewTotal; el("ph-progress-fill").style.width=((state.reviewIndex/state.reviewTotal)*100+10)+"%"; }
    else { el("ph-progress-label").textContent="Question "+(state.qIndex+1)+" of "+SESSION_LEN; el("ph-progress-fill").style.width=((state.qIndex/SESSION_LEN)*100+10)+"%"; }
    el("q-number").textContent=fmt(p.number);
    el("q-place").textContent="nearest "+L.placeWord;

    const vals=Math.random()<0.5?[p.lower,p.upper]:[p.upper,p.lower];
    [el("answer-a"),el("answer-b")].forEach((b,i)=>{ b.textContent=fmt(vals[i]); b.dataset.value=String(vals[i]); b.disabled=false; b.className="answer-tile"; });

    el("feedback").textContent=""; el("feedback").className="feedback";
    el("next-btn").disabled=true;
    el("next-btn").textContent = (!state.reviewMode && state.qIndex===SESSION_LEN-1) ? "See my results \u2192" : "Next question \u2192";

    // Help panel resets; ruler stays HIDDEN until Hint 4 or correct answer.
    el("hint-list").innerHTML=""; el("hint-btn").disabled=false; el("hint-btn").textContent="Show a hint";
    el("help-panel").hidden=false;
    el("why-panel").hidden=true; el("why-list").innerHTML="";
  }
  function practiceHint(){
    const p=state.problem;
    state.hintStep++;
    const list=el("hint-list"); list.innerHTML="";
    const lines=[];
    if(state.hintStep>=1) lines.push("<strong>Find it.</strong> Which digit is in the "+p.targetPlaceName+" place? (It's "+p.targetDigit+".)");
    if(state.hintStep>=2) lines.push("<strong>Look right.</strong> The "+p.checkPlaceName+" digit is <strong>"+p.checkDigit+"</strong>.");
    if(state.hintStep>=3) lines.push("<strong>Decide.</strong> 0&ndash;4 round down \u00b7 5&ndash;9 round up.");
    if(state.hintStep>=4){
      lines.push("<strong>Show me on the number line.</strong> "+fmt(p.number)+" is between "+fmt(p.lower)+" and "+fmt(p.upper)+"; halfway is "+fmt(p.midpoint)+".");
    }
    buildList(list,lines);
    if(state.hintStep>=4){
      // reveal the ruler inside the why-panel area (but not the "why" text yet)
      el("why-panel").hidden=false;
      el("why-list").innerHTML="";
      renderNumberLine("practice",p,false);
      el("hint-btn").disabled=true; el("hint-btn").textContent="That's every hint";
    } else {
      el("hint-btn").textContent="Show another hint";
    }
  }
  const PRAISE=["Great job!","You got it!","Exactly right!","Nice rounding!","Well done!"];
  function practiceAnswer(btn){
    if(state.answered) return;
    const chosen=Number(btn.dataset.value),p=state.problem;
    if(chosen===p.answer){
      state.answered=true;
      if(!state.reviewMode){ state.results.push(state.firstTry?"correct":"missed"); if(state.firstTry)state.correct++; else state.missed++; }
      btn.className="answer-tile correct";
      [el("answer-a"),el("answer-b")].forEach(b=>{b.disabled=true; if(b!==btn)b.classList.add("dimmed");});
      el("feedback").textContent=PRAISE[randInt(0,PRAISE.length-1)]+" "+fmt(p.number)+" rounds to "+fmt(p.answer)+".";
      el("feedback").className="feedback good";
      showWhy();
      el("next-btn").disabled=false; el("next-btn").focus();
    } else {
      state.firstTry=false;
      btn.className="answer-tile try-again";
      el("feedback").innerHTML="<strong>Almost!</strong> Take another look. You can try again or use a Hint.";
      el("feedback").className="feedback try";
    }
  }
  function showWhy(){
    const p=state.problem;
    el("help-panel").hidden=true;
    el("why-panel").hidden=false;
    const lines = p.isMidpoint
      ? [fmt(p.number)+" is exactly halfway between "+fmt(p.lower)+" and "+fmt(p.upper)+".", "Numbers at the halfway point <strong>round up</strong>.", fmt(p.number)+" rounds to <strong>"+fmt(p.answer)+"</strong>."]
      : [fmt(p.number)+" is between "+fmt(p.lower)+" and "+fmt(p.upper)+".", fmt(p.midpoint)+" is halfway.", fmt(p.number)+" is "+(p.answer===p.lower?"before":"past")+" "+fmt(p.midpoint)+", so it is closer to <strong>"+fmt(p.answer)+"</strong>."];
    buildList(el("why-list"),lines);
    renderNumberLine("practice",p,true);
  }
  function practiceNext(){
    if(el("next-btn").disabled) return;
    el("next-btn").disabled=true; stopSpeech();
    if(state.reviewMode){
      state.reviewIndex++;
      if(state.reviewIndex>=state.reviewTotal){ state.reviewMode=false; finishSession("practice"); return; }
      state.answered=false; state.firstTry=true; state.hintStep=0;
      state.problem=state.reviewQueue[state.reviewIndex];
      renderPractice(); return;
    }
    if(state.qIndex>=SESSION_LEN-1) finishSession("practice");
    else loadPractice(false);
  }

  /* ====================================================
     TEST
     ==================================================== */
  function startTest(){
    resetSession(); stampChips("test");
    showScreen("test"); loadTest(true);
  }
  function loadTest(first){
    if(!first) state.qIndex++;
    state.answered=false;
    state.problem=generateProblem();
    renderTest();
  }
  function renderTest(){
    const p=state.problem,L=LEVELS[state.levelKey];
    el("test-progress-label").textContent="Question "+(state.qIndex+1)+" of "+SESSION_LEN;
    el("test-progress-fill").style.width=((state.qIndex/SESSION_LEN)*100+10)+"%";
    el("test-q-number").textContent=fmt(p.number);
    el("test-q-place").textContent="nearest "+L.placeWord;
    const vals=Math.random()<0.5?[p.lower,p.upper]:[p.upper,p.lower];
    [el("test-answer-a"),el("test-answer-b")].forEach((b,i)=>{ b.textContent=fmt(vals[i]); b.dataset.value=String(vals[i]); b.disabled=false; b.className="answer-tile"; });
    el("test-feedback").textContent=""; el("test-feedback").className="feedback";
    el("test-next").disabled=true;
    el("test-next").textContent = state.qIndex===SESSION_LEN-1 ? "Finish test \u2192" : "Next question \u2192";
  }
  function testAnswer(btn){
    if(state.answered) return;
    state.answered=true;
    const chosen=Number(btn.dataset.value),p=state.problem;
    const ok=chosen===p.answer;
    if(ok) state.correct++; else { state.missed++; state.testMisses.push(p); }
    state.results.push(ok?"correct":"missed");
    [el("test-answer-a"),el("test-answer-b")].forEach(b=>{ b.disabled=true; if(Number(b.dataset.value)===chosen) b.classList.add("picked"); });
    el("test-feedback").textContent="Answer recorded."; el("test-feedback").className="feedback";
    el("test-next").disabled=false; el("test-next").focus();
  }
  function testNext(){
    if(el("test-next").disabled) return;
    el("test-next").disabled=true; stopSpeech();
    if(state.qIndex>=SESSION_LEN-1) finishSession("test");
    else loadTest(false);
  }
  function testComplete(){ return state.results.length>=SESSION_LEN; }

  /* ====================================================
     RESULTS
     ==================================================== */
  function finishSession(mode){
    const pct=Math.round((state.correct/SESSION_LEN)*100);
    el("results-skill").textContent=LEVELS[state.levelKey].displayName+" \u00b7 "+sizeChipText()+" \u00b7 "+(mode==="test"?"Test":"Practice");
    el("stat-correct").textContent=state.correct;
    el("stat-missed").textContent=SESSION_LEN-state.correct;
    el("stat-percent").textContent=pct+"%";
    el("results-ring").style.setProperty("--pct",pct);
    el("results-heading").textContent=mode==="test"?"Test complete!":"Session complete!";
    let msg,emoji;
    if(pct===100){msg="Perfect score \u2014 you're a rounding champion!";emoji="\uD83C\uDFC6";}
    else if(pct>=80){msg="Fantastic work! You really know your benchmarks.";emoji="\uD83C\uDF89";}
    else if(pct>=60){msg="Good effort! A little more practice and you'll master it.";emoji="\uD83D\uDC4D";}
    else {msg="Keep going! The number line shows where each number sits.";emoji="\uD83D\uDCAA";}
    el("results-message").textContent=msg; el("results-emoji").textContent=emoji;

    const review=el("review-block");
    if(mode==="test"&&state.testMisses.length){
      review.hidden=false; const list=el("review-list"); list.innerHTML="";
      state.testMisses.forEach(p=>{
        const c=document.createElement("div"); c.className="review-item";
        c.innerHTML="<p class='review-q'>Round <strong>"+fmt(p.number)+"</strong> to the nearest "+LEVELS[p.levelKey].placeWord+"</p>"+
          "<p class='review-a'>Answer: <strong>"+fmt(p.answer)+"</strong></p>"+
          "<p class='review-why'>The "+p.checkPlaceName+" digit is "+p.checkDigit+" \u2192 round "+p.direction+". "+fmt(p.number)+" is between "+fmt(p.lower)+" and "+fmt(p.upper)+" (halfway "+fmt(p.midpoint)+").</p>";
        list.appendChild(c);
      });
    } else review.hidden=true;

    const actions=el("results-actions"); actions.innerHTML="";
    const mk=(label,cls,fn)=>{const b=document.createElement("button");b.type="button";b.className=cls;b.textContent=label;b.addEventListener("click",fn);return b;};
    if(mode==="test"){
      if(state.testMisses.length) actions.appendChild(mk("Practice my misses","primary-btn",practiceMisses));
      actions.appendChild(mk("Test again","nav-btn",startTest));
      actions.appendChild(mk("Choose another mode","nav-btn",startWizardAtMode));
      actions.appendChild(mk("Home","nav-btn",goHome));
    } else {
      actions.appendChild(mk("Practice again","primary-btn",startPractice));
      actions.appendChild(mk("Choose another mode","nav-btn",startWizardAtMode));
      actions.appendChild(mk("Home","nav-btn",goHome));
    }
    showScreen("results");
  }
  function practiceMisses(){
    const q=state.testMisses.slice();
    resetSession(); state.mode="practice"; stampChips("practice");
    state.reviewMode=true; state.reviewQueue=q; state.reviewIndex=0; state.reviewTotal=q.length;
    state.problem=q[0];
    showScreen("practice");
    state.answered=false; state.firstTry=true; state.hintStep=0;
    renderPractice();
  }

  /* ---------- Navigation / exits ---------- */
  function goHome(){ stopSpeech(); startWizard(); }
  function needsTestConfirm(){ return !el("screen-test").hidden && !testComplete() && state.results.length<SESSION_LEN && state.results.length>=0 && state.mode==="test" && !el("screen-results").hidden===false; }
  function tryLeaveTest(after){
    // Confirm only if a test is in progress (not complete)
    if(!el("screen-test").hidden && state.results.length<SESSION_LEN){
      state.pendingExit=after; el("leave-modal").hidden=false; el("leave-stay").focus();
    } else { after(); }
  }
  function testBack(){ tryLeaveTest(startWizardAtMode); }
  function testHome(){ tryLeaveTest(goHome); }
  function leaveStay(){ el("leave-modal").hidden=true; state.pendingExit=null; }
  function leaveGo(){ el("leave-modal").hidden=true; const fn=state.pendingExit; state.pendingExit=null; if(fn)fn(); }

  /* ---------- Events ---------- */
  document.querySelectorAll(".skill-grid .pick-card").forEach(c=>c.addEventListener("click",()=>chooseSkill(c.dataset.level)));
  document.querySelectorAll(".mode-grid .mode-card").forEach(c=>c.addEventListener("click",()=>chooseMode(c.dataset.mode)));
  el("wiz-back").addEventListener("click",wizardBack);
  el("wiz-home").addEventListener("click",goHome);

  el("learn-next").addEventListener("click",learnNext);
  el("learn-back").addEventListener("click",learnBack);
  el("learn-home").addEventListener("click",goHome);
  el("decide-down").addEventListener("click",()=>onDecide("down"));
  el("decide-up").addEventListener("click",()=>onDecide("up"));
  el("ld-practice").addEventListener("click",startPractice);
  el("ld-again").addEventListener("click",startLearn);
  el("ld-mode").addEventListener("click",startWizardAtMode);
  el("ld-home").addEventListener("click",goHome);

  el("answer-a").addEventListener("click",()=>practiceAnswer(el("answer-a")));
  el("answer-b").addEventListener("click",()=>practiceAnswer(el("answer-b")));
  el("hint-btn").addEventListener("click",practiceHint);
  el("speak-btn").addEventListener("click",speak);
  el("next-btn").addEventListener("click",practiceNext);
  el("practice-back").addEventListener("click",startWizardAtMode);
  el("practice-home").addEventListener("click",goHome);

  el("test-answer-a").addEventListener("click",()=>testAnswer(el("test-answer-a")));
  el("test-answer-b").addEventListener("click",()=>testAnswer(el("test-answer-b")));
  el("test-next").addEventListener("click",testNext);
  el("test-back").addEventListener("click",testBack);
  el("test-home").addEventListener("click",testHome);
  el("leave-stay").addEventListener("click",leaveStay);
  el("leave-go").addEventListener("click",leaveGo);

  /* ---------- Audit hook ---------- */
  window.__roundit = { calc, generateProblem, buildLearnSet, LEVELS, SIZE_LENGTHS, state, BUILD_NUMBER };

  /* ---------- Boot ---------- */
  (function stampBuild(){ const b=el("build-badge"); if(b) b.textContent="Round It! \u2014 "+BUILD_NUMBER; })();
  startWizard();

})();
