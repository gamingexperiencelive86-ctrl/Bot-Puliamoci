# Guida completa Windows + online

Questa versione è in **JavaScript / Node.js** ed è pensata per Windows.

## 1. Cosa fa il bot

Comandi disponibili:
- `/pulizia_calcola`
- `/pulizia_storico`
- `/pulizia_reset`
- `/pulizia_regole`
- `/pulizia_imposta`

Regole applicate:
- **1ª volta**: totale fatture + 25.000 + 25%
- **2ª volta**: totale fatture + 25.000 + 50%
- **3ª volta**: totale fatture + 25.000 + 75%
- **4ª volta**: totale fatture + 25.000 + 100%
- **5ª volta in poi**: processo, con nota per il giudice: 300% + 25.000 oppure ergastolo

I dati vengono salvati in `data/pulizie_db.json`.

---

## 2. Requisiti

Sul PC Windows ti serve:
- Node.js già installato
- un server Discord dove invitare il bot
- un account Discord

Per controllare Node apri **Prompt dei comandi** e scrivi:

```bat
node -v
npm -v
```

Se compaiono le versioni, sei pronto.

---

## 3. Crea il bot su Discord

### Passaggi
1. Vai su **Discord Developer Portal**.
2. Clicca **New Application**.
3. Dai un nome al bot, per esempio `Fedina FiveM`.
4. Apri la sezione **Bot**.
5. Clicca **Add Bot**.
6. Copia il **token**.
7. Copia anche la **Application ID** dalla pagina General Information.

Tieni da parte:
- `DISCORD_BOT_TOKEN`
- `DISCORD_CLIENT_ID`

---

## 4. Invita il bot nel server

Nel Developer Portal:
1. Vai su **OAuth2** > **URL Generator**
2. Seleziona:
   - `bot`
   - `applications.commands`
3. Nei permessi seleziona almeno:
   - View Channels
   - Send Messages
   - Embed Links
   - Use Application Commands
   - Read Message History
4. Apri il link generato e invita il bot nel tuo server.

---

## 5. Prepara i file del progetto

Metti tutto in una cartella, per esempio:

```text
C:\bot-fedina-fivem-node
```

Dentro troverai:
- `bot.js`
- `package.json`
- `.env.example`
- `README_COMPLETA_WINDOWS_NODEJS.md`

---

## 6. Installa le dipendenze

Apri il Prompt dei comandi nella cartella del bot e scrivi:

```bat
npm install
```

Questo installerà `discord.js`.

---

## 7. Imposta le variabili ambiente su Windows

### Metodo veloce
Nel Prompt dei comandi scrivi:

```bat
set DISCORD_BOT_TOKEN=IL_TUO_TOKEN
set DISCORD_CLIENT_ID=LA_TUA_APPLICATION_ID
set DISCORD_GUILD_ID=ID_DEL_SERVER
node bot.js
```

`DISCORD_GUILD_ID` è facoltativo ma consigliato in fase test, perché registra i comandi più velocemente sul tuo server.

### ADMIN_ROLE_IDS
Se vuoi che solo certi ruoli possano resettare o impostare lo storico:

```bat
set ADMIN_ROLE_IDS=123456789012345678,987654321098765432
```

Se non la imposti, potranno usare quei comandi solo gli amministratori Discord.

---

## 8. Come prendere l'ID del server e dei ruoli

### Attiva la modalità sviluppatore su Discord
1. Discord > Impostazioni utente
2. Avanzate
3. Attiva **Modalità sviluppatore**

### Copiare ID server
- click destro sul server
- **Copia ID**

### Copiare ID ruolo
- Impostazioni server > Ruoli
- click destro sul ruolo
- **Copia ID**

---

## 9. Primo avvio

Se hai impostato tutto bene, lancia:

```bat
node bot.js
```

Se è tutto corretto vedrai un messaggio simile a:

```text
Comandi registrati nella guild ...
Bot online come NomeBot#1234
```

---

## 10. Come usare i comandi

### Calcolo nuova pulizia
```text
/pulizia_calcola soggetto:@Mario fatture:15000,10000,5000 salva:true
```

### Simulazione senza salvare
```text
/pulizia_calcola soggetto:@Mario fatture:15000,10000 salva:false
```

