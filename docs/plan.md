# Denúncias CAHK — Implementation Plan

Goal: formulário público e registro privado para administradores.
Architecture: um endpoint sem dependências, REST Supabase no servidor, tabelas privadas por RLS e bucket privado. Interface pública sem sessão e gestão com JWT existente.
Tech Stack: HTML/CSS/JavaScript, Supabase/PostgreSQL/Deno.
Spec: docs/design.md

## Global Constraints
- Três imagens; 20–10.000 caracteres; até 2 MB por imagem enviada.
- Administradores ativos somente; nenhuma identificação do denunciante solicitada.
- ZIP diferencial para publicação pelo usuário.

## Review Focus
- Upload interrompido: não confirmar recebimento e limpar imagens parciais.
- Reenvio após queda: retornar mesmo protocolo, sem duplicar.
- Perfil não administrativo: nenhum dado retornado.
- Conteúdo malicioso: renderizar texto, proibir anexos ativos.
- Edição concorrente: rejeitar sobrescrita e solicitar recarga.

## Task 1: recebimento e proteção
- [x] Escrever testes de autenticação, validação, upload e duplicatas; executar RED.
- [x] Implementar core.js, handler.js e index.ts em supabase/functions/cahk-denuncias.
- [x] Criar setup.sql com tabelas, RLS e bucket.
- [x] Executar testes GREEN; ativar no projeto confirmado e verificar permissões.

## Task 2: formulário e gestão
- [x] Escrever teste de interface com sucesso, erro e campos.
- [x] Criar public/denuncias e public/gestao/denuncias.js; integrar navegação e botão.
- [x] Atualizar service worker para não armazenar dados privados.
- [x] Rodar testes de interface e conferir capturas de tela.

## Task 3: entrega
- [x] Revisar diferenças, executar suite completa e conferir backend real.
- [x] Preparar ZIP com arquivos alterados, instruções e testes.
