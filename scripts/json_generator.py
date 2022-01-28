import os
import json
import gzip
import time
import shutil
import tarfile
import requests

BACKUP_URL = 'https://explorer.brightid.org/backups/brightid.tar.gz'
DEFAULT_QUOTA = 50
rar_addr = '/tmp/brightid.tar.gz'
backup_addr = '/tmp/brightid/dump'

now = time.time()
one_year_ago = int(now - 365 * 24 * 3600) * 1000
one_year_ago -= one_year_ago % (24 * 3600 * 1000)
one_week_ago = int(now - 7 * 24 * 3600) * 1000
one_week_ago -= one_week_ago % (3600 * 1000)
filter_files_dir = './suspicious_conns'


def read_filtered_conns():
    suspicious_conns = {}
    if not os.path.exists(filter_files_dir):
        os.makedirs(filter_files_dir)
    files = os.listdir(filter_files_dir)
    for file in files:
        with open(os.path.join(filter_files_dir, file), 'r') as f:
            for l in json.loads(f.read()):
                suspicious_conns[tuple(l)] = True
    return suspicious_conns


def get_links():
    suspicious_conns = read_filtered_conns()
    connection_levels = ('reported', 'suspicious',
                         'just met', 'already known', 'recovery', 'filtered')
    links = {}
    users_statistics = {}
    connections_history = records('connectionsHistory')
    for c in connections_history:
        if c['level'] in ['recovery', 'already known']:
            if (c['_from'], c['_to']) in suspicious_conns:
                c['level'] = 'filtered'
        f = c['_from'].replace('users/', '')
        t = c['_to'].replace('users/', '')
        k = f'{f}{t}'
        if k not in links:
            links[k] = {'source': f, 'target': t, 'history': []}
        links[k]['history'].append([c['timestamp'], c['level']])

    for key in links:
        link = links[key]
        if len(link['history']) > 1:
            link['history'].sort(key=lambda x: x[0])

        if link['source'] not in users_statistics:
            users_statistics[link['source']] = {
                'outbound': {k: 0 for k in connection_levels},
                'inbound': {k: 0 for k in connection_levels},
                'recoveries': []
            }
        if link['target'] not in users_statistics:
            users_statistics[link['target']] = {
                'outbound': {k: 0 for k in connection_levels},
                'inbound': {k: 0 for k in connection_levels},
                'recoveries': []
            }
        users_statistics[link['source']
                         ]['outbound'][link['history'][-1][1]] += 1
        users_statistics[link['target']
                         ]['inbound'][link['history'][-1][1]] += 1

        if link['history'][-1][1] == 'recovery':
            users_statistics[link['source']
                             ]['recoveries'].append(link['target'])

    return list(links.values()), users_statistics


def get_seeds_data(users, seed_connections):
    hourly = {}
    daily = {}
    for u in seed_connections:
        for seed in seed_connections[u]:
            t = seed_connections[u][seed]
            ht = t - t % (3600 * 1000)
            dt = t - t % (24 * 3600 * 1000)
            if seed not in hourly:
                hourly[seed] = {one_week_ago + i * 3600 *
                                1000: 0 for i in range(7 * 24 + 1)}
            if seed not in daily:
                daily[seed] = {one_year_ago + i * 24 *
                               3600 * 1000: 0 for i in range(365 + 1)}
            if t > one_week_ago:
                hourly[seed][ht] += 1
            if t > one_year_ago:
                daily[seed][dt] += 1
    h = {seed: [(t, hourly[seed][t]) for t in sorted(hourly[seed])]
         for seed in hourly}
    d = {seed: [(t, daily[seed][t]) for t in sorted(daily[seed])]
         for seed in daily}
    return {'hourly': h, 'daily': d}


def get_seed_groups_data(users):
    regions = {}
    for group in records('groups'):
        g = group['_id'].replace('groups/', '')
        regions[g] = group.get('region', g)
    seed_connections = {}
    seed_group_connections = {}
    for c in records('connections'):
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
        for g in users[f]['seed_groups']:
            if g not in seed_group_connections[t]:
                seed_group_connections[t][g] = c['timestamp']
        if f not in seed_connections[t]:
            seed_connections[t][f] = c['timestamp']
    hourly = {}
    daily = {}
    for u in seed_group_connections:
        for g in seed_group_connections[u]:
            t = seed_group_connections[u][g]
            ht = t - t % (3600 * 1000)
            dt = t - t % (24 * 3600 * 1000)
            if g not in hourly:
                hourly[g] = {one_week_ago + i * 3600 *
                             1000: 0 for i in range(7 * 24 + 1)}
            if g not in daily:
                daily[g] = {one_year_ago + i * 24 *
                            3600 * 1000: 0 for i in range(365 + 1)}
            if t > one_week_ago:
                hourly[g][ht] += 1
            if t > one_year_ago:
                daily[g][dt] += 1
    h = {regions[g]: [(t, hourly[g][t])
                      for t in sorted(hourly[g])] for g in hourly}
    d = {regions[g]: [(t, daily[g][t])
                      for t in sorted(daily[g])] for g in daily}
    return {'seed_connections': seed_connections, 'hourly': h, 'daily': d}


