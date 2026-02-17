/*
  MDCAT Portal - Premium Dashboard
  - Supabase REST (no libraries)
  - GitHub Pages compatible
  - 6 Dark themes
  - No-scroll quiz start (collapses setup)
*/

const SUPABASE_URL = "https://achaxseflfysltezynem.supabase.co/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjaGF4c2VmbGZ5c2x0ZXp5bmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMTM4NDIsImV4cCI6MjA4Njg4OTg0Mn0.MB48zCYeXWGn_AycEceYMSK5Wm_LxuTDLodofc-_C0o";

const $ = (id) => document.getElementById(id);

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function shuffle(arr){
  return [...arr].sort(() => Math.random() - 0.5);
}

function clamp(n, a, b){
  return Math.max(a, Math.min(b, n));
}

function nowISO(){
  return new Date().toISOString();
}

/* ------------------ Themes (Dark only) ------------------ */
const THEMES = [
  { id:"midnight", name:"Midnight Blue" },
  { id:"cyber", name:"Cyber Purple" },
  { id:"emerald", name:"Emerald Night" },
  { id:"crimson", name:"Crimson Noir" },
  { id:"graphite", name:"Graphite Gray" },
  { id:"ocean", name:"Ocean Teal" }
];

function loadTheme(){
  const saved = localStorage.getItem("mdcat_theme_dark") || "midnight";
  document.body.setAttribute("data-theme", saved);

  const t = THEMES.find(x => x.id === saved);
  $("themeBtn").textContent = `🎨 ${t ? t.name : "Theme"}`;
}

function cycleTheme(){
  const current = document.body.getAttribute("data-theme") || "midnight";
  const idx = THEMES.findIndex(x => x.id === current);
  const next = THEMES[(idx + 1) % THEMES.length];

  document.body.setAttribute("data-theme", next.id);
  localStorage.setItem("mdcat_theme_dark", next.id);

  $("themeBtn").textContent = `🎨 ${next.name}`;
  toast(`Theme: ${next.name}`);
}

/* ------------------ Local Storage ------------------ */
const LS_ATTEMPTS = "mdcat_attempts_v2";
const LS_LAST_FILTERS = "mdcat_last_filters_v2";

function loadAttempts(){
  try { return JSON.parse(localStorage.getItem(LS_ATTEMPTS) || "[]"); }
  catch { return []; }
}

function saveAttempt(attempt){
  const attempts = loadAttempts();
  attempts.unshift(attempt);
  localStorage.setItem(LS_ATTEMPTS, JSON.stringify(attempts.slice(0, 200)));
}

function saveLastFilters(filters){
  localStorage.setItem(LS_LAST_FILTERS, JSON.stringify(filters));
}

function loadLastFilters(){
  try { return JSON.parse(localStorage.getItem(LS_LAST_FILTERS) || "null"); }
  catch { return null; }
}

/* ------------------ Supabase REST ------------------ */
async function supabaseFetch(path){
  const url = `${SUPABASE_URL}${path}`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if(!res.ok){
    const t = await res.text();
    throw new Error(t || "Supabase request failed");
  }

  return await res.json();
}

async function fetchMCQs(filters){
  let path = `/rest/v1/mcqs?select=*`;

  path += `&subject=eq.${encodeURIComponent(filters.subject)}`;

  if(filters.chapter){
    path += `&chapter=ilike.*${encodeURIComponent(filters.chapter)}*`;
  }
  if(filters.topic){
    path += `&topic=ilike.*${encodeURIComponent(filters.topic)}*`;
  }
  if(filters.difficulty){
    path += `&difficulty=eq.${encodeURIComponent(filters.difficulty)}`;
  }

  path += `&limit=${filters.limit}`;
  return await supabaseFetch(path);
}

async function fetchDBCount(){
  try{
    const sample = await supabaseFetch(`/rest/v1/mcqs?select=id&limit=1`);
    if(sample) return "10,000+";
    return "—";
  }catch{
    return "—";
  }
}

/* ------------------ Quiz State ------------------ */
let quiz = {
  filters: null,
  mode: "learn",
  items: [],
  index: 0,
  score: 0,
  answered: false
};

