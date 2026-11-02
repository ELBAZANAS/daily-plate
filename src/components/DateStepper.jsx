import { addDays, prettyDate, todayKey } from '../lib/dates.js'
import { Icon } from './Icon.jsx'

export const weekdayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function relative(date, today) {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  if (date === addDays(today, 1)) return 'Tomorrow'
  return prettyDate(date)
}

export function DateStepper({ date, onChange }) {
  const today = todayKey()
  return (
    <div className="date-stepper">
      <button className="icon-btn" type="button" onClick={() => onChange(addDays(date, -1))} aria-label="Previous day"><Icon name="left" /></button>
      <label className="date-label" title="Pick a date">
        <Icon name="calendar" size={16} />
        <span>{relative(date, today)}</span>
        {relative(date, today) !== prettyDate(date) && <span className="topbar-date">{prettyDate(date)}</span>}
        <input
          type="date"
          value={date}
          aria-label="Pick a date"
          onChange={(event) => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) onChange(event.target.value) }}
        />
      </label>
      <button className="icon-btn" type="button" onClick={() => onChange(addDays(date, 1))} aria-label="Next day"><Icon name="right" /></button>
      {date !== today && <button className="btn ghost small today-btn" type="button" onClick={() => onChange(today)}>Today</button>}
    </div>
  )
}
