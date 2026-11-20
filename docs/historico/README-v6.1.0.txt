CAHK Portal v6.1.0 — Hub Acadêmico / Minha Física

NOVA ESTRUTURA ACADÊMICA
- /grade/ continua sendo a grade pública da Física UFPR.
- /disciplina/?code=CF2402 cria uma página própria para cada disciplina.
- /minha-fisica/ é o planejador acadêmico pessoal do estudante.
- /projetos/ permanece como redirecionamento para /grade/ para não quebrar links antigos.

PÁGINA DE CADA DISCIPLINA
- Oferta atual e docente responsável.
- E-mail, ramal e página do docente quando publicados pelo DFIS.
- Horários e salas extraídos automaticamente do quadro de encargos didáticos.
- Localização da disciplina na grade do Bacharelado/Licenciatura.
- Pré-requisitos com links clicáveis.
- Livros vinculados automaticamente pela Biblioteca Virtual.
- Monitorias, provas antigas, listas, materiais e links cadastrados pelo CAHK.
- Histórico de ofertas por semestre.
- Botões “Concluída” e “Adicionar ao meu semestre”.
- Formulário para aluno enviar link de material para aprovação da gestão.

MINHA FÍSICA
- Escolha entre Bacharelado e Licenciatura.
- Marcação de disciplinas concluídas.
- Progresso por número de disciplinas e carga horária identificada.
- “O que posso cursar agora?” com verificação de pré-requisitos.
- Inclui optativas quando os pré-requisitos estiverem atendidos.
- Indicação se a disciplina está sendo ofertada no semestre atual.
- Montador de horário semanal.
- Detecção de choques de horário.
- Exportação do horário em arquivo .ICS para calendário.
- Mapa visual de pré-requisitos.
- Agenda pessoal para provas, listas e seminários.
- Todos os dados pessoais ficam em localStorage no próprio navegador, sem conta e sem envio ao servidor.

GRADE
- Disciplinas ofertadas passam a mostrar horário e sala quando disponíveis.
- Todas as disciplinas apontam para a página individual.
- Optativas são separadas das obrigatórias quando a fonte oficial permite identificar.
- Alterações de docente/horário/oferta podem aparecer em destaque após sincronização.
- Botão direto para Minha Física.

ATUALIZAÇÃO AUTOMÁTICA
- Backend physics-academic consulta as páginas oficiais da Física UFPR.
- Detecta automaticamente versões curriculares mais novas.
- Detecta o quadro de encargos didáticos mais recente.
- Sincronização programada a cada 6 horas.
- Cache de 6 horas.
- Mantém a última cópia válida caso a fonte oficial esteja temporariamente indisponível.

HISTÓRICO
- Cada sincronização registra as ofertas em portal_academic_history.
- Isso permite construir histórico de docentes e horários ao longo dos semestres.

BIBLIOTECA
- portal_library_items ganhou course_codes.
- Gestão da Biblioteca pode associar livros diretamente a códigos como CF2413.
- Goldstein foi associado a Mecânica Clássica.
- Butkov foi associado a Métodos de Física Teórica / Análise Vetorial.
- Livros gerais foram associados às disciplinas iniciais compatíveis.

GESTÃO > ACADÊMICO / DISCIPLINAS
- Nova área administrativa para monitorias, provas antigas, listas, materiais e links.
- Aprovação/rejeição dos links enviados pelos alunos.
- Biblioteca Virtual agora possui o campo “Códigos das disciplinas”.

BUSCA GLOBAL
- Busca por código, nome da disciplina e docente.
- Resultados abrem diretamente a página da disciplina.
- Minha Física também é pesquisável.

QR CODES / PWA
- Novo QR Code para Grade.
- Novo QR Code para Minha Física.
- Minha Física adicionada aos atalhos do PWA.
- Grade, Disciplina e Minha Física entram no cache principal do service worker.

ENVIO DE MATERIAIS
- O envio estudantil é feito por link (Google Drive, OneDrive, página externa etc.).
- O link fica pendente e só é publicado após aprovação da gestão.
- Isso evita abrir upload anônimo de arquivos diretamente no servidor.

BUILD
CAHK Portal build 6.1.0-academic-hub
