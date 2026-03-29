const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Routes,
  REST,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID || null; // opzionale: per sync rapida su un solo server
const ADMIN_ROLE_IDS = (process.env.ADMIN_ROLE_IDS || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'pulizie_db.json');
const FIXED_TAX = 25000;

if (!TOKEN || !CLIENT_ID) {
  console.error('Mancano le variabili ambiente DISCORD_BOT_TOKEN o DISCORD_CLIENT_ID.');
  process.exit(1);
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ subjects: {} }, null, 2), 'utf8');
}

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    console.error('Errore lettura DB:', err);
    return { subjects: {} };
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function formatMoney(value) {
  return new Intl.NumberFormat('it-IT').format(Math.round(value));
}

function parseInvoices(raw) {
  const cleaned = raw
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => v.replace(/\./g, '').replace(',', '.'));

  if (!cleaned.length) {
    throw new Error('Inserisci almeno una fattura, separate da virgola.');
  }

  const numbers = cleaned.map(v => {
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) {
      throw new Error(`Valore fattura non valido: ${v}`);
    }
    return n;
  });

  return numbers;
}

function getSanctionForAttempt(attemptNumber, invoicesTotal) {
  if (attemptNumber === 1) {
    const surchargeRate = 0.25;
    const surcharge = invoicesTotal * surchargeRate;
    return {
      status: 'ok',
      title: 'Prima pulizia fedina',
      surchargeRate,
      surcharge,
      fixedTax: FIXED_TAX,
      finalTotal: invoicesTotal + FIXED_TAX + surcharge,
      decisionText: 'Pulizia consentita con pagamento standard di prima istanza.',
    };
  }

  if (attemptNumber === 2) {
    const surchargeRate = 0.50;
    const surcharge = invoicesTotal * surchargeRate;
    return {
      status: 'ok',
      title: 'Seconda pulizia fedina',
      surchargeRate,
      surcharge,
      fixedTax: FIXED_TAX,
      finalTotal: invoicesTotal + FIXED_TAX + surcharge,
      decisionText: 'Pulizia consentita con maggiorazione del 50%.',
    };
  }

  if (attemptNumber === 3) {
    const surchargeRate = 0.75;
    const surcharge = invoicesTotal * surchargeRate;
    return {
      status: 'ok',
      title: 'Terza pulizia fedina',
      surchargeRate,
      surcharge,
      fixedTax: FIXED_TAX,
      finalTotal: invoicesTotal + FIXED_TAX + surcharge,
      decisionText: 'Pulizia consentita con maggiorazione del 75%.',
    };
  }

  if (attemptNumber === 4) {
    const surchargeRate = 1.00;
    const surcharge = invoicesTotal * surchargeRate;
    return {
      status: 'ok',
      title: 'Quarta pulizia fedina',
      surchargeRate,
      surcharge,
      fixedTax: FIXED_TAX,
      finalTotal: invoicesTotal + FIXED_TAX + surcharge,
      decisionText: 'Pulizia consentita con maggiorazione del 100%.',
    };
  }

  const judgeFine = invoicesTotal + FIXED_TAX + (invoicesTotal * 3);
  return {
    status: 'process',
    title: 'Dalla quinta pulizia in poi: processo obbligatorio',
    surchargeRate: 3.00,
    surcharge: invoicesTotal * 3,
    fixedTax: FIXED_TAX,
    finalTotal: judgeFine,
    decisionText: 'Il soggetto va a processo. Il giudice può decidere una multa pari al 300% delle fatture + tassa fissa di 25.000 oppure l’ergastolo.',
  };
}

function getSubjectRecord(db, subjectId, subjectLabel) {
  if (!db.subjects[subjectId]) {
    db.subjects[subjectId] = {
      label: subjectLabel,
      cleans: 0,
      history: [],
    };
  }
  if (subjectLabel) db.subjects[subjectId].label = subjectLabel;
  return db.subjects[subjectId];
}

function isAdmin(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (!ADMIN_ROLE_IDS.length) return false;
  const memberRoleIds = interaction.member?.roles?.cache ? [...interaction.member.roles.cache.keys()] : [];
  return ADMIN_ROLE_IDS.some(roleId => memberRoleIds.includes(roleId));
}

