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
  X,
  Play,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Plus,
  Minus
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
  isTimed: boolean;
  duration?: number;
  targetReps?: string;
}

interface DailyRecord {
  pain: number;
  exercises: string[];
}

type History = Record<string, DailyRecord>;
type Scene = 'dashboard' | 'workout' | 'summary';
type WorkoutPhase = 'preparation' | 'active' | 'rest';

// --- Sub-componentes ---

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
          {[0, 5, 10].map(v => {
            const y = height - (v * (height - padding * 2)) / maxPain - padding;
            return (
              <line key={v} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="4" />
            );
          })}
          <polyline
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
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

// --- Workout View Components ---

interface CircularProgressProps {
  progress: number; // 0 to 100
  timeLeft: number;
  isWarning: boolean;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ progress, timeLeft, isWarning }) => {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90">
        <circle
          cx="128"
          cy="128"
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth="12"
        />
        <motion.circle
          cx="128"
          cy="128"
          r={radius}
          fill="none"
          stroke={isWarning ? "#ef4444" : "#6366f1"}
          strokeWidth="12"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "linear" }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-6xl font-mono font-black transition-colors ${isWarning ? 'text-red-500' : 'text-white'}`}>
          {timeLeft}
        </span>
        <span className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">segundos</span>
      </div>
    </div>
  );
};

// --- Main App Component ---

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
  const [appScene, setAppScene] = useState<Scene>('dashboard');
  
  // Workout State
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [workoutPhase, setWorkoutPhase] = useState<WorkoutPhase>('preparation');
  const [workoutTimer, setWorkoutTimer] = useState(10);
  const [repCount, setRepCount] = useState(0);
  const [completedInWorkout, setCompletedInWorkout] = useState<string[]>([]);

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
        isTimed: false,
        targetReps: '10-15',
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
        isTimed: false,
        targetReps: '12-15',
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
          obs: 'Isométrico', 
          type: 'comp',
          isTimed: true,
          duration: 45,
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
          isTimed: false,
          targetReps: '10-15',
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
          isTimed: false,
          targetReps: '12-15',
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

  // Workout Logic
  useEffect(() => {
    let interval: number | undefined;
    if (appScene === 'workout' && workoutPhase !== 'active' || (workoutPhase === 'active' && exercises[currentExerciseIndex]?.isTimed)) {
      interval = window.setInterval(() => {
        setWorkoutTimer(prev => {
          if (prev <= 1) {
            handleWorkoutStepComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [appScene, workoutPhase, currentExerciseIndex, exercises]);

  const handleWorkoutStepComplete = () => {
    if (workoutPhase === 'preparation') {
      setWorkoutPhase('active');
      const ex = exercises[currentExerciseIndex];
      setWorkoutTimer(ex.isTimed ? (ex.duration || 45) : 0);
    } else if (workoutPhase === 'active') {
      setCompletedInWorkout(prev => [...prev, exercises[currentExerciseIndex].id]);
      if (currentExerciseIndex < exercises.length - 1) {
        setWorkoutPhase('rest');
        setWorkoutTimer(15);
      } else {
        setAppScene('summary');
      }
    } else if (workoutPhase === 'rest') {
      setCurrentExerciseIndex(prev => prev + 1);
      setWorkoutPhase('active');
      const ex = exercises[currentExerciseIndex + 1];
      setWorkoutTimer(ex.isTimed ? (ex.duration || 45) : 0);
    }
  };

  const startWorkout = () => {
    setCurrentExerciseIndex(0);
    setWorkoutPhase('preparation');
    setWorkoutTimer(10);
    setCompletedInWorkout([]);
    setAppScene('workout');
  };

  const nextStep = () => {
    if (workoutPhase === 'preparation') {
      setWorkoutPhase('active');
      const ex = exercises[currentExerciseIndex];
      setWorkoutTimer(ex.isTimed ? (ex.duration || 45) : 0);
    } else if (workoutPhase === 'active') {
      handleWorkoutStepComplete();
    } else if (workoutPhase === 'rest') {
      handleWorkoutStepComplete();
    }
  };

  const prevStep = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(prev => prev - 1);
      setWorkoutPhase('active');
      const ex = exercises[currentExerciseIndex - 1];
      setWorkoutTimer(ex.isTimed ? (ex.duration || 45) : 0);
    }
  };

  const finishWorkout = () => {
    setHistory(prev => ({
      ...prev,
      [todayKey]: {
        ...currentRecord,
        exercises: Array.from(new Set([...currentRecord.exercises, ...completedInWorkout]))
      }
    }));
    setAppScene('dashboard');
  };

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
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      <AnimatePresence mode="wait">
        {appScene === 'dashboard' && (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-md mx-auto space-y-6 p-4 pb-12"
          >
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

            <div className="flex flex-col items-center py-8">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startWorkout}
                className="w-48 h-48 rounded-full bg-indigo-600 shadow-[0_0_30px_rgba(99,102,241,0.4)] flex flex-col items-center justify-center gap-2 border-4 border-indigo-400"
              >
                <Play size={48} fill="currentColor" />
                <span className="font-black uppercase tracking-tighter text-lg">Iniciar Treino</span>
              </motion.button>
              <p className="text-slate-500 text-xs mt-6 uppercase font-bold tracking-widest">
                {exercises.length} exercícios hoje
              </p>
            </div>

            <button 
              onClick={resetDailyProgress} 
              className="w-full py-3 text-slate-500 text-xs font-semibold hover:text-slate-300 transition-colors"
            >
              LIMPAR PROGRESSO DE HOJE
            </button>
          </motion.div>
        )}

        {appScene === 'workout' && (
          <motion.div 
            key="workout"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed inset-0 z-50 bg-[#020617] flex flex-col"
          >
            {/* Header */}
            <div className="p-6 flex justify-between items-center">
              <button onClick={() => setAppScene('dashboard')} className="text-slate-500 hover:text-white">
                <X size={24} />
              </button>
              <div className="flex gap-1">
                {exercises.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1 w-8 rounded-full transition-colors ${i === currentExerciseIndex ? 'bg-indigo-500' : i < currentExerciseIndex ? 'bg-emerald-500' : 'bg-slate-800'}`}
                  />
                ))}
              </div>
              <div className="w-6" />
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
              <AnimatePresence mode="wait">
                {workoutPhase === 'preparation' && (
                  <motion.div
                    key="prep"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    className="space-y-8"
                  >
                    <h2 className="text-indigo-400 font-black uppercase tracking-widest text-xl">Prepare-se</h2>
                    <div className="text-8xl font-black text-white">{workoutTimer}</div>
                    <div>
                      <p className="text-slate-400 text-sm uppercase font-bold mb-2">Primeiro exercício:</p>
                      <h3 className="text-2xl font-bold">{exercises[0].name}</h3>
                    </div>
                  </motion.div>
                )}

                {workoutPhase === 'active' && (
                  <motion.div
                    key="active"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full max-w-sm space-y-8"
                  >
                    <div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${exercises[currentExerciseIndex].type === 'base' ? 'bg-indigo-900 text-indigo-300' : 'bg-emerald-900 text-emerald-300'} uppercase mb-4 inline-block`}>
                        {exercises[currentExerciseIndex].type === 'base' ? 'Essencial' : 'Complementar'}
                      </span>
                      <h2 className="text-3xl font-black text-white leading-tight">{exercises[currentExerciseIndex].name}</h2>
                      <p className="text-slate-400 mt-2">{exercises[currentExerciseIndex].desc}</p>
                    </div>

                    <div className="flex flex-col items-center">
                      {exercises[currentExerciseIndex].isTimed ? (
                        <CircularProgress 
                          progress={(workoutTimer / (exercises[currentExerciseIndex].duration || 45)) * 100} 
                          timeLeft={workoutTimer}
                          isWarning={workoutTimer <= 3}
                        />
                      ) : (
                        <div className="space-y-6">
                          <div className="text-7xl font-black text-white flex items-center justify-center gap-6">
                            <button 
                              onClick={() => setRepCount(Math.max(0, repCount - 1))}
                              className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"
                            >
                              <Minus size={24} />
                            </button>
                            <span className="w-24">{repCount}</span>
                            <button 
                              onClick={() => setRepCount(repCount + 1)}
                              className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"
                            >
                              <Plus size={24} />
                            </button>
                          </div>
                          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Repetições Concluídas</p>
                          <button 
                            onClick={handleWorkoutStepComplete}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter text-lg shadow-lg shadow-indigo-900/40"
                          >
                            Concluir Exercício
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 text-left">
                      <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2 flex items-center gap-2">
                        <Info size={14} /> Dica de Execução
                      </h4>
                      <p className="text-xs text-slate-400 italic">{exercises[currentExerciseIndex].obs}</p>
                    </div>
                  </motion.div>
                )}

                {workoutPhase === 'rest' && (
                  <motion.div
                    key="rest"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    className="space-y-8"
                  >
                    <h2 className="text-emerald-400 font-black uppercase tracking-widest text-xl">Descanso</h2>
                    <div className="text-8xl font-black text-white">{workoutTimer}</div>
                    <div>
                      <p className="text-slate-400 text-sm uppercase font-bold mb-2">Próximo:</p>
                      <h3 className="text-2xl font-bold">{exercises[currentExerciseIndex + 1].name}</h3>
                    </div>
                    <button 
                      onClick={handleWorkoutStepComplete}
                      className="text-indigo-400 font-bold uppercase text-sm"
                    >
                      Pular Descanso
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Navigation */}
            <div className="p-8 flex justify-between items-center border-t border-slate-900">
              <button 
                onClick={prevStep} 
                disabled={currentExerciseIndex === 0}
                className="flex items-center gap-2 text-slate-500 disabled:opacity-0"
              >
                <ArrowLeft size={20} />
                <span className="font-bold uppercase text-xs">Anterior</span>
              </button>
              
              {currentExerciseIndex < exercises.length - 1 && (
                <div className="text-left">
                  <p className="text-[10px] font-bold text-slate-600 uppercase">Próximo</p>
                  <p className="text-xs font-bold text-slate-400">{exercises[currentExerciseIndex + 1].name}</p>
                </div>
              )}

              <button 
                onClick={nextStep}
                className="flex items-center gap-2 text-indigo-400"
              >
                <span className="font-bold uppercase text-xs">Pular</span>
                <ArrowRight size={20} />
              </button>
            </div>
          </motion.div>
        )}

        {appScene === 'summary' && (
          <motion.div 
            key="summary"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto p-6 flex flex-col min-h-screen"
          >
            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
              <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.4)]">
                <CheckCircle2 size={48} className="text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Treino Concluído!</h2>
                <p className="text-slate-400">Excelente trabalho na sua recuperação.</p>
              </div>

              <div className="w-full bg-slate-800 rounded-2xl p-6 space-y-4 border border-slate-700">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest text-left">Resumo da Sessão</h3>
                <div className="space-y-3">
                  {exercises.map(ex => (
                    <div key={ex.id} className="flex items-center justify-between text-left">
                      <span className="text-sm font-medium text-slate-300">{ex.name}</span>
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4 py-8">
              <button 
                onClick={finishWorkout}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase tracking-tighter text-lg shadow-lg shadow-indigo-900/40"
              >
                Salvar e Voltar
              </button>
              <button 
                onClick={() => setAppScene('dashboard')}
                className="w-full text-slate-500 font-bold uppercase text-xs"
              >
                Descartar Sessão
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
