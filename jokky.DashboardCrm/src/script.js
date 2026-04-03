
// CONSTANTS & SETTINGS

const SETTINGS = {
  relationshipTag: "contact",
  dataFolder: "@CRM",
}

// Legge le impostazioni: prima da DataStore.settings (UI plugin), poi da DataStore.preference (legacy), poi default
function getSetting(key, defaultValue) {
  const s = DataStore.settings
  if (s && s[key] !== undefined && s[key] !== null && String(s[key]) !== "") return s[key]
  const p = DataStore.preference(key)
  if (p !== undefined && p !== null && String(p) !== "") return p
  return defaultValue
}

const INTERACTION_TYPES = {
  call: "☎️ Call",
  email: "📧 Email",
  meeting: "🤝 Meeting",
  text: "💬 Text",
  social: "📱 Social",
  other: "📝 Other",
}

const REMINDER_FREQUENCIES = {
  day: "Every day",
  week: "Every week",
  twoWeeks: "Every 2 weeks",
  threeWeeks: "Every 3 weeks",
  month: "Every month",
  twoMonths: "Every 2 months",
  quarter: "Every 3 months",
  sixMonths: "Every 6 months",
  year: "Every year",
}

const WINDOW_ID = "np.crm:dashboard"

// MAIN COMMANDS

async function addRelationship() {
  try {
    const name = await CommandBar.showInput(
      "Contact Name",
      "Create Contact '%@'"
    )
    if (!name) return

    const category = await CommandBar.showOptions(
      ["Client", "Colleague", "Friend", "Family", "Business", "Other"],
      "Select category for " + name
    )

    const reminderFreq = await CommandBar.showOptions(
      Object.values(REMINDER_FREQUENCIES),
      "How often should you connect?"
    )

    const reminderFreqKey = Object.keys(REMINDER_FREQUENCIES)[reminderFreq.index]
    const frequencyText = Object.values(REMINDER_FREQUENCIES)[reminderFreq.index]

    const noteContent = createContactNote(
      name,
      category.value,
      frequencyText,
      reminderFreqKey
    )

    const filename = DataStore.newNoteWithContent(
      noteContent,
      SETTINGS.dataFolder,
      `${name.replace(/[\/\\:*?"<>|]/g, "")}.md`
    )

    console.log(`✅ Contact created: ${filename}`)
    scheduleNextReminder(name, reminderFreqKey, filename)

    await CommandBar.prompt(
      "Contact created!",
      `${name} has been added to your CRM`,
      ["OK"]
    )
    
    // Se la dashboard è aperta aggiornala, altrimenti non fa nulla
    await refreshDashboardIfOpen()
  } catch (error) {
    console.log(`❌ Error creating contact: ${error.message}`)
  }
}

async function showCRMDashboard() {
  try {
    console.log(`📊 Loading CRM Dashboard...`)
    const contacts = await getRelationships()
    const html = getCRMDashboardHTML(contacts)

    await HTMLView.showInMainWindow(html, "CRM Dashboard", {
      customId: WINDOW_ID,
      icon: "users",
      iconColor: "blue-500",
    })

    console.log(`✅ CRM Dashboard opened with ${contacts.length} contacts`)
  } catch (error) {
    console.log(`❌ Error showing dashboard: ${error.message}`)
  }
}

