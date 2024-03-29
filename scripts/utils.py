import os
import json
import time
import config
import shutil
import tarfile
import requests
import networkx as nx
from arango import ArangoClient

db = ArangoClient(hosts=config.ARANGO_SERVER_ENDPOINT).db(
    config.ARANGO_DB_NAME)


def read_suspicious_conns():
    now = int(time.time() * 1000)
    strong_levels = ['recovery', 'already known']
    if os.path.exists(config.LAST_SUSPICIOUS_CONNS_CHECK):
        with open(config.LAST_SUSPICIOUS_CONNS_CHECK, 'r') as f:
            LAST_CHECK = json.loads(f.read())
        start_time = LAST_CHECK['timestamp'] - 10 * 60 * 1000
        not_suspicious = set(LAST_CHECK['conns'])
    else:
        start_time = 0
        not_suspicious = set()
    suspicious_conns = {}
    if not os.path.exists(config.FILTER_FILES_DIR):
        return suspicious_conns
    files = os.listdir(config.FILTER_FILES_DIR)
    for file in files:
        with open(os.path.join(config.FILTER_FILES_DIR, file), 'r') as f:
            for k, v in json.loads(f.read()).items():
                if k in suspicious_conns:
                    suspicious_conns[k]['timestamp'] = max(
                        suspicious_conns[k]['timestamp'], v['timestamp'])
                else:
                    suspicious_conns[k] = v

    new_connections = {}
    cursor = db.aql.execute('''
        FOR c IN connectionsHistory
            FILTER c.level IN @strong_levels
            AND c.timestamp > @start_time
            RETURN c
        ''', bind_vars={'strong_levels': strong_levels, 'start_time': start_time})
    for c in cursor:
        f = c['_from'].replace('users/', '')
        t = c['_to'].replace('users/', '')
        if f'{f}{t}' not in new_connections:
            new_connections[f'{f}{t}'] = {'other_side': f'{t}{f}', 'timestamps': []}
        new_connections[f'{f}{t}']['timestamps'].append(c['timestamp'])

    for k, v in new_connections.items():
        if k not in suspicious_conns:
            continue

        if v['other_side'] not in new_connections:
            continue

        for t1 in v['timestamps']:
            if t1 <= suspicious_conns[k]['timestamp']:
                continue

            if [t2 for t2 in new_connections[v['other_side']]['timestamps'] if (t1 - 5 * 60 * 1000) <= t2 <= (t1 + 5 * 60 * 1000)]:
                not_suspicious.add(k)
                break

    with open(config.LAST_SUSPICIOUS_CONNS_CHECK, 'w') as f:
        f.write(json.dumps({
            'timestamp': now,
            'conns': list(not_suspicious)
        }))
    for k in not_suspicious:
        if k in suspicious_conns:
            del suspicious_conns[k]
    # print(f'No. suspicious conns: {len(suspicious_conns)}')
    return suspicious_conns


def restore_backup():
    print('\nRestoring database backup ...')
    backup = requests.get(config.BACKUP_URL)
    with open(config.RAR_ADDR, 'wb') as f:
        f.write(backup.content)
    shutil.rmtree(config.BACKUP_ADDR, ignore_errors=True)
    tarf = tarfile.open(config.RAR_ADDR, mode='r|gz')
    tarf.extractall(config.BACKUP_ADDR)
    tarf.close()
    # restore snapshot
    res = os.system(
        f"arangorestore --server.username 'root' --server.password '' --server.endpoint 'tcp://127.0.0.1:8529' --server.database '_system' --create-database true --create-collection true --import-data true --input-directory {config.BACKUP_ADDR}/dump")
    assert res == 0, 'restoring snapshot failed'


def get_manual_verifieds():
    bitu_verifieds_file = requests.get(config.BITU_VERIFIEDS_FILE)
    bitu_verifieds = set()
    for d in json.loads(bitu_verifieds_file.content):
        if d['score'] != 0 or d['linksNum'] > 0:
            bitu_verifieds.add(d['user'])
    return bitu_verifieds


def load_graph():
    suspicious_conns = read_suspicious_conns()
    graph = nx.Graph()
    connections = {
        f"{c['_from'].replace('users/', '')}{c['_to'].replace('users/', '')}": c for c in db['connections']}
    for c in connections.values():
        if c['level'] not in ['recovery', 'already known']:
            continue
        f = c['_from'].replace('users/', '')
        t = c['_to'].replace('users/', '')
        if f'{f}{t}' in suspicious_conns:
            continue
        if f'{t}{f}' in suspicious_conns:
            continue
        if graph.has_edge(f, t) or graph.has_edge(t, f):
            continue
        if (connections.get(f'{t}{f}', {}).get('level') not in ['recovery', 'already known']):
            continue
        graph.add_edge(f, t)
    main_component = sorted([comp for comp in nx.connected_components(
        graph)], key=lambda l: len(l), reverse=True)[0]
    for node in list(graph):
        if node not in main_component:
            graph.remove_node(node)
    return graph
