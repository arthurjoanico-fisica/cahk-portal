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
