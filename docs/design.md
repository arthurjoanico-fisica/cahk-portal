# Denúncias CAHK — desenho aprovado em 02/10/2026

Objetivo: substituir o botão principal de instalação por Fazer uma denúncia e receber relatos sem identificação solicitada, com imagens opcionais e registro restrito na gestão.

Formulário: texto de 20 a 10.000 caracteres; até três imagens JPEG, PNG ou WebP, com até 5 MB de entrada cada. O navegador recodifica as imagens para JPEG, remove metadados usuais e limita a 2 MB por imagem enviada. Sem login, e-mail ou nome. Não reutilizar a sessão administrativa nem salvar rascunhos no dispositivo. Aviso claro de que o conteúdo e a infraestrutura podem permitir identificação.

Recebimento: função pública distinta das funções existentes; validação de tamanho, conteúdo e assinatura dos arquivos; chave aleatória de envio evita duplicação por repetição. Sucesso somente após salvar texto e anexos. Armazenamento privado sem política pública. Limite de tentativas com HMAC temporário de origem, sem registrar IP bruto nem associar esse controle ao relato. Controle de origem e orçamento global de envios complementam a limitação.

Gestão: apenas perfil ativo com role admin, validado no servidor a cada operação. Lista paginada, detalhe, imagens temporárias autorizadas, status e observações internas. Atualização otimista por versão evita sobrescrever trabalho de outra pessoa. Histórico de mudanças e autor administrativo. Sem integração a backups gerais ou transparência. Nenhum envio de e-mail nesta versão.

Integração: aproveitar configurações Supabase existentes; acrescentar função e tabelas sem alterar módulos anteriores. Cache nunca armazena páginas de gestão ou dados de denúncias. Protocolo confirma recebimento, não oferece consulta pública.

Validação: testes de rejeição de acesso, limites, falhas de upload, duplicatas, conflito de edição e interface com sucesso/erro. Conferir permissões no banco e endpoint real sem criar denúncias fictícias na lista da gestão.
