CAHK Portal v6.0.16 — Prestação de contas mensal automática

GESTÃO > RELATÓRIOS
- O antigo botão “Exportar CSV” virou “Publicar na Transparência”.
- Ao clicar, a Tesouraria escolhe o mês e informa apenas o valor que havia no caixa no começo do mês.
- O sistema calcula automaticamente:
  • quanto entrou;
  • quanto saiu;
  • quanto ficou em dinheiro;
  • quanto ficou em produtos;
  • total final (dinheiro + produtos).
- Antes de publicar há uma prévia.
- Publicar o mesmo mês novamente atualiza o registro, sem criar duplicatas.
- Se o mês ainda não terminou, o sistema marca a publicação como PARCIAL.

CÁLCULO
- Entradas = vendas concluídas recebidas em Dinheiro/Pix/Cartão + pagamentos de fiado recebidos no mês.
- Saídas = entradas de estoque do mês que possuem custo unitário registrado.
- Caixa final = caixa inicial + entradas - saídas.
- Produtos = estoque estimado no fim do período × custo de compra cadastrado.
- Total final = caixa final + produtos.

TRANSPARÊNCIA PÚBLICA
- Prestação mensal tem card próprio com os seis valores principais.
- Mostra também quantidade de vendas, vendas recebidas, fiado recebido e compras de estoque.

BACKEND
- Estrutura de portal_transparency ampliada para armazenar o fechamento mensal.
- management-admin ganhou prévia e publicação autenticada usando a permissão de Relatórios.

BUILD
CAHK Portal build 6.0.16-transparencia-mensal
