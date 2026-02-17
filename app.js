const SUPABASE_URL = "https://achaxseflfysltezynem.supabase.co/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjaGF4c2VmbGZ5c2x0ZXp5bmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMTM4NDIsImV4cCI6MjA4Njg4OTg0Mn0.MB48zCYeXWGn_AycEceYMSK5Wm_LxuTDLodofc-_C0o";

// UI
const startBtn = document.getElementById("startBtn");
const quizArea = document.getElementById("quizArea");
const resultArea = document.getElementById("resultArea");

const subjectSelect = document.getElementById("subjectSelect");
const chapterInput = document.getElementById("chapterInput");
const topicInput = document.getElementById("topicInput");
const difficultySelect = document.getElementById("difficultySelect");
const limitInput = document.getElementById("limitInput");

const questionText = document.getElementById("questionText");
const optA = document.getElementById("optA");
const optB = document.getElementById("optB");
const optC = document.getElementById("optC");
const optD = document.getElementById("optD");

const explanationBox = document.getElementById("explanationBox");

const qCounter = document.getElementById("qCounter");
const scoreCounter = document.getElementById("scoreCounter");

const nextBtn = document.getElementById("nextBtn");
const finishBtn = document.getElementById("finishBtn");
const finalScore = document.getElementById("finalScore");

// Quiz state
let mcqs = [];
let index = 0;
let score = 0;
let answered = false;

// Fetch MCQs from Supabase
async function fetchMCQs(filters) {
  let url = `${SUPABASE_URL}/rest/v1/mcqs?select=*`;

  url += `&subject=eq.${encodeURIComponent(filters.subject)}`;

  if (filters.chapter) {
    url += `&chapter=ilike.*${encodeURIComponent(filters.chapter)}*`;
  }

  if (filters.topic) {
    url += `&topic=ilike.*${encodeURIComponent(filters.topic)}*`;
  }

  if (filters.difficulty) {
    url += `&difficulty=eq.${encodeURIComponent(filters.difficulty)}`;
  }

  // Random-ish by limiting + ordering
  url += `&limit=${filters.limit}`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  return await res.json();
}

// Render MCQ
function renderQuestion() {
  answered = false;
  explanationBox.classList.add("hidden");

  const q = mcqs[index];

  qCounter.textContent = `Q ${index + 1}/${mcqs.length}`;
  scoreCounter.textContent = `Score: ${score}`;

  questionText.textContent = q.question;

  optA.textContent = "A) " + q.option_a;
  optB.textContent = "B) " + q.option_b;
  optC.textContent = "C) " + q.option_c;
  optD.textContent = "D) " + q.option_d;

  // Reset styles
  document.querySelectorAll(".opt").forEach(btn => {
    btn.style.opacity = "1";
    btn.style.borderColor = "rgba(255,255,255,0.15)";
  });
}

// Handle answer
function handleAnswer(selected) {
  if (answered) return;
  answered = true;

  const q = mcqs[index];
  const correct = q.correct_option;

  if (selected === correct) {
    score++;
  }

  // Show explanation
  explanationBox.innerHTML = `
    <b>Correct:</b> ${correct}<br><br>
    <b>Explanation:</b> ${q.explanation || "No explanation"}<br><br>
    <b>Source:</b> ${q.source || "N/A"}
  `;
  explanationBox.classList.remove("hidden");

  // Highlight correct option
  document.querySelectorAll(".opt").forEach(btn => {
    const opt = btn.dataset.opt;
    if (opt === correct) btn.style.borderColor = "#2f7cff";
    if (opt !== correct) btn.style.opacity = "0.55";
  });

  scoreCounter.textContent = `Score: ${score}`;
}

// Next question
function nextQuestion() {
  if (index < mcqs.length - 1) {
    index++;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

// Finish quiz
function finishQuiz() {
  quizArea.classList.add("hidden");
  resultArea.classList.remove("hidden");

  finalScore.textContent = `You scored ${score} out of ${mcqs.length}`;
}

// Events
startBtn.addEventListener("click", async () => {
  const filters = {
    subject: subjectSelect.value,
    chapter: chapterInput.value.trim(),
    topic: topicInput.value.trim(),
    difficulty: difficultySelect.value,
    limit: parseInt(limitInput.value, 10)
  };

  startBtn.textContent = "Loading...";
  startBtn.disabled = true;

  mcqs = await fetchMCQs(filters);

  startBtn.textContent = "Start Quiz";
  startBtn.disabled = false;

  if (!mcqs.length) {
    alert("No MCQs found. Try removing chapter/topic filters.");
    return;
  }

  // Shuffle for randomness
  mcqs.sort(() => Math.random() - 0.5);

  index = 0;
  score = 0;

  quizArea.classList.remove("hidden");
  resultArea.classList.add("hidden");

  renderQuestion();
});

optA.addEventListener("click", () => handleAnswer("A"));
optB.addEventListener("click", () => handleAnswer("B"));
optC.addEventListener("click", () => handleAnswer("C"));
optD.addEventListener("click", () => handleAnswer("D"));

nextBtn.addEventListener("click", nextQuestion);
finishBtn.addEventListener("click", finishQuiz);
