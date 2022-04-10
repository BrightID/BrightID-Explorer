const baseURL = "http://node.brightid.org/profile";

const sleep = ms => new Promise(r => setTimeout(r, ms));

const CountdownTimer = () => {
  $("#loginStatus").text("15:00");
  const countDownDate = new Date().getTime() + 15 * 60 * 1000;
  counterIntervalID = setInterval(() => {
    let now = new Date().getTime();
    let distance = Math.floor((countDownDate - now) / 1000);
    let minutes = Math.floor(distance / 60);
    let seconds = Math.floor(distance) % 60;
    let timerText = `${minutes}:${seconds}`;
    $("#loginStatus").text(timerText);
    if (distance < 0) {
      clearInterval(counterIntervalID);
      $("#loginStatus").text("EXPIRED");
      if (autoLoginDone) {
        $("#logoutForm").show();
      } else {
        $("#loginForm").show();
      }
      $("#qrCodeForm").hide();
    }
  }, 1000);
};

const apiCall = (path, type, data) => {
  return $.ajax({
    contentType: "application/json; charset=utf-8",
    url: "/profile" + path,
    type,
    data,
    headers: { "Cache-Control": "no-cache" },
  });
};

const decryptData = (data, aesKey) => {
  const decrypted = CryptoJS.AES.decrypt(data, aesKey).toString(
    CryptoJS.enc.Utf8
  );
  return JSON.parse(decrypted);
};

const b64ToUrlSafeB64 = (s) => {
  const alts = {
    "/": "_",
    "+": "-",
    "=": "",
  };
  return s.replace(/[/+=]/g, (c) => alts[c]);
};

const hash = (data) => {
  const h = CryptoJS.SHA256(data);
  const b = h.toString(CryptoJS.enc.Base64);
  return b64ToUrlSafeB64(b);
};

const loadPersonalData = async () => {
  autoLoginDone = true;
  const owner = await localforage.getItem("explorer_owner");
  const ownerName = await localforage.getItem(`explorer_owner_name_${owner}`) || "Unknow";
  const ownerImg = await localforage.getItem(`explorer_owner_img_${owner}`);
  Object.assign(allNodes[owner], { name: ownerName, img: new Image() });
  if (ownerImg) {
    allNodes[owner].img.src = ownerImg;
    $("#logoutFormImage").attr("src", ownerImg);
  }
  $("#searchFieldConnections").append(new Option(`${ownerName} (Myself)`, owner));
  $("#logoutFormUserName").text(ownerName);
  const user = allNodes[owner];

  for (const groupId of user.groups || []) {
    if (!(groupId in groups)) {
      continue;
    }
    const groupName = await localforage.getItem(`explorer_group_name_${groupId}`) || "Unknow";

    if (groupName) {
      $("#searchFieldGroups").append(new Option(groupName, groupId));
      groups[groupId]["name"] = groupName;
    }
  }

  for (const neighbor of Object.keys(user.neighbors) || []) {
    const neighborName = await localforage.getItem(`explorer_user_name_${neighbor}`) || "Unknow";
    const neighborImg = await localforage.getItem(`explorer_user_img_${neighbor}`);

    $("#searchFieldConnections").append(new Option(neighborName, neighbor));
    Object.assign(allNodes[neighbor], { name: neighborName, img: new Image() });
    if (neighborImg) {
      allNodes[neighbor].img.src = neighborImg;
    }
  }

  $("#qrCodeForm").hide();
  $("#loginForm").hide();
  $("#logoutForm").show();
  $("#waitingSpinner").hide();
  selectNode(user, true);
};

const createImportQR = async () => {
  const array = CryptoJS.lib.WordArray.random(16);
  const aesKey = b64ToUrlSafeB64(CryptoJS.enc.Base64.stringify(array));
  console.log(`aesKey: ${aesKey}`);
  const channelId = hash(aesKey);
  console.log(`channelId: ${channelId}`);
  const { publicKey, secretKey } = await nacl.sign.keyPair();
  const b64PublicKey = base64js.fromByteArray(publicKey);
  localforage.setItem(`explorer_signing_key`, b64PublicKey);
  console.log(`b64PublicKey: ${b64PublicKey}`);
  const b64SecretKey = base64js.fromByteArray(secretKey);
  console.log(`b64SecretKey: ${b64SecretKey}`);
  localforage.setItem(`explorer_secret_key`, b64PublicKey);
  const data = {
    "data": JSON.stringify({
      signingKey: b64PublicKey,
      timestamp: Date.now(),
    }),
    "uuid": "data"
  };
  const res = await apiCall(`/upload/${channelId}`, "POST", JSON.stringify(data));
  qrString = `${baseURL}?aes=${aesKey}&t=3`;
  localforage.setItem(`explorer_last_sync_time`, Date.now());
  return { channelId, aesKey, signingKey: b64PublicKey, qrString };
};

