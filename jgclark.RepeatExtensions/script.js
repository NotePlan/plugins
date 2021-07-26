var exports = (function (exports) {
  'use strict';

  //-------------------------------------------------------------------------------
  // Date functions
  // @jgclark except where shown

  const RE_DATE = '\\d{4}-[01]\\d{1}-\\d{2}'; // find dates of form YYYY-MM-DD

  const RE_TIME = '[0-2]\\d{1}:[0-5]\\d{1}\\s?(?:AM|PM|am|pm)?'; // find '12:23' with optional '[ ][AM|PM|am|pm]'

  new Date().toISOString().slice(0, 10); // TODO: make a friendlier string

  new Date().toISOString().slice(0, 16);
  new Date().toLocaleString(); // @nmn
  function unhyphenateDateString(dateString) {
    return dateString.replace(/-/g, '');
  }
  function toISODateString(dateObj) {
    return dateObj.toISOString().slice(0, 10);
  }
  // console.log(withinDateRange(unhyphenateDate('2021-04-24'), '20210501', '20210531')) // false
  // console.log(withinDateRange(unhyphenateDate('2021-05-01'), '20210501', '20210531')) // true
  // console.log(withinDateRange(unhyphenateDate('2021-05-24'), '20210501', '20210531')) // true
  // console.log(withinDateRange(unhyphenateDate('2021-05-31'), '20210501', '20210531')) // true
  // console.log(withinDateRange(unhyphenateDate('2021-06-24'), '20210501', '20210531')) // false
  // Calculate an offset date, returning ISO datestring

  function calcOffsetDateStr(oldDateISO, interval) {
    // Calculate an offset date, assuming:
    // - oldDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
    // - interval is string of form nn[bdwmq], and could be negative
    // - where 'b' is weekday (i.e. Monday - Friday in English)
    // Return new date also in ISO Date format
    // v2 method, using built-in NotePlan function 'Calendar.addUnitToDate(date, type, num)'
    const newDate = calcOffsetDate(oldDateISO, interval);
    return toISODateString(newDate);
  } // Calculate an offset date, returning Date object

  function calcOffsetDate(oldDateISO, interval) {
    // Calculate an offset date, assuming:
    // - oldDateISO is type ISO Date (i.e. YYYY-MM-DD) - NB: different from JavaScript's Date type
    // - interval is string of form nn[bdwmq], and could be negative
    // - where 'b' is weekday (i.e. Monday - Friday in English)
    // Return new date as a JS Date
    // v2 method, using built-in NotePlan function 'Calendar.addUnitToDate(date, type, num)'
    const oldDate = new Date(oldDateISO);
    let daysToAdd = 0;
    let monthsToAdd = 0;
    let yearsToAdd = 0;
    const unit = interval.charAt(interval.length - 1); // get last character

    let num = Number(interval.substr(0, interval.length - 1)); // return all but last character
    // console.log("    c_o_d: old = " + oldDate + " / "  + num + " / " + unit)

    switch (unit) {
      case 'b':
        {
          // week days
          // Method from Arjen at https://stackoverflow.com/questions/279296/adding-days-to-a-date-but-excluding-weekends
          // Avoids looping, and copes with negative intervals too
          const currentDayOfWeek = oldDate.getUTCDay(); // = day of week with Sunday = 0, ..Saturday = 6

          let dayOfWeek;

          if (num < 0) {
            dayOfWeek = (currentDayOfWeek - 12) % 7;
          } else {
            dayOfWeek = (currentDayOfWeek + 6) % 7; // % = modulo operator in JSON
          }

          if (dayOfWeek === 6) {
            num--;
          }

          if (dayOfWeek === -6) {
            num++;
          } // console.log("    c_o_d b: " + currentDayOfWeek + " / " + num + " / " + dayOfWeek)


          const numWeekends = Math.trunc((num + dayOfWeek) / 5);
          daysToAdd = num + numWeekends * 2;
          break;
        }

      case 'd':
        daysToAdd = num; // need *1 otherwise treated as a string for some reason

        break;

      case 'w':
        daysToAdd = num * 7;
        break;

      case 'm':
        monthsToAdd = num;
        break;

      case 'q':
        monthsToAdd = num * 3;
        break;

      case 'y':
        yearsToAdd = num;
        break;

      default:
        console.log("\tInvalid date interval: '".concat(interval, "'"));
        break;
    }

    const newDate = daysToAdd > 0 ? Calendar.addUnitToDate(oldDate, 'day', daysToAdd) : monthsToAdd > 0 ? Calendar.addUnitToDate(oldDate, 'month', monthsToAdd) : yearsToAdd > 0 ? Calendar.addUnitToDate(oldDate, 'year', yearsToAdd) : oldDate; // if nothing else, leave date the same

    return newDate;
  }
  // console.log(`\ntesting relativeDate`)
  // console.log(`-14 -> ${relativeDateFromNumber(-14)}`)
  // console.log(`-7 -> ${relativeDateFromNumber(-7)}`)
  // console.log(`-2 -> ${relativeDateFromNumber(-2)}`)
  // console.log(`-1 -> ${relativeDateFromNumber(-1)}`)
  // console.log(`0 -> ${relativeDateFromNumber(0)}`)
  // console.log(`1 -> ${relativeDateFromNumber(1)}`)
  // console.log(`2 -> ${relativeDateFromNumber(2)}`)
  // console.log(`7 -> ${relativeDateFromNumber(7)}`)
  // console.log(`14 -> ${relativeDateFromNumber(14)}`)
  // console.log(`29 -> ${relativeDateFromNumber(29)}`)
  // console.log(`30 -> ${relativeDateFromNumber(30)}`)
  // console.log(`31 -> ${relativeDateFromNumber(31)}`)
  // console.log(`123 -> ${relativeDateFromNumber(123)}`)
  // console.log(`264 -> ${relativeDateFromNumber(264)}`)
  // console.log(`364 -> ${relativeDateFromNumber(364)}`)
  // console.log(`365 -> ${relativeDateFromNumber(365)}`)
  // console.log(`366 -> ${relativeDateFromNumber(366)}`)
  //-------------------------------------------------------------------------------
  // Misc functions for NP

  DataStore.defaultFileExtension != null ? DataStore.defaultFileExtension : 'md'; // Pretty print range information (@EduardMe)

  //--------------------------------------------------------------------------------------------------------------------
  // Process any completed(or cancelled) tasks with my extended @repeat(..) tags,
  // and also remove the HH: MM portion of any @done(...) tasks.

  async function repeats() {
    // When interval is of the form '+2w' it will duplicate the task for 2 weeks
    // after the date is was completed.
    // When interval is of the form '2w' it will duplicate the task for 2 weeks
    // after the date the task was last due.If this can't be determined,
    // then default to the first option.
    // Valid intervals are [0-9][bdwmqy].
    // To work it relies on finding @done(YYYY-MM-DD HH:MM) tags that haven't yet been
    // shortened to @done(YYYY-MM-DD).
    // It includes cancelled tasks as well; to remove a repeat entirely, remoce
    // the @repeat tag from the task in NotePlan.
    // const RE_DUE_DATE = '\\s+>' + RE_DATE; // find ' >2021-02-23' etc.
    const RE_DUE_DATE_CAPTURE = "\\s+>(".concat(RE_DATE, ")"); // find ' >2021-02-23' and return just date part

    const RE_DATE_TIME = "".concat(RE_DATE, " ").concat(RE_TIME); // YYYY-MM-DD HH:MM[AM|PM]

    const RE_DONE_DATE_TIME = "@done\\(".concat(RE_DATE_TIME, "\\)"); // find @done(...) and return date-time part

    const RE_DONE_DATE_CAPTURE = "@done\\((".concat(RE_DATE, ")( ").concat(RE_TIME, ")\\)"); // find @done(...) and return date-time part

    const RE_EXTENDED_REPEAT = '@repeat\\(\\+?\\d+[bdwmqy]\\)'; // find @repeat()

    const RE_EXTENDED_REPEAT_CAPTURE = '@repeat\\((.*?)\\)'; // find @repeat() and return part inside brackets
    // Get current note details

    const {
      paragraphs,
      title
    } = Editor;

    if (paragraphs === null) {
      // No note open, or no paragraphs (perhaps empty note), so don't do anything.
      console.log('repeat: warning: No note open, or empty note.');
      return;
    }

    let lineCount = paragraphs.length;
    console.log("\nrepeats: from note '".concat(title, "'")); // check if the last paragraph is undefined, and if so delete it from our copy

    if (paragraphs[lineCount] === null) {
      lineCount--;
    } // work out where ## Done or ## Cancelled sections start, if present


    let doneHeaderLine = 0;
    let cancelledHeaderLine = 0;

    for (let i = 0; i < lineCount; i++) {
      const p = paragraphs[i]; // console.log(i.toString() + "/" + p.lineIndex + ": " + p.content)

      if (p.headingLevel === 2 && p.content === 'Done') {
        doneHeaderLine = i;
      }

      if (p.headingLevel === 2 && p.content === 'Cancelled') {
        cancelledHeaderLine = i;
      }
    } // console.log('  dHL = ' + doneHeaderLine + ', cHL = ' + cancelledHeaderLine);


    const endOfActive = doneHeaderLine > 0 ? doneHeaderLine : cancelledHeaderLine > 0 ? cancelledHeaderLine : lineCount;
    let n = 0;
    let line = '';
    let updatedLine = '';
    let completedDate = '';
    let completedTime = '';
    let reReturnArray = []; // Go through each line in the active part of the file

    for (n = 0; n < endOfActive; n++) {
      const p = paragraphs[n];
      line = p.content;
      updatedLine = '';
      completedDate = ''; // find lines with datetime to shorten, and capture date part of it
      // i.e. @done(YYYY-MM-DD HH:MM[AM|PM])
      // console.log("  [" + n + "] " + line)

      if (p.content.match(RE_DONE_DATE_TIME)) {
        // get completed date and time
        reReturnArray = line.match(RE_DONE_DATE_CAPTURE);
        completedDate = reReturnArray[1];
        completedTime = reReturnArray[2];
        console.log("  Found completed repeat ".concat(completedDate, "/").concat(completedTime, " in line ").concat(n));
        updatedLine = line.replace(completedTime, ''); // couldn't get a regex to work here

        p.content = updatedLine; // Send the update to the Editor

        await Editor.updateParagraph(p); // console.log('    updated Paragraph ' + p.lineIndex);
        // Test if this is one of my special extended repeats

        if (updatedLine.match(RE_EXTENDED_REPEAT)) {
          let newRepeatDate = '';
          let outline = ''; // get repeat to apply

          reReturnArray = updatedLine.match(RE_EXTENDED_REPEAT_CAPTURE);
          let dateIntervalString = reReturnArray[1];
          console.log("\tFound EXTENDED @repeat syntax: ".concat(dateIntervalString));

          if (dateIntervalString[0] === '+') {
            // New repeat date = completed date + interval
            dateIntervalString = dateIntervalString.substring(1, dateIntervalString.length);
            newRepeatDate = calcOffsetDateStr(completedDate, dateIntervalString);
            console.log("\tAdding from completed date --> ".concat(newRepeatDate)); // Remove any >date

            updatedLine = updatedLine.replace(/\s+>\d{4}-[01]\d{1}-\d{2}/, ''); // i.e. RE_DUE_DATE, but can't get regex to work with variables like this
            // console.log(`\tupdatedLine: ${  updatedLine}`)
          } else {
            var _updatedLine$match;

            // New repeat date = due date + interval
            // look for the due date(>YYYY-MM-DD)
            let dueDate = '';
            const resArray = (_updatedLine$match = updatedLine.match(RE_DUE_DATE_CAPTURE)) !== null && _updatedLine$match !== void 0 ? _updatedLine$match : [];
            console.log(resArray.length);

            if (resArray[1] != null) {
              console.log("\tmatch => ".concat(resArray[1]));
              dueDate = resArray[1]; // need to remove the old due date

              updatedLine = updatedLine.replace(">".concat(dueDate), ''); // console.log(updatedLine);
            } else {
              // but if there is no due date then treat that as today
              dueDate = completedDate; // console.log(`\tno match => use completed date ${dueDate}`)
            }

            newRepeatDate = calcOffsetDateStr(dueDate, dateIntervalString);
            console.log("\tAdding from due date --> ".concat(newRepeatDate));
          }

          outline = updatedLine.replace(/@done\(.*\)/, '').trim(); // Create and add the new repeat line ...

          if (Editor.type === 'Notes') {
            // ...either in same project note
            outline += " >".concat(newRepeatDate); // console.log(`\toutline: ${  outline}`)

            await Editor.insertParagraphAfterParagraph(outline, p, 'scheduled');
            console.log("\tInserted new para after line ".concat(p.lineIndex));
          } else {
            // ... or in the future daily note (prepend)
            // console.log('    -> ' + outline)
            const newRepeatDateShorter = unhyphenateDateString(newRepeatDate);
            const newDailyNote = await DataStore.calendarNoteByDateString(newRepeatDateShorter);

            if (newDailyNote.title != null) {
              // console.log(newDailyNote.filename)
              await newDailyNote.appendTodo(outline);
              console.log("\tInserted new repeat in daily note ".concat(newRepeatDateShorter));
            } else {
              // After a fix to future calendar note creation in r635, we shouldn't get here.
              // But just in case, we'll create new repeat in today's daily note
              outline += " >".concat(newRepeatDate);
              console.log("\toutline: ".concat(outline));
              await Editor.insertParagraphAfterParagraph(outline, p, 'scheduled');
              console.log('\tInserted new repeat in original daily note');
            }
          }
        }
      }
    }
  }

  exports.repeats = repeats;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
