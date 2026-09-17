```javascript
const CLIENT_ID = "399570878423-0sk3n1k6uq4kllego97dtabgh2rv7dn0.apps.googleusercontent.com";

const SCOPES =
  "https://www.googleapis.com/auth/gmail.modify " +
  "https://www.googleapis.com/auth/gmail.send";

let accessToken = null;
let currentFolder = "INBOX";

const loginBtn = document.getElementById("loginBtn");
const status = document.getElementById("status");
const messageList = document.getElementById("messageList");

function setStatus(text) {
  status.textContent = text;
}

// =========================
// CONNEXION GOOGLE
// =========================

loginBtn.addEventListener("click", () => {
  if (CLIENT_ID.includes("TON_CLIENT_ID_ICI")) {
    setStatus("Ajoute ton Client ID Google dans app.js.");
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
      loginBtn.disabled = true;

      loadMessages();
    }
  });

  client.requestAccessToken({
    prompt: "consent"
  });
});

// =========================
// REQUÊTES GMAIL
// =========================

async function gmailRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,

    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

// =========================
// CHARGER LES MAILS
// =========================

async function loadMessages() {
  if (!accessToken) {
    setStatus("Connecte ton compte Google.");
    return;
  }

  try {
    setStatus("Chargement des mails…");
    messageList.innerHTML = "";

    const data = await gmailRequest(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${currentFolder}&maxResults=30`
    );

    if (!data.messages || data.messages.length === 0) {
      messageList.innerHTML =
        "<div class='message'>Aucun message.</div>";

      setStatus("Aucun message");
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
          ${escapeHtml(headers.from || "")}
        </span>

        <span>
          ${escapeHtml(headers.subject || "(Sans objet)")}
        </span>

        <span class="date">
          ${escapeHtml(headers.date || "")}
        </span>

        <button class="delete-btn" title="Supprimer">
          🗑️
        </button>
      `;

      // Ouvrir le mail
      div.addEventListener("click", (event) => {
        if (!event.target.classList.contains("delete-btn")) {
          openMessage(mail.id);
        }
      });

      // Supprimer
      const deleteButton = div.querySelector(".delete-btn");

      deleteButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        await deleteMessage(mail.id);
      });

      messageList.appendChild(div);
    }

    setStatus("Boîte chargée");

  } catch (error) {
    console.error(error);
    setStatus("Impossible de charger Gmail.");
  }
}

// =========================
// OUVRIR UN MAIL
// =========================

async function openMessage(id) {
  try {
    setStatus("Ouverture du mail…");

    const message = await gmailRequest(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`
    );

    const headers = {};

    for (const header of message.payload.headers) {
      headers[header.name.toLowerCase()] = header.value;
    }

    const body = getMessageBody(message);

    document.getElementById("readerContent").innerHTML = `
      <h2>
        ${escapeHtml(headers.subject || "(Sans objet)")}
      </h2>

      <p>
        <strong>De :</strong>
        ${escapeHtml(headers.from || "")}
      </p>

      <p>
        <strong>Date :</strong>
        ${escapeHtml(headers.date || "")}
      </p>

      <hr>

      <div class="mail-body">
        ${body}
      </div>
    `;

    document
      .getElementById("reader")
      .classList.remove("hidden");

    setStatus("Mail ouvert");

  } catch (error) {
    console.error(error);
    setStatus("Impossible d'ouvrir ce mail.");
  }
}

// =========================
// EXTRAIRE LE CONTENU DU MAIL
// =========================

function getMessageBody(message) {
  let bodyData = null;

  function searchParts(part) {
    if (!part) return;

    if (
      part.mimeType === "text/html" &&
      part.body &&
      part.body.data
    ) {
      bodyData = part.body.data;
      return;
    }

    if (
      part.mimeType === "text/plain" &&
      part.body &&
      part.body.data &&
      !bodyData
    ) {
      bodyData = part.body.data;
    }

    if (part.parts) {
      for (const child of part.parts) {
        searchParts(child);
      }
    }
  }

  searchParts(message.payload);

  if (!bodyData) {
    return "<p>Contenu du mail indisponible.</p>";
  }

  try {
    const decoded = decodeBase64(bodyData);

    // Si c'est du HTML, on l'affiche dans un conteneur.
    // Pour éviter d'exécuter des scripts externes, on retire les balises script.
    return decoded
      .replace(/<script[\s\S]*?<\/script>/gi, "");
  } catch {
    return "<p>Impossible de lire le contenu.</p>";
  }
}

function decodeBase64(data) {
  const base64 = data
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const binary = atob(base64);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder("utf-8").decode(bytes);
}

// =========================
// SUPPRIMER UN MAIL
// =========================

async function deleteMessage(id) {
  try {
    await gmailRequest(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`,
      {
        method: "POST"
      }
    );

    setStatus("Mail déplacé dans la corbeille.");

    loadMessages();

  } catch (error) {
    console.error(error);
    setStatus("Impossible de supprimer le mail.");
  }
}

// =========================
// FERMER UN MAIL
// =========================

document
  .getElementById("closeReader")
  .addEventListener("click", () => {
    document
      .getElementById("reader")
      .classList.add("hidden");
  });

// =========================
// ACTUALISER
// =========================

document
  .getElementById("refreshBtn")
  .addEventListener("click", () => {
    loadMessages();
  });

// =========================
// COMPOSER
// =========================

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

// =========================
// ENVOYER UN MAIL
// =========================

const sendBtn = document.getElementById("sendBtn");

if (sendBtn) {
  sendBtn.addEventListener("click", sendEmail);
}

async function sendEmail() {
  const to = document.getElementById("to")?.value.trim();
  const subject = document.getElementById("subject")?.va
```
