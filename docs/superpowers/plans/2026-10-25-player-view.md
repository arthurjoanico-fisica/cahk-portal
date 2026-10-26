# Player View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tela dividida com duas perspectivas de jogador e telão local opcional.
**Architecture:** Câmeras e viewports compartilham a simulação; BroadcastChannel
leva somente imagens de estado ao telão local, sem novo serviço de rede.
**Tech Stack:** Three.js, ESM, BroadcastChannel, Node test, Playwright.
**Spec:** docs/superpowers/specs/2026-10-25-player-view-design.md

## Global Constraints
- Manter a física e o protocolo dos celulares.
- Zero chamadas novas ao Supabase.
- Telão local somente leitura, sem credenciais ou comandos de partida.

## Review Focus
- Câmera do jogador 2 aponta no sentido oposto.
- Cada viewport tem aspecto, limpeza de profundidade e máscara próprios.
- Visão geral não herda a ocultação do próprio personagem.
- Telão atrasado avisa perda de sinal, sem continuar simulando pontos.
- Popup e reconexão da tela não criam nova sala ou canal de rede.

## Task 1 — Câmeras e layout
- [x] RED: layout cobre tela sem sobreposição dos jogadores; posições/opostos.
- [x] Implementar viewports.mjs e adaptar scene.mjs.
- [x] GREEN: testes unitários e captura da tela dividida no navegador.

## Task 2 — Telão e consumo
- [x] RED: snapshot não contém tokens; telão não cria sala ou chamadas Supabase.
- [x] Implementar broadcast.mjs, spectator.mjs e botões em app/index/CSS.
- [x] GREEN: teste com duas páginas e verificação de tráfego de rede.

## Task 3 — Entrega
- [x] Revisão independente, suíte completa e dry-run Wrangler.
- [x] Documentação e commit prontos; envio remoto bloqueado por ferramenta/credencial indisponível.
- [x] Distinguir consumo medido de screenshot, SQL e estimativa arquitetural.