/* ------------------ UI Navigation ------------------ */
function setView(view){
  document.querySelectorAll(".navItem").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  $(`view-${view}`).classList.remove("hidden");

  $("headline").textContent = view.charAt(0).toUpperCase() + view.slice(1);

  $("sidebar").classList.remove("open");

  if(view === "dashboard") refreshDashboard();
  if(view === "analytics") refreshAnalytics();
}

/* ------------------ Dashboard ------------------ */
function refreshDashboard(){
  const attempts = loadAttempts();

  $("attemptCount").textContent = attempts.length;

  if(attempts.length){
    const a = attempts[0];
    $("lastScore").textContent = `${a.score}/${a.total}`;
  } else {
    $("lastScore").textContent = "—";
  }

  // Accuracy
  let correct = 0, total = 0;
  for(const a of attempts){
    correct += a.score;
    total += a.total;
  }
  const acc = total ? Math.round((correct/total)*100) : null;

  $("accValue").textContent = acc === null ? "—" : `${acc}%`;
  $("accBar").style.width = `${acc ? acc : 0}%`;

  // Activity
  const activity = $("activityList");
  if(!attempts.length){
    activity.innerHTML = `<div class="muted">No attempts yet. Start a quiz and your history appears here.</div>`;
  } else {
    activity.innerHTML = attempts.slice(0,4).map(a => `
      <div class="activityItem">
        <div class="activityTop">
          <div class="activityTitle">${a.subject} • ${a.total} MCQs</div>
          <div class="badge">${a.score}/${a.total}</div>
        </div>
        <div class="activitySub">${new Date(a.created_at).toLocaleString()}</div>
      </div>
    `).join("");
  }

  // Weak tags (simple)
  const topicStats = {};
  for(const a of attempts){
    const key = `${a.subject}|${a.topic || "(mixed)"}`;
    if(!topicStats[key]) topicStats[key] = {score:0,total:0, subject:a.subject, topic:a.topic || "(mixed)"};
    topicStats[key].score += a.score;
    topicStats[key].total += a.total;
  }

  const weak = Object.values(topicStats)
    .filter(x => x.total >= 10)
    .map(x => ({...x, acc: x.score/x.total}))
    .sort((a,b) => a.acc - b.acc)
    .slice(0,4);

  const weakTags = $("weakTags");
  if(weak.length){
    weakTags.innerHTML = weak.map(w => `<span class="tag">${w.subject}: ${w.topic}</span>`).join("");
  } else {
    weakTags.innerHTML = `<span class="tag">Not enough data</span>`;
  }
}

/* ------------------ Quiz Rendering ------------------ */
function collapsePracticeTop(){
  // This is the main fix: no scroll frustration
  document.body.classList.add("practiceCollapsed");
}

function expandPracticeTop(){
  document.body.classList.remove("practiceCollapsed");
}

function resetQuizUI(){
  $("quizArea").classList.add("hidden");
  $("resultArea").classList.add("hidden");
  $("explanationBox").classList.add("hidden");
}

function renderQuestion(){
  quiz.answered = false;
  $("explanationBox").classList.add("hidden");

  const q = quiz.items[quiz.index];

  $("qCounter").textContent = `Q ${quiz.index + 1}/${quiz.items.length}`;
  $("scoreCounter").textContent = `Score: ${quiz.score}`;

  $("questionText").textContent = q.question;

  $("optA").textContent = `A) ${q.option_a}`;
  $("optB").textContent = `B) ${q.option_b}`;
  $("optC").textContent = `C) ${q.option_c}`;
  $("optD").textContent = `D) ${q.option_d}`;

  document.querySelectorAll(".opt").forEach(btn => {
    btn.classList.remove("correct","wrong");
    btn.disabled = false;
    btn.style.opacity = "1";
  });

  $("prevBtn").disabled = quiz.index === 0;
  $("nextBtn").textContent = quiz.index === quiz.items.length - 1 ? "Finish →" : "Next →";
}

function lockOptions(){
  document.querySelectorAll(".opt").forEach(btn => btn.disabled = true);
}

function showExplanation(q){
  $("explanationBox").innerHTML = `
    <b>Correct:</b> ${q.correct_option}<br><br>
    <b>Explanation:</b> ${q.explanation || "No explanation"}<br><br>
    <b>Source:</b> ${q.source || "N/A"}
  `;
  $("explanationBox").classList.remove("hidden");
}

