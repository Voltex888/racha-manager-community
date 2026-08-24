# Limpeza automática de mídias no Supabase

Esta versão evita o acúmulo de versões antigas no bucket `racha-media`.

## Alterações

- Fotos de jogadores: o arquivo anterior é removido somente depois que a nova foto e seus metadados são confirmados no Firestore.
- Remoção de foto: o arquivo remoto é apagado somente depois que a remoção é confirmada no Firestore.
- Exclusão de jogador: a foto remota é apagada somente depois que o jogador é removido dos dados compartilhados.
- Fundos personalizados: ao substituir ou remover um fundo, a versão anterior é apagada depois da confirmação no Firestore. Um arquivo compartilhado por mais de um contexto não é apagado enquanto ainda houver outro contexto usando-o.
- Músicas: troca e exclusão agora persistem primeiro a biblioteca e só depois removem o arquivo antigo.
- Uploads de música que não conseguem persistir os metadados são desfeitos para não criar órfãos.
- Erro ao apagar uma mídia antiga não desfaz o novo salvamento. A falha aparece apenas no console.

## Policy necessária no Supabase

Além de INSERT e SELECT, o bucket `racha-media` precisa permitir DELETE:

```sql
create policy "racha media delete"
on storage.objects
for delete
to anon
using (
  bucket_id = 'racha-media'
);
```

A exclusão usa a API oficial do Supabase Storage. Nenhum objeto é removido diretamente via SQL.
