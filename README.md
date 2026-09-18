# Portal CAHK v4 — visual unificado

Versão que unifica o visual do Portal, Rádio, Loja e Área da Gestão na mesma linguagem minimalista.

## Paleta
- Branco / off-white
- Preto / grafite para texto
- Roxo CAHK como cor de destaque
- Verde do mascote apenas na identidade visual

## Rotas
- `/` Portal
- `/radio/` Rádio CAHK
- `/radio/player.html` Player
- `/radio/admin.html` Administração da rádio
- `/loja/` Loja CAHK
- `/gestao/` Gestão / Caixa / Encomendas

## Deploy
Substitua os arquivos do repositório `cahk-portal` pelo conteúdo deste pacote e faça commit.
Depois do deploy, confirme em `/build.txt`: `CAHK Portal build 4.0-minimal-unificado`.


## v5.0 — Eventos + mídia da loja
- Gestão ganhou a aba **Eventos do Portal** com imagem, descrição, data, horário, local e link.
- Produtos / Loja agora aceita upload direto de foto do produto.
- A página inicial busca os eventos publicados automaticamente no Supabase.


## v5.1 - Favicon do CAHK
- Favicon do mascote aplicado a Portal, Rádio, Loja e Gestão.
- Ícone Apple Touch e manifest adicionados para atalhos no celular.

## v5.2 — Excluir produtos
- Botão vermelho **Excluir** em Produtos / Loja.
- Produtos sem histórico podem ser apagados definitivamente.
- Se houver vínculo com vendas/encomendas/variações, o sistema preserva o histórico e oferece inativar o produto, removendo-o do balcão e da loja.


## v5.3 — modo escuro
- Mantém o botão **Excluir** dos produtos da v5.2.
- Adiciona botão de alternância claro/escuro no cabeçalho do Portal.
- A preferência fica salva no navegador (`localStorage`).
- Na primeira visita, respeita a preferência de tema do sistema operacional.
- Rádio, Loja e Gestão já usam interface escura por padrão.
- Marcador de versão: `/build.txt` → `CAHK Portal build 5.3-excluir-produto-modo-escuro`.


## v5.7 — Biblioteca, Projetos/IC e Entrada de Estoque
- Nova Biblioteca Virtual pública com busca, filtro por disciplina e upload de PDF autorizado.
- Nova página Projetos de Física / IC, administrável pela Gestão.
- Nova função Entrada de estoque no Caixa CAHK, somando a quantidade recebida e registrando histórico.
