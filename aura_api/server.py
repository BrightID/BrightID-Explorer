from flask import Flask, request
from arango import ArangoClient
import ed25519
import base64
import time
import json
import os
import config

app = Flask(__name__)
app.secret_key = os.urandom(24)


@app.route('/comment', methods=['PUT', 'DELETE'])
def comments():
    data = request.get_json()
    print(data)
    if request.method == 'PUT':
        return add_comment(data)
    elif request.method == 'DELETE':
        return remove_comment(data)


def add_comment(data):
    for key in ['user', 'comment', 'nodes', 'aura', 'signing_key', 'sig']:
        if key not in data:
            raise ErrorToClient(f'Missing {key} value', 400)
    signing_key = data['signing_key']

    verify_sig(data)

    aura_node = config.AURA_NODE if data['aura'] == 'aura' else config.AURA_TEST_NODE
    snapshot_db = ArangoClient(hosts=aura_node).db('snapshot')
    db = ArangoClient(hosts=aura_node).db('_system')
    c = db.aql.execute('''
        FOR e IN users
            FILTER e._key == @user
            RETURN e.signingKeys
    ''', bind_vars={
        'user': data['user'],
    })
    signing_keys = next(c, [])
    if signing_key not in signing_keys:
        raise ErrorToClient("The signing key doesn't belong to the user", 403)

    c = snapshot_db.aql.execute('''
        FOR e IN energy
            FILTER e._key == @user
            RETURN e.energy
    ''', bind_vars={
        'user': data['user'],
    })
    energy = next(c, 0)
    if energy == 0:
        raise ErrorToClient("User doesn't have energy", 403)

    comments_coll = db.collection('comments')
    metadata = comments_coll.insert({
        'user': data['user'],
        'comment': data['comment'],
        'nodes': data['nodes'],
        'timestamp': int(time.time() * 1000),
    })
    return json.dumps({'status': 200, '_key': metadata['_key']})


def remove_comment(data):
    for key in ['user', '_key', 'aura', 'signing_key', 'sig']:
        if key not in data:
            raise ErrorToClient(f'Missing {key} value', 400)

    verify_sig(data)

    aura_node = config.AURA_NODE if data['aura'] == 'aura' else config.AURA_TEST_NODE
    db = ArangoClient(hosts=aura_node).db('_system')
    comments_coll = db.collection('comments')
    comment = comments_coll.get(str(data['_key']))
    if (not comment):
        raise ErrorToClient('The comment not found', 404)

    if (comment.get('user') != data['user']):
        raise ErrorToClient('Only the comment writer can remove it', 403)

    comments_coll.delete(str(data['_key']))
    return json.dumps({'status': 200})


def verify_sig(data):
    sig = base64.b64decode(data['sig']).hex()
    hex_signing_key = base64.b64decode(data['signing_key']).hex()
    verifying_key = ed25519.VerifyingKey(hex_signing_key, encoding='hex')
    del data['sig']
    del data['signing_key']
    message = json.dumps(data, separators=(',', ':')).encode('ascii')
    try:
        verifying_key.verify(sig, message, encoding='hex')
        print('Signature is verified')
    except Exception as e:
        raise ErrorToClient('Bad signature', 401)


class ErrorToClient(Exception):
    pass


@app.errorhandler(ErrorToClient)
def error_to_client(error):
    return json.dumps({
        'message': error.args[0],
        'status': error.args[1]
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=7523, threaded=True)
