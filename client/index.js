const socketUrl = `https://ws-voting-machine.herokuapp.com/`;

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
  if (nameInput.value.trim().length > 0 ){
    socket.emit('name-add', nameInput.value);
  }
  nameInput.value = null;
};

const addContrib = () => {
  const contribInput = document.getElementById('contribution');
  if (contribInput.value.trim().length > 0 ){
    socket.emit('contrib-add', contribInput.value);
  }
  contribInput.value = null;
};

const addVote = (contrib, socketId, name) => {
    socket.emit('vote-add', {contrib: contrib, name: name, socketId: socketId});
}

const removeVote = (contrib, socketId, name) => {
  socket.emit('vote-remove', {contrib: contrib, name: name, socketId: socketId});
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
  let html = '';
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
          votehtml += `<p>${name}: ${contributions[val].votes[name] || 0} <button type="submit" aria-label="Supprimer mon vote pour ${name}" onclick="removeVote('${contributions[val].value}', '${contributions[val]['socket-id']}', '${name}')" onkeydown="removeVote('${contributions[val].value}', '${contributions[val]['socket-id']}', '${name}')">-</button></p><br/>`;
        } else {
          votehtml += `<p>${name}: ${contributions[val].votes[name] || 0}<p><br/>`;
        }
      } else {
        if (contributions[val]['socket-id'] === socketId) {
          votehtml += `<p>${name}: ${contributions[val].votes[name] || 0}<p><br/>`;
        } else {
          votehtml += `<p>${name}: ${contributions[val].votes[name] || 0} <button type="submit" aria-label="Voter pour ${name}" onclick="addVote('${contributions[val].value}', '${contributions[val]['socket-id']}', '${name}')" onkeydown="addVote('${contributions[val].value}', '${contributions[val]['socket-id']}', '${name}')">+</button></p><br/>`;
        }
      }
    }
    let liste = `<li>
      ${contributions[val].value}<br/>
      ${votehtml}
      </li>`;
    html += liste;
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