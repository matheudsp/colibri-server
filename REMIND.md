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
