# CursoDownloader

Baixa uma videoaula por vez usando a sessão do Chrome e salva em MP4. Para playlists HLS (`.m3u8`), seleciona a maior resolução informada na playlist e preserva áudio separado. O PowerShell mostra o progresso em porcentagem quando a duração do vídeo está disponível.

Este guia explica a instalação do zero no Windows. Use o programa para aulas às quais você tem acesso autorizado. Ele não contorna DRM.

## 1. Instalar o Node.js

1. Abra a [página oficial do Node.js](https://nodejs.org/en/download/).
2. Selecione a versão **LTS** e baixe o instalador do Windows (`.msi`) adequado ao seu computador.
3. Execute o instalador e mantenha os componentes padrão, incluindo **npm** e a opção de adicionar ao **PATH**.
4. Conclua a instalação. Não é necessário instalar ferramentas extras de compilação para este projeto.

## 2. Instalar o Google Chrome

1. Acesse a [página do Google Chrome](https://www.google.com/chrome/).
2. Baixe e execute o instalador.
3. Aguarde a instalação terminar.

O programa usa o Google Chrome instalado, mesmo que seu navegador habitual seja o Edge ou outro. Não é necessário instalar um navegador separado pelo Playwright.

## 3. Instalar o FFmpeg

O FFmpeg reúne o vídeo e o áudio no arquivo MP4. Instale uma versão recente, pois o script usa opções de HLS que podem não existir em versões antigas.

### Instalar pelo PowerShell ou CMD (WinGet)

Abra o **PowerShell** ou o **Prompt de Comando (CMD)** e execute o mesmo comando em qualquer um deles:

```cmd
winget install --id Gyan.FFmpeg --exact --source winget
```

Aguarde a instalação terminar. Depois, **feche e abra novamente o terminal** e confira:

```cmd
ffmpeg -version
```

Se aparecer a versão, a instalação está pronta: siga para a etapa 4. Não é necessário repetir a instalação manual abaixo.

### Se aparecer “nenhum pacote encontrou os critérios de entrada correspondente”

Atualize os catálogos do WinGet:

```cmd
winget source update
```

Depois, procure o pacote:

```cmd
winget search ffmpeg --source winget
```

Se aparecer **Gyan.FFmpeg** na coluna **ID**, tente novamente:

```cmd
winget install --id Gyan.FFmpeg --exact --source winget
```

Após a instalação, reabra o terminal e execute `ffmpeg -version`. Se a busca não encontrar o pacote ou a atualização falhar, guarde a mensagem de erro para diagnóstico ou use a instalação manual abaixo.

Se **winget não for reconhecido**, instale ou atualize o **Instalador de Aplicativo (App Installer)** pela Microsoft Store, reabra o terminal e tente novamente.

Referência: [documentação de fontes e atualização do WinGet](https://learn.microsoft.com/en-us/windows/package-manager/winget/source).

### Alternativa: instalar manualmente

1. Acesse a [página de downloads do FFmpeg](https://ffmpeg.org/download.html).
2. Na seção Windows, abra **Windows builds from gyan.dev**.
3. Na página de builds, baixe o arquivo ZIP da versão de lançamento, por exemplo **ffmpeg-release-essentials.zip**.
4. No Explorador de Arquivos, clique com o botão direito no ZIP e escolha **Extrair Tudo**.
5. Mova a pasta extraída para um local permanente. Não execute os arquivos de dentro do ZIP.
6. Abra a subpasta **bin** e confirme que ela contém `ffmpeg.exe` e `ffprobe.exe`.
7. Copie o caminho completo dessa pasta `bin` pela barra de endereço do Explorador.

### Adicionar o FFmpeg ao PATH após a instalação manual

O PATH permite executar `ffmpeg` de qualquer pasta no PowerShell.

1. Abra o menu Iniciar e pesquise **Editar as variáveis de ambiente da sua conta**.
2. Em **Variáveis de usuário**, selecione **Path** e clique em **Editar**.
3. Clique em **Novo** e cole o caminho da pasta `bin` que você copiou.
4. Confirme em **OK** nas janelas abertas. Preserve as entradas que já existiam.
5. Feche o PowerShell e o Windows Terminal, se estiverem abertos, e abra novamente.

## 4. Conferir as instalações

Abra o **PowerShell** pelo menu Iniciar e execute, uma linha de cada vez:

```powershell
node --version
npm.cmd --version
ffmpeg -version
```

Cada comando deve mostrar a versão instalada. Se algum não for reconhecido, resolva a instalação ou o PATH antes de continuar. Depois de instalar programas ou mudar o PATH, reabra o terminal.

Este guia usa `npm.cmd`, que executa o npm no Windows sem depender da permissão para executar o arquivo `npm.ps1` do PowerShell.

## 5. Baixar o projeto do GitHub

1. Abra o repositório no GitHub.
2. Clique em **Code → Download ZIP**.
3. Extraia o ZIP com **Extrair Tudo**.
4. Guarde a pasta extraída em um local permanente. O nome pode ser `CursoDownloader-main`.
5. Abra a pasta que contém diretamente `downloader.js`, `package.json` e `package-lock.json`.

Você não precisa instalar Git nem GitHub Desktop para usar o download por ZIP.

## 6. Instalar as dependências do projeto

1. Na pasta do projeto, copie o caminho completo pela barra de endereço do Explorador.
2. Abra o PowerShell.
3. Execute o comando abaixo, substituindo o caminho de exemplo pelo caminho que você copiou:

```powershell
Set-Location 'C:\caminho\para\CursoDownloader-main'
```

4. Confira se está na pasta correta:

```powershell
Get-ChildItem
```

A listagem deve conter `downloader.js` e `package.json`.

5. Instale as dependências:

```powershell
npm.cmd install
```

Aguarde o comando terminar e o prompt do PowerShell voltar. Isso cria a pasta `node_modules` e instala o Playwright. É necessário acesso à internet. Faça esta etapa uma vez por computador ou novamente se remover `node_modules`.

## 7. Iniciar o download de uma aula

No PowerShell, dentro da pasta do projeto, execute:

```powershell
node .\downloader.js 'URL_DA_PAGINA_DA_AULA'
```

Substitua `URL_DA_PAGINA_DA_AULA` pelo endereço completo da página onde você assiste à aula. Não use o endereço de um segmento `.ts`.

**Mantenha as aspas ao redor do endereço**, principalmente quando ele contiver `&`. Por exemplo, este endereço é apenas ilustrativo:

```powershell
node .\downloader.js 'https://plataforma.exemplo/assistir-aula/?curso=123&aula_id=456&modulo=789'
```

Depois de executar:

1. Aguarde o Chrome abrir.
2. Faça login na plataforma nessa janela, se necessário. O programa usa um perfil próprio; estar conectado no seu navegador habitual não garante que este perfil esteja conectado.
3. Abra a aula desejada e dê **play**. Aguarde o vídeo começar a tocar.
4. Volte ao PowerShell e pressione **Enter**. Não há prazo fixo para terminar o login.
5. Confira as opções detectadas. O programa prioriza playlists com a maior resolução declarada. Digite o número da opção desejada e pressione **Enter**, ou pressione apenas **Enter** para selecionar a primeira.
6. Confira o nome e o destino do arquivo.
7. Digite **S** e pressione **Enter** para baixar. Outra resposta cancela.
8. Mantenha o PowerShell e o Chrome da automação abertos até terminar.

Se houver vários vídeos na página, confira a opção escolhida. Se nenhum vídeo for detectado, dê play ou recarregue a aula e tente novamente. Para limpar candidatos já detectados, digite **R** na seleção e recarregue a aula antes de tentar de novo.

## 8. Acompanhar o progresso e encontrar o vídeo

O PowerShell exibirá mensagens como:

```text
Preparando download...
Baixando: 37%
Baixando: 100% — finalizado.
Download concluído: ...\downloads\Nome da aula.mp4
```

A porcentagem é uma estimativa baseada na duração do vídeo processada, não na quantidade de bytes. Ela pode avançar em saltos e ficar em 99% enquanto o arquivo é finalizado. Se a duração total não estiver disponível, o programa mostra os segundos processados.

O arquivo fica na pasta **downloads**, dentro da pasta do projeto. Durante o download, o nome termina em `.part.mp4`. No sucesso, o arquivo é renomeado para `.mp4`, a mensagem **Download concluído** aparece e o Chrome da automação fecha.

Arquivos existentes não são sobrescritos: o programa acrescenta um número ao nome quando necessário. Uma interrupção forçada pode deixar um arquivo parcial; a versão atual não retoma downloads interrompidos.

Para baixar outra aula, execute novamente o comando com o novo link. A versão atual baixa **uma aula por execução**. A sessão de login é reutilizada enquanto continuar válida.

## Problemas comuns

| Mensagem ou situação | O que fazer |
| --- | --- |
| `node` ou `npm.cmd` não é reconhecido | Confira a instalação do Node.js e reabra o terminal. |
| `ffmpeg` não é reconhecido | Confira se o PATH aponta para a pasta `bin` que contém `ffmpeg.exe` e reabra o terminal. |
| `npm.ps1` não pode ser carregado | Use `npm.cmd install`, conforme este guia. Não é necessário mudar a política de execução. |
| Não encontra `downloader.js` ou `package.json` | Use `Set-Location` para entrar na pasta correta do projeto. |
| `Cannot find module 'playwright'` | Execute `npm.cmd install` dentro da pasta do projeto. |
| Erro ao colar uma URL com `&` | Coloque o endereço inteiro entre aspas simples. |
| Chrome não abre ou o perfil está em uso | Confirme que o Chrome está instalado. Encerre a execução anterior antes de iniciar outra com o mesmo perfil. Execute pelo PowerShell da sua área de trabalho. |
| Nenhuma playlist ou MP4 detectado | Faça login, dê play e só depois pressione Enter no terminal. Se necessário, recarregue a página. |
| HTTP 401/403 ou falha ao obter mídia autenticada | Confira o acesso à aula e a sessão. Abra novamente a aula para capturar links atuais; links temporários podem expirar. |
| FFmpeg informa uma opção desconhecida | Instale uma versão recente do FFmpeg e confira qual versão aparece em `ffmpeg -version`. |
| Proteção DRM não suportada | O programa não baixa esse tipo de conteúdo. Use as opções oficiais disponibilizadas pela plataforma. |

## O que guardar no GitHub

Envie estes arquivos:

```text
.gitignore
downloader.js
downloader.test.js
package.json
package-lock.json
README.md
```

Não envie `node_modules`, `perfil-chrome`, `downloads` nem arquivos `downloader.backup-*.js`. O `.gitignore` já lista essas exclusões para operações com Git; ao fazer upload pelo navegador, selecione somente os arquivos desejados.

Em outro computador, `npm.cmd install` recria `node_modules`. Ao executar, o programa cria `perfil-chrome` e `downloads`. Você precisará fazer login novamente.

**A pasta `perfil-chrome` contém dados da sua sessão de login.** Mantenha-a privada e considere que pastas dentro do OneDrive podem ser sincronizadas.

## Testes e limites técnicos

Para executar os testes de lógica incluídos no repositório:

```powershell
node --test .\downloader.test.js
```

O comando `npm test` não está configurado neste projeto; use o comando acima.

Durante o download, um servidor temporário restrito a `127.0.0.1` encaminha a mídia ao FFmpeg usando a sessão do navegador. Cabeçalhos de autorização não são copiados entre origens diferentes.

O programa não oferece detecção universal de DRM. Sessões encerradas, links expirados, desafios antibot ou autenticação específica da plataforma podem impedir o download. Playlists devem usar URIs HTTP(S) normais; variáveis HLS não são expandidas. Cada segmento é carregado na memória, e MP4s diretos muito grandes podem exigir bastante memória.