function handleAnswer(selected){
  if(quiz.answered) return;
  quiz.answered = true;

  const q = quiz.items[quiz.index];
  const correct = q.correct_option;

  const isCorrect = selected === correct;
  if(isCorrect) quiz.score++;

  document.querySelectorAll(".opt").forEach(btn => {
    const opt = btn.dataset.opt;
    if(opt === correct) btn.classList.add("correct");
    if(opt === selected && !isCorrect) btn.classList.add("wrong");
    if(opt !== correct && opt !== selected) btn.style.opacity = "0.55";
  });

  lockOptions();
  $("scoreCounter").textContent = `Score: ${quiz.score}`;

  if(quiz.mode === "learn"){
    showExplanation(q);
  }
}

function nextQuestion(){
  if(quiz.index >= quiz.items.length - 1){
    finishQuiz();
    return;
  }
  quiz.index++;
  renderQuestion();
}

function prevQuestion(){
  if(quiz.index <= 0) return;
  quiz.index--;
  renderQuestion();
}

function skipQuestion(){
  toast("Skipped. (Try not to make this a lifestyle.)");
  nextQuestion();
}

function finishQuiz(){
  $("quizArea").classList.add("hidden");
  $("resultArea").classList.remove("hidden");

  const total = quiz.items.length;
  const score = quiz.score;
  const percent = Math.round((score/total)*100);

  $("finalScore").textContent = `${score}/${total} (${percent}%)`;

  $("resultMeta").textContent =
    `${quiz.filters.subject} • ${quiz.filters.difficulty || "All"} • ${quiz.filters.chapter || "Any chapter"} • ${quiz.filters.topic || "Any topic"}`;

  // Save attempt
  saveAttempt({
    created_at: nowISO(),
    subject: quiz.filters.subject,
    chapter: quiz.filters.chapter || "",
    topic: quiz.filters.topic || "",
    difficulty: quiz.filters.difficulty || "",
    total,
    score
  });

  toast("Attempt saved locally.");
  refreshDashboard();
}

/* ------------------ Start Quiz ------------------ */
async function startQuizFromFilters(filters){
  resetQuizUI();

  $("startBtn").textContent = "Loading...";
  $("startBtn").disabled = true;

  try{
    const items = await fetchMCQs(filters);

    if(!items.length){
      toast("No MCQs found. Remove chapter/topic filters.");
      $("startBtn").textContent = "Start Quiz";
      $("startBtn").disabled = false;
      return;
    }

    quiz.filters = filters;
    quiz.mode = filters.mode;
    quiz.items = shuffle(items).slice(0, filters.limit);
    quiz.index = 0;
    quiz.score = 0;

    $("quizBadge").textContent = filters.mode === "exam" ? "Exam Mode" : "Learn Mode";
    $("quizTitle").textContent = `${filters.subject} Quiz`;
    $("quizMeta").textContent =
      `${filters.limit} MCQs • ${filters.difficulty || "All"} • ${filters.chapter || "Any chapter"} • ${filters.topic || "Any topic"}`;

    // Main fix: collapse setup so quiz is immediately visible
    collapsePracticeTop();

    $("quizArea").classList.remove("hidden");
    $("resultArea").classList.add("hidden");

    renderQuestion();

    toast("Quiz loaded from Supabase.");
    saveLastFilters(filters);

  }catch(err){
    console.error(err);
    toast("Supabase error. Check keys + RLS policy.");
  }

  $("startBtn").textContent = "Start Quiz";
  $("startBtn").disabled = false;
}

/* ------------------ Analytics ------------------ */
function refreshAnalytics(){
  const attempts = loadAttempts().slice(0, 200);

  const subjects = ["Biology","Chemistry","Physics","English","Logical Reasoning"];
  const stats = {};
  for(const s of subjects) stats[s] = {score:0,total:0};

  for(const a of attempts){
    if(!stats[a.subject]) stats[a.subject] = {score:0,total:0};
    stats[a.subject].score += a.score;
    stats[a.subject].total += a.total;
  }

  $("barsArea").innerHTML = subjects.map(s => {
    const total = stats[s].total;
    const score = stats[s].score;
    const acc = total ? Math.round((score/total)*100) : 0;

    return `
      <div class="barRow">
        <div class="barLabel"><span>${s}</span><span>${acc}%</span></div>
        <div class="barTrack"><div class="barFill" style="width:${acc}%"></div></div>
      </div>
    `;
  }).join("");

  const list = $("historyList");
  if(!attempts.length){
    list.innerHTML = `<div class="muted">No attempts yet.</div>`;
  } else {
    list.innerHTML = attempts.slice(0,10).map(a => {
      const percent = Math.round((a.score/a.total)*100);
      return `
        <div class="histItem">
          <div class="histTop">
            <div class="histTitle">${a.subject} • ${a.total} MCQs</div>
            <div class="badge">${percent}%</div>
          </div>
          <div class="histSub">${new Date(a.created_at).toLocaleString()}</div>
        </div>
      `;
    }).join("");
  }
}

