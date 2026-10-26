# Validação: perspectivas de jogador

25/10/2026. Base remota: 7ea417e5396ca515b497e96e769ca05e80000d17.

- npm test: **81 testes aprovados, zero falhas**.
- Wrangler deploy --dry-run: aprovado, ASSETS e ARENA_ROOMS presentes.
- git diff --check: aprovado.
- Capturas reais do Chromium mostram tela dividida, raquetes em primeira pessoa,
  miniatura e janela de telão local. O cenário usa a mesma física da versão anterior.
- Teste de tráfego: nenhuma chamada Supabase; abrir telão não cria outra sala.
- Testes cobrem câmera oposta, bola de saque dentro da visão dos dois lados,
  conversão de direção/efeito do jogador 2, ausência de tokens na transmissão,
  telão com host em segundo plano e redimensionamento fracionário do canvas.
- Revisão independente identificou realocação de buffer a cada frame e falta de
  atualização de pausa fora do requestAnimationFrame. Ambas receberam regressão
  RED → GREEN. A suíte também cobre a janela fechada/recarga da tela principal.
- Inicialização agora usa imports estáticos e funções de entrada separadas para
  evitar cliques em controles ainda sem comportamento durante import assíncrono.
  O teste simula atraso na chegada do módulo.

## Publicação

A versão anterior já consta no repositório, verificado via Git público. O
conector GitHub retornou Unknown tool, e o push --dry-run falhou por ausência de
credencial de escrita. Não houve push ou confirmação de deploy desta atualização.
O endereço cahk.app devolveu 403 para as consultas externas desta sessão; isso
não foi tratado como prova de falha do site para navegadores comuns.

## Limites da validação

O telão é uma janela do mesmo navegador/computador, não um espectador remoto.
Sensores foram simulados nos testes; sensação e compatibilidade física continuam
exigindo teste no Android/iPhone usados no evento. Câmeras extras aumentam o
trabalho gráfico local. Métricas mensais Supabase não foram inferidas dos logs.
Consumo verificado e print fornecido estão documentados em
arena-supabase-consumption.md.
