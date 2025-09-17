Bucket Policies Config
CREATE POLICY "Public read access for properties folder"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
bucket_id = 'default'
AND name LIKE 'properties/%'
);

Utilizar extensão unnacent para buscas!
CREATE EXTENSION IF NOT EXISTS unaccent;

Solução
No seu servidor, dentro da pasta colibri-server, execute estes dois comandos:

Garanta que o arquivo acme.json exista:

Bash

touch ./traefik/acme.json
Ajuste as permissões do arquivo:

Bash

chmod 600 ./traefik/acme.json
