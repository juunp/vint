require('dotenv').config();
const http = require('http');
const io = require('socket.io')();
const express = require('express');
const path = require('path');
const ObjectId = require('mongodb').ObjectID;
const MongoClient = require('mongodb').MongoClient;

const PORT = process.env.PORT || 9000;
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
const uriMongoDB = `mongodb+srv://${USERNAME}:${PASSWORD}@sandbox.1vyym.mongodb.net`;
const database = 'voting_machine';
const contribution_coll = 'contribution';
const name_coll = 'name';


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
    emitNames(socket);
  }, 3000)

  setInterval(async () => {
    emitContributions(socket);
  }, 3000)

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
  return MongoClient.connect(uriMongoDB, {}).then((client) =>  {
    return client.db(database).collection(name_coll).find().sort('name', 1).toArray().then((val) => {
      return val;
    })
    .finally(() => {client.close();});
  })
}

function getContributions() {
  return MongoClient.connect(uriMongoDB, {}).then((client) =>  {
    return client.db(database).collection(contribution_coll).find().toArray().then((val) => {
      return val;
    })
    .finally(() => {client.close();});
  })
}

function createOrUpdateName(socketId, name) {
  MongoClient.connect(uriMongoDB, function(err, client) {
    client.db(database).collection(name_coll).findOne({'socket-id': socketId}).then((val) => {
      if (val == null) {
        client.db(database).collection(name_coll).insertOne({'socket-id': socketId, 'name': name});
      } else {
        client.db(database).collection(name_coll).findOneAndUpdate({'socket-id': socketId}, {'$set': {'name': name}});
      }
        }, (err) => {
      console.log(err);
    })
    .finally(() => {
      client.close();
    });
  });
}

function createOrUpdateContribution(socketId, contributionName) {
  MongoClient.connect(uriMongoDB, function(err, client) {
    client.db(database).collection(contribution_coll).findOne({'socket-id': socketId}).then((val) => {
      if (val == null) {
        client.db(database).collection(contribution_coll).insertOne({'socket-id': socketId, 'value': contributionName, 'hasVoted': [], 'votes': {}, 'hasVotedFor': {}});
      } else {
        client.db(database).collection(contribution_coll).findOneAndUpdate({'socket-id': socketId}, {'$set': {'value': contributionName}});
      }
        }, (err) => {
      console.log(err);
    })
    .finally(() => {
      client.close();
    });
  });
}

function addVote(contributionId, votedFor, $expr, socketId) {
  let action = '$push';
  if ($expr < 0) {
    action = '$pull'
  }
  MongoClient.connect(uriMongoDB, function(err, client){
    client.db(database).collection(contribution_coll).findOne({'_id': new ObjectId(contributionId), 'hasVoted': {'$in': [socketId]}}).then((val) => {
      console.log(val);
      if ($expr > 0 && val === null) {
        client.db(database).collection(contribution_coll).findOneAndUpdate({'_id': new ObjectId(contributionId)}, {[`${action}`]: {[`hasVotedFor.${votedFor}`]: socketId, 'hasVoted': socketId}, '$inc': {[`votes.${votedFor}`]: $expr}});
      } else if (val !== null) {
        if (val.hasVotedFor[votedFor]?.includes(socketId)) {
          client.db(database).collection(contribution_coll).findOneAndUpdate({'_id': new ObjectId(contributionId)}, {[`${action}`]: {[`hasVotedFor.${votedFor}`]: socketId, 'hasVoted': socketId }, '$inc': {[`votes.${votedFor}`]: $expr}});
        }
      }
    });
  });
}

server.listen(PORT);