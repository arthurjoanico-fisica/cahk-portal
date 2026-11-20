# APK Android do CAHK

O site já contém o botão /downloads/CAHK.apk. O APK é gerado pelo GitHub Actions e copiado automaticamente para public/downloads/CAHK.apk.

Antes do primeiro build, configure estes 4 Repository Secrets no GitHub:
- ANDROID_KEYSTORE_BASE64
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS
- ANDROID_KEY_PASSWORD

Use os valores do pacote PRIVADO de assinatura entregue separadamente. Nunca envie o arquivo .jks nem o arquivo de segredos para um repositório público.

Depois: GitHub > Actions > Build CAHK Android APK > Run workflow.
Quando terminar, o workflow commita public/downloads/CAHK.apk e o Cloudflare publica automaticamente. O botão em cahk.app/instalar/ passa a funcionar.
