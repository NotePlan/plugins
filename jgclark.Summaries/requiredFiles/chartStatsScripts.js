/* eslint-disable prefer-template */

/**
 * Chart Stats – client-side script (constant logic).
 * Loaded by makeChartSummaryHTML() and called with data via initChartStats(tagData, yesNoData, tags, yesNoHabits, config).
 * Originally in chartStats.js generateClientScript(); extracted by @Cursor for @jgclark.
 * 
 * Note: this file is run as a script in the Habits and Summaries window, _so DO NOT USE TYPE ANNOTATIONS, or IMPORTs_.
 * 
 * Last updated: 2026-02-01 for v1.1.0 by @jgclark
 */

(function() {
  'use strict'

  window.initChartStats = function(tagData, yesNoData, tags, yesNoHabits, config) {
    const colors = config.colors

    function formatToSigFigs(num, sigFigs) {
      if (num === 0) return '0'
      sigFigs = sigFigs ?? config.significantFigures
      const magnitude = Math.floor(Math.log10(Math.abs(num)))
      const decimals = Math.max(0, sigFigs - magnitude - 1)
      const roundedNum = Number(num.toFixed(decimals))
      return roundedNum.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
      })
    }

    function formatTime(decimalHours) {
      const hours = Math.floor(decimalHours) % 24
      const minutes = Math.round((decimalHours % 1) * 60)
      return String(hours) + ':' + String(minutes).padStart(2, '0')
    }

    function isTimeTag(tag) {
      return config.timeTags.includes(tag)
    }

    function isTotalTag(tag) {
      return config.totalTags.includes(tag)
    }

    window.toggleFilters = function() {
      const content = document.getElementById('habit-filters')
      const icon = document.getElementById('filter-toggle-icon')
      content.classList.toggle('collapsed')
      icon.classList.toggle('collapsed')
      const isCollapsed = content.classList.contains('collapsed')
      localStorage.setItem('filtersCollapsed', isCollapsed ? 'true' : 'false')
    }

    function updateDays() {
      const daysInput = document.getElementById('days-input')
      if (!daysInput) {
        alert('Error: Could not find days input field')
        return
      }
      const days = parseInt(daysInput.value, 10)
      if (!isNaN(days) && days > 0 && days <= 365) {
        const pluginID = 'jgclark.Summaries'
        const command = 'chartSummaryStats'
        const url = 'noteplan://x-callback-url/runPlugin?pluginID=' + encodeURIComponent(pluginID) + '&command=' + encodeURIComponent(command) + '&arg0=' + days
        const link = document.createElement('a')
        link.href = url
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        setTimeout(function() {
          document.body.removeChild(link)
        }, 100)
      } else {
        alert('Please enter a valid number of days between 1 and 365')
      }
    }
    window.updateDays = updateDays

    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme')
    }

    const filtersCollapsed = localStorage.getItem('filtersCollapsed')
    if (filtersCollapsed === 'true') {
      const content = document.getElementById('habit-filters')
      const icon = document.getElementById('filter-toggle-icon')
      if (content) content.classList.add('collapsed')
      if (icon) icon.classList.add('collapsed')
    }

    function calculateMovingAverage(data, windowSize) {
      windowSize = windowSize ?? 7
      const result = []
      for (let i = 0; i < data.length; i++) {
        if (i < windowSize - 1) {
          result.push(null)
        } else {
          let sum = 0
          for (let j = 0; j < windowSize; j++) {
            sum += data[i - j]
          }
          result.push(sum / windowSize)
        }
      }
      return result
    }

    function getRecentAverage(data, days) {
      days = days ?? 7
      const recentData = data.slice(-days).filter(val => val > 0)
      if (recentData.length === 0) return 0
      const sum = recentData.reduce((acc, val) => acc + val, 0)
      return sum / recentData.length
    }

    const totals = tags.map((tag, i) =>
      tagData.counts[tag].reduce((sum, val) => sum + val, 0)
    )

    tags.forEach((tag, i) => {
      const validData = tagData.counts[tag].filter(val => val > 0)
      if (isTimeTag(tag)) {
        if (validData.length > 0) {
          const avgValue = validData.reduce((sum, val) => sum + val, 0) / validData.length
          document.getElementById('avg-value-' + i).textContent = formatTime(avgValue)
        } else {
          document.getElementById('avg-value-' + i).textContent = '--:--'
        }
      } else {
        if (validData.length > 0) {
          const avgValue = validData.reduce((sum, val) => sum + val, 0) / validData.length
          document.getElementById('avg-value-' + i).textContent = formatToSigFigs(avgValue)
        } else {
          document.getElementById('avg-value-' + i).textContent = '0'
        }
      }
      const total = totals[i]
      if (isTimeTag(tag)) {
        document.getElementById('total-value-' + i).textContent = total > 0 ? formatTime(total) : '0'
      } else {
        document.getElementById('total-value-' + i).textContent = formatToSigFigs(total)
      }
      let avg
      if (isTotalTag(tag)) {
        const recentData = tagData.counts[tag].slice(-7)
        const sum = recentData.reduce((acc, val) => acc + val, 0)
        avg = sum / 7
      } else {
        avg = getRecentAverage(tagData.counts[tag])
      }
      if (isTimeTag(tag)) {
        document.getElementById('avg' + i).textContent = '7-day avg: ' + formatTime(avg)
      } else {
        document.getElementById('avg' + i).textContent = '7-day avg: ' + avg.toFixed(1)
      }
    })

    const charts = []

    tags.forEach((tag, index) => {
      const ctx = document.getElementById('chart' + index).getContext('2d')
      const data = tagData.counts[tag]
      const movingAvg = calculateMovingAverage(data)
      const nonZeroConfig = config.nonZeroTags[tag]
      const yAxisConfig = {
        beginAtZero: !nonZeroConfig,
        suggestedMin: nonZeroConfig ? nonZeroConfig.min : undefined,
        suggestedMax: nonZeroConfig ? nonZeroConfig.max : undefined
      }
      const colorIndex = index % colors.length
      const color = colors[colorIndex]

      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: tagData.dates,
          datasets: [
            {
              type: 'bar',
              label: tag,
              data: data,
              backgroundColor: color.bg,
              borderColor: color.border,
              borderWidth: 1,
              barPercentage: 0.9,
              categoryPercentage: 0.95,
              order: 2
            },
            {
              type: 'line',
              label: '7-day avg',
              data: movingAvg,
              borderColor: color.border,
              backgroundColor: 'transparent',
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 4,
              tension: 0.3,
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(28, 28, 30, 0.95)',
              titleColor: '#f5f5f7',
              bodyColor: '#f5f5f7',
              borderColor: '#3a3a3c',
              borderWidth: 1,
              padding: 12,
              titleFont: { size: 13, weight: '600' },
              bodyFont: { size: 12 },
              callbacks: {
                label: function(context) {
                  const value = context.parsed.y
                  if (context.datasetIndex === 0) {
                    if (isTimeTag(tag) && value > 0) return tag + ': ' + formatTime(value)
                    return tag + ': ' + value.toFixed(1)
                  }
                  if (value !== null) {
                    if (isTimeTag(tag)) return '7-day avg: ' + formatTime(value)
                    return '7-day avg: ' + value.toFixed(1)
                  }
                  return null
                }
              }
            }
          },
          scales: {
            x: {
              // grid: { display: false, color: '#3a3a3c' },
              grid: { display: false, color: 'var(--border-color)' },
              // ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 }, color: '#98989d' }
              ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 }, color: 'var(--border-color)' }
            },
            y: {
              ...yAxisConfig,
              ticks: {
                font: { size: 10 },
                // color: '#98989d',
                color: 'var(--border-color)',
                callback: function(value) {
                  if (isTimeTag(tag) && value > 0) return formatTime(value)
                  return value
                }
              },
              // grid: { color: '#3a3a3c' }
              grid: { color: 'var(--border-color)' }
            }
          }
        }
      })
      charts.push(chart)
    })

    document.querySelectorAll('.tag-checkbox').forEach((checkbox, index) => {
      checkbox.addEventListener('change', function(e) {
        const wrapper = document.getElementById('wrapper' + index)
        const avgStat = document.getElementById('avg-stat-' + index)
        const totalStat = document.getElementById('total-stat-' + index)
        const avgSelector = document.getElementById('avg-select-' + index)
        const totalSelector = document.getElementById('total-select-' + index)
        if (e.target.checked) {
          wrapper.style.display = 'block'
          if (avgSelector.checked) avgStat.style.display = 'block'
          if (totalSelector.checked) totalStat.style.display = 'block'
        } else {
          wrapper.style.display = 'none'
          avgStat.style.display = 'none'
          totalStat.style.display = 'none'
        }
      })
    })

    document.querySelectorAll('.avg-selector').forEach((checkbox, index) => {
      checkbox.addEventListener('change', function(e) {
        const stat = document.getElementById('avg-stat-' + index)
        const tagCheckbox = document.getElementById('tag' + index)
        if (e.target.checked && tagCheckbox.checked) stat.style.display = 'block'
        else stat.style.display = 'none'
      })
    })

    document.querySelectorAll('.total-selector').forEach((checkbox, index) => {
      checkbox.addEventListener('change', function(e) {
        const stat = document.getElementById('total-stat-' + index)
        const tagCheckbox = document.getElementById('tag' + index)
        if (e.target.checked && tagCheckbox.checked) stat.style.display = 'block'
        else stat.style.display = 'none'
      })
    })

    function calculateCompletionRate(data) {
      const total = data.length
      const completed = data.filter(val => val === 1).length
      return total > 0 ? Math.round((completed / total) * 100) : 0
    }

    function calculateStreak(data) {
      let streak = 0
      for (let i = data.length - 2; i >= 0; i--) {
        if (data[i] === 1) streak++
        else break
      }
      return streak
    }

    function createYesNoHeatmapSection() {
      const row = document.getElementById('yesno-heatmap-section')
      if (!row) return

      // const row = document.createElement('div')
      // row.className = 'yesno-habit-row'

      row.innerHTML = ''
      yesNoHabits.forEach((habit, index) => {
        const data = yesNoData.counts[habit]
        const dates = yesNoData.dates
        // const yesColor = '#32d74b'
        // const noColor = '#992e2e'
        const completionRate = calculateCompletionRate(data)
        const streak = calculateStreak(data)

        // const row = document.createElement('div')
        // row.className = 'yesno-habit-row'
        // row.id = 'yesno-row-' + index

        const label = document.createElement('span')
        label.className = 'yesno-habit-label'
        label.textContent = habit
        row.appendChild(label)

        const vizContainer = document.createElement('span')
        vizContainer.className = 'yesno-habit-viz'
        const grid = document.createElement('span')
        grid.className = 'heatmap-grid'
        const dataToShow = data.slice(0, -1)
        const datesToShow = dates.slice(0, -1)
        dataToShow.forEach((value, i) => {
          const cell = document.createElement('div')
          cell.className = 'heatmap-cell ' + (value === 1 ? 'completed' : 'incomplete')
          cell.title = datesToShow[i] + ': ' + (value === 1 ? 'Completed' : 'Not completed')
          grid.appendChild(cell)
        })
        vizContainer.appendChild(grid)
        row.appendChild(vizContainer)

        const statCompletion = document.createElement('span')
        statCompletion.className = 'yesno-habit-stat-completion'
        statCompletion.textContent = completionRate + '%'
        row.appendChild(statCompletion)

        const statStreak = document.createElement('span')
        statStreak.className = 'yesno-habit-stat-streak'
        statStreak.textContent = 'Streak: ' + streak
        row.appendChild(statStreak)
        // container.appendChild(row)
      })
    }

    createYesNoHeatmapSection()
  }
})()
