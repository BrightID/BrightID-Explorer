import os
import json
import requests
import networkx as nx
from google.cloud import storage
from arango import ArangoClient
import utils
import config


def upload(fpath):
    print('Uploading bitu.json')
    dir_path = os.path.dirname(os.path.realpath(__file__))
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.join(
        dir_path, 'google.json')
    client = storage.Client()
    bucket = client.get_bucket('brightid-explorer')
    fname = os.path.basename(fpath)
    blob = bucket.blob(fname)
    with open(fpath, 'rb') as f:
        blob.upload_from_file(f)


def get_main_component():
    db = ArangoClient(hosts=config.ARANGO_SERVER_ENDPOINT).db(
        config.ARANGO_DB_NAME)
    suspicious_conns = utils.read_suspicious_conns()
    graph = nx.DiGraph()
    for c in db['connections']:
        f = c['_from'].replace('users/', '')
        t = c['_to'].replace('users/', '')
        if c['level'] in ['recovery', 'already known']:
            if f"{f}{t}" in suspicious_conns:
                c['level'] = 'filtered'
        graph.add_edge(f, t, level=c['level'])
    main_node = 'AsjAK5gJ68SMYvGfCAuROsMrJQ0_83ZS92xy94LlfIA'
    checked = set()
    check_list = []
    main_component = set()
    check_list.append(main_node)
    while len(check_list) > 0:
        v = check_list.pop()
        if v not in checked:
            main_component.add(v)
            checked.add(v)
            neighbors = list(graph.neighbors(v))
            predecessors = list(graph.neighbors(v))
            for neighbor in set(neighbors + predecessors):
                c1 = graph.edges.get([v, neighbor], {}).get(
                    'level') in ['already known', 'recovery']
                c2 = graph.edges.get([neighbor, v], {}).get(
                    'level') in ['already known', 'recovery']
                if c1 and c2:
                    check_list.append(neighbor)
    for node in list(graph.nodes):
        if node not in main_component:
            graph.remove_node(node)
    # print(
    #     f'main component\tnodes: {len(graph.nodes)}\tedges: {len(graph.edges)}')
    return graph


def bitu():
    f = requests.get(config.BITU_VERIFIEDS_FILE)
    supervised_verifieds = {v['user']: v for v in json.loads(f.content)}
    main_component = get_main_component()
    scores = {v: {'name': 'Bitu', 'user': v, 'linksNum': 0, 'score': 0, 'tempScore': 0, 'directReports': {
    }, 'indirectReports': {}, 'reportedConnections': {}, 'releaseTime': 0} for v in main_component.nodes}
    with open(config.BITU_ELIGIBLES_FILE, 'r') as f:
        eligibles = json.loads(f.read())
    for e in main_component.edges:
        # skip the edges that the source is not eligible
        if e[0] not in eligibles or e[1] not in eligibles:
            continue

        level = main_component.edges[e]['level']
        if level not in ['already known', 'recovery']:
            continue

        other_side_level = main_component.edges.get(
            (e[1], e[0]), {}).get('level')
        if other_side_level in ['already known', 'recovery']:
            scores[e[0]]['tempScore'] += 1
        elif other_side_level in ['suspicious', 'reported']:
            scores[e[0]]['directReports'][e[1]] = -config.DIRECT_PENALTY
            scores[e[0]]['tempScore'] -= config.DIRECT_PENALTY

    for e in main_component.edges:
        # skip the edges that the target already hasn't had Bitu verification
        if supervised_verifieds.get(e[1], {}).get('score', 0) < 1:
            continue

        level = main_component.edges[e]['level']
        if level not in ['already known', 'recovery']:
            continue
        if len(scores[e[1]]['directReports']) > 0:
            scores[e[0]]['indirectReports'][e[1]] = - \
                config.INDIRECT_PENALTY * len(scores[e[1]]['directReports'])
            scores[e[0]]['reportedConnections'][e[1]] = list(
                scores[e[1]]['directReports'].keys())
            scores[e[0]]['tempScore'] -= config.INDIRECT_PENALTY * \
                len(scores[e[1]]['directReports'])

    for n in scores:
        if n in supervised_verifieds:
            supervised_verifieds[n]['tempScore'] = scores[n]['tempScore']
        elif n not in supervised_verifieds and scores[n]['tempScore'] > 0:
            supervised_verifieds[n] = scores[n]
    for n in supervised_verifieds:
        if n not in scores:
            supervised_verifieds[n]['tempScore'] = 0

    res = json.dumps(list(supervised_verifieds.values()))
    with open('bitu.json', 'w') as f:
        f.write(res)


def main():
    print('\nUpdating Bitu ...')
    bitu()
    upload('./bitu.json')


if __name__ == '__main__':
    main()
