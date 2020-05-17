# BrightID graph explorer
https://explorer.brightid.org

BrightID graph explorer enables users to see their own/friends position in BrightID graph.

It is a pure html/js web app without any server side code that uses different APIs to show BrightID graph to users. It uses:

- the officially hosted brightid graph from `https://storage.googleapis.com/brightid-backups/brightid.json` to render graph
- profile service from `http://node.brightid.org/profile/` when users share their connection codes to load users brightid, name and profile picture
- brightid api from `http://node.brightid.org/brightid/v4/users/{brightid}` to fetch list of connections and groups for the user
- backup service from `https://recovery.brightid.org/backups/{key1}/{key2}` to load connections and groups names and photos from encrypted backup data

To avoid CORS related issues, the server that host explorer should use nginx as reverse proxy
to access required apis on the same domain that index.html file is hosted. The following section
can be added to the server configuration to achieve this.

```
location /backups/ {
        proxy_pass https://storage.googleapis.com/brightid-backups/;
}

location /storage/ {
        proxy_pass https://recovery.brightid.org/backups/;
}

location /profile/ {
        proxy_pass http://node.brightid.org/profile/;
}

location /api/ {
        proxy_pass http://node.brightid.org/brightid/;
}

```