// Base function: log interaction without creating a reminder
async function logInteractionBase(contact) {
  try {
    const interactionType = await CommandBar.showOptions(
      Object.values(INTERACTION_TYPES),
      "How did you interact?"
    )

    const notes = await CommandBar.showInput(
      "Interaction notes",
      "Add notes: '%@'"
    )

    // Legge la nota direttamente senza aprirla nell'editor
    const note = DataStore.projectNoteByFilename(contact.filename)
    if (!note) {
      console.log(`❌ Could not open note: ${contact.filename}`)
      return false
    }

    const interaction = `${formatDateTime(new Date())} ${interactionType.value} - ${notes || "No notes"}`
    const interactionPosition = getSetting("crm-interaction-position", "append")
    if (interactionPosition === "prepend") {
      // Inserisce dopo l'intestazione "## Interactions" se esiste, altrimenti in cima
      const interactionsHeading = note.paragraphs.find(
        p => p.type === "title" && p.content.trim() === "Interactions"
      )
      if (interactionsHeading) {
        note.insertParagraph(interaction, interactionsHeading.lineIndex + 1, "list")
      } else {
        note.prependParagraph(interaction, "list")
      }
    } else {
      note.appendParagraph(interaction, "list")
    }

    for (const p of note.paragraphs) {
      if (p.content.includes("**Last Contact**")) {
        p.content = `**Last Contact**: ${formatDate(new Date())}`
        note.updateParagraph(p)
        break
      }
    }

    return true
  } catch (error) {
    console.log(`❌ Error logging interaction: ${error.message}`)
    return false
  }
}

// Command 1: Log interaction only (no reminder)
async function addInteraction() {
  try {
    const contacts = await getRelationships()
    if (contacts.length === 0) {
      await CommandBar.prompt("No contacts", "Create a Contact first.", ["OK"])
      return
    }

    const contactChoice = await CommandBar.showOptions(
      contacts.map((c) => c.name),
      "Select contact"
    )
    const contact = contacts[contactChoice.index]

    const success = await logInteractionBase(contact)
    if (!success) return

    await CommandBar.prompt(
      "Interaction logged!",
      `Added interaction for ${contact.name}`,
      ["OK"]
    )

    // ✅ Naviga alla nota del contatto solo se la preferenza è abilitata
    const navigateAfterInteraction = getSetting("crm-navigate-after-interaction", "true")
    if (navigateAfterInteraction !== "false") {
      await Editor.openNoteByFilename(contact.filename)
    }

    // ✅ Se la dashboard è aperta aggiornala in background senza navigarci
    await refreshDashboardIfOpen()

    console.log(`✅ Interaction logged for ${contact.name}`)
  } catch (error) {
    console.log(`❌ Error adding interaction: ${error.message}`)
  }
}

// Command 2: Log interaction AND schedule next reminder
async function logInteractionWithReminder() {
  try {
    const contacts = await getRelationships()
    if (contacts.length === 0) {
      await CommandBar.prompt("No contacts", "Create a Contact first.", ["OK"])
      return
    }

    const contactChoice = await CommandBar.showOptions(
      contacts.map((c) => c.name),
      "Select contact"
    )
    const contact = contacts[contactChoice.index]

    const success = await logInteractionBase(contact)
    if (!success) return

    // ✅ Completa il reminder del contatto per oggi
    await completeContactReminder(contact.name)

    // ✅ Crea il prossimo reminder se configurato
    console.log(`\n📋 ===== REMINDER CREATION DEBUG =====`)
    console.log(`Contact name: "${contact.name}"`)
    console.log(`Contact frequencyKey: "${contact.frequencyKey}"`)
    console.log(`Contact frequency: "${contact.frequency}"`)
    console.log(`Contact filename: "${contact.filename}"`)
    
    const hasValidFreqKey = contact.frequencyKey && contact.frequencyKey.trim() !== ""
    console.log(`Has valid frequencyKey? ${hasValidFreqKey}`)
    
    if (hasValidFreqKey) {
      try {
        const nextDate = getNextReminderDate(contact.frequencyKey)
        const reminderTitle = `Follow up with ${contact.name}`
        
        console.log(`✅ Creating reminder:`)
        console.log(`   Title: "${reminderTitle}"`)
        console.log(`   Date: ${nextDate.toString()}`)
        console.log(`   From contact file: ${contact.filename}`)
        
        scheduleCalendarReminder(reminderTitle, nextDate, contact.filename)
        console.log(`✅ REMINDER SCHEDULED`)
      } catch (reminderError) {
        console.log(`❌ ERROR creating reminder: ${reminderError.message}`)
      }
    } else {
      console.log(`❌ SKIPPED: No valid frequencyKey found`)
    }
    console.log(`📋 ===== END DEBUG =====\n`)

    await CommandBar.prompt(
      "Interaction logged!",
      `Added interaction for ${contact.name} with reminder scheduled`,
      ["OK"]
    )

    // ✅ Naviga alla nota del contatto solo se la preferenza è abilitata
    const navigateAfterInteraction = getSetting("crm-navigate-after-interaction", "true")
    if (navigateAfterInteraction !== "false") {
      await Editor.openNoteByFilename(contact.filename)
    }

    // ✅ Se la dashboard è aperta aggiornala in background senza navigarci
    await refreshDashboardIfOpen()

    console.log(`✅ Interaction logged and reminder scheduled for ${contact.name}`)
  } catch (error) {
    console.log(`❌ Error adding interaction with reminder: ${error.message}`)
  }
}

