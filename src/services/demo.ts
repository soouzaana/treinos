import type { Exercise, Modality, WeekPlanDay, Workout } from '@/types'
import { uid } from '@/utils/id'

/**
 * Dados de EXEMPLO — totalmente opcionais. Tudo o que é criado aqui é registrado em
 * settings['demoIds'] para que possa ser removido com um clique (Configurações).
 * Nenhuma carga é preenchida: você define os seus valores.
 */
export interface DemoBundle {
  modalities: Modality[]
  workouts: Workout[]
  weekPlan: WeekPlanDay[]
}

const ex = (name: string, sets: number, reps: string, notes = ''): Exercise => ({ id: uid(), name, sets, reps, load: null, unit: 'kg', notes })
const exs = (name: string, reps: string, notes = ''): Exercise => ({ id: uid(), name, sets: 1, reps, load: null, unit: '', notes })

export function buildDemo(existing: Modality[]): DemoBundle {
  const t = Date.now()
  const base = existing.length ? Math.max(...existing.map((m) => m.order)) + 1 : 0
  const M = (i: number, name: string, color: string, category: Modality['category'], logType: Modality['logType']): Modality => ({
    id: uid(), name, color, category, logType, order: base + i, active: true, createdAt: t
  })
  const musc = M(0, 'Musculação', '#6366f1', 'musculacao', 'sets')
  const corr = M(1, 'Corrida', '#10b981', 'cardio', 'simple')
  const barra = M(2, 'Barra', '#f59e0b', 'calistenia', 'sets')
  const flex = M(3, 'Flexão', '#ec4899', 'calistenia', 'sets')
  const abd = M(4, 'Abdominal', '#06b6d4', 'calistenia', 'sets')

  const W = (m: Modality, position: number, name: string, exercises: Exercise[], description = ''): Workout => ({
    id: uid(), modalityId: m.id, name, position, description, notes: '', goal: '', active: true, exercises, createdAt: t
  })

  const workouts: Workout[] = [
    W(musc, 0, 'Upper A', [ex('Supino reto', 4, '8-10'), ex('Remada curvada', 4, '8-10'), ex('Desenvolvimento', 3, '10'), ex('Rosca direta', 3, '12'), ex('Tríceps testa', 3, '12')]),
    W(musc, 1, 'Upper B', [ex('Supino inclinado', 4, '8-10'), ex('Puxada frontal', 4, '10'), ex('Elevação lateral', 3, '12-15'), ex('Rosca martelo', 3, '12'), ex('Tríceps corda', 3, '12')]),
    W(musc, 2, 'Lower A', [ex('Agachamento livre', 4, '8-10'), ex('Leg press', 3, '12'), ex('Mesa flexora', 3, '12'), ex('Panturrilha em pé', 4, '15')]),
    W(musc, 3, 'Lower B', [ex('Levantamento terra romeno', 4, '8-10'), ex('Afundo', 3, '10 por perna'), ex('Cadeira extensora', 3, '12'), ex('Panturrilha sentado', 4, '15')]),
    W(musc, 4, 'Lower C', [ex('Agachamento frontal', 4, '8'), ex('Hip thrust', 4, '10'), ex('Cadeira abdutora', 3, '15'), ex('Panturrilha no leg press', 4, '15')]),
    W(corr, 0, 'Treino 1', [exs('Corrida contínua', '30 min em ritmo confortável')], 'Base aeróbica'),
    W(corr, 1, 'Treino 2', [exs('Aquecimento', '5 min'), exs('Tiros', '6 x 400 m, descanso de 1 min 30 s'), exs('Desaquecimento', '5 min')], 'Intervalado'),
    W(corr, 2, 'Treino 3', [exs('Corrida progressiva', '40 min, aumentando o ritmo a cada 10 min')], 'Longo / progressivo'),
    W(barra, 0, 'Treino 1', [ex('Barra fixa', 5, 'máx. de repetições'), ex('Remada invertida', 3, '10')]),
    W(barra, 1, 'Treino 2', [ex('Barra isométrica', 5, 'tempo máximo (s)'), ex('Barra negativa', 3, '5')]),
    W(flex, 0, 'Treino 1', [ex('Flexão de braços', 5, 'máx. de repetições')]),
    W(flex, 1, 'Treino 2', [ex('Flexão de braços', 4, '15'), ex('Flexão diamante', 3, '10')]),
    W(flex, 2, 'Treino 3', [ex('Flexão de braços', 6, '10, descanso curto')]),
    W(abd, 0, 'Treino 1', [ex('Abdominal remador', 5, '20')]),
    W(abd, 1, 'Treino 2', [ex('Abdominal infra', 4, '15'), ex('Prancha', 3, '45 s')]),
    W(abd, 2, 'Treino 3', [ex('Abdominal completo', 5, 'máx. em 60 s')])
  ]
  for (const w of workouts) for (const e of w.exercises) if (!e.unit) e.unit = ''

  const plan = (weekday: number, ids: string[]): WeekPlanDay => ({ weekday, rest: ids.length === 0, modalityIds: ids })
  const weekPlan = [
    plan(1, [musc.id, abd.id]),
    plan(2, [musc.id, corr.id]),
    plan(3, [musc.id, barra.id]),
    plan(4, [corr.id]),
    plan(5, [musc.id, flex.id]),
    plan(6, [musc.id, corr.id]),
    plan(0, [])
  ]
  return { modalities: [musc, corr, barra, flex, abd], workouts, weekPlan }
}
