# Raquete por movimento

Objetivo: substituir a sensação de botões por inclinação por movimento de
raquete em três eixos, trajetória, potência por amplitude e velocidade e efeitos.
Preservar os dois jogadores, movimento automático, tela dividida e telão local.

## Contrato
MotionController.sample(reading, now) continua retornando null ou um swing com
power [0,1], aim [-1,1], lob [0,1], spin [-1,1] e novo topspin [-1,1].
MotionController.getPose() retorna quaternion normalizado [x,y,z,w] relativo à
calibração e ao referencial do jogador, ou null antes de calibrar.
Celular envia {type:'pose',q:[x,y,z,w]} quando muda, no máximo 15 Hz, e no máximo
1 Hz parado. Nada antes de calibrar ou com página oculta. Reconexão reenvia a pose.
O servidor autentica lado, valida, limita e retransmite ao host; não persiste.
Host mantém poses fora do game/checkpoint; o telão recebe-as por BroadcastChannel.
Swing aceita topspin opcional, mantendo compatibilidade com controles anteriores.

## Processamento
Usar orientação como quaternion relativo e trajetória integrada do giro,
suavizando ruído, tratando wrap e intervalo inválido. Potência depende de
amplitude e velocidade; um giro curto de punho não deve produzir a mesma força
de um arco amplo. Direção deve responder ao caminho lateral da mão e à face da
raquete. Efeito lateral responde ao giro/corte, topspin/backspin ao caminho
vertical e à face; segurar o aparelho inclinado e parado não gera rebatida.
Sensores não fornecem rastreamento absoluto confiável da mão: posição visual é
um braço virtual e isso deve constar na documentação.

## Física e visual
Efeito lateral curva e desvia no quique. Topspin aumenta queda e altera o quique;
backspin reduz avanço e muda a trajetória. Manter pouso-alvo em quadra para
golpes centrais válidos. Aplicar quaternion na raquete em primeira pessoa e no
avatar, com interpolação; pose isolada nunca marca ponto ou rebate a bola.

## Consumo e limites
Zero integração Supabase. Pose aumenta o tráfego WebSocket Cloudflare frente à
versão de gestos esparsos. Não enviar sensores brutos nem gravar série de poses.
Durante inatividade/ocultação, reduzir/cessar envios. Exige validação física em
Android/iPhone; teste simulado não autoriza alegar fidelidade igual ao Poddle.
