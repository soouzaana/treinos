export type ModalityCategory = 'musculacao' | 'casa' | 'cardio' | 'calistenia' | 'taf' | 'outro'
/** 'sets' = registro série a série (carga/repetições); 'simple' = checklist + observações */
export type LogType = 'sets' | 'simple'

export interface Modality {
  id: string
  name: string
  color: string
  category: ModalityCategory
  logType: LogType
  order: number
  active: boolean
  createdAt: number
}

export interface Exercise {
  id: string
  name: string
  sets: number
  reps: string // texto livre: "10", "8-12", "30s"
  load: number | null
  unit: string // kg, m, s...
  notes: string
  /** duração planejada do exercício (ex.: prancha 45 s). Opcional. */
  durationSec?: number | null
  /** descanso entre séries, em segundos. Opcional. */
  restSec?: number | null
}

export interface Workout {
  id: string
  modalityId: string
  name: string
  position: number
  description: string
  notes: string
  goal: string
  active: boolean
  exercises: Exercise[]
  createdAt: number
}

export interface WeekPlanDay {
  weekday: number // 0 = domingo ... 6 = sábado
  rest: boolean
  modalityIds: string[] // ordem de apresentação
}

export interface SetLog {
  n: number
  load: number | null
  reps: number | null
  done: boolean
  notes: string
}

export interface ExerciseLog {
  exerciseId: string
  name: string
  unit: string
  plannedSets: number
  plannedReps: string
  plannedLoad: number | null
  plannedDurationSec?: number | null
  plannedRestSec?: number | null
  done: boolean // usado no modo 'simple'
  sets: SetLog[]
}

export type SessionStatus = 'in_progress' | 'completed' | 'skipped'

export interface Session {
  /** determinístico: `${date}_${modalityId}` → impede duplicidade */
  id: string
  date: string // YYYY-MM-DD (local)
  modalityId: string
  workoutId: string // treino efetivamente executado
  workoutName: string
  workoutPosition: number // snapshot da posição (permite continuar a rotação se o treino for excluído)
  suggestedWorkoutId: string | null
  substituted: boolean
  /**
   * Substituição entre modalidades: esta sessão (ex.: Treino em Casa) tomou o lugar de outra
   * modalidade planejada no dia (ex.: Musculação). Guarda o treino que estava sugerido para ela.
   */
  replacesModalityId?: string | null
  replacesWorkoutId?: string | null
  replacesWorkoutName?: string | null
  status: SessionStatus
  startedAt: number | null
  completedAt: number | null
  durationSec: number | null
  notes: string
  exercises: ExerciseLog[]
  createdAt: number
  updatedAt: number
}

export type TafKind = 'distance' | 'reps' | 'time' | 'custom'
export type TafDirection = 'higher' | 'lower'

export interface TafTest {
  id: string
  name: string
  unit: string
  kind: TafKind
  direction: TafDirection // higher = quanto maior melhor
  durationSec: number | null // duração do protocolo (12 min = 720, 60 s = 60)
  protocol: string
  personalGoal: number | null
  officialRef: number | null
  officialSource: string
  active: boolean
  order: number
}

export type TafEvalKind = 'training' | 'simulated'

export interface TafEvaluation {
  id: string
  testId: string
  date: string
  result: number
  unit: string
  kind: TafEvalKind
  durationSec: number | null
  notes: string
  personalGoal: number | null
  officialRef: number | null
  officialSource: string
  createdAt: number
}

/**
 * Substituição de uma modalidade planejada por outra, em uma data (ex.: Musculação → Treino em Casa).
 * Fica em settings['daySwaps'] (vai junto no backup). Não altera o planejamento semanal.
 */
export interface DaySwap {
  date: string
  fromModalityId: string
  toModalityId: string
  /** treino que a rotação sugeria para a modalidade substituída, no momento da troca */
  originalWorkoutId: string | null
  originalWorkoutName: string | null
  createdAt: number
}

export interface SettingRow {
  key: string
  value: unknown
}

export interface BackupFile {
  app: 'treinos-taf'
  schemaVersion: number
  exportedAt: string
  data: {
    modalities: Modality[]
    workouts: Workout[]
    weekPlan: WeekPlanDay[]
    sessions: Session[]
    tafTests: TafTest[]
    tafEvaluations: TafEvaluation[]
    settings: SettingRow[]
  }
}

export type Evolution = 'evolucao' | 'manutencao' | 'regressao'
export type TafStatus = 'achieved' | 'progress' | 'below' | 'nogoal'
