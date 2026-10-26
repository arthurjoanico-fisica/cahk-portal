# Validação da raquete 3D

Verificação em 26/10/2026, atualização sobre `origin/main` 7ea417e.

## Comportamento entregue

- Quaternion relativo à posição calibrada, com eixos do jogador e tratamento
  contínuo da passagem 359°/0°. Calibrar outra empunhadura redefine o neutro.
- Movimento acumulado e velocidade definem força, direção e efeitos; a mesma
  velocidade de pico não torna um gesto curto equivalente a um arco amplo.
- Corte lateral, topspin e backspin alteram voo/quique. O lob preserva o alvo.
- Orientação contínua da raquete com interpolação e braço virtual nas duas
  perspectivas e no telão local. A pose sozinha não acerta a bola.
- Até 15 poses/s em movimento, 1/s parado, com limiar de mudança de 1,5°.
  Sem transmissão no modo manual, oculto, sem host ou antes de calibrar.
- Relay valida quaternion normalizado, autentica o jogador e limita frequência.
  O protocolo antigo de rebatida continua funcionando sem topspin.
- Poses ficam fora de checkpoint e backup. Nenhum sensor bruto é transmitido.
  A Arena continua sem chamadas ao Supabase.

## Evidências

- `npm test`: suite completa de 100 testes, sem falhas.
- `npm run deploy:check`: Wrangler conclui o empacotamento sem publicar.
- Testes de trajetória analítica: eixos reais DeviceMotion, cortes opostos,
  escovadas verticais, velocidades de amostragem de 20 e 50 Hz, wrap, ruído,
  lacunas, calibração, autorização, reconexão e limites de tráfego.
- Navegador: permissões/sensores simulados alimentam o controle real, o
  WebSocket/SQLite real encaminha a pose e o host a publica no telão local.
  A imagem renderizada muda após o giro; a pose não dispara uma rebatida.
- Revisão independente não identificou defeitos acionáveis no relay, física,
  host e renderização. Também verificou saques centrais dentro da quadra.

## Limites e publicação

Não houve ensaio com um Android/iPhone físico. Ajustar sensibilidade, direção
percebida da empunhadura e latência no local do campeonato continua necessário.
Sem câmera ou referência externa não há rastreamento absoluto da posição da mão.
A física é uma aproximação de jogo, não uma medição biomecânica.

A atualização foi preparada localmente. O conector GitHub respondeu
`Unknown tool` e o ambiente não tem credenciais Git/Cloudflare para publicar.
O ZIP inclui também a alteração anterior de tela dividida e telão, preservando
os caminhos para upload no repositório seguido pelo build Cloudflare.

Referência funcional pública consultada: https://poddleball.com/phone-paddle.html.
A implementação e os recursos visuais são próprios; não se afirma paridade
exata com o produto de referência.
