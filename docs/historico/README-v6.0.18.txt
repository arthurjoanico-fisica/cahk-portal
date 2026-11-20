CAHK Portal v6.0.18 — Grade da Física automática

MUDANÇA PRINCIPAL
- A antiga aba pública “Projetos” foi substituída por “Grade”.
- Nova página canônica: /grade/
- /projetos/ redireciona para /grade/ para não quebrar links antigos.

GRADE E DISCIPLINAS
- Disciplinas ofertadas no semestre atual pelo Departamento de Física.
- Separação entre Bacharelado, Licenciatura e optativas.
- Docente responsável por cada oferta.
- E-mail institucional, ramal e página pessoal quando publicados pelo DFIS.
- Busca por código, disciplina ou docente.
- Aba de docentes do semestre.
- Grade curricular do Bacharelado e da Licenciatura organizada por período.
- Pré-requisitos e carga horária quando disponíveis nas fontes.

ATUALIZAÇÃO AUTOMÁTICA
- O backend consulta as páginas oficiais da Física UFPR.
- Fontes-base:
  https://fisica.ufpr.br/grad/bacharelado_2023.html
  https://fisica.ufpr.br/grad/licenciatura_2023.html
- O sistema detecta automaticamente versões curriculares mais novas linkadas nessas páginas.
- Em 2026/2 detectou Bacharelado versão 2025 e Licenciatura versão 2023.
- O semestre corrente é obtido do quadro de encargos didáticos mais recente publicado pelo Departamento.
- Contatos são sincronizados de https://fisica.ufpr.br/pessoal.html
- Atualização programada diariamente, além de cache de 6 horas.
- Se a fonte oficial estiver temporariamente fora do ar, mantém a última cópia válida.

BACKEND
- Edge Function physics-academic.
- Cache em portal_academic_cache.
- Job diário refresh-physics-academic-daily.

BUILD
CAHK Portal build 6.0.18-grade-fisica-auto
