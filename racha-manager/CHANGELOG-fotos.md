# Correção de sincronização das fotos

- A foto nova só é considerada salva depois de ser enviada ao Firebase Storage e receber uma URL HTTP/HTTPS válida.
- Cada troca usa um caminho versionado `racha-player-photos/{playerId}/{timestamp}.{ext}` para evitar cache antigo no Android.
- O upload usa cache-control de revalidação e o app continua usando `photoVersion` como cache-busting.
- `photoStoragePath` passou a ter prioridade absoluta no carregamento. IndexedDB/dataURL só funcionam como contingência visual local.
- Se o Storage falhar, o sistema não conclui o salvamento do jogador como se estivesse sincronizado. A tela informa o erro e permite tentar novamente.
- Fotos antigas em dataURL podem ser promovidas para Storage quando o fluxo de compactação/migração é executado pelo organizador.

## Firebase

Se aparecer a mensagem de que a foto não foi salva na nuvem, confira se o Firebase Storage está habilitado no mesmo projeto e se as regras permitem ao organizador autenticado gravar em `racha-player-photos/**` e permitem leitura das fotos conforme a política do seu site.
