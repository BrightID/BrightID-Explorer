function b64ToUrlSafeB64(s) {
  const alts = { "/": "_", "+": "-", "=": "" };
  return s.replace(/[/+=]/g, (c) => alts[c]);
}

function hash(data) {
  const h = CryptoJS.SHA256(data);
  const b = h.toString(CryptoJS.enc.Base64);
  return b64ToUrlSafeB64(b);
}

async function loadUsers(user, key1, password) {
  $("#logoutFormUserName").text(user.name || "");

  // set the user's name and image
  Object.assign(allNodes[user.id], { name: user.name, img: new Image() });
  let imgData = await localforage.getItem(`explorer_img_${user.id}`);
  if (imgData) {
    allNodes[user.id].img.src = imgData;
    $("#logoutFormImage").attr("src", imgData);
  } else {
    $.get(`/storage/${key1}/${user.id}`, (data) => {
      imgData = CryptoJS.AES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
      localforage.setItem(`explorer_img_${user.id}`, imgData);
      allNodes[user.id].img.src = imgData;
      $("#logoutFormImage").attr("src", imgData);
    });
  }

  $("#searchFieldConnections").append(new Option(`${user.name} (Myself)`, user.id));
  // set the connections' name and image
  for (const conn of user.connections || []) {
    // skip conn.id === user.id to solve bugs related to users connected to themselves!
    if (!allNodes[conn.id] || conn.id === user.id) {
      continue;
    }
    $("#searchFieldConnections").append(new Option(conn.name, conn.id));
    Object.assign(allNodes[conn.id], { name: conn.name, img: new Image() });
    let imgData = await localforage.getItem(`explorer_img_${conn.id}`);
    if (imgData) {
      allNodes[conn.id].img.src = imgData;
    } else {
      $.get(`/storage/${key1}/${conn.id}`, (data) => {
        imgData = CryptoJS.AES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
        localforage.setItem(`explorer_img_${conn.id}`, imgData);
        allNodes[conn.id].img.src = imgData;
      });
    }
  }
}

async function loadGroups(user, key1, password) {
  for (const group of user.groups || []) {
    if (!(group.id in groups)) {
      continue;
    }

    if (group.name) {
      $("#searchFieldGroups").append(new Option(group.name, group.id));
    }

    if (!group.url || !group.aesKey) {
      continue;
    }

    Object.assign(groups[group.id], { name: group.name, img: new Image() });
    let imgData = await localforage.getItem(`explorer_img_${group.id}`);
    if (imgData) {
      groups[group.id].img.src = JSON.parse(imgData)?.photo || "";
    } else {
      const url = "/storage/immutable" + group.url.split("immutable")[1];
      $.get(url, (data) => {
        imgData = CryptoJS.AES.decrypt(data, group.aesKey).toString(CryptoJS.enc.Utf8);
        localforage.setItem(`explorer_img_${group.id}`, imgData);
        groups[group.id].img.src = JSON.parse(imgData)?.photo || "";
      });
    }
  }
}

async function loadInfo() {
  autoLoginDone = true;
  let user;
  let key1;
  const code = $("#code").val();
  const password = $("#password").val();;
  let backupData = await localforage.getItem("explorer_backup_data");
  if (backupData) {
    backupData = JSON.parse(backupData);
    user = { id: backupData.id };
    key1 = await localforage.getItem("explorer_key1");
  } else {
    if (code.indexOf("==") > -1) {
      const brightid = CryptoJS.AES.decrypt(code, password).toString(CryptoJS.enc.Utf8);
      user = { id: brightid };
    } else {
      user = { id: code };
    }
    key1 = hash(user.id + password);
    localforage.setItem("explorer_key1", key1);
    await $.get(`/storage/${key1}/data`)
      .done((data) => {
        backupData = CryptoJS.AES.decrypt(data, password).toString(CryptoJS.enc.Utf8);
        if (!backupData) {
          return alert("No backup found");
        }
      })
      .fail(() => {
        return alert("Invalid explorer code or password or backup not available");
      })
    localforage.setItem("explorer_backup_data", backupData);
    backupData = JSON.parse(backupData);
  }
  $("#loginForm").hide();
  $("#logoutForm").show();
  Object.assign(user, {
    ...backupData.userData,
    connections: backupData.connections,
    groups: backupData.groups,
  });
  await loadGroups(user, key1, password);
  await loadUsers(user, key1, password);
  selectNode(allNodes[user.id], true);
}
