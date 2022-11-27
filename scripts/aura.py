from arango import ArangoClient
import json
import gzip


aura_node = ''
aura_test_node = ''
node_temp = {
    'inHonestyNum': 0,
    'outHonestyNum': 0,
    'inHonesty': 0,
    'outHonesty': 0,
    'inEnergyNum': 0,
    'outEnergyNum': 0,
    'inEnergy': 0,
    'outEnergy': 0,
    'energy': 0,
}


def read_data_from_db(db_url):
    db = ArangoClient(hosts=db_url).db('_system')
    snapshot_db = ArangoClient(hosts=db_url).db('snapshot')
    nodes = {}
    links = {}

    for d in db.collection('honesty'):
        f = d['_from'].replace('energy/', '')
        t = d['_to'].replace('users/', '')

        if f not in nodes:
            nodes[f] = node_temp.copy()
            nodes[f]['id'] = f

        if t not in nodes:
            nodes[t] = node_temp.copy()
            nodes[t]['id'] = t

        nodes[t]['inHonestyNum'] += 1
        nodes[f]['outHonestyNum'] += 1
        nodes[t]['inHonesty'] += float(d['honesty'])
        nodes[f]['outHonesty'] += float(d['honesty'])

        links[f'{f}:{t}'] = {
            'source': f,
            'target': t,
            'history': [],
            'honesty': float(d['honesty']),
        }

    scales = {}
    for ea in db.collection('energyAllocation'):
        if ea['allocation'] == 0:
            continue
        f = ea['_from'].replace('energy/', '')
        t = ea['_to'].replace('energy/', '')
        nodes[f]['outEnergyNum'] += 1
        nodes[t]['inEnergyNum'] += 1
        scales[f] = scales.get(f, 0) + float(ea['allocation'])
    for ea in db.collection('energyAllocation'):
        f = ea['_from'].replace('energy/', '')
        t = ea['_to'].replace('energy/', '')
        links[f'{f}:{t}']['allocation'] = int(
            float(ea['allocation']) / scales[f] * 100)
        links[f'{f}:{t}']['history'].append([ea['modified'], 'energyFlow'])

    for ef in db.collection('energyFlow'):
        f = ef['_from'].replace('energy/', '')
        t = ef['_to'].replace('energy/', '')
        nodes[f]['outEnergy'] += float(ef['energy'])
        nodes[t]['inEnergy'] += float(ef['energy'])
        links[f'{f}:{t}']['energy'] = float(ef['energy'])

    for e in snapshot_db.collection('energy'):
        nodes[e['_key']]['energy'] = e['energy']

    hashes = json.loads(next(filter(
        lambda v: v['_key'] == 'VERIFICATIONS_HASHES', db['variables']))['hashes'])
    v_block = sorted([int(block) for block in hashes])[-1]
    verifieds = db.aql.execute('''
        FOR v IN verifications
            FILTER v.name == "Aura"
                AND v.block == @v_block
                RETURN v
    ''', bind_vars={
        'v_block': v_block,
    })
    for v in verifieds:
        nodes[v['user']]['aura_level'] = v['level']
        nodes[v['user']]['aura_score'] = v['score']

    comments = []
    for c in db.collection('comments'):
        del c['_id']
        del c['_rev']
        comments.append(c)

    if db_url.find('test') > -1:
        json_file = '../aura-test.json.gz'
    else:
        json_file = '../aura.json.gz'

    json_graph = {'nodes': list(nodes.values()), 'links': list(links.values()), 'comments': comments}
    with gzip.open(json_file, 'w') as f:
        f.write(json.dumps(json_graph).encode('utf-8'))


def run():
    import time
    t1 = time.time()
    print('\nUpdating the Aura graph explorer data ... ')
    read_data_from_db(aura_node)
    read_data_from_db(aura_test_node)
    print(time.time() - t1)


if __name__ == '__main__':
    run()
