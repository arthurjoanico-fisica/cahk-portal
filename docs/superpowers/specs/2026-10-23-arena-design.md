# Arena CAHK

## Objetivo aprovado na conversa
Jogo próprio inspirado na experiência de pickleball por movimento: dois jogadores,
uma tela compartilhada, dois celulares, deslocamento automático e nenhuma webcam.
Integrar ao CAHK Portal em /arena/ e preparar publicação no GitHub e Cloudflare.

## Arquitetura
O Worker existente mantém os arquivos estáticos e ganha rotas /arena/api/*.
Um Durable Object SQLite por sala faz pareamento e retransmite apenas rebatidas,
prontidão e feedback. A tela é a autoridade da simulação e envia checkpoints por
ponto e mudanças da chave. Hibernation WebSockets mantêm o custo reduzido.
Alternativa rejeitada: transmitir sensores brutos continuamente e simular a 60 Hz
no servidor; desnecessário numa tela única. Outra alternativa, WebRTC, adiciona
dependência de ICE/TURN e não é necessária para o primeiro evento.

## Contrato entre componentes
POST /arena/api/rooms cria {room,hostToken,padTokens:[a,b]}.
GET /arena/api/rooms/:room/ws?role=host|p1|p2&token=... conecta WebSocket.
Servidor envia {type:'presence',host:boolean,pads:[boolean,boolean],ready:[boolean,boolean]}.
Celular envia {type:'ready',ready:boolean} ou {type:'swing',power:0..1,aim:-1..1,lob:0..1,spin:-1..1,id:string}.
Tela recebe swing com player:0|1 imposto pelo servidor; celular nunca escolhe lado.
Tela envia {type:'checkpoint',state:object}; servidor devolve {type:'restore',state:object|null} na conexão do host.
Tela envia {type:'feedback',player:0|1,event:'hit'|'point',power:0..1}, repassado só ao celular certo.
Ping/pong e {type:'error',message:string} completam o protocolo.
Sala e tokens aleatórios; papel não permite escalada; criação exige mesma origem.

## Experiência
Tela: entrada com nomes, partida rápida, modo treino contra bot, campeonato local
de 4 a 16 nomes, chave persistida, placar, pausa, calibrar celulares, tela cheia,
som, instruções e erro explícito se backend indisponível. Câmera diagonal fixa.
Dois QR codes usam /arena/pad/?room=...&player=1|2#token=...; tokens não vão a logs HTTP.
Controle: iniciar por toque, permissão iOS, calibrar, rebatida por giroscópio,
sensibilidade, recentralizar, wake lock e feedback. Sem sensores, erro claro.
Desconexão pausa a partida; reconexão não reinicia placar. Pausa manual exige
retomada manual. Torneio usa byes, nunca inventa participantes humanos.
Pontuação comum até 11, diferença de 2, teto 15; torneio até 7, final 11.

## Validação e limites
Testar física determinística, pontuação, auto movimento, torneio, sinal de sensores,
autorização, isolamento de lados, duplicatas, reconexão e checkpoint real no runtime.
Verificar UI em tela e celular. Sensação física requer Android/iPhone reais e é
limite explícito da validação automatizada. Não anunciar deploy sem sucesso remoto.
Código e recursos próprios, bibliotecas com suas licenças, sem copiar Poddle.
