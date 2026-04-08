import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Info, 
  Bell,
  X
} from 'lucide-react';

// CONFIGURAÇÕES
const START_DATE = new Date('2026-04-08T00:00:00');

interface Exercise {
  id: string;
  name: string;
  desc: string;
  obs: string;
  type: 'base' | 'comp';
  instructions: string[];
  avoid: string;
}

interface DailyRecord {
  pain: number;
  exercises: string[];
}

type History = Record<string, DailyRecord>;

// --- Sub-componentes ---

interface ExerciseCardProps {
  exercise: Exercise;
  isDone: boolean;
  onToggle: (id: string) => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, isDone, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card-transition bg-slate-800 rounded-xl border border-slate-700 overflow-hidden ${isDone ? 'opacity-60 grayscale-[0.5]' : ''}`}
    >
      <div className="p-4 flex justify-between items-center">
        <div className="flex-1 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold ${exercise.type === 'base' ? 'text-indigo-400' : 'text-emerald-400'} uppercase tracking-widest`}>
              {exercise.type === 'base' ? 'Essencial' : 'Complementar'}
            </span>
            {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
          </div>
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            {exercise.name}
            <Info size={14} className="text-slate-500 hover:text-indigo-400" />
          </h3>
          <p className="text-sm text-slate-400">{exercise.desc}</p>
        </div>
        <button 
          onClick={() => onToggle(exercise.id)}
          className={`ml-4 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            isDone 
              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' 
              : 'border-indigo-500 hover:bg-indigo-500/20 text-transparent'
          }`}
        >
          <AnimatePresence mode="wait">
            {isDone && (
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
              >
                <CheckCircle2 size={24} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4 border-t border-slate-700/50 bg-slate-800/50"
          >
            <div className="pt-4 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-indigo-400 uppercase mb-1">Passo a Passo:</h4>
                <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                  {exercise.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-amber-900/20 border border-amber-900/50 p-2 rounded-lg">
                <h4 className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1">
                  <AlertCircle size={12} /> O que evitar:
                </h4>
                <p className="text-xs text-amber-200/80 mt-1">{exercise.avoid}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface PainScaleProps {
  painLevel: number;
  onSetPain: (val: number) => void;
}

const PainScale: React.FC<PainScaleProps> = ({ painLevel, onSetPain }) => {
  return (
    <div className="bg-slate-800 p-4 rounded-xl shadow-md border border-slate-700">
      <label className="block text-xs font-semibold text-slate-400 uppercase mb-3 text-center">
        Nível de Dor Inicial (0-10)
      </label>
      <div className="flex justify-between gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            onClick={() => onSetPain(i)}
            className={`pain-btn ${painLevel === i ? 'active' : ''}`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
};

interface PainTrendProps {
  history: History;
}

const PainTrend: React.FC<PainTrendProps> = ({ history }) => {
  const last7Days = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      data.push({
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
        value: history[key]?.pain ?? 0,
        date: key
      });
    }
    return data;
  }, [history]);

  const maxPain = 10;
  const height = 100;
  const width = 300;
  const padding = 20;

  const points = last7Days.map((d, i) => {
    const x = (i * (width - padding * 2)) / 6 + padding;
    const y = height - (d.value * (height - padding * 2)) / maxPain - padding;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
      <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
        <TrendingUp size={14} /> Tendência de Dor (7 dias)
      </h3>
      <div className="relative h-[120px] w-full flex items-end justify-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Grid lines */}
          {[0, 5, 10].map(v => {
            const y = height - (v * (height - padding * 2)) / maxPain - padding;
            return (
              <line key={v} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="4" />
            );
          })}
          
          {/* Line */}
          <polyline
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
          
          {/* Dots */}
          {last7Days.map((d, i) => {
            const x = (i * (width - padding * 2)) / 6 + padding;
            const y = height - (d.value * (height - padding * 2)) / maxPain - padding;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="4" fill="#6366f1" />
                <text x={x} y={height + 15} fontSize="8" fill="#94a3b8" textAnchor="middle" className="uppercase font-bold">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const IsometricTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(45);
  const [isActive, setIsActive] = useState(false);
  const totalTime = 45;

  useEffect(() => {
    let interval: number | undefined;
    if (isActive && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      alert("Tempo concluído!");
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(45);
  };

  const progress = (timeLeft / totalTime) * 100;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="24"
                cy="24"
                r={radius / 2}
                fill="none"
                stroke="#334155"
                strokeWidth="4"
              />
              <motion.circle
                cx="24"
                cy="24"
                r={radius / 2}
                fill="none"
                stroke="#6366f1"
                strokeWidth="4"
                strokeDasharray={circumference / 2}
                animate={{ strokeDashoffset: offset / 2 }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-indigo-400">
              {timeLeft}s
            </div>
          </div>
          <span className="text-sm font-bold text-slate-400 uppercase">Timer Isométrico</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={toggleTimer} 
            className={`${isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} px-4 py-1 rounded-md text-sm font-bold transition-colors flex items-center gap-2`}
          >
            {isActive ? <X size={16} /> : <Clock size={16} />}
            {isActive ? 'Pausar' : timeLeft < 45 ? 'Retomar' : 'Iniciar'}
          </button>
          <button 
            onClick={resetTimer} 
            className="bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-md text-sm transition-colors"
          >
            ↺
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Componente Principal ---

const App: React.FC = () => {
  const [history, setHistory] = useState<History>(() => {
    const saved = localStorage.getItem('fisio_history');
    return saved ? JSON.parse(saved) : {};
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('fisio_notifications') === 'true';
  });

  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const todayKey = new Date().toISOString().split('T')[0];
  const currentRecord = history[todayKey] || { pain: 0, exercises: [] };

  const [treatmentDay, setTreatmentDay] = useState(0);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - START_DATE.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    setTreatmentDay(diffDays);
  }, []);

  // Persistência
  useEffect(() => {
    localStorage.setItem('fisio_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('fisio_notifications', notificationsEnabled.toString());
    if (notificationsEnabled && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [notificationsEnabled]);

  // Análise IA
  useEffect(() => {
    const analyzePain = async () => {
      const dates = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }

      const highPainStreak = dates.every(date => (history[date]?.pain ?? 0) > 7);

      if (highPainStreak && !aiRecommendation && !isAnalyzing) {
        setIsAnalyzing(true);
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `O usuário registrou dor nível > 7 por 3 dias seguidos durante o protocolo de recuperação de epicondilite lateral. Com base nisso, forneça uma recomendação curta e profissional (máximo 3 frases) sugerindo repouso ou consulta, seguindo as diretrizes de fisioterapia.`,
          });
          setAiRecommendation(response.text);
        } catch (error) {
          console.error("Erro na análise IA:", error);
        } finally {
          setIsAnalyzing(false);
        }
      }
    };

    analyzePain();
  }, [history, aiRecommendation, isAnalyzing]);

  const isDayB = treatmentDay >= 0 && treatmentDay % 2 === 0;
  const tylerVariation = treatmentDay % 2 === 0 ? "Tyler Twist Clássico" : "Reverse Tyler Twist";

  const exercises = useMemo<Exercise[]>(() => {
    const list: Exercise[] = [
      { 
        id: 'tyler', 
        name: tylerVariation, 
        desc: '3 séries de 10–15 reps', 
        obs: 'Fase excêntrica: descida lenta', 
        type: 'base',
        instructions: [
          'Segure a barra flexível verticalmente com a mão afetada.',
          'Segure a parte superior com a outra mão (palma para fora).',
          'Gire a barra com a mão não afetada enquanto a mantém firme.',
          'Lentamente, deixe a mão afetada retornar à posição inicial resistindo ao movimento.'
        ],
        avoid: 'Não compense o movimento elevando o ombro ou girando o tronco.'
      },
      { 
        id: 'eccentric', 
        name: 'Excêntrico com Halter', 
        desc: '3 séries de 12–15 reps', 
        obs: 'Subir com ajuda, descer controlado', 
        type: 'base',
        instructions: [
          'Apoie o antebraço em uma mesa com o punho para fora.',
          'Use a mão saudável para levantar o peso.',
          'Desça o peso lentamente usando apenas a mão afetada (fase excêntrica).',
          'Repita o ciclo.'
        ],
        avoid: 'Não use força explosiva na descida; o controle é a chave.'
      }
    ];

    if (isDayB) {
      list.push(
        { 
          id: 'farmer', 
          name: "Farmer's Hold", 
          desc: '3–4 séries de 30–45 seg', 
          obs: 'Isométrico - Use o Timer abaixo', 
          type: 'comp',
          instructions: [
            'Segure um peso pesado ao lado do corpo com o braço estendido.',
            'Mantenha a postura ereta e o punho neutro.',
            'Sustente a carga pelo tempo determinado sem deixar o punho ceder.'
          ],
          avoid: 'Evite inclinar o corpo para o lado oposto ao peso.'
        },
        { 
          id: 'wall', 
          name: 'Wall Slide (Serrátil)', 
          desc: '2–3 séries de 10–15 reps', 
          obs: 'Manter braços em 90°', 
          type: 'comp',
          instructions: [
            'Encoste os antebraços na parede em um ângulo de 90°.',
            'Deslize os braços para cima mantendo o contato com a parede.',
            'Retorne lentamente mantendo a escápula estabilizada.'
          ],
          avoid: 'Não deixe os cotovelos se afastarem da parede durante a subida.'
        },
        { 
          id: 'rotation', 
          name: 'Rotação Externa', 
          desc: '2–3 séries de 12–15 reps', 
          obs: 'Cotovelo colado ao corpo', 
          type: 'comp',
          instructions: [
            'Segure um elástico ou halter leve.',
            'Mantenha o cotovelo colado ao tronco em 90°.',
            'Rode o antebraço para fora e retorne controladamente.'
          ],
          avoid: 'Não afaste o cotovelo do corpo para ganhar amplitude.'
        }
      );
    }
    return list;
  }, [isDayB, tylerVariation]);

  const progress = exercises.length > 0 
    ? Math.round((currentRecord.exercises.length / exercises.length) * 100) 
    : 0;

  const setPainLevel = (val: number) => {
    setHistory(prev => ({
      ...prev,
      [todayKey]: {
        ...currentRecord,
        pain: val
      }
    }));
  };

  const toggleComplete = (id: string) => {
    const newExercises = currentRecord.exercises.includes(id)
      ? currentRecord.exercises.filter(i => i !== id)
      : [...currentRecord.exercises, id];
    
    setHistory(prev => ({
      ...prev,
      [todayKey]: {
        ...currentRecord,
        exercises: newExercises
      }
    }));
  };

  const resetDailyProgress = () => {
    if (confirm("Deseja resetar o progresso de hoje?")) {
      setHistory(prev => {
        const newHistory = { ...prev };
        delete newHistory[todayKey];
        return newHistory;
      });
    }
  };

  if (treatmentDay < 0) {
    return (
      <div className="max-w-md mx-auto space-y-6 text-center py-12">
        <h1 className="text-2xl font-[800] text-indigo-400 uppercase tracking-tighter">FisioCheck</h1>
        <div className="bg-slate-800 border-l-4 border-indigo-500 p-6 rounded-r-xl shadow-lg">
          <h2 className="text-xl font-bold">Tratamento não iniciado</h2>
          <p className="text-sm text-slate-400 mt-2">Início previsto em: 08/04/2026</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-12">
      <header className="text-center py-6 relative">
        <div className="absolute right-0 top-6">
          <button 
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`p-2 rounded-full transition-colors ${notificationsEnabled ? 'text-indigo-400 bg-indigo-400/10' : 'text-slate-500 bg-slate-800'}`}
            title="Lembretes Diários"
          >
            <Bell size={20} />
          </button>
        </div>
        <h1 className="text-2xl font-[800] text-indigo-400 uppercase tracking-tighter">FisioCheck</h1>
        <p className="text-slate-400 text-sm">
          {new Date().toLocaleDateString('pt-BR', { 
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
          })}
        </p>
      </header>

      <AnimatePresence>
        {aiRecommendation && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-red-900/30 border border-red-500/50 p-4 rounded-xl flex gap-3 items-start"
          >
            <AlertCircle className="text-red-400 shrink-0" size={20} />
            <div>
              <h4 className="text-xs font-bold text-red-400 uppercase mb-1">Recomendação da IA</h4>
              <p className="text-sm text-red-100/90 leading-relaxed">{aiRecommendation}</p>
              <button 
                onClick={() => setAiRecommendation(null)}
                className="text-[10px] font-bold text-red-400 mt-2 uppercase hover:underline"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-slate-800 border-l-4 border-indigo-500 p-4 rounded-r-xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">
              {isDayB ? "Protocolo B (Completo)" : "Protocolo A (Base)"}
            </h2>
            <p className="text-sm text-slate-400">
              {isDayB ? "Base + Exercícios Complementares" : "Foco nos exercícios base"}
            </p>
          </div>
          <div className="text-right">
            <span className="bg-indigo-900 text-indigo-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {progress}%
            </span>
          </div>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5 mt-4 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="bg-indigo-500 h-1.5 rounded-full"
            transition={{ duration: 0.8, ease: "easeOut" }}
          ></motion.div>
        </div>
      </div>

      <PainScale painLevel={currentRecord.pain} onSetPain={setPainLevel} />

      <PainTrend history={history} />

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {exercises.map(ex => (
            <ExerciseCard 
              key={ex.id} 
              exercise={ex} 
              isDone={currentRecord.exercises.includes(ex.id)} 
              onToggle={toggleComplete} 
            />
          ))}
        </AnimatePresence>
      </div>

      {isDayB && <IsometricTimer />}

      <button 
        onClick={resetDailyProgress} 
        className="w-full py-3 text-slate-500 text-xs font-semibold hover:text-slate-300 transition-colors"
      >
        LIMPAR PROGRESSO DE HOJE
      </button>
    </div>
  );
};

export default App;