async function setReminder() {
  try {
    const contacts = await getRelationships()
    if (contacts.length === 0) {
      await CommandBar.prompt("No contacts", "Create a Contact first.", ["OK"])
      return
    }

    const contactChoice = await CommandBar.showOptions(
      contacts.map((c) => c.name),
      "Select contact to remind"
    )
    const contact = contacts[contactChoice.index]

    const reminderType = await CommandBar.showOptions(
      ["Today", "Tomorrow", "Next week", "In 2 weeks", "Next month"],
      "When do you want to connect?"
    )

    const offsetDays = [0, 1, 7, 14, 30]
    const reminderDate = new Date()
    reminderDate.setDate(reminderDate.getDate() + offsetDays[reminderType.index])

    const reminderText = await CommandBar.showInput(
      "What's the reminder?",
      "Reminder: '%@'"
    )

    scheduleCalendarReminder(
      `${contact.name}: ${reminderText || "Follow up"}`,
      reminderDate,
      contact.filename
    )

    await CommandBar.prompt(
      "Reminder set!",
      `Reminder for ${contact.name} set`,
      ["OK"]
    )

    await refreshDashboard()

    console.log(`✅ Reminder set for ${contact.name}`)
  } catch (error) {
    console.log(`❌ Error setting reminder: ${error.message}`)
  }
}

async function updateSettings() {
  try {
    const currentTag =
      getSetting("crm-relationship-tag", SETTINGS.relationshipTag)

    const tag = await CommandBar.showInput(
      "Relationship tag prefix",
      "Update tag to '%@'",
      currentTag
    )

    if (tag) {
      DataStore.setPreference("crm-relationship-tag", tag)
    const s = DataStore.settings || {}; s["crm-relationship-tag"] = tag; DataStore.settings = s
    }

    // Impostazione navigazione dopo interazione
    const navigateChoice = await CommandBar.showOptions(
      ["✅ Yes – open contact note after logging interaction", "🚫 No – stay in current context"],
      "After logging an interaction, open the contact note?"
    )
    const navVal = navigateChoice.index === 0 ? "true" : "false"
    DataStore.setPreference("crm-navigate-after-interaction", navVal)
    { const s = DataStore.settings || {}; s["crm-navigate-after-interaction"] = navVal; DataStore.settings = s }

    // Impostazione formato data/ora interazione
    const datetimeChoice = await CommandBar.showOptions(
      ["📅 Date only  (e.g. 2026-03-31)", "🕐 Date + time  (e.g. 2026-03-31 | 09:52)"],
      "Interaction timestamp format"
    )
    const dtVal = datetimeChoice.index === 0 ? "false" : "true"
    DataStore.setPreference("crm-interaction-datetime", dtVal)
    { const s = DataStore.settings || {}; s["crm-interaction-datetime"] = dtVal; DataStore.settings = s }

    // Impostazione posizione interazione nella nota
    const positionChoice = await CommandBar.showOptions(
      ["⬇️ Append – newest at the bottom", "⬆️ Prepend – newest at the top"],
      "Where to add new interactions in the contact note?"
    )
    const posVal = positionChoice.index === 0 ? "append" : "prepend"
    DataStore.setPreference("crm-interaction-position", posVal)
    { const s = DataStore.settings || {}; s["crm-interaction-position"] = posVal; DataStore.settings = s }

    await refreshDashboard()
    console.log(`✅ Settings updated`)
  } catch (error) {
    console.log(`❌ Error updating settings: ${error.message}`)
  }
}

