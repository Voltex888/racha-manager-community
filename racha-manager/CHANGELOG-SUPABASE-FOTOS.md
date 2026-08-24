# Fotos dos jogadores no Supabase Storage

- Fotos novas são enviadas para o bucket público `racha-media`.
- O caminho usado é `players/{playerId}/{timestamp}.{ext}` para evitar cache antigo no Android.
- A URL pública é salva no jogador no Firestore.
- IndexedDB/dataURL ficam apenas como contingência temporária deste aparelho.
- O estado de upload só é concluído depois que a URL remota também foi salva no Firestore.
- Firebase Storage continua intacto para recursos antigos que ainda o utilizam, mas não é mais usado para fotos novas dos jogadores.

Configuração usada:
- Project URL: `https://moesysxjujftdhetmmfe.supabase.co`
- Bucket: `racha-media`
- Autorização de cliente: publishable key + políticas RLS do bucket.

Políticas necessárias no `storage.objects`:
- `INSERT` para `anon` quando `bucket_id = 'racha-media'`.
- `SELECT` para `anon` quando `bucket_id = 'racha-media'` (o bucket também está público).
