import './index.css';

// CONFIGURAÇÕES
const START_DATE = new Date('2026-04-08T00:00:00');
let completedExercises: string[] = JSON.parse(localStorage.getItem('fisio_completed') || '[]');
let timerInterval: number | null = null;
let timeLeft = 45;

// LÓGICA DE DATAS
function getTreatmentDay() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - START_DATE.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function initApp() {
    const diffDays = getTreatmentDay();
    const today = new Date();
    
    // Exibir Data
    const dateDisplay = document.getElementById('current-date-display');
    if (dateDisplay) {
        dateDisplay.textContent = today.toLocaleDateString('pt-BR', { 
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
        });
    }

    const titleEl = document.getElementById('day-type-title');
    const descEl = document.getElementById('day-description');

    if (diffDays < 0) {
        if (titleEl) titleEl.textContent = "Tratamento não iniciado";
        if (descEl) descEl.textContent = `Início previsto em: 08/04/2026`;
        return;
    }

    // Regra: Dias pares desde o início -> Dia B (Completo). Ímpares -> Dia A (Base).
    const isDayB = (diffDays % 2 === 0);
    const tylerVariation = (diffDays % 2 === 0) ? "Tyler Twist Clássico" : "Reverse Tyler Twist";

    if (titleEl) titleEl.textContent = isDayB ? "Protocolo B (Completo)" : "Protocolo A (Base)";
    if (descEl) descEl.textContent = isDayB ? "Base + Exercícios Complementares" : "Foco nos exercícios base";

    renderExercises(isDayB, tylerVariation);
    renderPainButtons();
    updateProgress();
    
    // Carregar dor salva
    const savedPain = localStorage.getItem('fisio_pain');
    if (savedPain) setPain(parseInt(savedPain));

    // Setup Event Listeners
    setupEventListeners();
}

function setupEventListeners() {
    document.getElementById('timer-btn')?.addEventListener('click', toggleTimer);
    document.getElementById('reset-timer-btn')?.addEventListener('click', resetTimer);
    document.getElementById('reset-progress-btn')?.addEventListener('click', resetDailyProgress);
}

function renderPainButtons() {
    const container = document.getElementById('pain-buttons-container');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i <= 10; i++) {
        const btn = document.createElement('button');
        btn.className = 'pain-btn';
        btn.setAttribute('data-value', i.toString());
        btn.textContent = i.toString();
        btn.onclick = () => setPain(i);
        container.appendChild(btn);
    }
}

function renderExercises(isDayB: boolean, tylerName: string) {
    const list = document.getElementById('exercise-list');
    if (!list) return;
    list.innerHTML = '';

    const exercises = [
        { id: 'tyler', name: tylerName, desc: '3 séries de 10–15 reps', obs: 'Fase excêntrica: descida lenta', type: 'base' },
        { id: 'eccentric', name: 'Excêntrico com Halter', desc: '3 séries de 12–15 reps', obs: 'Subir com ajuda, descer controlado', type: 'base' }
    ];

    if (isDayB) {
        exercises.push(
            { id: 'farmer', name: "Farmer's Hold", desc: '3–4 séries de 30–45 seg', obs: 'Isométrico - Use o Timer abaixo', type: 'comp' },
            { id: 'wall', name: 'Wall Slide (Serrátil)', desc: '2–3 séries de 10–15 reps', obs: 'Manter braços em 90°', type: 'comp' },
            { id: 'rotation', name: 'Rotação Externa', desc: '2–3 séries de 12–15 reps', obs: 'Cotovelo colado ao corpo', type: 'comp' }
        );
        document.getElementById('timer-box')?.classList.remove('hidden');
    } else {
        document.getElementById('timer-box')?.classList.add('hidden');
    }

    exercises.forEach(ex => {
        const isDone = completedExercises.includes(ex.id);
        const card = document.createElement('div');
        card.className = `card-transition bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center ${isDone ? 'completed' : ''}`;
        card.id = `card-${ex.id}`;
        
        card.innerHTML = `
            <div class="flex-1">
                <span class="text-[10px] font-bold ${ex.type === 'base' ? 'text-indigo-400' : 'text-emerald-400'} uppercase tracking-widest">${ex.type === 'base' ? 'Essencial' : 'Complementar'}</span>
                <h3 class="font-bold text-slate-100">${ex.name}</h3>
                <p class="text-sm text-slate-400">${ex.desc}</p>
                <p class="text-[11px] text-slate-500 italic mt-1">${ex.obs}</p>
            </div>
            <button class="ml-4 w-10 h-10 rounded-full border-2 border-indigo-500 flex items-center justify-center hover:bg-indigo-500/20 transition-colors">
                ${isDone ? '✓' : ''}
            </button>
        `;
        
        const btn = card.querySelector('button');
        if (btn) btn.onclick = () => toggleComplete(ex.id);
        
        list.appendChild(card);
    });
}

// FUNCIONALIDADES
function toggleComplete(id: string) {
    if (completedExercises.includes(id)) {
        completedExercises = completedExercises.filter(i => i !== id);
    } else {
        completedExercises.push(id);
    }
    localStorage.setItem('fisio_completed', JSON.stringify(completedExercises));
    
    const card = document.getElementById(`card-${id}`);
    if (card) {
        card.classList.toggle('completed');
        const btn = card.querySelector('button');
        if (btn) btn.innerHTML = completedExercises.includes(id) ? '✓' : '';
    }
    
    updateProgress();
}

function updateProgress() {
    const total = document.querySelectorAll('#exercise-list > div').length;
    const done = completedExercises.length;
    const perc = total > 0 ? Math.round((done / total) * 100) : 0;
    
    const progressBar = document.getElementById('progress-bar');
    const progressBadge = document.getElementById('progress-badge');
    
    if (progressBar) progressBar.style.width = perc + '%';
    if (progressBadge) progressBadge.textContent = perc + '%';
}

function setPain(val: number) {
    document.querySelectorAll('.pain-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'border-indigo-400', 'active');
    });
    const selected = document.querySelector(`.pain-btn[data-value="${val}"]`);
    if (selected) {
        selected.classList.add('bg-indigo-600', 'border-indigo-400', 'active');
        localStorage.setItem('fisio_pain', val.toString());
    }
}

function resetDailyProgress() {
    if (confirm("Deseja resetar o progresso de hoje?")) {
        completedExercises = [];
        localStorage.removeItem('fisio_completed');
        initApp();
    }
}

// TIMER
function toggleTimer() {
    const btn = document.getElementById('timer-btn');
    if (!btn) return;

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        btn.textContent = "Retomar";
        btn.classList.remove('bg-red-600');
        btn.classList.add('bg-indigo-600');
    } else {
        btn.textContent = "Pausar";
        btn.classList.remove('bg-indigo-600');
        btn.classList.add('bg-red-600');
        timerInterval = window.setInterval(() => {
            timeLeft--;
            const display = document.getElementById('timer-display');
            if (display) display.textContent = timeLeft + 's';
            if (timeLeft <= 0) {
                if (timerInterval) clearInterval(timerInterval);
                timerInterval = null;
                alert("Tempo concluído!");
                resetTimer();
            }
        }, 1000);
    }
}

function resetTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timeLeft = 45;
    const display = document.getElementById('timer-display');
    const btn = document.getElementById('timer-btn');
    if (display) display.textContent = '45s';
    if (btn) {
        btn.textContent = "Iniciar";
        btn.classList.remove('bg-red-600');
        btn.classList.add('bg-indigo-600');
    }
}

// Iniciar
initApp();