// HELPER FUNCTIONS

async function getRelationships() {
  try {
    // 🔑 FIX: Ignora la ricerca per tag e usa SOLO la cartella @CRM
    // Questo evita di leggere note che contengono "contact" ma non sono contatti
    
    const folderNotes = DataStore.projectNotes.filter(
      (n) => n.filename && n.filename.startsWith(SETTINGS.dataFolder + "/")
    )
    
    console.log(`📂 Found ${folderNotes.length} notes in ${SETTINGS.dataFolder}`)

    const relationships = folderNotes
      .map((note) => {
        // Verifica che sia un contatto valido (abbia il tag #contact/)
        if (!note.content.includes("#contact/")) {
          console.log(`⚠️ Skipping ${note.title}: no #contact/ tag`)
          return null
        }
        
        const rel = parseContactNote(note)
        if (!rel) {
          console.log(`⚠️ Could not parse contact from ${note.title}`)
          return null
        }
        
        const contact = { name: note.title, filename: note.filename, ...rel }
        console.log(`✅ Loaded contact: ${contact.name} | frequency: ${contact.frequency} | frequencyKey: ${contact.frequencyKey}`)
        return contact
      })
      .filter(Boolean)

    console.log(`✅ Loaded ${relationships.length} valid contacts`)
    return relationships
  } catch (error) {
    console.log(`❌ Error getting relationships: ${error.message}`)
    return []
  }
}

function parseContactNote(note) {
  try {
    const content = note.content
    let category = ""
    let frequency = ""
    let frequencyKey = ""
    let lastContact = ""

    const categoryMatch = content.match(/\*\*Category\*\*:\s*(.+)/i)
    if (categoryMatch) category = categoryMatch[1].trim()

    // 🔑 FIX: Cercare ENTRAMBI i formati: "**Frequency**" e "**Reminder Frequency**"
    let frequencyMatch = content.match(/\*\*Frequency\*\*:\s*(.+)/i)
    if (!frequencyMatch) {
      frequencyMatch = content.match(/\*\*Reminder Frequency\*\*:\s*(.+)/i)
    }
    if (frequencyMatch) frequency = frequencyMatch[1].trim()

    // 🔑 FIX: Cercare ENTRAMBI i formati: "**Last Contact**" e "**Reminder Frequency Key**"
    let lastContactMatch = content.match(/\*\*Last Contact\*\*:\s*(.+)/i)
    if (lastContactMatch) lastContact = lastContactMatch[1].trim()

    console.log(`🔍 Parsing "${note.title}":`)
    console.log(`   Raw frequency text: "${frequency}"`)
    
    // Estrai la chiave della frequenza dai valori
    console.log(`   Checking against REMINDER_FREQUENCIES:`)
    for (const [key, value] of Object.entries(REMINDER_FREQUENCIES)) {
      console.log(`      ${key}: "${value}" === "${frequency}" ? ${value === frequency}`)
      if (value === frequency) {
        frequencyKey = key
        console.log(`      ✅ MATCHED! frequencyKey = "${key}"`)
        break
      }
    }

    // 🔑 FALLBACK: Se non trova la frequenza, prova a cercare la chiave direttamente
    if (!frequencyKey) {
      const keyMatch = content.match(/\*\*Reminder Frequency Key\*\*:\s*(.+)/i)
      if (keyMatch) {
        frequencyKey = keyMatch[1].trim()
        console.log(`   ✅ Found frequencyKey directly from "Reminder Frequency Key": "${frequencyKey}"`)
      } else {
        console.log(`   ❌ NO MATCH FOUND for "${frequency}"`)
      }
    }

    return {
      category,
      frequency,
      frequencyKey,
      lastContact,
    }
  } catch (error) {
    console.log(`⚠️ Error parsing contact note: ${error.message}`)
    return null
  }
}

