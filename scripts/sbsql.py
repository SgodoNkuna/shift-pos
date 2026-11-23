#!/usr/bin/env python3
"""Run a SQL file against the Supabase project through the Management API.
Usage: sbsql.py <file.sql> [--migrate NAME]
The access token is added by the session's network proxy; nothing secret lives here."""
import json, sys, urllib.request
REF = 'qnlndzxlgfcoieqnpnfh'
sql = open(sys.argv[1]).read()
if '--migrate' in sys.argv:
    url = f'https://api.supabase.com/v1/projects/{REF}/database/migrations'
    body = {'query': sql, 'name': sys.argv[sys.argv.index('--migrate') + 1]}
else:
    url = f'https://api.supabase.com/v1/projects/{REF}/database/query'
    body = {'query': sql}
req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST',
    headers={'Authorization': 'Bearer proxy-injected', 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as r:
        print(r.status, r.read().decode()[:4000])
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode()[:4000]); sys.exit(1)
