(function () {
  'use strict';

  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
      var info = gen[key](arg);
      var value = info.value;
    } catch (error) {
      reject(error);
      return;
    }

    if (info.done) {
      resolve(value);
    } else {
      Promise.resolve(value).then(_next, _throw);
    }
  }

  function _asyncToGenerator(fn) {
    return function () {
      var self = this,
          args = arguments;
      return new Promise(function (resolve, reject) {
        var gen = fn.apply(self, args);

        function _next(value) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
        }

        function _throw(err) {
          asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
        }

        _next(undefined);
      });
    };
  }

  function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
  }

  function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return _arrayLikeToArray(arr);
  }

  function _iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
  }

  function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
  }

  function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;

    for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

    return arr2;
  }

  function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  function _createForOfIteratorHelper(o, allowArrayLike) {
    var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];

    if (!it) {
      if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
        if (it) o = it;
        var i = 0;

        var F = function () {};

        return {
          s: F,
          n: function () {
            if (i >= o.length) return {
              done: true
            };
            return {
              done: false,
              value: o[i++]
            };
          },
          e: function (e) {
            throw e;
          },
          f: F
        };
      }

      throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }

    var normalCompletion = true,
        didErr = false,
        err;
    return {
      s: function () {
        it = it.call(o);
      },
      n: function () {
        var step = it.next();
        normalCompletion = step.done;
        return step;
      },
      e: function (e) {
        didErr = true;
        err = e;
      },
      f: function () {
        try {
          if (!normalCompletion && it.return != null) it.return();
        } finally {
          if (didErr) throw err;
        }
      }
    };
  }

  // Return string with percentage value appended
  // export function percent(value, total) {
  function percent(value, total) {
    return "".concat(value, " (").concat(Math.round(value / total * 100), "%)");
  }
  function chooseOption(_x, _x2, _x3) {
    return _chooseOption.apply(this, arguments);
  }

  function _chooseOption() {
    _chooseOption = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(title, options, defaultValue) {
      var _options$index$value, _options$index;

      var _yield$CommandBar$sho, index;

      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.next = 2;
              return CommandBar.showOptions(options.map(function (option) {
                return option.label;
              }), title);

            case 2:
              _yield$CommandBar$sho = _context.sent;
              index = _yield$CommandBar$sho.index;
              return _context.abrupt("return", (_options$index$value = (_options$index = options[index]) === null || _options$index === void 0 ? void 0 : _options$index.value) !== null && _options$index$value !== void 0 ? _options$index$value : defaultValue);

            case 5:
            case "end":
              return _context.stop();
          }
        }
      }, _callee);
    }));
    return _chooseOption.apply(this, arguments);
  }

  new Date().toISOString().slice(0, 10);
  var monthsAbbrev = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function monthNameAbbrev(m) {
    return monthsAbbrev[m - 1];
  }
  function withinDateRange(testDate, fromDate, toDate) {
    return testDate >= fromDate && testDate <= toDate;
  } // Tests for the above
  // console.log(withinDateRange(unhyphenateDateString('2021-04-24'), '20210501', '20210531')) // false
  // console.log(withinDateRange(unhyphenateDateString('2021-05-01'), '20210501', '20210531')) // true
  // console.log(withinDateRange(unhyphenateDateString('2021-05-24'), '20210501', '20210531')) // true
  // console.log(withinDateRange(unhyphenateDateString('2021-05-31'), '20210501', '20210531')) // true
  // console.log(withinDateRange(unhyphenateDateString('2021-06-24'), '20210501', '20210531')) // false

  function dateStringFromCalendarFilename(filename) {
    return filename.slice(0, 8);
  }

  // Show note counts

  function showNoteCount() {
    return _showNoteCount.apply(this, arguments);
  }

  function _showNoteCount() {
    _showNoteCount = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
      var calNotes, projNotes, total, createdLastMonth, createdLastQuarter, updatedLastMonth, updatedLastQuarter, display, re;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              calNotes = DataStore.calendarNotes;
              projNotes = DataStore.projectNotes;
              total = calNotes.length + projNotes.length;
              createdLastMonth = projNotes.filter(function (n) {
                return Calendar.unitsAgoFromNow(n.createdDate, "month") < 1;
              });
              createdLastQuarter = projNotes.filter(function (n) {
                return Calendar.unitsAgoFromNow(n.createdDate, "month") < 3;
              });
              updatedLastMonth = projNotes.filter(function (n) {
                return Calendar.unitsAgoFromNow(n.changedDate, "month") < 1;
              });
              updatedLastQuarter = projNotes.filter(function (n) {
                return Calendar.unitsAgoFromNow(n.changedDate, "month") < 3;
              });
              display = ["\uD83D\uDD22 Total: ".concat(total), "\uD83D\uDCC5 Calendar notes: ".concat(calNotes.length, " (equivalent to ").concat(Math.round(calNotes.length / 36.5) / 10.0, " years)"), "\uD83D\uDEE0 Project notes: ".concat(projNotes.length), "    - created in last month: ".concat(percent(createdLastMonth.length, projNotes.length)), "    - created in last quarter: ".concat(percent(createdLastQuarter.length, projNotes.length)), "    - updated in last month: ".concat(percent(updatedLastMonth.length, projNotes.length)), "    - updated in last quarter: ".concat(percent(updatedLastQuarter.length, projNotes.length))];
              _context.next = 10;
              return CommandBar.showOptions(display, "Notes count. Select anything to copy.");

            case 10:
              re = _context.sent;

              if (re !== null) {
                Clipboard.string = display.join("\n");
              }

            case 12:
            case "end":
              return _context.stop();
          }
        }
      }, _callee);
    }));
    return _showNoteCount.apply(this, arguments);
  }

  // Show word counts etc. for currently displayed note
  function showWordCount() {
    return _showWordCount.apply(this, arguments);
  }

  function _showWordCount() {
    _showWordCount = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
      var _Editor$selectedText$, _Editor$selectedText;

      var paragraphs, note, charCount, wordCount, lineCount, mentionCount, tagCount, selectedCharCount, selectedWordCount, _Editor$selectedText$2, _Editor$selectedText2, _Editor$selectedText3, selectedLines, display, re;

      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              paragraphs = Editor.paragraphs;
              note = Editor.note;

              if (!(note == null)) {
                _context.next = 4;
                break;
              }

              return _context.abrupt("return");

            case 4:
              charCount = 0;
              wordCount = 0;
              lineCount = 0;
              mentionCount = note.mentions.length;
              tagCount = note.hashtags.length;
              paragraphs.forEach(function (p) {
                charCount += p.content.length;

                if (p.content.length > 0) {
                  var match = p.content.match(/\w+/g);

                  if (match != null) {
                    wordCount += match.length;
                  }
                }

                lineCount += 1;
              });
              selectedCharCount = (_Editor$selectedText$ = (_Editor$selectedText = Editor.selectedText) === null || _Editor$selectedText === void 0 ? void 0 : _Editor$selectedText.length) !== null && _Editor$selectedText$ !== void 0 ? _Editor$selectedText$ : 0;
              selectedWordCount = 0;

              if (selectedCharCount > 0) {
                selectedWordCount = (_Editor$selectedText$2 = (_Editor$selectedText2 = Editor.selectedText) === null || _Editor$selectedText2 === void 0 ? void 0 : (_Editor$selectedText3 = _Editor$selectedText2.match(/\w+/g)) === null || _Editor$selectedText3 === void 0 ? void 0 : _Editor$selectedText3.length) !== null && _Editor$selectedText$2 !== void 0 ? _Editor$selectedText$2 : 0;
              }

              selectedLines = Editor.selectedLinesText.length;
              display = ["Characters: ".concat(selectedCharCount > 0 ? "".concat(selectedCharCount, "/").concat(charCount) : charCount), "Words: ".concat(selectedWordCount > 0 ? "".concat(selectedWordCount, "/").concat(wordCount) : wordCount), "Lines: ".concat(selectedLines > 1 ? "".concat(selectedLines, "/").concat(lineCount) : lineCount), "Mentions: ".concat(mentionCount), "Hashtags: ".concat(tagCount)];
              _context.next = 17;
              return CommandBar.showOptions(display, "Word count. Select anything to copy.");

            case 17:
              re = _context.sent;

              if (re !== null) {
                Clipboard.string = display.join("\n");
              }

            case 19:
            case "end":
              return _context.stop();
          }
        }
      }, _callee);
    }));
    return _showWordCount.apply(this, arguments);
  }

  globalThis.showWordCount = showWordCount;

  // Shows task statistics for project notes

  function showTaskCountProjects() {
    return _showTaskCountProjects.apply(this, arguments);
  }

  function _showTaskCountProjects() {
    _showTaskCountProjects = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
      var projNotes, projNotesCount, doneTotal, openTotal, cancelledTotal, scheduledTotal, open, _i, n, closedTotal, total, display1, openSorted, openSortedTitle, i, display2, _iterator, _step, _elem$, elem, display, re, title;

      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              projNotes = DataStore.projectNotes;
              projNotesCount = projNotes.length;
              doneTotal = 0;
              openTotal = 0;
              cancelledTotal = 0;
              scheduledTotal = 0;
              open = new Map(); // track the open totals as an object
              // Count task type for a single note
              // The following stopped working for reasons I couldn't understand, so commented out.
              // const countTaskTypeInNote = function (inType) {
              //   return Editor.paragraphs.filter((p) => p.type === inType).length
              // }
              // Iterate over all project notes, counting

              _i = 0;

            case 8:
              if (!(_i < projNotesCount)) {
                _context.next = 20;
                break;
              }

              n = projNotes[_i];
              doneTotal += n.paragraphs.filter(function (p) {
                return p.type === 'done';
              }).length;
              openTotal += n.paragraphs.filter(function (p) {
                return p.type === 'open';
              }).length;
              cancelledTotal += n.paragraphs.filter(function (p) {
                return p.type === 'cancelled';
              }).length;
              scheduledTotal += n.paragraphs.filter(function (p) {
                return p.type === 'scheduled';
              }).length;
              open.set(n.title, n.paragraphs.filter(function (p) {
                return p.type === 'open';
              }).length);

              if (!(_i > 20)) {
                _context.next = 17;
                break;
              }

              return _context.abrupt("break", 20);

            case 17:
              _i += 1;
              _context.next = 8;
              break;

            case 20:
              closedTotal = doneTotal + scheduledTotal + cancelledTotal;
              total = openTotal + closedTotal;
              display1 = ["Task statistics from ".concat(projNotes.length, " project notes:  (select any to copy)"), "\t\u2705 Done: ".concat(percent(doneTotal, total), "\t\uD83D\uDEAB Cancelled: ").concat(percent(cancelledTotal, total)), "\t\u26AA\uFE0F Open: ".concat(percent(openTotal, total)), "\t\uD83D\uDCC6 Scheduled: ".concat(percent(scheduledTotal, total)), "\t\uD83D\uDCE4 Closed: ".concat(percent(closedTotal, total))]; // Now find top 5 project notes by open tasks
              // (spread operator can be used to concisely convert a Map into an array)

              openSorted = new Map(_toConsumableArray(open.entries()).sort(function (a, b) {
                return b[1] - a[1];
              }));
              openSortedTitle = [];
              i = 0;
              display2 = [];
              display2.push('Projects with most open tasks:  (select any to open)');
              _iterator = _createForOfIteratorHelper(openSorted.entries());
              _context.prev = 29;

              _iterator.s();

            case 31:
              if ((_step = _iterator.n()).done) {
                _context.next = 40;
                break;
              }

              elem = _step.value;
              i += 1;
              display2.push("\t".concat((_elem$ = elem[0]) !== null && _elem$ !== void 0 ? _elem$ : '', " (").concat(elem[1], " open)"));
              openSortedTitle.push(elem[0]);

              if (!(i >= 5)) {
                _context.next = 38;
                break;
              }

              return _context.abrupt("break", 40);

            case 38:
              _context.next = 31;
              break;

            case 40:
              _context.next = 45;
              break;

            case 42:
              _context.prev = 42;
              _context.t0 = _context["catch"](29);

              _iterator.e(_context.t0);

            case 45:
              _context.prev = 45;

              _iterator.f();

              return _context.finish(45);

            case 48:
              display = display1.concat(display2);
              _context.next = 51;
              return CommandBar.showOptions(display, 'Task stats.  (Select to open/copy)');

            case 51:
              re = _context.sent;

              if (re !== null) {
                if (re.index <= 5) {
                  // We want to copy the statistics
                  Clipboard.string = display1.join('\n');
                } else {
                  // We want to open the relevant note
                  title = openSortedTitle[re.index - 6];
                  Editor.openNoteByTitle(title);
                }
              }

            case 53:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, null, [[29, 42, 45, 48]]);
    }));
    return _showTaskCountProjects.apply(this, arguments);
  }

  // Show task counts for currently displayed note

  function showTaskCountNote() {
    return _showTaskCountNote.apply(this, arguments);
  }

  function _showTaskCountNote() {
    _showTaskCountNote = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
      var paragraphs, countParagraphs, total, display, re;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              paragraphs = Editor.paragraphs;

              countParagraphs = function countParagraphs(types) {
                return paragraphs.filter(function (p) {
                  return types.includes(p.type);
                }).length;
              };

              total = countParagraphs(["open", "done", "scheduled", "cancelled"]);
              display = ["\uD83D\uDD22 Total: ".concat(total), "\u2705 Done: ".concat(percent(countParagraphs(["done"]), total)), "\u26AA\uFE0F Open: ".concat(percent(countParagraphs(["open"]), total)), "\uD83D\uDEAB Cancelled: ".concat(percent(countParagraphs(["cancelled"]), total)), "\uD83D\uDCC6 Scheduled: ".concat(percent(countParagraphs(["scheduled"]), total)), "\uD83D\uDCE4 Closed: ".concat(percent(countParagraphs(["done", "scheduled", "cancelled"]), total))];
              _context.next = 6;
              return CommandBar.showOptions(display, "Task count. Select anything to copy.");

            case 6:
              re = _context.sent;

              if (re !== null) {
                Clipboard.string = display.join("\n");
              }

            case 8:
            case "end":
              return _context.stop();
          }
        }
      }, _callee);
    }));
    return _showTaskCountNote.apply(this, arguments);
  }

  //-----------------------------------------------------------------------------
  // User settings: TODO: move to proper preferences system, when available in NP
  var pref_folderToStore = 'Summaries'; //-----------------------------------------------------------------------------
  //-------------------------------------------------------------------------------
  // Ask user which period to cover, call main stats function, and present results

  function tagStats() {
    return _tagStats.apply(this, arguments);
  }

  function _tagStats() {
    _tagStats = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
      var todaysDate, y, m, d, period, fromDate, toDate, periodString, quarterStartMonth, _quarterStartMonth, fromDateStr, toDateStr, title, results, sortedResults, outputArray, _iterator, _step, elem, labelString, destination, todaysNote, note, existingNote, re;

      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              todaysDate = new Date(); // couldn't get const { y, m, d } = getYearMonthDate(todaysDate) to work ??

              y = todaysDate.getFullYear();
              m = todaysDate.getMonth() + 1;
              d = todaysDate.getDate(); // Ask user what time interval to do tag counts for

              _context.next = 6;
              return chooseOption("Which date interval would you like me to count hashtags for?", [{
                label: "Last Month",
                value: "lm"
              }, {
                label: "This Month (to date)",
                value: "mtd"
              }, {
                label: "Last Quarter",
                value: "lq"
              }, {
                label: "This Quarter (to date)",
                value: "qtd"
              }, {
                label: "Last Year",
                value: "ly"
              }, {
                label: "Year to date",
                value: "ytd"
              }], "mtd");

            case 6:
              period = _context.sent;
              periodString = "";
              _context.t0 = period;
              _context.next = _context.t0 === "lm" ? 11 : _context.t0 === "mtd" ? 17 : _context.t0 === "lq" ? 21 : _context.t0 === "qtd" ? 28 : _context.t0 === "ly" ? 33 : _context.t0 === "ytd" ? 37 : 41;
              break;

            case 11:
              fromDate = Calendar.dateFrom(y, m, 1, 0, 0, 0); // go to start of this month

              fromDate = Calendar.addUnitToDate(fromDate, "month", -1); // -1 month

              toDate = Calendar.addUnitToDate(fromDate, "month", 1); // + 1 month

              toDate = Calendar.addUnitToDate(toDate, "day", -1); // -1 day, to get last day of last month

              periodString = "".concat(monthNameAbbrev(fromDate.getMonth() + 1), " ").concat(y);
              return _context.abrupt("break", 41);

            case 17:
              fromDate = Calendar.dateFrom(y, m, 1, 0, 0, 0); // start of this month

              toDate = Calendar.dateFrom(y, m, d, 0, 0, 0);
              periodString = "".concat(monthNameAbbrev(m), " ").concat(y);
              return _context.abrupt("break", 41);

            case 21:
              quarterStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
              fromDate = Calendar.dateFrom(y, quarterStartMonth, 1, 0, 0, 0); // start of this quarter

              fromDate = Calendar.addUnitToDate(fromDate, "month", -3); // -1 quarter

              toDate = Calendar.addUnitToDate(fromDate, "month", 3); // +1 quarter

              toDate = Calendar.addUnitToDate(toDate, "day", -1); // -1 day, to get last day of last month

              periodString = "".concat(fromDate.getFullYear(), " Q").concat(Math.floor(fromDate.getMonth() / 3) + 1);
              return _context.abrupt("break", 41);

            case 28:
              _quarterStartMonth = Math.floor((m - 1) / 3) * 3 + 1;
              fromDate = Calendar.dateFrom(y, _quarterStartMonth, 1, 0, 0, 0); // start of this quarter

              toDate = Calendar.dateFrom(y, m, d, 0, 0, 0);
              periodString = "".concat(y, " Q").concat(Math.floor((m - 1) / 3) + 1);
              return _context.abrupt("break", 41);

            case 33:
              fromDate = Calendar.dateFrom(y - 1, 1, 1, 0, 0, 0); // start of last year

              toDate = Calendar.dateFrom(y - 1, 12, 31, 0, 0, 0); // end of last year

              periodString = "".concat(y - 1);
              return _context.abrupt("break", 41);

            case 37:
              fromDate = Calendar.dateFrom(y, 1, 1, 0, 0, 0); // start of this year

              toDate = Calendar.dateFrom(y, m, d, 0, 0, 0);
              periodString = "".concat(y);
              return _context.abrupt("break", 41);

            case 41:
              fromDateStr = fromDate.toISOString().slice(0, 10).replace(/-/g, '');
              toDateStr = toDate.toISOString().slice(0, 10).replace(/-/g, '');
              title = "".concat(periodString, " (").concat(fromDateStr, "-").concat(toDateStr, ")");
              console.log("\ntagStats: ".concat(title, ":"));
              results = calcTagStatsPeriod(fromDateStr, toDateStr);
              sortedResults = new Map(_toConsumableArray(results.entries()).sort());
              outputArray = [];
              _iterator = _createForOfIteratorHelper(sortedResults.entries());

              try {
                for (_iterator.s(); !(_step = _iterator.n()).done;) {
                  elem = _step.value;
                  outputArray.push("".concat(elem[1], "\t").concat(elem[0]));
                }
              } catch (err) {
                _iterator.e(err);
              } finally {
                _iterator.f();
              }

              labelString = "\uD83D\uDDD2 Add/update note '".concat(periodString, "' in folder '").concat(pref_folderToStore, "'");
              _context.next = 53;
              return chooseOption("Where to save the summary for ".concat(outputArray.length, " hashtags?"), [{
                // TODO: When weekly/monthly notes are made possible in NP, then add options like this
                //   label: "📅 Append to today's note",
                //   value: "today"
                // }, {
                label: labelString,
                value: "note"
              }, {
                label: "🖥 Pop-up display",
                value: "show"
              }, {
                label: "🖊 Write to console log",
                value: "log"
              }, {
                label: "❌ Cancel",
                value: "cancel"
              }], "show");

            case 53:
              destination = _context.sent;
              _context.t1 = destination;
              _context.next = _context.t1 === "today" ? 57 : _context.t1 === "note" ? 62 : _context.t1 === "log" ? 79 : _context.t1 === "cancel" ? 81 : 82;
              break;

            case 57:
              _context.next = 59;
              return DataStore.calendarNoteByDate(new Date());

            case 59:
              todaysNote = _context.sent;

              if (todaysNote === null) {
                console.log("\terror appending to today's note");
              } else {
                console.log("\tappending results to today's note (".concat(todaysNote.filename, ")")); // TODO: create two different 'title' strings to use

                todaysNote.appendParagraph("### Hashtag Counts for ".concat(title));
                todaysNote.appendParagraph(outputArray.join('\n'));
                console.log("\tappended results to today's note");
              }

              return _context.abrupt("break", 87);

            case 62:
              _context.next = 64;
              return DataStore.projectNoteByTitle(title);

            case 64:
              existingNote = _context.sent;

              if (!(existingNote === null)) {
                _context.next = 72;
                break;
              }

              _context.next = 68;
              return DataStore.newNote(title, pref_folderToStore);

            case 68:
              note = _context.sent;
              console.log("\twriting results to new note (".concat(title, ")"));
              _context.next = 74;
              break;

            case 72:
              note = existingNote;
              console.log("\twriting results to existing note (".concat(title, ")"));

            case 74:
              note.appendParagraph("");
              note.appendParagraph("### Hashtag Counts");
              note.appendParagraph(outputArray.join('\n'));
              console.log("\twritten results to note (".concat(title, ")"));
              return _context.abrupt("break", 87);

            case 79:
              console.log(outputArray.join('\n'));
              return _context.abrupt("break", 87);

            case 81:
              return _context.abrupt("break", 87);

            case 82:
              _context.next = 84;
              return CommandBar.showOptions(outputArray, "Tag counts.  (Select anything to copy)");

            case 84:
              re = _context.sent;

              if (re !== null) {
                Clipboard.string = outputArray.join('\n');
              }

              return _context.abrupt("break", 87);

            case 87:
            case "end":
              return _context.stop();
          }
        }
      }, _callee);
    }));
    return _tagStats.apply(this, arguments);
  }

  globalThis.tagStats = tagStats; //-------------------------------------------------------------------------------
  // Calculate tag statistics for daily notes of a given time period
  // Returns a Map of {tag, count}

  function calcTagStatsPeriod(fromDateStr, toDateStr) {
    // Get all daily notes that are within this time period
    var periodDailyNotes = DataStore.calendarNotes.filter(function (p) {
      return withinDateRange(dateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr);
    });

    if (periodDailyNotes.length === 0) {
      console.log('\twarning: no matching daily notes found');
      return;
    } else {
      console.log("\tfound ".concat(periodDailyNotes.length, " matching daily notes"));
    } // For each matching date, find and store the tags in Map


    var tags = new Map(); // key: tagname; value: count

    for (var i = 0; i < periodDailyNotes.length; i++) {
      var n = periodDailyNotes[i];
      var includedTags = n.hashtags; // TODO: later .mentions too?
      // console.log(`i:${i} -> ${n.hashtags.join(' / ')}`)

      for (var j = 0; j < includedTags.length; j++) {
        if (tags.has(includedTags[j])) {
          tags.set(includedTags[j], tags.get(includedTags[j]) + 1); // console.log(typeof (tags.get(includedTags[j])))
          // console.log(typeof (tags.get(includedTags[j]) +1))
        } else {
          tags.set(includedTags[j], 1);
        } // console.log(`  j:${j} ${includedTags[j]} = ${tags.get(includedTags[j])}`)

      }
    }

    return tags;
  } // function removeDateTags(content) {
  //   return content.replace(/<\d{4}-\d{2}-\d{2}/g, '').replace(/>\d{4}-\d{2}-\d{2}/g, '').trim();
  // }
  // async function sweepFile() {
  //   const type = Editor.type;
  //   const note = Editor.note;
  //   if (note == null) {
  //     return;
  //   }
  //   if (type === 'Calendar') {
  //     const todayNoteFileName = filenameDateString(new Date()) + '.' + DataStore.defaultFileExtension;
  //     if (Editor.filename == todayNoteFileName) {
  //       await CommandBar.showInput('Open a different note than today', 'OK');
  //       return;
  //     }
  //     return await sweepCalendarNote(note);
  //   } else {
  //     return await sweepProjectNote(note);
  //   }
  // }
  // const OPTIONS = [{
  //   label: '7 days',
  //   value: {
  //     num: 7,
  //     unit: 'day'
  //   }
  // }, {
  //   label: '14 days',
  //   value: {
  //     num: 14,
  //     unit: 'day'
  //   }
  // }, {
  //   label: '21 days',
  //   value: {
  //     num: 21,
  //     unit: 'day'
  //   }
  // }, {
  //   label: '1 month',
  //   value: {
  //     num: 1,
  //     unit: 'month'
  //   }
  // }, {
  //   label: '3 months',
  //   value: {
  //     num: 3,
  //     unit: 'month'
  //   }
  // }, {
  //   label: '6 months',
  //   value: {
  //     num: 6,
  //     unit: 'month'
  //   }
  // }, {
  //   label: '1 year',
  //   value: {
  //     num: 1,
  //     unit: 'year'
  //   }
  // }, {
  //   label: '❌ Cancel',
  //   value: {
  //     num: 0,
  //     unit: 'day'
  //   }
  // }];
  // const DEFAULT_OPTION = {
  //   unit: 'day',
  //   num: 0
  // };
  // /**
  //  * TODO:
  //  * 1. Add option to move all tasks silently
  //  * 2. Add option to reschedule instead of move Calendar notes
  //  * 3. Add option to change target date from "Today" to something you can choose
  //  *  */
  // async function sweepAll() {
  //   const {
  //     unit,
  //     num
  //   } = await chooseOption('🧹 Reschedule tasks to today of the last...', OPTIONS, DEFAULT_OPTION);
  //   if (num == 0) {
  //     // User canceled, return here, so no additional messages are shown
  //     await showMessage(`Cancelled! No changes made.`);
  //     return;
  //   }
  //   const afterDate = Calendar.addUnitToDate(new Date(), unit, -num);
  //   const afterDateFileName = filenameDateString(Calendar.addUnitToDate(new Date(), unit, -num));
  //   const re1 = await CommandBar.showOptions(['✅ OK', '❌ Skip'], '📙 Processing with your Project Notes first...');
  //   if (re1.index == 0) {
  //     for (const note of DataStore.projectNotes) {
  //       await sweepProjectNote(note, true, hyphenatedDateString(afterDate), false);
  //     }
  //   }
  //   const re2 = await CommandBar.showOptions(['✅ OK', '❌ Skip'], '🗓 Now processing your Daily Notes...');
  //   if (re2.index == 0) {
  //     const todayFileName = filenameDateString(new Date());
  //     const recentCalNotes = DataStore.calendarNotes.filter(note => note.filename < todayFileName && note.filename >= afterDateFileName);
  //     for (const note of recentCalNotes) {
  //       await sweepCalendarNote(note, true, false);
  //     }
  //   }
  //   await showMessage(`All Done!`);
  // }

  //-----------------------------------------------------------------------------
  globalThis.showNoteCount = showNoteCount;
  globalThis.showWordCount = showWordCount;
  globalThis.showTaskCountProjects = showTaskCountProjects;
  globalThis.showTaskCountNote = showTaskCountNote;
  globalThis.showTagCount = tagStats;

}());
