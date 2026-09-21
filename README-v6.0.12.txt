CAHK Portal v6.0.12 — Rádio / conexão fraca

Correções do Player Central:
- YouTube IFrame API agora carrega sob demanda, depois de clicar em Iniciar Rádio.
- Timeout de carregamento e repetição automática se a rede estiver lenta.
- Se a API do YouTube não carregar, entra em modo compatibilidade com iframe direto.
- O sistema continua tentando recuperar a API em segundo plano.
- Ao recuperar, retoma aproximadamente no ponto em que o vídeo estava.
- Watchdog detecta vídeo travado/buffering sem progresso.
- Até 3 tentativas automáticas antes de cair para o modo compatibilidade.
- Erros de vídeo removido/bloqueado continuam pulando para a próxima faixa.
- Botão “Conexão fraca” permite ativar recuperação mais agressiva.
- Detecção automática de Save-Data / 2G / 3G / downlink baixo quando o navegador fornece essa informação.
- Botão “Recarregar vídeo” agora reinicializa toda a conexão com o YouTube.

Observação:
O YouTube escolhe a qualidade do stream automaticamente. A API oficial não permite mais forçar 144p/360p por JavaScript.
Se a rede bloquear os domínios do YouTube ou do streaming de mídia, o portal não consegue contornar esse bloqueio.

BUILD:
CAHK Portal build 6.0.12-radio-weak-network
