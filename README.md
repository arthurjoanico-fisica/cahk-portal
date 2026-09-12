# Portal CAHK — v2 minimalista

Portal unificado do Centro Acadêmico Hugo Kremer, preparado para futura publicação em `cahk.app`.

## Rotas

- `/` — Portal público
- `/radio/` — Rádio CAHK
- `/loja/` — Loja CAHK
- `/gestao/` — Área interna protegida por login
- `/musica/` — compatibilidade com a rota antiga da rádio
- `/caixa/` — compatibilidade com a rota antiga da gestão

## Identidade

A página inicial usa os elementos da identidade visual enviados pelo CAHK no arquivo-base do Canva. Os arquivos tratados ficam em `public/assets/`.

## Contatos configurados

- CAHK: `cahk@fisica.ufpr.br`
- Impressão: `cahkimpressora@gmail.com`
- Instagram: `https://www.instagram.com/cahk.ufpr/`

## Publicar eventos

Edite `public/portal-data.js`. A página aceita até três eventos em destaque. Quando a lista estiver vazia, mostra "Agenda em atualização" sem inventar datas ou eventos.

## Cloudflare

O `wrangler.jsonc` está configurado para Static Assets a partir de `./public`.
