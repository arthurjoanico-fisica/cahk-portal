# Publicar Arena CAHK no portal existente

Destino: **https://cahk.app/arena/**. O endereço só estará disponível depois
de uma publicação bem-sucedida no Worker `cahk-portal`.

## O que esta versão entrega

- Quadra 3D própria, dois jogadores, uma tela e dois celulares.
- Visão em primeira pessoa em tela dividida, com visão geral em miniatura.
- Telão extra local: uma janela somente de leitura no mesmo navegador/computador.
- Deslocamento automático, sem câmera, com controles por movimento.
- Duelo, treino contra bot e campeonato eliminatório com 4 a 16 participantes.
- Dois QR codes independentes, calibração, reconexão e pausa após desconexão.
- Backup local e checkpoint de placar/chave no Cloudflare, sem gravar sensores.
- Botão de entrada no portal, em Serviços e no menu Mais.

## Publicação pelo GitHub + Cloudflare Builds

1. Envie os arquivos desta alteração ao repositório
   `arthurjoanico-fisica/cahk-portal`, mantendo os diretórios.
2. No projeto **cahk-portal** do Cloudflare Workers, confirme que a integração
   GitHub acompanha a branch que recebeu a alteração.
3. Diretório raiz: raiz do repositório. Instalação: `npm ci`.
   Comando de publicação: `npx wrangler deploy`.
   Esta aplicação utiliza **Workers com arquivos estáticos e Durable Objects**.
   Um upload estático isolado no Pages não executa o backend dos celulares.
4. A primeira publicação cria o namespace SQLite `ArenaRoom` pela migração
   `arena-v1`. O domínio existente continua vinculado ao mesmo Worker.
5. Confirme a conclusão do build e abra `/arena/` pelo menu do portal.

O arquivo `wrangler.jsonc` preserva o nome do Worker e o diretório `public`.
Não exige banco Supabase, token no frontend ou alteração de DNS. A configuração
não declara rotas/domínios novos: usa o vínculo existente do Worker.

## Publicação pelo terminal, alternativa

```bash
npm ci
npx playwright install chromium
npm test
npm run deploy:check
npx wrangler login
npm run deploy
```

Em CI, armazene autenticação apenas nos segredos da plataforma, nunca no Git.

## Usar no campeonato

1. Abra a Arena em um computador conectado à TV/projetor.
2. Escolha Duelo ou Campeonato e preencha nomes.
3. Prepare a quadra; cada jogador escaneia seu próprio QR code.
4. Nos celulares, toque em Iniciar, permita movimento/orientação e segure parado
   na posição de jogo até concluir a calibração.
5. Quando os dois controles estiverem prontos, inicie pela tela compartilhada.
6. Se alguém sair da página ou perder conexão, a partida pausa. Depois de
   reconectar, retome pela tela. Use `C` para pedir recalibração, Espaço para
   pausa e `F` para tela cheia.
7. No fim de cada partida do campeonato, prepare a próxima. Consulte a chave
   e exporte o JSON de resultados ao terminar.
8. Use **Visão geral** para alternar o enquadramento ou **Abrir telão extra**
   para abrir a visão de transmissão. Mova essa janela para outro monitor do
   mesmo computador. Mantenha a janela da partida aberta e visível. O telão
   não é um link para espectadores remotos em outro aparelho.

O modo acessível por toque é uma alternativa explícita no celular e também
permite verificar conexões antes de testar gestos. Para competição, defina o
mesmo modo e sensibilidade para todos. Em iPhone/Android, abra o link no navegador
completo. Para sensores em aparelhos reais, o site precisa estar em HTTPS.

## Persistência, custo e limites

A física e os gráficos são calculados pela tela. Cada celular envia apenas
gestos reconhecidos e mensagens de prontidão; não transmite sensores a 60 Hz.
O Durable Object usa WebSocket Hibernation e grava apenas checkpoints, evitando
uma gravação por frame. A criação é limitada a 6 salas por minuto e 24 por hora por rede, com teto global de 120 salas por dia. Retomar uma sala não consome uma nova criação. A sala expira em 24 horas. Uma sessão expirada pode ser
recriada preservando o backup deste computador; será necessário escanear novos
QR codes. Limpar dados do navegador remove esse backup e as credenciais locais.

Durable Objects SQLite são compatíveis com o Workers Free, sujeito às quotas
atuais da conta. Isso não equivale a promessa de uso ilimitado. Não há chamadas
novas ao Supabase nesta funcionalidade.

A tela dividida e a miniatura renderizam a mesma partida por câmeras diferentes,
sem criar outra sala. O telão usa BroadcastChannel local, com no máximo 12
snapshots por segundo (1 por segundo em pausa), e não abre conexão adicional
com Cloudflare ou Supabase. Há um custo adicional de renderização na máquina.
Gráficos e bibliotecas continuam sendo arquivos estáticos do Cloudflare.

## Validação desta entrega

Testes cobrem pontuação/teto, rebatida, perseguição automática, chave com byes,
permissões simuladas, calibração, gesto, autorização e isolamento de controles,
reconexão, persistência SQLite/hibernação e fluxo de navegador com tela e dois
controles. A resposta dos sensores em celulares físicos precisa de ensaio no
local do evento. A experiência foi reconstruída com código próprio e não é
apresentada como uma cópia exata do Poddle.

As bibliotecas gráficas e de QR são servidas pelo próprio portal, com licenças
em `public/arena/vendor/`. Para regenerar esses arquivos após atualização de
dependências, execute `node scripts/arena-assets.mjs`.