### Storico
```text
/pulizia_storico soggetto:@Mario
```

### Reset storico
```text
/pulizia_reset soggetto:@Mario
```

### Impostare manualmente il numero di pulizie già fatte
```text
/pulizia_imposta soggetto:@Mario numero:3
```

### Regole
```text
/pulizia_regole
```

---

## 11. Come funziona lo storico

Il bot salva per ogni soggetto:
- numero totale di pulizie effettuate
- elenco delle operazioni
- operatore che ha eseguito il calcolo
- totale fatture
- totale finale
- data e ora

Il file è:

```text
data\pulizie_db.json
```

Fai una copia di backup ogni tanto.

---

## 12. Come tenerlo acceso su Windows

### Metodo semplice
Lasci aperto il Prompt dei comandi con:

```bat
node bot.js
```

### Metodo migliore
Usa **Utilità di pianificazione** di Windows o un servizio come **NSSM**.

### Con NSSM
1. Scarica NSSM
2. Installa il servizio indicando:
   - Path: percorso di `node.exe`
   - Startup directory: cartella del bot
   - Arguments: `bot.js`
3. Nelle variabili ambiente del servizio inserisci:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID`
   - `ADMIN_ROLE_IDS` opzionale
4. Avvia il servizio

In questo modo il bot parte anche al riavvio del PC.

---

## 13. Metterlo online 24/7

Hai due strade buone:
- Railway
- Render

### File già pronti
Per l'hosting ti bastano questi file:
- `bot.js`
- `package.json`

---

## 14. Metterlo online con Railway

### Passaggi
1. Crea un account GitHub
2. Crea un repository, ad esempio `bot-fedina-fivem-node`
3. Carica dentro il progetto
4. Crea un account Railway
5. Crea un nuovo progetto da GitHub
6. Seleziona il repository
7. In **Variables** aggiungi:

```text
DISCORD_BOT_TOKEN=IL_TUO_TOKEN
DISCORD_CLIENT_ID=LA_TUA_APPLICATION_ID
DISCORD_GUILD_ID=ID_DEL_SERVER
ADMIN_ROLE_IDS=123456789012345678,987654321098765432
```

8. Come start command usa:

```text
node bot.js
```

### Nota importante
Questo bot salva i dati in un file JSON locale. Su alcuni hosting i file locali possono non essere affidabili nel lungo periodo. Per un progetto serio, in futuro conviene passare a MySQL o PostgreSQL.

---

## 15. Metterlo online con Render

1. Crea repository GitHub
2. Carica il progetto
3. Su Render crea un nuovo servizio
4. Collega il repository
5. Build command:

```text
npm install
```

6. Start command:

```text
node bot.js
```

7. Aggiungi le stesse variabili ambiente viste sopra

---

## 16. Problemi comuni

### `node non è riconosciuto`
Node.js non è installato bene o non è nel PATH.

### `Used disallowed intents`
Di solito questo bot non richiede intent speciali, perché usa solo slash commands e Guilds. Se in futuro aggiungi lettura messaggi, dovrai attivare gli intent dal Developer Portal.

### Non compaiono i comandi
Controlla:
- token giusto
- client id giusto
- bot invitato con `applications.commands`
- server corretto in `DISCORD_GUILD_ID`

### Hai cambiato i comandi ma su Discord non si aggiornano
Riavvia il bot. Se usi `DISCORD_GUILD_ID`, di solito l'aggiornamento è veloce.

### Il database si resetta
Hai perso o sovrascritto `data/pulizie_db.json`. Fai backup.

---

## 17. Struttura del progetto

```text
bot-fedina-fivem-node/
│
├── bot.js
├── package.json
├── .env.example
├── data/
│   └── pulizie_db.json
└── README_COMPLETA_WINDOWS_NODEJS.md
```

---

## 18. Consigli per usarlo bene nello staff

Ti conviene creare un canale dedicato tipo:
- `#fedina-penale`
- `#log-fedina`

E usare ruoli tipo:
- Questura
- Magistratura
- Staff Legale

---

## 19. Come migliorarlo dopo

Versione successiva consigliata:
- log automatici in un canale staff
- pulsanti conferma
- supporto ID cittadino FiveM invece del tag Discord
- esportazione storico
- pannello admin
- database MySQL
- webhook log

