# Validação 6.1.5

Cache diário do RU compartilhado e renovado à virada do dia, cache com TTL para avisos/agenda/clima, cooldown em erros e deduplicação no mesmo runtime. Simulação de 31 dias de painel abaixo de 11.000 Edge calls. Rádio tem throttle de 60 segundos, pausa402 e único temporizador de recuperação, inclusive se erro402 vier de outra função enquanto música toca. Navegação real no Chromium confirmou uso do mesmo cache em Painel/Vida no Campus e renovação em página aberta.

Cenário aproximado de uma rádio24h, músicas3min e um painel:85mil Edge calls/31dias. Sem promessa de teto global300mil. Backend existente e limite de antecipação5s preservados; áudios podem atrasar aproximadamente1min. Produção segue bloqueada e não foi invocada para teste.

7 testes de economia,7 de navegador e13 backend de denúncias. Verificar logs/contadores reais após publicação e renovação do ciclo.
