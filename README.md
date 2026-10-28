# Treinos TAF — PWA de treinos com rotação inteligente

App pessoal, offline-first, para organizar musculação e a preparação para o TAF. Sem login, sem backend, sem APIs pagas: tudo fica no IndexedDB do seu aparelho.

**Stack:** Vue 3 (`<script setup>`) · Vite · TypeScript · Pinia · Vue Router · Tailwind CSS · Lucide · Dexie (IndexedDB) · vite-plugin-pwa · Vitest.

## Comandos

```bash
npm install          # instala dependências (usa package-lock.json)
npm run dev          # desenvolvimento em http://localhost:5173
npm test             # testes automatizados (Vitest)
npm run typecheck    # verificação de tipos (vue-tsc)
npm run build        # typecheck + build de produção em dist/
npm run preview      # serve dist/ em http://localhost:4173 (testar PWA/offline)
npm run icons        # regenera os ícones PNG a partir do SVG (opcional)
```

Requer Node 18+ (testado com Node 22).

## Como usar

1. **Mais → Configurações → Carregar exemplo** (opcional) cria modalidades, treinos e um planejamento de demonstração. Pode ser removido sem afetar seus dados. Ou comece do zero em **Treinos → Nova modalidade**.
2. **Treinos:** cadastre modalidades (nome, cor, categoria, ativa/inativa), treinos na ordem da rotação e exercícios (séries, repetições, carga, unidade, observações). Dá para duplicar, reordenar, desativar e excluir.
3. **Plano:** escolha as modalidades de cada dia, a ordem ou descanso. O plano nunca fixa um treino a um dia: cada modalidade recebe o próximo treino pendente da sua própria sequência.
4. **Hoje:** inicie, retome, conclua ("Concluir musculação" deixa a corrida pendente), troque o treino sugerido (fica marcado como substituição) ou registre "Não treinei".
5. **TAF:** configure provas, metas pessoais e critérios do edital (opcionais), registre avaliações (treino ou simulado) e acompanhe a evolução.
6. **Cronômetro de descanso:** botão flutuante nas telas de execução (30/45/60/90/120/180 s ou personalizado). Usa timestamps, então continua correto com a tela bloqueada ou em segundo plano e avisa se já terminou.
7. **Backup:** Configurações → Exportar/Importar JSON (a importação valida a estrutura e pede confirmação antes de substituir).

## Treino em Casa (substitui a musculação)

- A modalidade **Treino em Casa** (4 treinos vazios: *Treino em Casa 1–4*) é criada uma única vez, também em bases que já existiam, sem tocar nos seus dados. Preencha os exercícios em **Treinos → Treino em Casa** (séries, repetições, carga, duração, descanso e observações). Se você excluí-la, ela não volta.
- Em **Hoje**, quando há musculação prevista e ainda sem registro, aparece **Substituir por treino em casa**. O dia passa a ser *Treino em Casa + …* e recebe o próximo treino da sequência de casa. O planejamento semanal não é alterado.
- Só concluir o treino em casa avança a sequência de casa; a de musculação não avança. Iniciar e não concluir não avança nenhuma. As outras modalidades do dia (corrida etc.) seguem independentes.
- **Voltar para musculação** desfaz a troca antes de iniciar. Depois de iniciado, o registro nunca é descartado em silêncio: o app pede confirmação explícita (ou use *Ver / editar* para corrigir).
- Histórico e Desempenho tratam Treino em Casa como modalidade própria e mostram *Substituiu Musculação · treino programado*. A troca fica em `settings['daySwaps']` e vai no backup JSON; não há mudança de esquema do IndexedDB.

## Regras de rotação

O estado da rotação **não é gravado**: é sempre derivado das sessões *concluídas*, em ordem cronológica (`src/services/rotation.ts`, funções puras com testes).

- Cada modalidade tem sequência independente.
- Faltar, apenas iniciar ou visualizar **não** avança.
- Concluir só a musculação avança só a musculação.
- Corrigir ou reabrir um registro recalcula as sugestões automaticamente.
- Uma sessão por modalidade/dia (id `data_modalidade`): concluir duas vezes não duplica.
- Editar o plano, reordenar ou desativar treinos não reinicia a rotação nem apaga histórico.

## Sobre o TAF

O app **não traz índices oficiais**. Você cadastra metas pessoais e, se quiser, a referência do edital (com origem). A situação pessoal (meta atingida / em progresso / abaixo da meta) é separada da situação em relação ao edital, e o app nunca declara aprovação sem todos os critérios oficiais cadastrados.

## Deploy (hospedagem estática)

Rode `npm run build` e publique `dist/`. O roteamento usa *hash* (`/#/rota`), então não precisa de regras de reescrita.

- **Vercel / Netlify:** build `npm run build`, saída `dist`. Nada mais.
- **GitHub Pages (subpasta):** `VITE_BASE=/nome-do-repo/ npm run build` e publique `dist/`.
- **Qualquer servidor estático:** copie o conteúdo de `dist/`. PWA exige HTTPS (ou `localhost`).

## Instalar no celular

- **Android (Chrome):** abra o site → menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.
- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.

Após o primeiro carregamento o app funciona offline. Quando houver versão nova, aparece um aviso para atualizar; os dados do IndexedDB são preservados (o banco tem versionamento Dexie para migrações futuras).

## Estrutura

```
src/
  components/  pages/  stores/  composables/
  services/    rotation, progression, taf, timer, stats, projection, backup, sessions
  db/          schema Dexie versionado, export/import
  types/  router/  utils/
tests/         rotação, progressão, TAF, cronômetro, backup, projeção/sequências
```
