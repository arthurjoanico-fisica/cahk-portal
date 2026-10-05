# Verificação — CAHK Denúncias v6.1.4

- 13 testes de backend: limites, assinatura de imagem, remoção de metadados JPEG, sessão ausente/inválida, usuário comum/inativo, recebimento sem imagem, reenvio, alteração de conteúdo, falha de upload, resposta perdida, concorrência e conflito de edição.
- 6 testes de interface no Chromium: botão do portal, ausência de campos de identificação, falha seguida de reenvio, conversão de imagem sem nome original, perfil inicial já carregado, bloqueio durante salvamento, aviso de falha de recarga e legibilidade no tema claro.
- Endpoint real: rejeição de chamadas de gestão sem sessão, token inválido, origem externa e texto inválido.
- Envio real temporário de texto: resposta 201, repetição 200 com mesmo protocolo e uma única linha no banco. O registro técnico foi removido ao concluir a conferência.
- PostgreSQL em transação revertida: recebimento, limite de envios, atualização administrativa, histórico e rejeição de versão desatualizada.
- Banco confirmado: RLS habilitado; visitantes e usuários autenticados não têm SELECT nas tabelas nem EXECUTE nos RPCs. A função de gestão valida o JWT e o perfil admin ativo antes de usar o acesso do servidor.
- Bucket confirmado privado, limitado a JPEG e 2 MB por arquivo. Políticas existentes de outros buckets não abrangem este bucket.
- Código do backup existente conferido: lista explícita de tabelas, sem as tabelas de denúncias.
- Revisão independente de código: corrigidas preservação de anexos em resultado ambíguo, nomes únicos por tentativa, perfil inicial, bloqueio durante salvamento e estado preservado após falha de recarga.
- Capturas revisadas em largura de celular e desktop. Conferência de sintaxe dos JavaScripts alterados.

## Limites operacionais

O aplicativo não solicita nem vincula identidade do denunciante ao relato; provedores podem manter logs técnicos. Há controle de abuso com hash HMAC por janela de 15 minutos, separado das denúncias: até três tentativas por origem e 60 no total por janela. Redes compartilhadas podem atingir esse limite. Contadores com mais de 30 minutos são limpos na próxima tentativa válida; não há limpeza agendada se o canal ficar sem tráfego.

Imagens do formulário são recodificadas no navegador e os segmentos usuais APP/COM do JPEG são removidos no servidor. A conversão pode reduzir detalhes; não substitui o arquivo original de eventual evidência. Links de imagem da gestão duram 120 segundos e ainda podem ser usados por quem os obtiver durante esse intervalo.

Se um upload ou gravação perde sua resposta, um arquivo privado sem vínculo pode permanecer para evitar apagar evidência de uma gravação já concluída. Tentativas futuras usam caminhos diferentes e não ficam bloqueadas. Na manutenção do armazenamento, compare caminhos do bucket com os caminhos em cahk_complaints.attachments antes de excluir arquivos sem vínculo; não exclua itens recentes nem relatados enquanto houver um envio em processamento.

O canal exige internet, não oferece atendimento imediato, consulta pública de andamento, notificações por e-mail ou remoção automática de registros. A gestão precisa acompanhar a aba e definir sua rotina de encaminhamento e guarda.