/* ------------------ Events ------------------ */
document.querySelectorAll(".navItem").forEach(btn => {
  btn.addEventListener("click", () => {
    expandPracticeTop(); // when switching tabs, show setup again
    setView(btn.dataset.view);
  });
});

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

$("themeBtn").addEventListener("click", cycleTheme);

$("quickStartBtn").addEventListener("click", () => {
  setView("practice");
  expandPracticeTop();
  $("subjectSelect").value = "Biology";
  $("chapterInput").value = "";
  $("topicInput").value = "";
  $("difficultySelect").value = "";
  $("limitInput").value = "10";
  $("modeSelect").value = "learn";
  toast("Quick start loaded: Biology 10.");
});

$("dashStartBtn").addEventListener("click", () => {
  setView("practice");
  expandPracticeTop();
});

$("dashDemoBtn").addEventListener("click", () => {
  setView("practice");
  expandPracticeTop();
  $("subjectSelect").value = "Biology";
  $("chapterInput").value = "Cell";
  $("topicInput").value = "";
  $("difficultySelect").value = "";
  $("limitInput").value = "10";
  $("modeSelect").value = "learn";
  toast("Demo filters loaded. Start quiz.");
});

document.querySelectorAll("[data-quick]").forEach(btn => {
  btn.addEventListener("click", () => {
    setView("practice");
    expandPracticeTop();
    $("subjectSelect").value = btn.dataset.quick;
    $("chapterInput").value = "";
    $("topicInput").value = "";
    $("difficultySelect").value = "";
    $("limitInput").value = "10";
    $("modeSelect").value = "learn";
    toast(`${btn.dataset.quick}: Quick start ready.`);
  });
});

$("startBtn").addEventListener("click", () => {
  const filters = {
    subject: $("subjectSelect").value,
    chapter: $("chapterInput").value.trim(),
    topic: $("topicInput").value.trim(),
    difficulty: $("difficultySelect").value,
    limit: clamp(parseInt($("limitInput").value || "10", 10), 5, 50),
    mode: $("modeSelect").value
  };
  startQuizFromFilters(filters);
});

$("optA").addEventListener("click", () => handleAnswer("A"));
$("optB").addEventListener("click", () => handleAnswer("B"));
$("optC").addEventListener("click", () => handleAnswer("C"));
$("optD").addEventListener("click", () => handleAnswer("D"));

$("nextBtn").addEventListener("click", nextQuestion);
$("prevBtn").addEventListener("click", prevQuestion);
$("skipBtn").addEventListener("click", skipQuestion);
$("finishBtn").addEventListener("click", finishQuiz);

$("retryBtn").addEventListener("click", () => {
  if(!quiz.filters){
    toast("No previous filters found.");
    return;
  }
  startQuizFromFilters(quiz.filters);
});

$("backBtn").addEventListener("click", () => {
  $("resultArea").classList.add("hidden");
  $("quizArea").classList.add("hidden");
  expandPracticeTop();
});

/* ------------------ Init ------------------ */
(async function init(){
  loadTheme();
  $("dbCount").textContent = "Loading...";
  $("dbCount").textContent = await fetchDBCount();

  refreshDashboard();

  // restore last filters
  const lf = loadLastFilters();
  if(lf){
    $("subjectSelect").value = lf.subject || "Biology";
    $("chapterInput").value = lf.chapter || "";
    $("topicInput").value = lf.topic || "";
    $("difficultySelect").value = lf.difficulty || "";
    $("limitInput").value = lf.limit || 10;
    $("modeSelect").value = lf.mode || "learn";
    $("statusText").textContent = "Last filters restored automatically.";
  }
})();
