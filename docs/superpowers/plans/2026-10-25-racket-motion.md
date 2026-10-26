# Racket Motion Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement with tests.

**Goal:** Controle 3D de raquete com trajetória e efeitos lateral/vertical.
**Architecture:** Sensores e análise locais; pose limitada em RAM no relay;
simulação no host; transmissão de telão local. Compatibilidade do swing anterior.
**Tech Stack:** JavaScript ESM, quaternions, Cloudflare WebSockets, Three.js.
**Spec:** docs/superpowers/specs/2026-10-25-racket-motion-design.md

## Global Constraints
- Sem webcam, rastreamento absoluto ou chamadas Supabase.
- Pose não persiste em checkpoint e não causa rebatida sozinha.
- Limitar pose, validar unidades e preservar isolamento dos dois celulares.

## Review Focus
- Giros estáticos, troca de grip, ruído e wrap não disparam golpes.
- Gestos curtos fortes não recebem potência de arco amplo.
- Os eixos de efeito são coerentes nas duas perspectivas.
- Reconexão/calibração não deixa a raquete travada ou transmite antes da prontidão.
- Poses não vazam tokens e não entram em banco ou backup.

## Task 1 — Telefone
- [x] RED: poses relativas, arcos, cortes opostos, ruído e limites.
- [x] Implementar quaternion/gestos e envio 15 Hz no máximo.
- [x] GREEN: testes do detector e fronteiras do controle.

## Task 2 — Relay e física
- [x] RED: pose validada e não persistida, topspin, efeitos no voo/quique.
- [x] Implementar protocolo retrocompatível e física dos efeitos.
- [x] GREEN no runtime SQLite e testes determinísticos.

## Task 3 — Visual e entrega
- [x] Integrar poses em RAM, interpolar raquete e telão local.
- [x] Verificar no navegador, suite completa e dry-run Wrangler.
- [x] Revisão independente, documentação e pacote de atualização.