const commands = [
  new SlashCommandBuilder()
    .setName('pulizia_calcola')
    .setDescription('Calcola il costo della pulizia fedina per un soggetto.')
    .addUserOption(option =>
      option.setName('soggetto').setDescription('Utente Discord del soggetto').setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('fatture')
        .setDescription('Lista importi separati da virgola. Esempio: 15000,10000,5000')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('salva')
        .setDescription('Salvare questa pulizia nello storico?')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('nome_custom')
        .setDescription('Nome RP o nominativo alternativo del soggetto')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('pulizia_storico')
    .setDescription('Mostra lo storico delle pulizie di un soggetto.')
    .addUserOption(option =>
      option.setName('soggetto').setDescription('Utente Discord del soggetto').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('pulizia_reset')
    .setDescription('Resetta lo storico di un soggetto. Solo admin o ruoli autorizzati.')
    .addUserOption(option =>
      option.setName('soggetto').setDescription('Utente Discord del soggetto').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('pulizia_regole')
    .setDescription('Mostra le regole di calcolo della pulizia fedina.'),

  new SlashCommandBuilder()
    .setName('pulizia_imposta')
    .setDescription('Imposta manualmente il numero di pulizie già effettuate. Solo admin o ruoli autorizzati.')
    .addUserOption(option =>
      option.setName('soggetto').setDescription('Utente Discord del soggetto').setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('numero').setDescription('Numero di pulizie già avvenute').setRequired(true).setMinValue(0)
    ),
].map(cmd => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log(`Comandi registrati nella guild ${GUILD_ID}.`);
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Comandi registrati globalmente.');
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Bot online come ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'pulizia_regole') {
      const embed = new EmbedBuilder()
        .setTitle('Regole pulizia fedina penale')
        .setDescription('Sistema automatico di calcolo per FiveM')
        .addFields(
          { name: '1ª volta', value: 'Totale fatture + 25.000 + 25% del totale fatture' },
          { name: '2ª volta', value: 'Totale fatture + 25.000 + 50% del totale fatture' },
          { name: '3ª volta', value: 'Totale fatture + 25.000 + 75% del totale fatture' },
          { name: '4ª volta', value: 'Totale fatture + 25.000 + 100% del totale fatture' },
          { name: '5ª volta in poi', value: 'Processo obbligatorio: il giudice decide tra multa al 300% delle fatture + 25.000 oppure ergastolo' },
        )
        .setFooter({ text: 'Tassa fissa: 25.000' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: false });
      return;
    }

    if (interaction.commandName === 'pulizia_calcola') {
      const subject = interaction.options.getUser('soggetto', true);
      const invoicesRaw = interaction.options.getString('fatture', true);
      const shouldSave = interaction.options.getBoolean('salva', true);
      const customName = interaction.options.getString('nome_custom') || subject.displayName || subject.username;

      const invoices = parseInvoices(invoicesRaw);
      const invoicesTotal = invoices.reduce((acc, val) => acc + val, 0);

      const db = loadDb();
      const record = getSubjectRecord(db, subject.id, customName);
      const attemptNumber = record.cleans + 1;
      const sanction = getSanctionForAttempt(attemptNumber, invoicesTotal);

      if (shouldSave) {
        record.cleans += 1;
        record.history.unshift({
          cleaned_at: new Date().toISOString(),
          attempt: attemptNumber,
          invoices,
          invoices_total: invoicesTotal,
          result: sanction,
          by_user_id: interaction.user.id,
          by_user_tag: interaction.user.tag,
        });
        saveDb(db);
      }

      const embed = new EmbedBuilder()
        .setTitle(sanction.title)
        .setDescription(`Calcolo per **${customName}** (${subject})`)
        .addFields(
          { name: 'Numero pulizia attuale', value: `${attemptNumber}ª`, inline: true },
          { name: 'Totale fatture', value: `${formatMoney(invoicesTotal)}`, inline: true },
          { name: 'Tassa fissa', value: `${formatMoney(sanction.fixedTax)}`, inline: true },
          { name: 'Maggiorazione', value: `${Math.round(sanction.surchargeRate * 100)}%`, inline: true },
          { name: 'Importo maggiorazione', value: `${formatMoney(sanction.surcharge)}`, inline: true },
          { name: 'Totale finale', value: `${formatMoney(sanction.finalTotal)}`, inline: true },
          { name: 'Fatture inserite', value: invoices.map(v => `• ${formatMoney(v)}`).join('\n').slice(0, 1024) || 'Nessuna', inline: false },
          { name: 'Esito', value: sanction.decisionText, inline: false },
          { name: 'Storico aggiornato', value: shouldSave ? 'Sì' : 'No (solo simulazione)', inline: true },
        )
        .setFooter({ text: `Operazione eseguita da ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === 'pulizia_storico') {
      const subject = interaction.options.getUser('soggetto', true);
      const db = loadDb();
      const record = db.subjects[subject.id];

      if (!record || !record.history.length) {
        await interaction.reply({
          content: `Nessuno storico trovato per ${subject}.`,
          ephemeral: true,
        });
        return;
      }

      const lines = record.history.slice(0, 10).map(entry => {
        const date = new Date(entry.cleaned_at).toLocaleString('it-IT');
        return `**${entry.attempt}ª** • ${date}\nTotale fatture: ${formatMoney(entry.invoices_total)} | Totale finale: ${formatMoney(entry.result.finalTotal)}\nOperatore: ${entry.by_user_tag}`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`Storico pulizie: ${record.label || subject.username}`)
        .setDescription(lines.join('\n\n'))
        .addFields({ name: 'Totale pulizie registrate', value: String(record.cleans), inline: true })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (interaction.commandName === 'pulizia_reset') {
      if (!isAdmin(interaction)) {
        await interaction.reply({ content: 'Non hai i permessi per usare questo comando.', ephemeral: true });
        return;
      }

      const subject = interaction.options.getUser('soggetto', true);
      const db = loadDb();
      delete db.subjects[subject.id];
      saveDb(db);

      await interaction.reply({ content: `Storico resettato per ${subject}.`, ephemeral: true });
      return;
    }

    if (interaction.commandName === 'pulizia_imposta') {
      if (!isAdmin(interaction)) {
        await interaction.reply({ content: 'Non hai i permessi per usare questo comando.', ephemeral: true });
        return;
      }

      const subject = interaction.options.getUser('soggetto', true);
      const number = interaction.options.getInteger('numero', true);
      const db = loadDb();
      const record = getSubjectRecord(db, subject.id, subject.username);
      record.cleans = number;
      saveDb(db);

      await interaction.reply({ content: `Numero pulizie di ${subject} impostato a ${number}.`, ephemeral: true });
      return;
    }
  } catch (err) {
    console.error('Errore comando:', err);
    const message = err?.message || 'Errore interno durante l’esecuzione del comando.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  }
});

(async () => {
  try {
    await registerCommands();
    await client.login(TOKEN);
  } catch (err) {
    console.error('Avvio fallito:', err);
    process.exit(1);
  }
})();