function createContactNote(name, category, frequency, frequencyKey) {
  return `# ${name}

#contact/${category}

**Category**: ${category}
**Frequency**: ${frequency}
**Last Contact**: Never

## Interactions
`
}

function scheduleCalendarReminder(title, date, noteFilename) {
  try {
    const item = CalendarItem.create(
      title, date, null, "reminder", false, "", false,
      `From CRM: ${noteFilename}`
    )
    const created = Calendar.add(item)
    if (created) {
      console.log(`✅ Calendar reminder created: ${title}`)
    } else {
      console.log(`❌ Failed to create reminder: ${title}`)
    }
  } catch (error) {
    console.log(`❌ Error scheduling reminder: ${error.message}`)
  }
}

function scheduleNextReminder(contactName, frequencyKey, noteFilename) {
  const date = getNextReminderDate(frequencyKey)
  const filename = noteFilename || `${SETTINGS.dataFolder}/${contactName}.md`
  scheduleCalendarReminder(`Follow up with ${contactName}`, date, filename)
}

async function completeContactReminder(contactName) {
  try {
    // Cerca in un range ampio: da 2 anni fa a 2 anni nel futuro
    // In modo da completare qualsiasi reminder del contatto, anche quelli futuri
    const from = new Date()
    from.setFullYear(from.getFullYear() - 2)
    const to = new Date()
    to.setFullYear(to.getFullYear() + 2)

    const allReminders = await Calendar.remindersBetween(from, to, '')
    
    const contactReminders = allReminders.filter((r) =>
      r.title.toLowerCase().includes(contactName.toLowerCase()) &&
      !r.isCompleted
    )

    let completedCount = 0
    for (const reminder of contactReminders) {
      reminder.isCompleted = true
      await Calendar.update(reminder)
      completedCount++
      console.log(`✅ Completed reminder: ${reminder.title}`)
    }

    if (completedCount === 0) {
      console.log(`ℹ️ No pending reminders found for ${contactName}`)
    } else {
      console.log(`✅ Completed ${completedCount} reminder(s) for ${contactName}`)
    }
  } catch (error) {
    console.log(`⚠️ Could not complete reminder: ${error.message}`)
  }
}

async function refreshDashboard() {
  try {
    console.log(`🔄 Refreshing dashboard...`)
    const contacts = await getRelationships()
    const html = getCRMDashboardHTML(contacts)
    
    await HTMLView.showInMainWindow(html, "CRM Dashboard", {
      customId: WINDOW_ID,
      icon: "users",
      iconColor: "blue-500",
    })
    
    console.log(`✅ Dashboard refreshed`)
  } catch (error) {
    console.log(`⚠️ Could not refresh dashboard: ${error.message}`)
  }
}

// Aggiorna la dashboard solo se è già aperta, senza navigarci
async function refreshDashboardIfOpen() {
  try {
    const dashWindow = NotePlan.htmlWindows.find(w => w.customId === WINDOW_ID)
    if (!dashWindow) {
      console.log(`ℹ️ Dashboard not open, skipping refresh`)
      return
    }
    console.log(`🔄 Dashboard is open, refreshing in place...`)
    const contacts = await getRelationships()
    const contactsJSON = JSON.stringify(contacts || [])
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
    await dashWindow.runJavaScript(
      "if (typeof updateContacts === 'function') { updateContacts(" + contactsJSON + "); }"
    )
    console.log(`✅ Dashboard refreshed in place`)
  } catch (error) {
    console.log(`⚠️ Could not refresh dashboard in place: ${error.message}`)
  }
}

