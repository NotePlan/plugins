// @flow

export function getYearMonthDate(dateObj: Date): $ReadOnly<{
  year: number,
  month: number,
  date: number,
}> {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const date = dateObj.getDate();
  return { year, month, date };
}

export function hyphenatedDateString(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj);
  return `${year}-${month < 10 ? '0' : ''}${month}-${
    date < 10 ? '0' : ''
  }${date}`;
}

export function filenameDateString(dateObj: Date): string {
  const { year, month, date } = getYearMonthDate(dateObj);
  return `${year}${month < 10 ? '0' : ''}${month}${
    date < 10 ? '0' : ''
  }${date}`;
}
