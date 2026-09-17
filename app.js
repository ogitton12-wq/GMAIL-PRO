const CLIENT_ID = "399570878423-0sk3n1k6uq4kllego97dtabgh2rv7dn0.apps.googleusercontent.com";

const SCOPES =
  "https://www.googleapis.com/auth/gmail.readonly";

let accessToken = null;
let currentFolder = "INBOX";

const loginBtn = document.getElementById("loginBtn");
const status = document.getElementById("status");
const messageList = document.getElementById("messageList");

function setStatus(text) {
  status.textContent = text;
}

loginBtn.addEventListener("click", () => {

  if (CLIENT_ID.includes("TON_CLIENT_ID_ICI")) {
    setStatus("Il faut ajouter ton Client ID Google dans app.js.");
    return;
  }

  const client = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,

    callback: (response) => {

      if (response.error) {
        console.error(response);
        setStatus("Connexion Google impossible.");
        return;
      }

      accessToken = response.access_token;
      loginBtn.textContent = "Compte connecté";

      loadMessages();
    }
  });

  client.requestAccessToken({
    prompt: "consent"
  });
});


async function gmailRequest(url, options = {}) {

  const response = await fetch(url, {

    ...options,

    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }

  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}


async function loadMessages() {

  if (!accessToken) return;

  try {

    setStatus("Chargement de tes mails…");

    const data = await gmailRequest(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${currentFolder}&maxResults=30`
    );

    messageList.innerHTML = "";

    if (!data.messages) {
      messageList.innerHTML =
        "<div class='message'>Aucun message.</div>";
      return;
    }

    for (const mail of data.messages) {

      const message = await gmailRequest(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${mail.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
      );

      const headers = {};

      for (const header of message.payload.headers) {
        headers[header.name.toLowerCase()] = header.value;
      }

      const div = document.createElement("div");

      div.className = "message";

      div.innerHTML = `
        <span class="sender">
          ${headers.from || ""}
        </span>

        <span>
          ${headers.subject || "(Sans objet)"}
        </span>

        <span class="date">
          ${headers.date || ""}
        </span>
      `;

      div.onclick = () => openMessage(mail.id);

      messageList.appendChild(div);
    }

    setStatus("Boîte de réception");

  } catch (error) {

    console.error(error);

    setStatus(
      "Impossible de charger Gmail. Vérifie ta connexion."
    );
  }
}


async function openMessage(id) {

  const message = await gmailRequest(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`
  );

  const headers = {};

  for (const header of message.payload.headers) {
    headers[header.name.toLowerCase()] = header.value;
  }

  let body = "";

  if (message.payload.body.data) {
    body = atob(
      message.payload.body.data
        .replace(/-/g, "+")
        .replace(/_/g, "/")
    );
  }

  document.getElementById("readerContent").innerHTML = `
    <h2>${headers.subject || "(Sans objet)"}</h2>

    <p>
      <strong>De :</strong>
      ${headers.from || ""}
    </p>

    <hr>

    <p>${body}</p>
  `;

  document
    .getElementById("reader")
    .classList.remove("hidden");
}


document
  .getElementById("closeReader")
  .addEventListener("click", () => {

    document
      .getElementById("reader")
      .classList.add("hidden");

  });


document
  .getElementById("refreshBtn")
  .addEventListener("click", loadMessages);


document
  .getElementById("composeBtn")
  .addEventListener("click", () => {

    document
      .getElementById("composer")
      .classList.remove("hidden");

  });


document
  .getElementById("closeComposer")
  .addEventListener("click", () => {

    document
      .getElementById("composer")
      .classList.add("hidden");

  });


document.querySelectorAll("aside button[data-folder]")
  .forEach(button => {

    button.addEventListener("click", () => {

      currentFolder = button.dataset.folder;

      loadMessages();

    });

  });