const createSyncQR = async (brightID, signingKey, lastSyncTime) => {
  const array = CryptoJS.lib.WordArray.random(16);
  const aesKey = b64ToUrlSafeB64(CryptoJS.enc.Base64.stringify(array));
  const channelId = hash(aesKey);
  const dataObj = { signingKey, lastSyncTime, isPrimaryDevice: false };
  const data = JSON.stringify(dataObj);
  let body = JSON.stringify({ data, uuid: "sig_data" });
  const res = await apiCall(`/upload/${channelId}`, "POST", body);
  const uuid = `sig_completed_${brightID}:${b64ToUrlSafeB64(signingKey)}`;
  body = JSON.stringify({ data: "completed", uuid });
  const res2 = await apiCall(`/upload/${channelId}`, "POST", body);
  qrString = `${baseURL}?aes=${aesKey}&t=4`;
  return { channelId, aesKey, signingKey, qrString };
};

let channels = {};
const readChannel = async (data) => {
  let completed = false;
  const { channelId, aesKey, signingKey } = data;
  let res = await apiCall(`/list/${channelId}`, "GET");
  const dataIds = res.profileIds;
  if (dataIds.length > 2) {
    $("#qrcode").hide();
    clearInterval(counterIntervalID);
    $("#waitingSpinner").show();
    if (!(channelId in channels)) {
      channels[channelId] = { "all": 0, "received": 0 }
    }
    channels[channelId]["all"] = dataIds.length + channels[channelId]["received"];
    $("#loginStatus").text("");
  }
  const uploader = (id) => id.replace("completed_", "").split(":")[1];
  for (let i = 0; i < dataIds.length; i++) {
    const dataId = dataIds[i];
    if (dataId.startsWith("sig_completed_") && uploader(dataId) != b64ToUrlSafeB64(signingKey)) {
      completed = true;
    } else if (dataId.startsWith("sig_userinfo_")) {
      res = await apiCall(`/download/${channelId}/${dataId}`, "GET");
      const encrypted = res.data;
      const data = decryptData(encrypted, aesKey);
      localforage.setItem(`explorer_owner`, data.id);
      localforage.setItem(`explorer_owner_img_${data.id}`, data.photo);
      localforage.setItem(`explorer_owner_name_${data.id}`, data.name);
      Object.assign(allNodes[data.id], { name: data.name, img: new Image() });
      $("#logoutFormUserName").text(data.name);
      allNodes[data.id].img.src = data.photo;
      $("#logoutFormImage").attr("src", data.photo);
    } else if (dataId.startsWith("connection_")) {
      res = await apiCall(`/download/${channelId}/${dataId}`, "GET");
      const encrypted = res.data;
      const data = decryptData(encrypted, aesKey);
      localforage.setItem(`explorer_user_img_${data.id}`, data.photo);
      localforage.setItem(`explorer_user_name_${data.id}`, data.name);
      Object.assign(allNodes[data.id], { name: data.name, img: new Image() });
      allNodes[data.id].img.src = data.photo;
    } else if (dataId.startsWith("group_")) {
      res = await apiCall(`/download/${channelId}/${dataId}`, "GET");
      const encrypted = res.data;
      const data = decryptData(encrypted, aesKey);
      localforage.setItem(`explorer_group_name_${data.id}`, data.name);
    }
    if (!(["sig_data", "data"].includes(dataId)) && !(dataId.startsWith("sig_completed_"))) {
      await apiCall(`/${channelId}/${dataId}`, "DELETE");
      channels[channelId]["received"] += 1;
    }
    if (i != 0 && i % 10 == 0) {
      let res = await apiCall(`/list/${channelId}`, "GET");
      channels[channelId]["all"] = res.profileIds.length + channels[channelId]["received"];
    }
    if (channelId in channels) {
      $("#loginStatus").text(`received ${channels[channelId]["received"]} of ${channels[channelId]["all"]}`);
    }
  }
  if (completed) {
    localforage.setItem("brightid_has_imported", true);
    $("#loginStatus").text("");
    loadPersonalData();
  } else {
    await sleep(3000);
    await readChannel(data);
  }
};

const importBrightID = async () => {
  $("#qrCodeForm").show();
  $("#loginForm").hide();
  $("#logoutForm").hide();
  const data = await createImportQR();
  $("#qrcode").html("");
  new QRCode(document.getElementById("qrcode"), {
    text: data.qrString,
    width: 250,
    height: 250,
  });
  $("#qrcode").show();
  CountdownTimer();
  await readChannel(data);
};

const syncBrightID = async () => {
  $("#qrCodeForm").show();
  $("#logoutForm").hide();
  const brightID = await localforage.getItem("explorer_owner") || "";
  const signingKey = await localforage.getItem("explorer_signing_key") || "";
  const lastSyncTime = await localforage.getItem("explorer_last_sync_time");
  if (brightID && signingKey && lastSyncTime) {
    const data = await createSyncQR(brightID, signingKey, lastSyncTime);
    $("#qrcode").html("");
    new QRCode(document.getElementById("qrcode"), {
      text: data.qrString,
      width: 250,
      height: 250,
    });
  $("#qrcode").show();
    CountdownTimer();
    await readChannel(data);
  } else {
    localforage.clear().then(() => {
      return importBrightID();
    });
  }
};
