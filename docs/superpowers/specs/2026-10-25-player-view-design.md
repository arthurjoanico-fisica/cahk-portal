# Perspectivas dos jogadores e telão local

Solicitação: duas perspectivas de jogador em tela dividida; conservar a visão
geral como extra e explicar consumo do Supabase. Repositório remoto verificado:
origin/main 7ea417e contém a Arena anterior. Não substituir arquivos do portal.

Proposta de implementação: duas câmeras em primeira pessoa, uma por jogador,
uma única simulação e um único renderizador WebGL. Mostrar a raquete na frente
da câmera e ocultar apenas o próprio personagem durante aquela perspectiva.
Manter visão geral em miniatura, alternância de enquadramento e botão de telão. Converter direção e efeito do segundo controle para a orientação oposta da sua câmera, preservando potência e física.
O telão abre uma janela somente de leitura no mesmo navegador/computador e
recebe snapshots locais via BroadcastChannel, até 12 Hz. Ele não é um espectador
remoto e não abre WebSocket, conta Supabase ou nova sala Cloudflare.

Alterar somente apresentação, compartilhamento local e testes; manter física,
controles, regras e backend existentes. O consumo adicional esperado do jogo
no Supabase é zero: o código da Arena e do Worker não usa esse serviço. Duas ou
três câmeras aumentam o trabalho gráfico da máquina. O orçamento do Cloudflare
continua existindo e é independente da franquia Supabase.

Critérios: perspectivas opostas, placar único, miniatura, telão que acompanha a
partida e avisa perda de sinal, restauração sem credenciais na transmissão,
nenhuma chamada Supabase em ambos os modos, regressões anteriores aprovadas.
