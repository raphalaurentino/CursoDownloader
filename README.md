# CursoDownloader

Requer Node.js, Google Chrome, Playwright (`npm install`) e FFmpeg disponível no PATH.

```powershell
Set-Location 'C:\Users\rapha\OneDrive\Documentos\CursoDownloader'
node .\downloader.js "URL_DA_PAGINA_DA_AULA"
```

1. Faça login no Chrome aberto pelo script e dê play na aula. Não há prazo para terminar o login.
2. Volte ao terminal e pressione ENTER.
3. Escolha a playlist ou o MP4 capturado. A primeira opção prioriza a maior resolução declarada nas playlists. Use R para limpar os candidatos e recapturar após recarregar a aula.
4. Confira o destino e responda S para baixar.

O programa lê a playlist HLS, seleciona sua maior resolução e preserva faixas de áudio separadas. Não seleciona segmentos TS nem solicitações genéricas de análise. Se várias mídias forem detectadas, confira a opção escolhida.

Os vídeos são salvos em `downloads`. Arquivos existentes não são sobrescritos. O download usa um arquivo temporário, renomeado ao terminar; falhas tratadas removem esse arquivo.

Um servidor temporário restrito a 127.0.0.1 encaminha a mídia ao FFmpeg. As solicitações usam a sessão do navegador e cabeçalhos capturados no mesmo domínio de origem. Cookies seguem as regras de destino do Playwright; Authorization não é copiado entre origens. URLs assinadas e credenciais não são exibidas no terminal nem gravadas em logs pelo script. O perfil persistente contém dados de sessão: proteja a pasta `perfil-chrome` e considere que esta pasta está no OneDrive.

O programa não contorna DRM. Rejeita os métodos de proteção HLS não suportados; não oferece detecção universal de DRM. URLs expiradas, sessões encerradas, desafios antibot ou autenticação específica da plataforma ainda podem impedir o download. Playlists devem usar URIs HTTP(S) normais; variáveis HLS não são expandidas. O relay carrega cada segmento na memória; arquivos MP4 diretos muito grandes podem exigir bastante memória.

Testes de lógica: `node --test downloader.test.js`.
