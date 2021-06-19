var exports = (function (exports) {
  'use strict';

  const nowISO = () => new Date().toISOString();

  const dateTime = () => {
    const today = new Date();
    const date = hyphenatedDateString();
    const time = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`;
    return `${date} ${time}`;
  };

  function insertDate() {
    Editor.insertTextAtCursor(hyphenatedDateString());
  }
  function insertISODate() {
    Editor.insertTextAtCursor(nowISO());
  }
  function insertDateTime() {
    Editor.insertTextAtCursor(dateTime());
  }
  function insertCalendarNoteLink() {
    Editor.insertTextAtCursor(`[[${hyphenatedDateString()}]]`);
  } // From nmn.sweep

  function hyphenatedDateString(dateObj) {
    const {
      year,
      month,
      date
    } = getYearMonthDate(dateObj);
    return `${year}-${month < 10 ? '0' : ''}${month}-${date < 10 ? '0' : ''}${date}`;
  }
  function getYearMonthDate(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const date = dateObj.getDate();
    return {
      year,
      month,
      date
    };
  }

  exports.insertCalendarNoteLink = insertCalendarNoteLink;
  exports.insertDate = insertDate;
  exports.insertDateTime = insertDateTime;
  exports.insertISODate = insertISODate;

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;

}({}));
Object.assign(globalThis, exports)
