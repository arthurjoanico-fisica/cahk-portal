# Portal CAHK Unificado v1

Estrutura funcional unificada, preparada para o futuro `cahk.app`.

Rotas principais:
- `/` — Portal CAHK
- `/radio/` — Rádio CAHK pública
- `/radio/player.html` — Player da sala
- `/radio/admin.html` — Administração da rádio (código administrativo)
- `/loja/` — Loja CAHK pública
- `/gestao/` — Caixa, Encomendas, Produtos, Estoque etc. (login obrigatório)

Compatibilidade:
- `/musica/` redireciona para `/radio/`
- `/caixa/` redireciona para `/gestao/`

## Publicação

Crie um repositório para o portal e envie O CONTEÚDO desta pasta para a raiz do repositório. Conecte o repositório ao Cloudflare Workers.

O projeto usa caminhos relativos e internos; quando o domínio `cahk.app` estiver disponível, basta associá-lo ao mesmo Worker. A estrutura de URLs já estará pronta.

## Segurança

A Loja é pública. A Área da Gestão continua usando o login do Caixa CAHK e não é anunciada como serviço público; o link fica discreto no rodapé do Portal.

## Próxima fase

Depois de validar navegação e funcionamento, aplicar a identidade visual definitiva (astronomia/nebulosas/Hubble) sem alterar a arquitetura.
