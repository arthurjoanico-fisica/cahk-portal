CAHK Portal v6.0.15 — Tempo no Centro Politécnico

NOVO NO PAINEL
- Temperatura atual no Centro Politécnico UFPR, Curitiba.
- Sensação térmica.
- Máxima e mínima do dia.
- Probabilidade máxima de chuva.
- Previsão do dia inteiro em intervalos de 3 horas (00h a 21h, quando disponíveis).
- Condição representada por ícone e temperatura.
- Atualização meteorológica em cache por 10 minutos no navegador.
- Mantém o painel em proporção 16:9.

BACKEND
- Nova Edge Function: weather-info.
- Coordenadas fixas do Centro Politécnico UFPR.
- Está preparada para usar OPENWEATHER_API_KEY quando cadastrada como secret da Edge Function.
- Enquanto o secret não estiver cadastrado, usa Open-Meteo como fallback automático, então o painel já funciona sem expor chave no navegador.

BUILD
CAHK Portal build 6.0.15-weather-centro-politecnico
