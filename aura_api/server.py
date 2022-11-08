from marshmallow import Schema, fields, ValidationError
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


class AddCommentSchema(Schema):
    user = fields.String(required=True)
    comment = fields.String(required=True)
    nodes = fields.List(fields.String(), metadata={'allow_blank': False})
    aura = fields.String(required=True)
    signing_key = fields.String(required=True)
    sig = fields.String(required=True)
    category = fields.String(required=True)
    mainCommentKey = fields.String(required=True)


class RemoveCommentSchema(Schema):
    _key = fields.Integer(required=True)
    user = fields.String(required=True)
    aura = fields.String(required=True)
    signing_key = fields.String(required=True)
    sig = fields.String(required=True)


add_comment_schema = AddCommentSchema()
remove_comment_schema = RemoveCommentSchema()


@app.route('/comment', methods=['PUT', 'DELETE'])
def comments():
    data = request.get_json()
    print("DATA", data)
    if request.method == 'PUT':
        return add_comment(data)
    elif request.method == 'DELETE':
        return remove_comment(data)


def add_comment(data):
    try:
        data = add_comment_schema.load(data, partial=("mainCommentKey",))
    except ValidationError as err:
        raise ErrorToClient(err.messages, 400)

    signing_key = data['signing_key']
    verify_sig(data)

    aura_node = config.AURA_NODE if data['aura'] == 'aura' else config.AURA_TEST_NODE
    db = ArangoClient(hosts=aura_node).db('_system')
    snapshot_db = ArangoClient(hosts=aura_node).db('snapshot')

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

    if data.get('mainCommentKey'):
        if not db['comments'].has(str(data['mainCommentKey'])):
            raise ErrorToClient('The main comment not found', 403)

    metadata = db['comments'].insert({
        'user': data['user'],
        'comment': data['comment'],
        'category': data['category'],
        'nodes': data['nodes'],
        'mainCommentKey': data.get('mainCommentKey', ''),
        'timestamp': int(time.time() * 1000),
    })
    return json.dumps({'status': 200, '_key': metadata['_key']})


def remove_comment(data):
    try:
        data = remove_comment_schema.load(data)
    except ValidationError as err:
        raise ErrorToClient(err.messages, 400)

    verify_sig(data)

    aura_node = config.AURA_NODE if data['aura'] == 'aura' else config.AURA_TEST_NODE
    db = ArangoClient(hosts=aura_node).db('_system')

    comment = db['comments'].get(str(data['_key']))
    if not comment:
        raise ErrorToClient('The comment not found', 404)

    if comment.get('user') != data['user']:
        raise ErrorToClient('Only the comment writer can remove it', 403)

    db.aql.execute('''
        for c in comments
            filter c._key == @key
            or c.mainCommentKey == @key
            REMOVE { _key: c._key } IN comments
    ''', bind_vars={
        'key': data['_key']
    })
    return json.dumps({'status': 200})


def verify_sig(data):
    sig = base64.b64decode(data['sig']).hex()
    hex_signing_key = base64.b64decode(data['signing_key']).hex()
    verifying_key = ed25519.VerifyingKey(hex_signing_key, encoding='hex')
    del data['sig']
    del data['signing_key']
    message = json.dumps(data, sort_keys=True,
                         separators=(',', ':')).encode('ascii')
    try:
        verifying_key.verify(sig, message, encoding='hex')
        print('Signature is verified')
    except:
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
