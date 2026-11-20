# CAHK Portal

Portal público e área de gestão do Centro Acadêmico Hugo Kremer — https://cahk.app

A versão publicada aparece em `public/build.txt` (também em https://cahk.app/build.txt).

## O que vai ao ar

O deploy é automático na Cloudflare a cada commit na `main` e publica **somente**:

- `public/` — o site inteiro, uma pasta por módulo
- `worker/` — Worker da Cloudflare (Arena CAHK)
- `wrangler.jsonc` — configuração do Worker

Todo o resto do repositório (`docs/`, `tests/`, `scripts/`, `android/`, `supabase/`) não altera o site.

## Módulos (`public/`)

| Pasta | O que é |
| --- | --- |
| `/` , `painel/`, `noticias/`, `agenda/`, `equipe/`, `historia/` | Portal público, avisos, agenda e institucional |
| `radio/`, `musica/` | Rádio CAHK |
| `loja/` | Loja e encomendas (fluxo MLTN/POD) |
| `caixa/`, `gestao/` | Caixa/PDV, estoque, relatórios e área de gestão |
| `daex/` | DAEX — vendas e eventos das entidades |
| `grade/`, `disciplina/`, `minha-fisica/` | Hub acadêmico: grade da Física UFPR, página por disciplina e planejador pessoal |
| `biblioteca/` | Biblioteca Virtual por disciplina |
| `vida-campus/` | RU e Intercampi |
| `denuncias/` | Canal de denúncias |
| `transparencia/` | Documentos públicos |
| `arena/` | Arena CAHK — jogo com dois celulares |
| `instalar/`, `downloads/`, `qrcode/` | PWA, APK e QR Codes |

## Outras pastas

- `supabase/` — função `cahk-denuncias` e `setup-denuncias.sql`. As demais funções do projeto Supabase (`portal-public`, `physics-academic`, `management-admin`, `portal-admin` etc.) ainda não estão versionadas aqui.
- `android/` — app Android (WebView) do portal.
- `tests/` e `scripts/` — testes (`npm test`, depois de `npm install`) e utilitários da Arena.
- `docs/guias/` — guias de instalação e uso (DAEX, denúncias, MLTN, APK, Arena).
- `docs/historico/` — notas de versões antigas e arquivos que ficavam soltos na raiz. Não são publicados.

## Comandos

```
npm install
npm run dev           # wrangler dev
npm test              # testes
npm run deploy:check  # simula o deploy sem publicar
```
