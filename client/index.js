const socketUrl = 'http://localhost:9000';

let socket;
let nameInput;
let listnames;
let serverNames = {};
let serverContributions = {};
let names = [];
let contributions = [];

const connect = () => {
  let error = null;

  socket = io(socketUrl, {
    autoConnect: false,
  });

  socket.on('connect', () => {
    console.log('Connected');
  });

  socket.on('unauthorized', (reason) => {
    console.log('Unauthorized:', reason);

    error = reason.message;

    socket.disconnect();
  });

  socket.on('names', (msg) => {
    if (isDifferentFromKnown(serverNames, msg)) {
      serverNames = msg;
      names = getListOfNames(msg);
      recreateListOfNames(names);
      recreateListOfContributions(names, contributions, socket.id);
    }
  })

  socket.on('contributions', (msg) => {
    if (isDifferentFromKnown(serverContributions, msg)) {
      serverContributions = msg;
      contributions = getListOfContributions(msg);
      recreateListOfContributions(names, contributions, socket.id);
    }
  })

  socket.on('disconnect', (reason) => {
    console.log(`Disconnected: ${error || reason}`);
    error = null;
  });

  socket.open();
};

const disconnect = () => {
  socket.disconnect();
}

const addName = () => {
  const nameInput = document.getElementById('name');
  socket.emit('name-add', nameInput.value);
};

const addContrib = () => {
  const contribInput = document.getElementById('contribution');
  socket.emit('contrib-add', contribInput.value);
};

const addVote = (contrib, name) => {
    socket.emit('vote-add', {contrib: contrib, name: name});
}

const removeVote = (contrib, name) => {
  socket.emit('vote-remove', {contrib: contrib, name: name});
}

const getListOfNames = (msg) => {
    names = [];
    for (const val in msg){
      names.push(msg[val].name);
    }
    return names;
}

const recreateListOfNames = (names) => {
  const listnames = document.getElementById('list-names');
  while (listnames.firstChild) {
    listnames.firstChild.remove();
  }
  for (const i in names) {
    let li = document.createElement('li');
    let nameText = document.createTextNode(names[i]);
    li.append(nameText);
    listnames.appendChild(li);
  }
}

const getListOfContributions = (msg) => {
  contributions = [];
  for (const val in msg) {
    contributions.push(msg[val]);
  }
  return contributions;
}

const recreateListOfContributions = (names, contributions, socketId) => {
  const listContributions = document.getElementById('contributions');
  while (listContributions.firstChild) {
    listContributions.firstChild.remove();
  }
  for (const val in contributions) {
    let votehtml = '';
    let hasVoted = false;
    if (contributions[val].hasVoted.includes(socketId)) {
      hasVoted = true;
    }
    for(let i in names) {
      let name = names[i];
      let hasVotedFor = false;
      if (hasVoted && contributions[val].hasVotedFor[name]?.includes(socketId)) {
        hasVotedFor = true;
      }
      if (hasVoted) {
        if (hasVotedFor) {
          votehtml += `${name}: ${contributions[val].votes[name] || 0} <button type="submit" onclick="removeVote('${contributions[val].value}', '${name}')">-</button>`
        } else {
          votehtml += `${name}: ${contributions[val].votes[name] || 0}`;
        }
      } else {
        votehtml += `${name}: ${contributions[val].votes[name] || 0} <button type="submit" onclick="addVote('${contributions[val].value}', '${name}')">+</button>`;
      }
    }
    let html = `<li>
      ${contributions[val].value}
      ${votehtml}
      </li>`
    listContributions.innerHTML = html;
  }
}

const isDifferentFromKnown = (a, b) => {
  return JSON.stringify(a) !== JSON.stringify(b);
}

document.addEventListener('DOMContentLoaded', () => {  
  connect();
});

//fullstack angular laravel
//laravel + connaissance front