def get_groups_data(users, groups_used_quota):
    group_dics = []
    groups_quota = {}
    groups = records('groups')
    for group in groups:
        g = group['_id'].replace('groups/', '')
        group_dic = {'id': g, 'seed': group.get(
            'seed', False), 'region': group.get('region', None)}
        if group.get('seed', False):
            quota = max(0, group.get('quota', DEFAULT_QUOTA) -
                        groups_used_quota.get(g, 0))
            group_dic['all_quota'] = group.get('quota', DEFAULT_QUOTA)
            group_dic['quota'] = quota
            groups_quota[g] = quota
        group_dics.append(group_dic)
    # def group_sorter(
    #     g): return groups_quota[g] if groups_quota[g] > 0 else 1000000
    for user_group in records('usersInGroups'):
        u = user_group['_from'].replace('users/', '')
        g = user_group['_to'].replace('groups/', '')
        if u not in users:
            continue
        users[u]['groups'].append(g)
        if g in groups_quota:
            users[u]['seed_groups'].append(g)
            users[u]['node_type'] = 'Seed'
            users[u]['quota'] += groups_quota[g]
            users[u]['seed_groups'].sort(
                key=lambda g: groups_quota[g] if groups_quota[g] > 0 else 1000000)
    return group_dics


def get_verifications_block():
    variables = records('variables')
    hashes = json.loads(
        next(filter(lambda v: v['_key'] == 'VERIFICATIONS_HASHES', variables))['hashes'])
    return sorted([int(block) for block in hashes])[-1]


def get_verifications_data(users):
    groups_used_quota = {}
    v_block = get_verifications_block()
    for v in records('verifications'):
        if v['block'] != v_block:
            continue
        u = v['user']
        name = v['name']
        for k in ['name', '_key', '_id', '_rev', 'user']:
            del v[k]
        users[u]['verifications'][name] = v
        if name == 'SeedConnected':
            for g in v['connected']:
                if g not in groups_used_quota:
                    groups_used_quota[g] = 0
                groups_used_quota[g] += 1
        elif name == 'Yekta':
            if v['rank'] > 2:
                users[u]['size'] = 4
            else:
                users[u]['size'] = 2
    return groups_used_quota


def get_users():
    recs = records('users')
    users = {}
    for r in recs:
        u = r['_id'].replace('users/', '')
        users[u] = {'id': u, 'createdAt': r['createdAt'], 'groups': [
        ], 'verifications': {}, 'seed_groups': [], 'quota': 0}
    return users


def records(table):
    fnames = os.listdir(backup_addr)
    fname = next(filter(lambda fn: fn.startswith(
        f'{table}_') and fn.endswith('.data.json'), fnames))
    recs = []
    with open(os.path.join(backup_addr, fname), 'r') as f:
        for line in f.read().split('\n'):
            if not line.strip():
                continue
            rec = json.loads(line)
            if rec['type'] == 2300:
                recs.append(rec['data'])
            elif rec['type'] == 2302 and rec['data'] in recs:
                recs.remove(rec['data'])
    return recs


def read_backup():
    backup = requests.get(BACKUP_URL)
    with open(rar_addr, 'wb') as f:
        f.write(backup.content)
    shutil.rmtree(backup_addr, ignore_errors=True)
    tarf = tarfile.open(rar_addr, mode='r|gz')
    tarf.extractall('/tmp/brightid/')
    tarf.close()


def load_from_backup():
    ret = {}

    users = get_users()

    groups_used_quota = get_verifications_data(users)
    ret['groups'] = get_groups_data(users, groups_used_quota)

    seed_groups_data = get_seed_groups_data(users)
    ret['seed_groups_hourly'] = seed_groups_data['hourly']
    ret['seed_groups_daily'] = seed_groups_data['daily']
    seed_connections = seed_groups_data['seed_connections']

    seeds_data = get_seeds_data(users, seed_connections)
    ret['seeds_hourly'] = seeds_data['hourly']
    ret['seeds_daily'] = seeds_data['daily']

    ret['nodes'] = list(users.values())
    ret['links'], ret['users_statistics'] = get_links()
    return ret


def main():
    print('Updating the graph explorer data. ', time.ctime())
    read_backup()
    json_graph = load_from_backup()
    with gzip.open('../brightid.json.gz', 'w') as f:
        f.write(json.dumps(json_graph).encode('utf-8'))


if __name__ == '__main__':
    main()
