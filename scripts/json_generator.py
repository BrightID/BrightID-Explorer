import os
import json
import time
import zipfile
import tarfile
import requests
import networkx as nx

BACKUP_URL = 'https://explorer.brightid.org/backups/brightid.tar.gz'
DEFAULT_QUOTA = 50


def main():
    print('Updating the graph explorer data. ', time.ctime())
    json_graph = load_from_backup()
    with open('../brightid.json', 'w') as f:
        f.write(json.dumps(json_graph))


def load_from_backup():
    # read data from the backup
    rar_addr = '/tmp/brightid.tar.gz'
    zip_addr = '/tmp/brightid.zip'
    # backup = requests.get(BACKUP_URL)
    # with open(rar_addr, 'wb') as f:
    #     f.write(backup.content)
    tar_to_zip(rar_addr, zip_addr)
    user_groups = records(zip_addr, 'usersInGroups')
    users = records(zip_addr, 'users')
    groups = records(zip_addr, 'groups')
    connections = records(zip_addr, 'connections')
    connections = {(
        c['_from'].replace('users/', ''),
        c['_to'].replace('users/', '')
    ): c for c in connections.values()}
    verifications = records(zip_addr, 'verifications')
    variables = records(zip_addr, 'variables')
    hashes = json.loads(variables['VERIFICATIONS_HASHES']['hashes'])
    v_block = sorted([int(block) for block in hashes])[-1]
    # remove the unconnected nodes to the main component
    graph = nx.Graph()
    graph.add_nodes_from(users.keys())
    graph.add_edges_from([(c['_from'].replace(
        'users/', ''), c['_to'].replace('users/', '')) for c in connections.values()])
    main_component = sorted([comp for comp in nx.connected_components(
        graph)], key=lambda l: len(l), reverse=True)[0]
    for node in list(graph):
        if node not in main_component:
            graph.remove_node(node)
            del users[node]

    # generate the JSON
    ret = {'nodes': [], 'links': [], 'groups': []}
    groupsUsedQuota = {}
    groupsQuota = {}
    for u in users:
        if u not in graph:
            continue
        users[u] = {'id': u, 'groups': [], 'verifications': {
        }, 'seed_groups': [], 'quota': 0, 'trusted': users[u].get('trusted', list())}
    for v in verifications.values():
        if v['block'] != v_block:
            continue
        u = v['user']
        if u not in graph:
            continue
        name = v['name']
        for k in ['name', '_key', '_id', '_rev', 'user']:
            del v[k]
        users[u]['verifications'][name] = v
        if name == 'SeedConnected':
            for g in v['connected']:
                if g not in groupsUsedQuota:
                    groupsUsedQuota[g] = 0
                groupsUsedQuota[g] += 1
        if name == 'Yekta':
            if v['rank'] > 2:
                users[u]['size'] = 4
            else:
                users[u]['size'] = 2

    for g in groups:
        groupDic = {'id': g, 'seed': groups[g].get(
            'seed', False), 'region': groups[g].get('region', None)}
        if groups[g].get('seed', False):
            quota = max(0, groups[g].get(
                'quota', DEFAULT_QUOTA) - groupsUsedQuota.get(g, 0))
            groupDic['quota'] = quota
            groupsQuota[g] = quota
        ret['groups'].append(groupDic)

    group_sorter = lambda g: groupsQuota[g] if groupsQuota[g] > 0 else 1000000
    for user_group in user_groups.values():
        u = user_group['_from'].replace('users/', '')
        if u not in graph:
            continue
        g = user_group['_to'].replace('groups/', '')
        users[u]['groups'].append(g)
        if groups[g].get('seed', False):
            users[u]['seed_groups'].append(g)
            users[u]['node_type'] = 'Seed'
            users[u]['quota'] += groupsQuota[g]
            users[u]['seed_groups'].sort(key = group_sorter)

    for c in connections.values():
        if c['level'] in ('just met', 'suspicious'):
            continue
        _from = c['_from'].replace('users/', '')
        _to = c['_to'].replace('users/', '')
        if _from not in graph or _to not in graph:
            continue
        otherSideLevel = connections.get((_to, _from), {}).get('level')
        if c['level'] == 'already known' and otherSideLevel in ('just met', 'suspicious'):
            continue
        ret['links'].append({
            'source': _from,
            'target': _to,
            'level': c['level'],
            'timestamp': c['timestamp']
        })
    ret['nodes'] = list(users.values())

    seed_connections = {}
    seed_group_connections = {}
    for c in connections.values():
        if c['level'] not in ('just met', 'already known', 'recovery'):
            continue
        f = c['_from'].replace('users/', '')
        if f not in users or users[f].get('node_type') != 'Seed':
            continue
        t = c['_to'].replace('users/', '')
        if t not in seed_group_connections:
            seed_group_connections[t] = {}
        if t not in seed_connections:
            seed_connections[t] = {}
        g = users[f]['seed_groups'][0]
        if g not in seed_group_connections[t]:
            seed_group_connections[t][g] = c['timestamp']
        if f not in seed_connections[t]:
            seed_connections[t][f] = c['timestamp']
    now = time.time()
    one_year_ago = int(now - 365*24*3600) * 1000
    one_year_ago -= one_year_ago%(24*3600*1000)
    one_week_ago = int(now - 7*24*3600) * 1000
    one_week_ago -= one_week_ago%(3600*1000)
    hourly = {}
    daily = {}
    for u in seed_group_connections:
        for g in seed_group_connections[u]:
            t = seed_group_connections[u][g]
            ht = t - t%(3600*1000)
            dt = t - t%(24*3600*1000)
            if g not in hourly:
                hourly[g] = {one_week_ago+i*3600*1000: 0 for i in range(7*24+1)}
            if g not in daily:
                daily[g] = {one_year_ago+i*24*3600*1000: 0 for i in range(365+1)}
            if t > one_week_ago:
                hourly[g][ht] += 1
            if t > one_year_ago:
                daily[g][dt] += 1
    ret['seed_groups_hourly'] = {groups[g].get('region', g): [(t, hourly[g][t]) for t in sorted(hourly[g])] for g in hourly}
    ret['seed_groups_daily'] = {groups[g].get('region', g): [(t, daily[g][t]) for t in sorted(daily[g])] for g in daily}

    hourly = {}
    daily = {}
    for u in seed_connections:
        for seed in seed_connections[u]:
            t = seed_connections[u][seed]
            ht = t - t%(3600*1000)
            dt = t - t%(24*3600*1000)
            if seed not in hourly:
                hourly[seed] = {one_week_ago+i*3600*1000: 0 for i in range(7*24+1)}
            if seed not in daily:
                daily[seed] = {one_year_ago+i*24*3600*1000: 0 for i in range(365+1)}
            if t > one_week_ago:
                hourly[seed][ht] += 1
            if t > one_year_ago:
                daily[seed][dt] += 1
    ret['seeds_hourly'] = {seed: [(t, hourly[seed][t]) for t in sorted(hourly[seed])] for seed in hourly}
    ret['seeds_daily'] = {seed: [(t, daily[seed][t]) for t in sorted(daily[seed])] for seed in daily}


    return ret


def records(f, table):
    zf = zipfile.ZipFile(f)
    fnames = zf.namelist()
    fname = list(filter(lambda fn: fn.endswith('.data.json')
                        and fn.count('/{}_'.format(table)) > 0, fnames))[0]
    content = zf.open(fname).read().decode('utf-8')
    ol = [json.loads(line) for line in content.split('\n') if line.strip()]
    d = {}
    for o in ol:
        if o['type'] == 2300:
            d[o['data']['_key']] = o['data']
        elif o['type'] == 2302 and o['data']['_key'] in d:
            del d[o['data']['_key']]
    return dict((d[k]['_id'].replace(table + '/', ''), d[k]) for k in d)


def tar_to_zip(fin, fout):
    if os.path.exists(fout):
        os.remove(fout)
    tarf = tarfile.open(fin, mode='r|gz')
    zipf = zipfile.ZipFile(fout, mode='a', compression=zipfile.ZIP_DEFLATED)
    for m in tarf:
        f = tarf.extractfile(m)
        if f:
            zipf.writestr(m.name, f.read())
    tarf.close()
    zipf.close()


if __name__ == '__main__':
    main()