function getNextReminderDate(frequencyKey) {
  const date = new Date()
  const frequencyMap = {
    day: 1,
    week: 7,
    twoWeeks: 14,
    threeWeeks: 21,
    month: 30,
    twoMonths: 60,
    quarter: 90,
    sixMonths: 180,
    year: 365,
  }
  date.setDate(date.getDate() + (frequencyMap[frequencyKey] || 30))
  return date
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateTime(date) {
  const showTime = getSetting("crm-interaction-datetime", "true") !== "false"
  const dateStr = formatDate(date)
  if (!showTime) return dateStr
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${dateStr} | ${hours}:${minutes}`
}

// CRM DASHBOARD HTML

function getCRMDashboardHTML(contacts) {
  const contactsJSON = JSON.stringify(contacts || [])
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRM Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      background-color: #fff;
      color: #333;
      padding: 20px;
    }
    @media (prefers-color-scheme: dark) {
      body { background-color: #1c1c1e; color: #f5f5f5; }
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 28px; margin-bottom: 6px; font-weight: 700; }
    .subtitle { font-size: 13px; color: #888; margin-bottom: 24px; }

    .action-buttons {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      margin-bottom: 28px;
      padding: 16px;
      background: #f5f5f7;
      border-radius: 10px;
    }
    @media (prefers-color-scheme: dark) {
      .action-buttons { background: #2c2c2e; }
    }
    
    .btn {
      padding: 10px 16px;
      background: #007AFF;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: #0051D5; }
    .btn:active { background: #003FA8; }
    
    .btn-secondary {
      background: #666;
    }
    .btn-secondary:hover { background: #555; }
    .btn-secondary:active { background: #444; }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 28px;
    }
    .stat-card {
      background: #f5f5f7;
      padding: 16px 20px;
      border-radius: 10px;
      text-align: center;
    }
    @media (prefers-color-scheme: dark) { .stat-card { background: #2c2c2e; } }
    .stat-value { font-size: 26px; font-weight: 700; color: #007AFF; }
    .stat-label { font-size: 11px; color: #888; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 16px; font-weight: 700;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #007AFF;
    }

    .list { display: flex; flex-direction: column; gap: 8px; }

    .card {
      background: #f5f5f7;
      padding: 14px 16px;
      border-radius: 8px;
      border-left: 4px solid #007AFF;
      cursor: pointer;
      transition: background 0.2s;
    }
    .card:hover { background: #ececf0; }
    @media (prefers-color-scheme: dark) {
      .card { background: #2c2c2e; }
      .card:hover { background: #3a3a3d; }
    }

    .card-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .card-meta { font-size: 12px; color: #888; display: flex; gap: 14px; flex-wrap: wrap; }

    .empty { text-align: center; color: #888; padding: 32px 20px; font-size: 14px; }
    .loading { text-align: center; padding: 20px; color: #888; }

    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }
    .filter-btn {
      padding: 5px 12px;
      border: 1.5px solid #007AFF;
      border-radius: 20px;
      background: transparent;
      color: #007AFF;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .filter-btn:hover { background: #e5f0ff; }
    .filter-btn.active { background: #007AFF; color: white; }
    @media (prefers-color-scheme: dark) {
      .filter-btn { color: #4da3ff; border-color: #4da3ff; }
      .filter-btn:hover { background: #1a2f4a; }
      .filter-btn.active { background: #4da3ff; color: #1c1c1e; }
    }
  </style>
</head>
<body>
<div class="container">

  <div class="action-buttons">
    <button class="btn" onclick="addInteractionFromDashboard()">📝 Log Interaction</button>
    <button class="btn" onclick="addInteractionWithReminderFromDashboard()">📝 + 🔔 Log & Remind</button>
    <button class="btn" onclick="addReminderFromDashboard()">⏰ Set Reminder</button>
    <button class="btn" onclick="addContactFromDashboard()">👤 Add Contact</button>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-value" id="totalContacts">—</div>
      <div class="stat-label">Contacts</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="upcomingReminders">—</div>
      <div class="stat-label">This Week</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="overdueCount">—</div>
      <div class="stat-label">Overdue</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">📅 Upcoming Reminders</div>
    <div class="list" id="reminders">
      <div class="loading">Loading…</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">👥 Contacts</div>
    <div class="filter-bar" id="categoryFilters"></div>
    <div class="list" id="contacts">
      <div class="loading">Loading…</div>
    </div>
  </div>
</div>

<script>
  // Dati iniettati dal plugin
  var CONTACTS = ${contactsJSON};
  var activeFilter = 'All';

  // ──────────────────────────────────────────────────────────────────────────
  // CATEGORY FILTER
  // ──────────────────────────────────────────────────────────────────────────

  function buildCategoryFilters() {
    var categories = ['All'];
    CONTACTS.forEach(function(c) {
      if (c.category && categories.indexOf(c.category) === -1) {
        categories.push(c.category);
      }
    });

    var bar = document.getElementById('categoryFilters');
    if (categories.length <= 1) {
      bar.style.display = 'none';
      return;
    }

    var html = '';
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var cls = cat === activeFilter ? 'filter-btn active' : 'filter-btn';
      html += '<button class="' + cls + '" data-cat="' + esc(cat) + '">'
        + esc(cat) + '</button>';
    }
    bar.innerHTML = html;

    var btns = bar.querySelectorAll('.filter-btn');
    for (var j = 0; j < btns.length; j++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          setFilter(btn.getAttribute('data-cat'));
        });
      })(btns[j]);
    }
  }

  function setFilter(category) {
    activeFilter = category;
    buildCategoryFilters();
    renderContacts();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FUNZIONI PER BUTTONS
  // ──────────────────────────────────────────────────────────────────────────

  async function addInteractionFromDashboard() {
    window.webkit.messageHandlers.jsBridge.postMessage({
      code: ${JSON.stringify(`(function() { DataStore.invokePluginCommandByName('addInteraction', 'np.crm', []); })()`)}
,
      onHandle: "onBridgeCallback",
      id: "addInteraction"
    });
  }

  async function addInteractionWithReminderFromDashboard() {
    window.webkit.messageHandlers.jsBridge.postMessage({
      code: ${JSON.stringify(`(function() { DataStore.invokePluginCommandByName('logInteractionWithReminder', 'np.crm', []); })()`)}
,
      onHandle: "onBridgeCallback",
      id: "logInteractionWithReminder"
    });
  }

  async function addReminderFromDashboard() {
    window.webkit.messageHandlers.jsBridge.postMessage({
      code: ${JSON.stringify(`(function() { DataStore.invokePluginCommandByName('setReminder', 'np.crm', []); })()`)}
,
      onHandle: "onBridgeCallback",
      id: "setReminder"
    });
  }

  async function addContactFromDashboard() {
    window.webkit.messageHandlers.jsBridge.postMessage({
      code: ${JSON.stringify(`(function() { DataStore.invokePluginCommandByName('addRelationship', 'np.crm', []); })()`)}
,
      onHandle: "onBridgeCallback",
      id: "addRelationship"
    });
  }

  function onBridgeCallback(result, id) {
    console.log('Command executed: ' + id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  function renderContacts() {
    var el = document.getElementById('contacts');
    document.getElementById('totalContacts').textContent = CONTACTS.length;

    var filtered = activeFilter === 'All'
      ? CONTACTS
      : CONTACTS.filter(function(c) { return c.category === activeFilter; });

    if (filtered.length === 0) {
      el.innerHTML = CONTACTS.length === 0
        ? '<div class="empty">No contacts yet.<br>Use "Add Contact" button to create one.</div>'
        : '<div class="empty">No contacts in category "' + esc(activeFilter) + '".</div>';
      return;
    }

    el.innerHTML = filtered.map(function(c) {
      return '<div class="card">' +
        '<div class="card-title">' + esc(c.name) + '</div>' +
        '<div class="card-meta">' +
          (c.category ? '<span>🏷️ ' + esc(c.category) + '</span>' : '') +
          '<span>📅 ' + esc(c.frequency || 'Monthly') + '</span>' +
          '<span>💬 Last: ' + esc(c.lastContact || 'Never') + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  async function renderReminders() {
    var el = document.getElementById('reminders');
    try {
      var now = new Date();
      var todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      var todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      // Overdue: dalla data più remota fino alla fine di ieri (escluso oggi)
      var pastStart = new Date(todayStart);
      pastStart.setFullYear(pastStart.getFullYear() - 2);
      var yesterdayEnd = new Date(todayStart);
      yesterdayEnd.setMilliseconds(yesterdayEnd.getMilliseconds() - 1);

      var overdueRaw = (await Calendar.remindersBetween(pastStart, yesterdayEnd, '')).filter(function(r) {
        return !r.isCompleted;
      });

      // Upcoming: da oggi incluso fino a fine settimana
      var endOfWeek = new Date(todayStart);
      endOfWeek.setDate(endOfWeek.getDate() + (6 - todayStart.getDay()));
      endOfWeek.setHours(23, 59, 59, 999);

      var upcoming = (await Calendar.remindersBetween(todayStart, endOfWeek, '')).filter(function(r) {
        return !r.isCompleted;
      });

      document.getElementById('upcomingReminders').textContent = upcoming.length;
      document.getElementById('overdueCount').textContent = overdueRaw.length;

      var html = '';

      // Mostra overdue in cima con label rossa
      if (overdueRaw.length > 0) {
        html += '<div style="font-size:11px;font-weight:700;color:#FF3B30;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">⚠️ Overdue</div>';
        html += overdueRaw.map(function(r) {
          return '<div class="card" style="border-left:3px solid #FF3B30;">' +
            '<div class="card-title">' + esc(r.title) + '</div>' +
            '<div class="card-meta"><span style="color:#FF3B30;">' + new Date(r.date).toLocaleDateString() + '</span></div>' +
          '</div>';
        }).join('');
      }

      // Mostra upcoming
      if (upcoming.length > 0) {
        if (overdueRaw.length > 0) {
          html += '<div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin:12px 0 6px;">📅 This week</div>';
        }
        html += upcoming.map(function(r) {
          return '<div class="card">' +
            '<div class="card-title">' + esc(r.title) + '</div>' +
            '<div class="card-meta"><span>' + new Date(r.date).toLocaleDateString() + '</span></div>' +
          '</div>';
        }).join('');
      }

      if (html === '') {
        el.innerHTML = '<div class="empty">No reminders this week 🎉</div>';
      } else {
        el.innerHTML = html;
      }

    } catch (e) {
      el.innerHTML = '<div class="empty">Could not load reminders: ' + esc(e.message) + '</div>';
      document.getElementById('upcomingReminders').textContent = '?';
      document.getElementById('overdueCount').textContent = '?';
    }
  }

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function init() {
    buildCategoryFilters();
    renderContacts();

    if (typeof Calendar !== 'undefined') {
      await renderReminders();
    } else {
      window.addEventListener('notePlanBridgeReady', function() {
        renderReminders();
      }, { once: true });
      setTimeout(function() {
        if (typeof Calendar !== 'undefined') renderReminders();
        else {
          document.getElementById('reminders').innerHTML =
            '<div class="empty">Calendar API not available</div>';
          document.getElementById('upcomingReminders').textContent = '—';
          document.getElementById('overdueCount').textContent = '—';
        }
      }, 2500);
    }
  }

  // Chiamata dal plugin via runJavaScript per aggiornare i dati senza ricaricare la pagina
  function updateContacts(newContacts) {
    CONTACTS = newContacts;
    buildCategoryFilters();
    renderContacts();
    renderReminders();
  }

  window.addEventListener('load', init);
</script>
</body>
</html>`;
}