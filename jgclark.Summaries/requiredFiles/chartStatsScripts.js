/* eslint-disable prefer-template */

/**
 * Chart Stats – client-side script (constant logic).
 * Loaded by makeChartSummaryHTML() and called with data via initChartStats(tagData, yesNoData, tags, yesNoHabits, config).
 * Originally in chartStats.js generateClientScript(); extracted by @Cursor for @jgclark.
 * 
 * Note: this file is run as a script in the Habits and Summaries window, _so DO NOT USE TYPE ANNOTATIONS, or IMPORTs_.
 * 
 * Last updated: 2026-02-04 for v1.1.0 by @jgclark
 */

(function() {
  'use strict'

  window.initChartStats = function(tagData, yesNoData, tags, yesNoHabits, config) {
    const colors = config.colors
    // Canvas needs a real hex; plugin passes theme-based grid/axis color (fallback dark #52535B)
    const gridColor = config.chartGridColor || '#52535B'
    const axisTextColor = config.chartAxisTextColor || '#52535B'

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

    // Set initial theme for this window based on NotePlan's current theme mode
    // (mode is detected on the plugin side using the same approach as helpers/NPThemeToCSS)
    if (config && config.currentThemeMode === 'light') {
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

    /**
     * Return YYYY-MM-DD of the Monday of the week containing the given date string.
     * Week is Monday–Sunday. dateStr must be 'YYYY-MM-DD'.
     */
    function getMondayOfWeek(dateStr) {
      const d = new Date(dateStr + 'T12:00:00')
      const day = d.getDay()
      const daysSinceMonday = (day + 6) % 7
      d.setDate(d.getDate() - daysSinceMonday)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dayOfMonth = String(d.getDate()).padStart(2, '0')
      return y + '-' + m + '-' + dayOfMonth
    }

    /**
     * One dataset array per calendar week (Monday–Sunday), each with values only in that week (null elsewhere).
     * Segments are only included when the week has at least one non-zero, non-empty value.
     * If dates is missing or length differs from data, falls back to fixed 7-day chunks (still skipping all-zero weeks).
     */
    function calculatePeriodAverageSegments(data, dates, windowSize) {
      windowSize = windowSize ?? 7
      const segments = []
      const hasNonZero = (v) => v != null && !Number.isNaN(v) && Number(v) > 0

      if (!dates || dates.length !== data.length) {
        for (let periodStart = 0; periodStart < data.length; periodStart += windowSize) {
          const periodEnd = Math.min(periodStart + windowSize, data.length)
          const slice = data.slice(periodStart, periodEnd)
          if (!slice.some(hasNonZero)) continue
          const sum = slice.reduce((acc, val) => acc + (Number(val) || 0), 0)
          const avg = slice.length > 0 ? sum / slice.length : null
          const segment = new Array(data.length).fill(null)
          for (let i = periodStart; i < periodEnd; i++) segment[i] = avg
          segments.push(segment)
        }
        return segments
      }

      const weekToIndices = {}
      for (let i = 0; i < dates.length; i++) {
        const mon = getMondayOfWeek(dates[i])
        if (!weekToIndices[mon]) weekToIndices[mon] = []
        weekToIndices[mon].push(i)
      }
      const sortedMondays = Object.keys(weekToIndices).sort()
      for (const mon of sortedMondays) {
        const indices = weekToIndices[mon]
        const slice = indices.map(function(i) { return data[i] })
        if (!slice.some(hasNonZero)) continue
        const sum = slice.reduce((acc, val) => acc + (Number(val) || 0), 0)
        const avg = slice.length > 0 ? sum / slice.length : null
        const segment = new Array(data.length).fill(null)
        for (let k = 0; k < indices.length; k++) segment[indices[k]] = avg
        segments.push(segment)
      }
      return segments
    }

    function getRecentAverage(data, days) {
      days = days ?? 7
      const recentData = data.slice(-days).filter(val => val > 0)
      if (recentData.length === 0) return 0
      const sum = recentData.reduce((acc, val) => acc + val, 0)
      return sum / recentData.length
    }

    /** Average of the last 7-day period (the period containing the most recent day). */
    function getLastPeriodAverage(data, windowSize) {
      windowSize = windowSize ?? 7
      if (data.length === 0) return 0
      const lastPeriodStart = Math.floor((data.length - 1) / windowSize) * windowSize
      const slice = data.slice(lastPeriodStart)
      const sum = slice.reduce((acc, val) => acc + val, 0)
      return slice.length > 0 ? sum / slice.length : 0
    }

    const averageType = (config.averageType === 'none' || config.averageType === 'moving' || config.averageType === 'weekly')
      ? config.averageType
      : 'moving'
    const avgLineLabel = averageType === 'weekly' ? 'weekly avg' : '7-day moving avg'

    const totals = tags.map((tag, i) =>
      tagData.counts[tag].reduce((sum, val) => sum + val, 0)
    )

    tags.forEach((tag, i) => {
      let avgDisplay = ''
      let totalDisplay = ''
      const validData = tagData.counts[tag].filter(val => val > 0)
      if (isTimeTag(tag)) {
        avgDisplay = '--:--'
        if (validData.length > 0) {
          const avgValue = validData.reduce((sum, val) => sum + val, 0) / validData.length
          avgDisplay = formatTime(avgValue)
        }
        const avgValueEl = document.getElementById('avg-value-' + i)
        if (avgValueEl) {
          avgValueEl.textContent = avgDisplay
        } else {
          console.log('avg-value-[' + i + '] not found')
        }
      } else {
        avgDisplay = '0'
        if (validData.length > 0) {
          const avgValue = validData.reduce((sum, val) => sum + val, 0) / validData.length
          avgDisplay = formatToSigFigs(avgValue)
        }
        const avgValueEl = document.getElementById('avg-value-' + i)
        if (avgValueEl) {
          avgValueEl.textContent = avgDisplay
        } else {
          console.log('avg-value-' + i + ' not found')
        }
      }
      const total = totals[i]
      if (isTimeTag(tag)) {
        totalDisplay = total > 0 ? formatTime(total) : '0'
      } else {
        totalDisplay = formatToSigFigs(total)
      }
      const totalValueEl = document.getElementById('total-value-' + i)
      if (totalValueEl) {
        totalValueEl.textContent = totalDisplay
      } else {
        console.log('total-value-' + i + ' not found')
      }
      const totalLabelEl = document.getElementById('total-label-' + i)
      if (totalLabelEl) {
        totalLabelEl.textContent = 'total:'
      } else {
        console.log('total-label-' + i + ' not found')
      }
      let avg
      const avgLabel = avgLineLabel + ': '
      const avgEl = document.getElementById('avg' + i)
      if (avgEl) {
        if (averageType === 'none') {
          avgEl.textContent = '—'
        } else {
          if (averageType === 'weekly') {
            avg = getLastPeriodAverage(tagData.counts[tag])
          } else if (isTotalTag(tag)) {
            const recentData = tagData.counts[tag].slice(-7)
            const sum = recentData.reduce((acc, val) => acc + val, 0)
            avg = sum / 7
          } else {
            avg = getRecentAverage(tagData.counts[tag])
          }
          if (isTimeTag(tag)) {
            avgEl.textContent = avgLabel + formatTime(avg)
          } else {
            avgEl.textContent = avgLabel + avg.toFixed(1)
          }
        }
      } else {
        console.log('avg' + i + ' not found')
      }

      // Also show per-tag totals/averages in the chart header (unique IDs to avoid clashing with stats section)
      const headerStatAvgEl = document.getElementById('chart-header-avg-value-' + i)
      if (headerStatAvgEl) {
        headerStatAvgEl.textContent = avgDisplay
      }
      const headerStatTotalEl = document.getElementById('chart-header-total-value-' + i)
      if (headerStatTotalEl) {
        headerStatTotalEl.textContent = totalDisplay
      }
    })

    const charts = []

    tags.forEach((tag, index) => {
      const canvas = document.getElementById('chart' + index)
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const data = tagData.counts[tag]
      const avgData = averageType === 'moving'
        ? calculateMovingAverage(data)
        : null
      const avgSegments = averageType === 'weekly' ? calculatePeriodAverageSegments(data, tagData.rawDates) : null
      const nonZeroConfig = config.nonZeroTags[tag]
      const yAxisConfig = {
        beginAtZero: !nonZeroConfig,
        suggestedMin: nonZeroConfig ? nonZeroConfig.min : undefined,
        suggestedMax: nonZeroConfig ? nonZeroConfig.max : undefined
      }
      const colorIndex = index % colors.length
      const color = colors[colorIndex]

      const datasets = [
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
        }
      ]
      if (averageType === 'moving' && avgData) {
        datasets.push({
          type: 'line',
          label: avgLineLabel,
          data: avgData,
          borderColor: color.border,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3,
          order: 1
        })
      }
      if (averageType === 'weekly' && avgSegments && avgSegments.length > 0) {
        avgSegments.forEach(function(segmentData) {
          datasets.push({
            type: 'line',
            label: avgLineLabel,
            data: segmentData,
            borderColor: color.border,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0,
            order: 1
          })
        })
      }

      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: tagData.dates,
          datasets: datasets
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
                title: function(context) {
                  const dataIndex = context[0] && context[0].dataIndex
                  const titles = tagData.tooltipTitles
                  if (titles && dataIndex >= 0 && dataIndex < titles.length) return titles[dataIndex]
                  return (tagData.dates && tagData.dates[dataIndex]) || ''
                },
                label: function(context) {
                  const value = context.parsed.y
                  if (context.datasetIndex === 0) {
                    if (isTimeTag(tag) && value > 0) return tag + ': ' + formatTime(value)
                    return tag + ': ' + value.toFixed(1)
                  }
                  if (value !== null) {
                    if (isTimeTag(tag)) return avgLineLabel + ': ' + formatTime(value)
                    return avgLineLabel + ': ' + value.toFixed(1)
                  }
                  return null
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false, color: gridColor },
              ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 }, color: axisTextColor }
            },
            y: {
              ...yAxisConfig,
              ticks: {
                font: { size: 10 },
                color: axisTextColor,
                callback: function(value) {
                  if (isTimeTag(tag) && value > 0) return formatTime(value)
                  return value
                }
              },
              grid: { color: gridColor }
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
