import os
import json
import zipfile
import tarfile
import requests
import networkx as nx

BACKUP_URL = 'https://storage.googleapis.com/brightid-backups/brightid.tar.gz'


def main():
    # load json from backup file
    json_graph = load_backup()
    graph = nx.Graph()
    nodes = {}
    for node in json_graph['nodes']:
        nodes[node['id']] = node
        graph.add_node(node['id'])
    for edge in json_graph['edges']:
        graph.add_edge(edge[0], edge[1])

    # remove the unconnected nodes to the main component
    main_component = sorted([comp for comp in nx.connected_components(
        graph)], key=lambda l: len(l), reverse=True)[0]
    for node in json_graph['nodes']:
        if node['id'] not in main_component:
            json_graph['nodes'].remove(node)
            graph.remove_node(node['id'])
    for edge in list(json_graph['edges']):
        if nodes[edge[0]] not in json_graph['nodes'] or nodes[edge[1]] not in json_graph['nodes']:
            if edge in json_graph['edges']:
                json_graph['edges'].remove(edge)
    with open('/var/www/html/explorer/brightid.json', 'w') as f:
        f.write(json.dumps(json_graph))


def load_backup():
    rar_addr = '/tmp/brightid.tar.gz'
    zip_addr = '/tmp/brightid.zip'
    backup = requests.get(BACKUP_URL)
    with open(rar_addr, 'wb') as f:
        f.write(backup.content)
    tar_to_zip(rar_addr, zip_addr)
    user_groups = records(zip_addr, 'usersInGroups')
    users = records(zip_addr, 'users')
    groups = records(zip_addr, 'groups')
    connections = records(zip_addr, 'connections')
    verifications = records(zip_addr, 'verifications')
    ret = {'nodes': [], 'edges': [], 'groups': []}
    for u in users:
        users[u] = {'id': u, 'groups': [], 'verifications': {}}
        ret['nodes'].append(users[u])
    for v in verifications.values():
        u = v['user']
        name = v['name']
        if u in users:
            for k in ['name', '_key', '_id', '_rev', 'user']:
                del v[k]
            users[u]['verifications'][name] = v
    for user_group in user_groups.values():
        u = user_group['_from'].replace('users/', '')
        g = user_group['_to'].replace('groups/', '')
        users[u]['groups'].append(g)
        if groups[g].get('seed', False):
            users[u]['node_type'] = 'Seed'
    for c in connections.values():
        ret['edges'].append([
            c['_from'].replace('users/', ''),
            c['_to'].replace('users/', ''),
            c['timestamp']
        ])
    for g in groups:
        ret['groups'].append({'id': g, 'rank': groups[g]['score'], 'seed': groups[g].get(
            'seed', False), 'region': groups[g].get('region', None)})
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
