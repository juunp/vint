require('dotenv').config();
const http = require('http');
const io = require('socket.io')();
const express = require('express');
const path = require('path');
const ObjectId = require('mongodb').ObjectID;
const MongoClient = require('mongodb').MongoClient;
const { resolve } = require('bluebird');

const PORT = process.env.PORT || 9000;
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
const uriMongoDB = `mongodb+srv://${USERNAME}:${PASSWORD}@sandbox.1vyym.mongodb.net`;
const database = 'voting_machine';
const contribution_coll = 'contribution';
const ready_coll = 'ready';
const name_coll = 'name';
const mongoDBOptions = { useUnifiedTopology: true };


const app = express();
const server = http.createServer(app);

const pathStaticFiles = path.resolve(__dirname, '../client');
app.use(express.static(pathStaticFiles));

io.attach(server);
  

io.on('connection', (socket) => {
  console.log(`Socket ${socket.id} connected.`);

  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected.`);
  });

  socket.on('name-add', async (msg) => {
    await createOrUpdateName(msg.id, msg.value);
    emit(socket);
  });

  socket.on('contrib-add', (msg) => {
    createOrUpdateContribution(msg.id, msg.value);
    emit(socket);
  });

  socket.on('vote-add', (msg) => {
    addVote(msg.contrib, msg.name, 1, msg.socketId);
    emit(socket);
  })

  socket.on('vote-remove', (msg) => {
    addVote(msg.contrib, msg.name, -1, msg.socketId);
    emit(socket);
  })

  setInterval(async () => {
    try {
      emitNames(socket);
    } catch (err) {
      console.error(err);
    }
  }, 1000);

  setInterval(async () => {
    try {
      emitContributions(socket);
    } catch (err) {
      console.error(err);
    }
  }, 1000);
});

function emit(socket) {
  emitNames(socket);
  emitContributions(socket);
}

async function emitNames(socket) {
  socket.emit('names', await getNames());
}

async function emitContributions(socket) {
  socket.emit('contributions', await getContributions());
}

function getNames() {
  return MongoClient.connect(uriMongoDB, mongoDBOptions).then((client) =>  {
    return client.db(database).collection(name_coll).find().sort('name', 1).toArray().then((val) => {
      return val;
    })
    .catch(() => console.error('cannot get names'))
    .finally(() => {client.close();})
  })
  .catch((err) => console.error(err))
}

function getContributions() {
  return MongoClient.connect(uriMongoDB, mongoDBOptions).then((client) =>  {
    let ready = client.db(database).collection(ready_coll).findOne({'ready': true});
    let findContributionsPromise = client.db(database).collection(contribution_coll).find().toArray().finally(() => {client.close();});
    return ready.then((readyVal) => {
      if (readyVal !== null) {
        return findContributionsPromise;
      } else {
        return new Promise((resolve, reject) => {
          return [];
        });
      }
    })
    .then((val) => {
      val.shift()
      return val;
    })
    .catch(() => console.error('cannot get contributions'))
  }).catch((err) => console.error(err))
  
}

function createOrUpdateName(socketId, name) {
  MongoClient.connect(uriMongoDB, mongoDBOptions).then((client) => {
    client.db(database).collection(name_coll).findOne({'socket-id': socketId}).then((val) => {
      if (val == null) {
        client.db(database).collection(name_coll).insertOne({'socket-id': socketId, 'name': name}).finally(() => {
          client.close();
        });
      } else {
        client.db(database).collection(name_coll).findOneAndUpdate({'socket-id': socketId}, {'$set': {'name': name}}).finally(() => {
          client.close();
        });
      }
        }, (err) => {
      console.log(err);
    })
    .catch(() => console.error('cannot create or update names'))
  })
}

function createOrUpdateContribution(socketId, contributionName) {
  MongoClient.connect(uriMongoDB, mongoDBOptions).then((client) => {
    client.db(database).collection(contribution_coll).findOne({'socket-id': socketId}).then((val) => {
      if (val == null) {
        client.db(database).collection(contribution_coll).insertOne({'socket-id': socketId, 'value': contributionName, 'hasVoted': [], 'votes': {}, 'hasVotedFor': {}}).finally(() => {
          client.close();
        });
      } else {
        client.db(database).collection(contribution_coll).findOneAndUpdate({'socket-id': socketId}, {'$set': {'value': contributionName}}).finally(() => {
          client.close();
        });
      }
        }, (err) => {
      console.log(err);
    })
    .catch(() => console.error('cannot create or update contributions'))
    
  })
}

function addVote(contributionId, votedFor, $expr, socketId) {
  let action = '$push';
  if ($expr < 0) {
    action = '$pull'
  }
  MongoClient.connect(uriMongoDB, mongoDBOptions).then((client) => {
    client.db(database).collection(contribution_coll).findOne({'_id': new ObjectId(contributionId), 'hasVoted': {'$in': [socketId]}}).then((val) => {
      if ($expr > 0 && val === null) {
        client.db(database).collection(contribution_coll).findOneAndUpdate({'_id': new ObjectId(contributionId)}, {[`${action}`]: {[`hasVotedFor.${votedFor}`]: socketId, 'hasVoted': socketId}, '$inc': {[`votes.${votedFor}`]: $expr}}).finally(() => {
          client.close();
        });
      } else if (val !== null) {
        if (val.hasVotedFor[votedFor]?.includes(socketId)) {
          client.db(database).collection(contribution_coll).findOneAndUpdate({'_id': new ObjectId(contributionId)}, {[`${action}`]: {[`hasVotedFor.${votedFor}`]: socketId, 'hasVoted': socketId }, '$inc': {[`votes.${votedFor}`]: $expr}}).finally(() => {
            client.close();
          });
        }
      }
      
    })
    .catch(() => console.error('cannot vote'))
  });
}

server.listen(PORT);