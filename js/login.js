const baseURL = "http://node.brightid.org/profile";
const channels = {};

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

const removeData = (path) => {
  return $.ajax({
    contentType: "application/json; charset=utf-8",
    url: "/profile" + path,
    type: "DELETE",
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
  $("#qrCodeForm").hide();
  $("#loginForm").hide();
  $("#waitingSpinner").hide();
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

  $("#logoutForm").show();
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
  try {
    await $.ajax({
      contentType: "application/json; charset=utf-8",
      url: `/profile/upload/${channelId}`,
      type: "POST",
      data: JSON.stringify(data),
      headers: { "Cache-Control": "no-cache" },
    });
    const qrString = `${baseURL}?aes=${aesKey}&t=3`;
    localforage.setItem(`explorer_last_sync_time`, Date.now());
    return { channelId, aesKey, signingKey: b64PublicKey, qrString };
  } catch (error) {
    $("#qrCodeForm").hide();
    $("#loginForm").show();
    alert("Error:", "Please check your network connection and try again.");
  }
};

const createSyncQR = async (brightID, signingKey, lastSyncTime) => {
  const array = CryptoJS.lib.WordArray.random(16);
  const aesKey = b64ToUrlSafeB64(CryptoJS.enc.Base64.stringify(array));
  const channelId = hash(aesKey);
  const dataObj = { signingKey, lastSyncTime, isPrimaryDevice: false };
  const data = JSON.stringify(dataObj);
  let body = JSON.stringify({ data, uuid: "sig_data" });
  try {
    await $.ajax({
      contentType: "application/json; charset=utf-8",
      url: `/profile/upload/${channelId}`,
      type: "POST",
      data: body,
      headers: { "Cache-Control": "no-cache" },
    });
  } catch (error) {
    $("#qrCodeForm").hide();
    $("#logoutForm").show();
    alert("Error:", "Please check your network connection and try again.");
  }

  const uuid = `sig_completed_${brightID}:${b64ToUrlSafeB64(signingKey)}`;
  body = JSON.stringify({ data: "completed", uuid });
  try {
    await $.ajax({
      contentType: "application/json; charset=utf-8",
      url: `/profile/upload/${channelId}`,
      type: "POST",
      data: body,
      headers: { "Cache-Control": "no-cache" },
    });
    const qrString = `${baseURL}?aes=${aesKey}&t=4`;
    return { channelId, aesKey, signingKey, qrString };
  } catch (error) {
    $("#qrCodeForm").hide();
    $("#logoutForm").show();
    alert("Error:", "Please check your network connection and try again.");
  }
};

const readChannel = (data) => {
  const { channelId, aesKey, signingKey } = data;

  $.ajax({
    contentType: "application/json; charset=utf-8",
    url: `/profile/list/${channelId}`,
    type: "GET",
    headers: { "Cache-Control": "no-cache" },
    success: function (res) {
      for (let dataId of res.profileIds) {
        channels[channelId]["dataIds"].add(dataId);
      }
    },
    failure: function (res) {
      console.log(res);
    }
  });

  if (channels[channelId]["state"] == "waiting") {
    return;
  }

  for (let dataId of channels[channelId]["dataIds"]) {
    if (channels[channelId]["requested"].has(dataId)) {
      continue;
    }

    channels[channelId]["requested"].add(dataId);

    if (!dataId.startsWith("sig_completed_") &&
      !dataId.startsWith("sig_userinfo_") &&
      !dataId.startsWith("connection_") &&
      !dataId.startsWith("group_")) {
      channels[channelId]["received"].add(dataId);
      $("#loginStatus").text(`received ${channels[channelId]["received"].size} of ${channels[channelId]["dataIds"].size}`);
      removeData(`/${channelId}/${dataId}`);
      continue;
    }

    if (dataId == "data") {
      channels[channelId]["received"].add(dataId);
      continue;
    }

    if (dataId.startsWith("sig_completed_")) {
      if (dataId.replace("completed_", "").split(":")[1] != b64ToUrlSafeB64(signingKey)) {
        channels[channelId]["state"] = "uploadCompleted";
      }
      channels[channelId]["received"].add(dataId);
      $("#loginStatus").text(`received ${channels[channelId]["received"].size} of ${channels[channelId]["dataIds"].size}`);
      continue;
    }

    $.ajax({
      contentType: "application/json; charset=utf-8",
      url: `/profile/download/${channelId}/${dataId}`,
      type: "GET",
      headers: { "Cache-Control": "no-cache" },
      success: function (res) {
        channels[channelId]["received"].add(dataId);
        $("#loginStatus").text(`received ${channels[channelId]["received"].size} of ${channels[channelId]["dataIds"].size}`);
        const data = decryptData(res.data, aesKey);
        if (dataId.startsWith("sig_userinfo_")) {
          localforage.setItem(`explorer_owner`, data.id);
          localforage.setItem(`explorer_owner_img_${data.id}`, data.photo);
          localforage.setItem(`explorer_owner_name_${data.id}`, data.name);
        } else if (dataId.startsWith("connection_")) {
          localforage.setItem(`explorer_user_img_${data.id}`, data.photo);
          localforage.setItem(`explorer_user_name_${data.id}`, data.name);
        } else if (dataId.startsWith("group_")) {
          localforage.setItem(`explorer_group_name_${data.id}`, data.name);
        }
        removeData(`/${channelId}/${dataId}`);
      },
      failure: function (res) {
        channels[channelId]["requested"].delete(dataId);
      }
    });
  }
};

const isDownloadCompleted = (channelId) => {
  const dataIds = channels[channelId]["dataIds"];
  const received = channels[channelId]["received"];
  return channels[channelId]["state"] == "uploadCompleted" && dataIds.size === received.size && [...dataIds].every(id => received.has(id));
};

const checkChannelState = (data) => {
  const { channelId } = data;
  if (!(channelId in channels)) {
    channels[channelId] = { "dataIds": new Set(), "requested": new Set(), "received": new Set(), "state": "waiting" };
  }
  if (isDownloadCompleted(channelId)) {
    channels[channelId]["state"] = "finished";
    clearInterval(checkChannelStateIntervalID);
    clearInterval(readChannelIntervalID);
    localforage.setItem("brightid_has_imported", true);
    $("#loginStatus").text("");
    loadPersonalData();
    return;
  }

  if (channels[channelId]["state"] == "waiting" && channels[channelId]["dataIds"].size > 2) {
    channels[channelId]["state"] = "downloading";
    clearInterval(counterIntervalID);
    $("#qrInfo").hide();
    $("#qrcode").hide();
    $("#waitingSpinner").show();
    $("#loginStatus").text(`received ${channels[channelId]["received"].size} of ${channels[channelId]["dataIds"].size}`);
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
  checkChannelStateIntervalID = setInterval(function () { checkChannelState(data); }, 5000);
  readChannelIntervalID = setInterval(function () { readChannel(data); }, 10000);
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
    checkChannelStateIntervalID = setInterval(function () { checkChannelState(data); }, 5000);
    readChannelIntervalID = setInterval(function () { readChannel(data); }, 5000);
  } else {
    localforage.clear().then(() => {
      return importBrightID();
    });
  }
};
