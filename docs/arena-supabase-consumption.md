# Arena: consumo de Supabase e renderização

Verificação em 25/10/2026. Código remoto origin/main 7ea417e contém a primeira
versão da Arena. O conector GitHub retornou `Unknown tool` ao consultar metadados
e arquivo; a leitura pública foi concluída por Git. Não confundir esse erro com
uma confirmação de que a conta foi desconectada.

## Consumo adicional da Arena

| Recurso Supabase | Arena, por partida |
|---|---:|
| Database e Storage | 0 gravações/arquivos |
| Auth / usuários ativos | 0 logins |
| Edge Functions | 0 invocações |
| Realtime | 0 conexões e mensagens |
| Egress Supabase | 0 bytes requisitados pelo módulo |

Isso decorre da arquitetura verificada: a Arena usa arquivos próprios no
Cloudflare, simulação no navegador e WebSocket para o Durable Object do
Cloudflare. Nenhum módulo da Arena ou Worker importa Supabase ou chama suas
rotas. O teste de navegador verifica que a tela e o telão não requisitam esse
serviço e que o telão não cria nova sala. O portal e a rádio continuam tendo
consumo próprio independente, inclusive se estiverem abertos em outras abas.

Tela dividida, miniatura e telão usam o mesmo estado de partida. As câmeras
adicionais aumentam o trabalho da CPU/GPU e memória local. O telão independente
usa BroadcastChannel, com fluxo regular de até 12 snapshots/s, dentro do mesmo navegador.
Não utiliza serviço de transmissão de vídeo nem canal Supabase Realtime.

## O que o print fornecido mostra

| Indicador | Uso mostrado | Limite mostrado |
|---|---:|---:|
| Banco de dados | 0,032 GB | 0,5 GB |
| Storage | 0,002 GB | 1 GB |
| Edge Functions | 14 | 500.000 |
| Egress | 0 GB, arredondado | 5 GB |
| Realtime mensagens | 0 | 2.000.000 |
| Pico de conexões Realtime | 0 | 200 |

O print não informa aqui um intervalo de faturamento legível. Ele é uma captura
fornecida pelo usuário, não uma consulta atual de todos os medidores mensais.

## Medição direta, leitura sem alterações

As configurações do repositório apontam para dois projetos conectados. Consultas
`pg_database_size(current_database())` retornaram:

| Projeto | Bytes físicos retornados | Aproximação |
|---|---:|---:|
| caixa-cahk / portal | 16.452.755 | 15,69 MiB |
| Projeto usado pela rádio | 17.296.531 | 16,50 MiB |

Esse método mede o tamanho físico do banco naquele momento. Não é o mesmo
medidor do painel de faturamento; não deve ser usado para substituir contadores
mensais de egress, invocações, MAU ou Realtime. Os logs foram consultados somente
de forma agregada; número de linhas de log não equivale a invocações faturadas.

## Recomendação

Manter sensores, câmeras e estado por frame fora do Supabase. A infraestrutura
atual permite isso. Cloudflare tem sua própria franquia, limites e métricas:
zero consumo adicional no Supabase não significa uso ilimitado no Cloudflare.
Referências oficiais: https://supabase.com/docs/guides/platform/billing-on-supabase
e https://supabase.com/docs/guides/realtime/limits .

## Atualização: raquete com orientação contínua

A raquete 3D continua sem usar Supabase. O celular transmite apenas quaternion
relativo, limitado a 15 Hz em movimento e 1 Hz parado, além de gestos e
prontidão. As amostras brutas ficam no aparelho. As poses não entram no SQLite
nem no backup local. O telão recebe uma cópia pública por BroadcastChannel.

Isso eleva o tráfego do Cloudflare: duas pessoas podem enviar até 30 poses/s,
ou 108.000 mensagens em uma hora de movimento contínuo, além de rebatidas e
controle. O relay limita a frequência e suspende encaminhamento sem host ou
sem prontidão. A contagem de mensagens não é uma estimativa de cobrança.
